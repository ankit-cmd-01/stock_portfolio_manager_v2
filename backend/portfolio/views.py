import json
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.http import HttpResponse, JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import StockHolding, UserPortfolio
from .services.btc_service import BtcForecastError, get_btc_forecast, get_btc_history
from .services.clustering_service import (
    ClusteringError,
    cluster_market_stocks,
    cluster_portfolio_stocks,
)
from .services.compare_service import build_compare_response
from .services.metals_service import MetalsDataError, get_metals_history, predict_metal_price
from .services.risk_service import RiskAnalysisError, analyze_portfolio_risk, analyze_single_stock_risk
from .services.stock_service import get_stock_detail, get_stock_metrics, search_stocks


def _parse_json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return None


def _portfolio_to_dict(portfolio):
    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "created_at": portfolio.created_at.isoformat(),
        "stock_count": portfolio.stocks.count(),
    }


def _stock_to_dict(stock, include_live_metrics=False):
    quantity = float(stock.quantity)
    buy_price = float(stock.buy_price)
    payload = {
        "id": stock.id,
        "portfolio_id": stock.portfolio_id,
        "stock_symbol": stock.stock_symbol,
        "company_name": stock.company_name,
        "quantity": quantity,
        "buy_price": buy_price,
        "total_value": quantity * buy_price,
        "created_at": stock.created_at.isoformat(),
    }
    if include_live_metrics:
        payload.update(get_stock_metrics(stock.stock_symbol))
    return payload


class HealthCheckView(View):
    def get(self, request):
        return JsonResponse({"status": "ok"}, status=200)


class ApiAuthView(View):
    def _get_user_or_error(self, request):
        if not request.user.is_authenticated:
            # Frontend fallback: use signed-in context email when Django session auth is not configured.
            user_email = (request.headers.get("X-User-Email") or "").strip().lower()
            if not user_email:
                return None, JsonResponse({"detail": "Authentication required."}, status=401)

            user_model = get_user_model()
            user, _ = user_model.objects.get_or_create(
                username=user_email,
                defaults={"email": user_email},
            )
            return user, None
        return request.user, None


