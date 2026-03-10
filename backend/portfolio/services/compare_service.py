from __future__ import annotations

from typing import Any

import numpy as np
import yfinance as yf

from ..models import StockHolding, UserPortfolio

from .stock_service import _convert_price_to_inr, _to_float

try:
    from sklearn.linear_model import LinearRegression
except Exception:  # pragma: no cover - runtime fallback when sklearn isn't installed
    LinearRegression = None


TRADING_DAYS_1_MONTH = 21


def _compute_growth_pct(prices: list[float], lookback_days: int) -> float | None:
    if not prices:
        return None
    lookback_index = len(prices) - 1 - lookback_days
    if lookback_index < 0:
        lookback_index = 0
    base = prices[lookback_index]
    current = prices[-1]
    if base == 0:
        return None
    return ((current - base) / base) * 100.0


def _compute_volatility_pct(prices: list[float]) -> float | None:
    if len(prices) < 2:
        return None
    returns: list[float] = []
    for idx in range(1, len(prices)):
        previous = prices[idx - 1]
        if previous == 0:
            continue
        returns.append((prices[idx] - previous) / previous)
    if not returns:
        return None
    return float(np.std(np.array(returns), ddof=0) * 100.0)


def _predict_next_day_price(prices: list[float]) -> float | None:
    if len(prices) < 2:
        return prices[-1] if prices else None

    x_axis = np.arange(len(prices), dtype=float).reshape(-1, 1)
    y_axis = np.array(prices, dtype=float)

    if LinearRegression is not None:
        model = LinearRegression()
        model.fit(x_axis, y_axis)
        prediction = float(model.predict(np.array([[float(len(prices))]]))[0])
        return prediction

    # Fallback to least-squares linear fit when sklearn isn't available.
    slope, intercept = np.polyfit(np.arange(len(prices), dtype=float), y_axis, 1)
    return float((slope * len(prices)) + intercept)


def _weighted_average(rows: list[dict[str, Any]], field: str, weight_field: str = "weight") -> float | None:
    weighted_sum = 0.0
    weight_sum = 0.0
    for row in rows:
        value = row.get(field)
        weight = row.get(weight_field)
        if value is None or weight is None or weight <= 0:
            continue
        weighted_sum += float(value) * float(weight)
        weight_sum += float(weight)
    if weight_sum == 0:
        return None
    return weighted_sum / weight_sum


def _with_metric_aliases(metrics: dict[str, Any]) -> dict[str, Any]:
    aliased = dict(metrics)
    aliased["1_month_growth"] = metrics.get("growth_1m_pct")
    aliased["3_month_growth"] = metrics.get("growth_3m_pct")
    aliased["volatility"] = metrics.get("volatility_pct")
    aliased["dividend_yield"] = metrics.get("dividend_yield_pct")
    return aliased


def _resolve_portfolio_for_user(user: Any, identifier: Any) -> UserPortfolio:
    portfolio_qs = UserPortfolio.objects.filter(user=user)
    identifier_str = str(identifier or "").strip()
    if not identifier_str:
        raise ValueError("Portfolio identifier is required.")

    portfolio = None
    if identifier_str.isdigit():
        portfolio = portfolio_qs.filter(id=int(identifier_str)).first()
    if not portfolio:
        portfolio = portfolio_qs.filter(name__iexact=identifier_str).first()
    if not portfolio:
        raise LookupError("Portfolio not found.")
    return portfolio


def _build_stock_asset(symbol: str, stock_cache: dict[str, dict[str, Any]]) -> dict[str, Any]:
    symbol_key = str(symbol or "").strip().upper()
    if not symbol_key:
        raise ValueError("Stock symbol is required.")

    cached = stock_cache.get(symbol_key)
    if cached:
        return cached

    try:
        ticker = yf.Ticker(symbol_key)
        info = getattr(ticker, "info", None) or {}
        fast_info = getattr(ticker, "fast_info", None) or {}
    except Exception as exc:
        raise LookupError(f"Unable to fetch stock details for {symbol_key}.") from exc

    company_name = str(
        info.get("longName")
        or info.get("shortName")
        or info.get("displayName")
        or info.get("name")
        or symbol_key
    ).strip()

    currency_code = str(
        info.get("currency")
        or info.get("financialCurrency")
        or fast_info.get("currency")
        or ""
    ).strip().upper()

    try:
        history_frame = ticker.history(period="3mo")
    except Exception as exc:
        raise LookupError(f"Unable to fetch stock history for {symbol_key}.") from exc
    history: list[dict[str, Any]] = []
    close_prices: list[float] = []
    volumes: list[float] = []

    if history_frame is not None and not history_frame.empty:
        for index, row in history_frame.iterrows():
            close_native = _to_float(row.get("Close"))
            if close_native is None:
                continue
            close_price = _convert_price_to_inr(close_native, currency_code)
            if close_price is None:
                continue
            volume = _to_float(row.get("Volume")) or 0.0
            history.append(
                {
                    "date": index.strftime("%Y-%m-%d"),
                    "price": round(float(close_price), 2),
                }
            )
            close_prices.append(float(close_price))
            volumes.append(float(volume))

    current_price_native = (
        _to_float(fast_info.get("last_price"))
        or _to_float(info.get("currentPrice"))
        or _to_float(info.get("regularMarketPrice"))
        or _to_float(info.get("previousClose"))
    )
    current_price = _convert_price_to_inr(current_price_native, currency_code)
    if current_price is None and close_prices:
        current_price = close_prices[-1]

    pe_ratio = _to_float(info.get("trailingPE")) or _to_float(info.get("forwardPE"))
    eps = _to_float(info.get("trailingEps")) or _to_float(info.get("epsTrailingTwelveMonths"))
    market_cap = _to_float(info.get("marketCap"))
    dividend_yield = _to_float(info.get("dividendYield"))
    if dividend_yield is not None:
        dividend_yield = dividend_yield * 100.0 if dividend_yield <= 1 else dividend_yield
    average_volume = _to_float(info.get("averageVolume")) or _to_float(info.get("averageDailyVolume10Day"))
    if average_volume is None and volumes:
        average_volume = float(np.mean(np.array(volumes)))

    predicted_next = _predict_next_day_price(close_prices)
    growth_1m = _compute_growth_pct(close_prices, TRADING_DAYS_1_MONTH)
    growth_3m = _compute_growth_pct(close_prices, len(close_prices) - 1 if close_prices else 0)
    volatility = _compute_volatility_pct(close_prices)

    if current_price is None and not close_prices:
        raise LookupError(f"No comparable market data found for {symbol_key}.")

    history_with_growth: list[dict[str, Any]] = []
    for idx, point in enumerate(history):
        point_price = point["price"]
        lookback_index = idx - TRADING_DAYS_1_MONTH
        growth_rolling = None
        if lookback_index >= 0:
            base_price = history[lookback_index]["price"]
            if base_price not in (None, 0):
                growth_rolling = ((point_price - base_price) / base_price) * 100.0
        history_with_growth.append(
            {
                "date": point["date"],
                "price": point_price,
                "growth_1m_pct": round(growth_rolling, 2) if growth_rolling is not None else None,
            }
        )

    asset = {
        "type": "stock",
        "label": company_name or symbol_key,
        "symbol": symbol_key,
        "symbols": [symbol_key],
        "metrics": _with_metric_aliases({
            "current_price": round(current_price, 2) if current_price is not None else None,
            "predicted_next_day_price": round(predicted_next, 2) if predicted_next is not None else None,
            "growth_1m_pct": round(growth_1m, 2) if growth_1m is not None else None,
            "growth_3m_pct": round(growth_3m, 2) if growth_3m is not None else None,
            "volatility_pct": round(volatility, 2) if volatility is not None else None,
            "pe_ratio": round(pe_ratio, 2) if pe_ratio is not None else None,
            "eps": round(eps, 2) if eps is not None else None,
            "market_cap": round(market_cap, 2) if market_cap is not None else None,
            "dividend_yield_pct": round(dividend_yield, 4) if dividend_yield is not None else None,
            "average_volume": round(average_volume, 2) if average_volume is not None else None,
            "total_value": round(current_price, 2) if current_price is not None else None,
        }),
        "history": history_with_growth,
    }

    stock_cache[symbol_key] = asset
    return asset