@method_decorator(csrf_exempt, name="dispatch")
class PortfoliosView(ApiAuthView):
    def get(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        portfolios = UserPortfolio.objects.filter(user=user).prefetch_related("stocks")
        payload = [_portfolio_to_dict(portfolio) for portfolio in portfolios]
        return JsonResponse(payload, safe=False, status=200)

    def post(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        payload = _parse_json_body(request)
        if payload is None:
            return JsonResponse({"detail": "Invalid JSON body."}, status=400)

        name = str(payload.get("name", "")).strip()
        if not name:
            return JsonResponse({"detail": "Portfolio name is required."}, status=400)

        portfolio, created = UserPortfolio.objects.get_or_create(user=user, name=name)
        status_code = 201 if created else 200
        return JsonResponse(_portfolio_to_dict(portfolio), status=status_code)


@method_decorator(csrf_exempt, name="dispatch")
class PortfolioStocksView(ApiAuthView):
    def _get_portfolio_for_user(self, user, portfolio_id):
        return UserPortfolio.objects.filter(id=portfolio_id, user=user).first()

    def get(self, request, portfolio_id):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        portfolio = self._get_portfolio_for_user(user, portfolio_id)
        if not portfolio:
            return JsonResponse({"detail": "Portfolio not found."}, status=404)

        stocks = StockHolding.objects.filter(portfolio=portfolio)
        payload = [_stock_to_dict(stock, include_live_metrics=True) for stock in stocks]
        return JsonResponse(payload, safe=False, status=200)

    def post(self, request, portfolio_id):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        portfolio = self._get_portfolio_for_user(user, portfolio_id)
        if not portfolio:
            return JsonResponse({"detail": "Portfolio not found."}, status=404)

        payload = _parse_json_body(request)
        if payload is None:
            return JsonResponse({"detail": "Invalid JSON body."}, status=400)

        stock_symbol = str(payload.get("stock_symbol", "")).strip().upper()
        company_name = str(payload.get("company_name", "")).strip()

        if not stock_symbol or not company_name:
            return JsonResponse({"detail": "stock_symbol and company_name are required."}, status=400)

        quantity_input = payload.get("quantity", 1)
        buy_price_input = payload.get("buy_price", 1)
        if quantity_input in ("", None):
            quantity_input = 1
        if buy_price_input in ("", None):
            buy_price_input = 1

        try:
            quantity = Decimal(str(quantity_input))
            buy_price = Decimal(str(buy_price_input))
        except (InvalidOperation, TypeError):
            return JsonResponse({"detail": "quantity and buy_price must be valid numbers."}, status=400)

        if quantity <= 0 or buy_price <= 0:
            return JsonResponse({"detail": "quantity and buy_price must be greater than zero."}, status=400)

        stock = StockHolding.objects.create(
            portfolio=portfolio,
            stock_symbol=stock_symbol,
            company_name=company_name,
            quantity=quantity,
            buy_price=buy_price,
        )
        return JsonResponse(_stock_to_dict(stock), status=201)


@method_decorator(csrf_exempt, name="dispatch")
class PortfolioStockDetailView(ApiAuthView):
    def delete(self, request, portfolio_id, stock_id):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        portfolio = UserPortfolio.objects.filter(id=portfolio_id, user=user).first()
        if not portfolio:
            return JsonResponse({"detail": "Portfolio not found."}, status=404)

        stock = StockHolding.objects.filter(id=stock_id, portfolio=portfolio).first()
        if not stock:
            return JsonResponse({"detail": "Stock not found."}, status=404)

        stock.delete()
        return JsonResponse({"detail": "Stock removed successfully."}, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class StockSearchView(ApiAuthView):
    def get(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        _ = user  # user is resolved intentionally for auth/ownership consistency
        query = (request.GET.get("query") or "").strip()
        if not query:
            return JsonResponse([], safe=False, status=200)

        results = search_stocks(query)
        return JsonResponse(results, safe=False, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class StockDetailView(ApiAuthView):
    def get(self, request, symbol):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        _ = user  # user is resolved intentionally for auth/ownership consistency
        details = get_stock_detail(symbol)
        if (
            details.get("current_price") is None
            and details.get("pe_ratio") is None
            and not details.get("historical_prices")
        ):
            return JsonResponse({"detail": "Unable to fetch stock details for this symbol."}, status=404)

        return JsonResponse(details, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class CompareView(ApiAuthView):
    def post(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        payload = _parse_json_body(request)
        if payload is None:
            return JsonResponse({"detail": "Invalid JSON body."}, status=400)

        left_type = str(payload.get("left_type", "")).strip().lower()
        right_type = str(payload.get("right_type", "")).strip().lower()
        left_value = payload.get("left_value")
        right_value = payload.get("right_value")

        if left_type not in {"portfolio", "stock"} or right_type not in {"portfolio", "stock"}:
            return JsonResponse({"detail": "left_type and right_type must be 'portfolio' or 'stock'."}, status=400)

        try:
            result = build_compare_response(
                user=user,
                left_type=left_type,
                right_type=right_type,
                left_value=left_value,
                right_value=right_value,
            )
        except LookupError as exc:
            return JsonResponse({"detail": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"detail": str(exc)}, status=400)
        except Exception:
            return JsonResponse({"detail": "Unable to build comparison right now."}, status=500)

        return JsonResponse(result, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class MetalsHistoryView(ApiAuthView):
    def get(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        _ = user  # user is resolved intentionally for auth/ownership consistency
        try:
            history = get_metals_history()
        except MetalsDataError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to fetch metal history right now."}, status=500)

        return JsonResponse(history, safe=False, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class MetalsPredictView(ApiAuthView):
    def post(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        payload = _parse_json_body(request)
        if payload is None:
            return JsonResponse({"detail": "Invalid JSON body."}, status=400)

        metal = str(payload.get("metal", "")).strip().lower()
        target_date = str(payload.get("date", "")).strip()
        if not metal or not target_date:
            return JsonResponse({"detail": "metal and date are required."}, status=400)

        _ = user  # user is resolved intentionally for auth/ownership consistency
        try:
            prediction = predict_metal_price(metal=metal, target_date_text=target_date)
        except ValueError as exc:
            return JsonResponse({"detail": str(exc)}, status=400)
        except MetalsDataError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to predict metal prices right now."}, status=500)

        return JsonResponse(prediction, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class RiskPortfolioView(ApiAuthView):
    def get(self, request, portfolio_id):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        try:
            payload = analyze_portfolio_risk(user=user, portfolio_id=portfolio_id)
        except LookupError as exc:
            return JsonResponse({"detail": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"detail": str(exc)}, status=400)
        except RiskAnalysisError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to analyze portfolio risk right now."}, status=500)

        return JsonResponse(payload, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class RiskStockView(ApiAuthView):
    def get(self, request, symbol):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        _ = user  # user is resolved intentionally for auth/ownership consistency
        try:
            payload = analyze_single_stock_risk(symbol=symbol)
        except LookupError as exc:
            return JsonResponse({"detail": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"detail": str(exc)}, status=400)
        except RiskAnalysisError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to analyze stock risk right now."}, status=500)

        return JsonResponse(payload, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class ClusteringPortfolioView(ApiAuthView):
    def get(self, request, portfolio_id):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        try:
            payload = cluster_portfolio_stocks(user=user, portfolio_id=portfolio_id)
        except LookupError as exc:
            return JsonResponse({"detail": str(exc)}, status=404)
        except ValueError as exc:
            return JsonResponse({"detail": str(exc)}, status=400)
        except ClusteringError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to cluster portfolio stocks right now."}, status=500)

        return JsonResponse(payload, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class ClusteringMarketView(ApiAuthView):
    def get(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        _ = user  # user is resolved intentionally for auth/ownership consistency
        raw_symbols = str(request.GET.get("symbols", "")).strip()
        symbols = [item.strip() for item in raw_symbols.split(",") if item.strip()]
        if len(symbols) < 2:
            return JsonResponse({"detail": "Query param 'symbols' must contain at least 2 symbols."}, status=400)

        try:
            payload = cluster_market_stocks(symbols=symbols)
        except ValueError as exc:
            return JsonResponse({"detail": str(exc)}, status=400)
        except ClusteringError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to cluster market stocks right now."}, status=500)

        return JsonResponse(payload, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class BtcHistoryView(ApiAuthView):
    def get(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        _ = user  # user is resolved intentionally for auth/ownership consistency
        try:
            payload = get_btc_history()
        except BtcForecastError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to fetch BTC history right now."}, status=500)

        return JsonResponse(payload, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class BtcForecastView(ApiAuthView):
    def get(self, request):
        user, error = self._get_user_or_error(request)
        if error:
            return error

        _ = user  # user is resolved intentionally for auth/ownership consistency
        try:
            payload = get_btc_forecast()
        except BtcForecastError as exc:
            return JsonResponse({"detail": str(exc)}, status=503)
        except Exception:
            return JsonResponse({"detail": "Unable to generate BTC forecast right now."}, status=500)

        return JsonResponse(payload, status=200)


@method_decorator(csrf_exempt, name="dispatch")
class PortfolioReportView(ApiAuthView):
    def post(self, request):
        from .services.report_service import (
            build_portfolio_report_blocks,
            render_portfolio_report_pdf,
            render_portfolio_report_txt,
        )

        user, error = self._get_user_or_error(request)
        if error:
            return error

        payload = _parse_json_body(request)
        if payload is None:
            return JsonResponse({"detail": "Invalid JSON body."}, status=400)

        raw_portfolio_id = payload.get("portfolio_id")
        report_format = str(payload.get("format", "")).strip().lower()
        if report_format not in {"pdf", "txt"}:
            return JsonResponse({"detail": "format must be 'pdf' or 'txt'."}, status=400)

        portfolios = UserPortfolio.objects.filter(user=user).prefetch_related("stocks")
        scope_label = "All Portfolios"

        if raw_portfolio_id not in ("", None):
            try:
                portfolio_id = int(raw_portfolio_id)
            except (TypeError, ValueError):
                return JsonResponse({"detail": "portfolio_id must be a valid integer."}, status=400)

            portfolio = portfolios.filter(id=portfolio_id).first()
            if not portfolio:
                return JsonResponse({"detail": "Portfolio not found."}, status=404)
            portfolios = portfolios.filter(id=portfolio_id)
            scope_label = portfolio.name

        blocks = build_portfolio_report_blocks(portfolios)
        file_stub = f"portfolio-report-{scope_label.lower().replace(' ', '-')}"

        if report_format == "pdf":
            file_bytes = render_portfolio_report_pdf(blocks, scope_label)
            content_type = "application/pdf"
            extension = "pdf"
        else:
            file_bytes = render_portfolio_report_txt(blocks, scope_label)
            content_type = "text/plain; charset=utf-8"
            extension = "txt"

        response = HttpResponse(file_bytes, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{file_stub}.{extension}"'
        return response