def _aggregate_portfolio_history(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    all_dates = sorted(
        {
            point["date"]
            for component in components
            for point in component.get("asset", {}).get("history", [])
            if point.get("date")
        }
    )
    if not all_dates:
        return []

    component_price_maps: list[dict[str, Any]] = []
    for component in components:
        history = component.get("asset", {}).get("history", [])
        price_map = {point["date"]: point.get("price") for point in history}
        component_price_maps.append(
            {
                "quantity": float(component.get("quantity", 1.0) or 1.0),
                "price_map": price_map,
                "last_price": None,
            }
        )

    merged_history: list[dict[str, Any]] = []
    for date_key in all_dates:
        total_price = 0.0
        has_value = False
        for comp in component_price_maps:
            direct_price = comp["price_map"].get(date_key)
            if direct_price is not None:
                comp["last_price"] = float(direct_price)
            if comp["last_price"] is None:
                continue
            total_price += comp["last_price"] * comp["quantity"]
            has_value = True
        if has_value:
            merged_history.append({"date": date_key, "price": round(total_price, 2)})

    for idx, point in enumerate(merged_history):
        lookback_idx = idx - TRADING_DAYS_1_MONTH
        point["growth_1m_pct"] = None
        if lookback_idx >= 0:
            base = merged_history[lookback_idx]["price"]
            if base not in (None, 0):
                point["growth_1m_pct"] = round(((point["price"] - base) / base) * 100.0, 2)

    return merged_history


def _build_portfolio_asset(user: Any, identifier: Any, stock_cache: dict[str, dict[str, Any]]) -> dict[str, Any]:
    portfolio = _resolve_portfolio_for_user(user, identifier)
    holdings = list(StockHolding.objects.filter(portfolio=portfolio))
    if not holdings:
        raise LookupError("Selected portfolio has no stocks.")

    grouped: dict[str, dict[str, Any]] = {}
    for holding in holdings:
        symbol = str(holding.stock_symbol or "").strip().upper()
        if not symbol:
            continue
        item = grouped.setdefault(symbol, {"quantity": 0.0})
        item["quantity"] += float(holding.quantity or 0.0)

    if not grouped:
        raise LookupError("Selected portfolio has no valid stock symbols.")

    components: list[dict[str, Any]] = []
    metric_rows: list[dict[str, Any]] = []
    total_value = 0.0
    predicted_total = 0.0

    for symbol, row in grouped.items():
        asset = _build_stock_asset(symbol, stock_cache)
        quantity = row["quantity"] if row["quantity"] > 0 else 1.0
        current_price = asset["metrics"].get("current_price")
        predicted_price = asset["metrics"].get("predicted_next_day_price")
        weight = float(current_price or 0.0) * quantity

        if current_price is not None:
            total_value += float(current_price) * quantity
        if predicted_price is not None:
            predicted_total += float(predicted_price) * quantity

        components.append(
            {
                "symbol": symbol,
                "quantity": quantity,
                "asset": asset,
            }
        )
        metric_rows.append(
            {
                "weight": weight if weight > 0 else quantity,
                "growth_1m_pct": asset["metrics"].get("growth_1m_pct"),
                "growth_3m_pct": asset["metrics"].get("growth_3m_pct"),
                "volatility_pct": asset["metrics"].get("volatility_pct"),
                "pe_ratio": asset["metrics"].get("pe_ratio"),
                "eps": asset["metrics"].get("eps"),
                "market_cap": asset["metrics"].get("market_cap"),
                "dividend_yield_pct": asset["metrics"].get("dividend_yield_pct"),
                "average_volume": asset["metrics"].get("average_volume"),
            }
        )

    history = _aggregate_portfolio_history(components)
    history_prices = [float(point["price"]) for point in history if point.get("price") is not None]
    if not history_prices and total_value > 0:
        history_prices = [total_value]

    metrics = {
        "current_price": round(total_value, 2) if total_value > 0 else None,
        "predicted_next_day_price": round(predicted_total, 2) if predicted_total > 0 else None,
        "growth_1m_pct": round(_weighted_average(metric_rows, "growth_1m_pct"), 2)
        if _weighted_average(metric_rows, "growth_1m_pct") is not None
        else None,
        "growth_3m_pct": round(_weighted_average(metric_rows, "growth_3m_pct"), 2)
        if _weighted_average(metric_rows, "growth_3m_pct") is not None
        else None,
        "volatility_pct": round(_weighted_average(metric_rows, "volatility_pct"), 2)
        if _weighted_average(metric_rows, "volatility_pct") is not None
        else None,
        "pe_ratio": round(_weighted_average(metric_rows, "pe_ratio"), 2)
        if _weighted_average(metric_rows, "pe_ratio") is not None
        else None,
        "eps": round(_weighted_average(metric_rows, "eps"), 2)
        if _weighted_average(metric_rows, "eps") is not None
        else None,
        "market_cap": round(_weighted_average(metric_rows, "market_cap"), 2)
        if _weighted_average(metric_rows, "market_cap") is not None
        else None,
        "dividend_yield_pct": round(_weighted_average(metric_rows, "dividend_yield_pct"), 4)
        if _weighted_average(metric_rows, "dividend_yield_pct") is not None
        else None,
        "average_volume": round(_weighted_average(metric_rows, "average_volume"), 2)
        if _weighted_average(metric_rows, "average_volume") is not None
        else None,
        "total_value": round(total_value, 2) if total_value > 0 else None,
    }

    if metrics["growth_1m_pct"] is None:
        growth_1m = _compute_growth_pct(history_prices, TRADING_DAYS_1_MONTH)
        metrics["growth_1m_pct"] = round(growth_1m, 2) if growth_1m is not None else None
    if metrics["growth_3m_pct"] is None:
        growth_3m = _compute_growth_pct(history_prices, len(history_prices) - 1 if history_prices else 0)
        metrics["growth_3m_pct"] = round(growth_3m, 2) if growth_3m is not None else None
    if metrics["volatility_pct"] is None:
        volatility = _compute_volatility_pct(history_prices)
        metrics["volatility_pct"] = round(volatility, 2) if volatility is not None else None
    if metrics["predicted_next_day_price"] is None:
        predicted = _predict_next_day_price(history_prices)
        metrics["predicted_next_day_price"] = round(predicted, 2) if predicted is not None else None

    return {
        "type": "portfolio",
        "label": portfolio.name,
        "portfolio_id": portfolio.id,
        "symbols": sorted(grouped.keys()),
        "metrics": _with_metric_aliases(metrics),
        "history": history,
    }


def _build_asset_for_compare(
    user: Any,
    asset_type: str,
    asset_value: Any,
    stock_cache: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    type_key = str(asset_type or "").strip().lower()
    if type_key == "stock":
        return _build_stock_asset(str(asset_value or ""), stock_cache)
    if type_key == "portfolio":
        return _build_portfolio_asset(user, asset_value, stock_cache)
    raise ValueError("Asset type must be either 'portfolio' or 'stock'.")


def _build_trend_series(left_history: list[dict[str, Any]], right_history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    all_dates = sorted(
        {
            *(point.get("date") for point in left_history if point.get("date")),
            *(point.get("date") for point in right_history if point.get("date")),
        }
    )
    left_price_map = {point["date"]: point.get("price") for point in left_history if point.get("date")}
    left_growth_map = {point["date"]: point.get("growth_1m_pct") for point in left_history if point.get("date")}
    right_price_map = {point["date"]: point.get("price") for point in right_history if point.get("date")}
    right_growth_map = {point["date"]: point.get("growth_1m_pct") for point in right_history if point.get("date")}

    trend: list[dict[str, Any]] = []
    left_last_price = None
    right_last_price = None
    left_last_growth = None
    right_last_growth = None

    for date_key in all_dates:
        if left_price_map.get(date_key) is not None:
            left_last_price = left_price_map[date_key]
        if right_price_map.get(date_key) is not None:
            right_last_price = right_price_map[date_key]
        if left_growth_map.get(date_key) is not None:
            left_last_growth = left_growth_map[date_key]
        if right_growth_map.get(date_key) is not None:
            right_last_growth = right_growth_map[date_key]

        trend.append(
            {
                "date": date_key,
                "left_price": round(float(left_last_price), 2) if left_last_price is not None else None,
                "right_price": round(float(right_last_price), 2) if right_last_price is not None else None,
                "left_growth_1m_pct": round(float(left_last_growth), 2) if left_last_growth is not None else None,
                "right_growth_1m_pct": round(float(right_last_growth), 2) if right_last_growth is not None else None,
            }
        )

    return trend


def _build_radar_comparison(left_metrics: dict[str, Any], right_metrics: dict[str, Any]) -> list[dict[str, Any]]:
    radar_metrics = [
        ("PE Ratio", "pe_ratio"),
        ("EPS", "eps"),
        ("Dividend Yield", "dividend_yield_pct"),
        ("Volatility", "volatility_pct"),
        ("Growth", "growth_3m_pct"),
    ]
    return [
        {
            "metric": label,
            "left": left_metrics.get(key),
            "right": right_metrics.get(key),
        }
        for label, key in radar_metrics
    ]


def build_compare_response(
    user: Any,
    left_type: str,
    right_type: str,
    left_value: Any,
    right_value: Any,
) -> dict[str, Any]:
    if left_value in (None, "") or right_value in (None, ""):
        raise ValueError("Both left and right selections are required.")

    stock_cache: dict[str, dict[str, Any]] = {}
    left_asset = _build_asset_for_compare(user, left_type, left_value, stock_cache)
    right_asset = _build_asset_for_compare(user, right_type, right_value, stock_cache)

    left_metrics = left_asset.get("metrics", {})
    right_metrics = right_asset.get("metrics", {})

    response = {
        "left_asset": left_asset,
        "right_asset": right_asset,
        "trend": _build_trend_series(left_asset.get("history", []), right_asset.get("history", [])),
        "radar_comparison": _build_radar_comparison(left_metrics, right_metrics),
        "metric_table": [
            {"metric": "Current Price", "left": left_metrics.get("current_price"), "right": right_metrics.get("current_price")},
            {
                "metric": "Predicted Next Day Price",
                "left": left_metrics.get("predicted_next_day_price"),
                "right": right_metrics.get("predicted_next_day_price"),
            },
            {"metric": "1 Month Growth %", "left": left_metrics.get("growth_1m_pct"), "right": right_metrics.get("growth_1m_pct")},
            {"metric": "3 Month Growth %", "left": left_metrics.get("growth_3m_pct"), "right": right_metrics.get("growth_3m_pct")},
            {"metric": "Volatility", "left": left_metrics.get("volatility_pct"), "right": right_metrics.get("volatility_pct")},
            {"metric": "PE Ratio", "left": left_metrics.get("pe_ratio"), "right": right_metrics.get("pe_ratio")},
            {"metric": "EPS", "left": left_metrics.get("eps"), "right": right_metrics.get("eps")},
            {"metric": "Market Cap", "left": left_metrics.get("market_cap"), "right": right_metrics.get("market_cap")},
            {
                "metric": "Dividend Yield",
                "left": left_metrics.get("dividend_yield_pct"),
                "right": right_metrics.get("dividend_yield_pct"),
            },
            {"metric": "Average Volume", "left": left_metrics.get("average_volume"), "right": right_metrics.get("average_volume")},
            {"metric": "Total Value", "left": left_metrics.get("total_value"), "right": right_metrics.get("total_value")},
        ],
    }
    return response
