from django.test import TestCase
from unittest.mock import patch

from .models import StockHolding


class PortfolioStocksApiTests(TestCase):
    def setUp(self):
        self.email_header = {"HTTP_X_USER_EMAIL": "qa@example.com"}
        portfolio_response = self.client.post(
            "/api/portfolios/",
            data='{"name":"QA Portfolio"}',
            content_type="application/json",
            **self.email_header,
        )
        self.assertIn(portfolio_response.status_code, (200, 201))
        self.portfolio_id = portfolio_response.json()["id"]

    def test_add_stock_without_quantity_and_buy_price_defaults_to_one(self):
        response = self.client.post(
            f"/api/portfolios/{self.portfolio_id}/stocks/",
            data='{"stock_symbol":"AAPL","company_name":"Apple Inc."}',
            content_type="application/json",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["stock_symbol"], "AAPL")
        self.assertEqual(payload["company_name"], "Apple Inc.")
        self.assertEqual(payload["quantity"], 1.0)
        self.assertEqual(payload["buy_price"], 1.0)
        self.assertEqual(payload["total_value"], 1.0)

    def test_delete_stock_removes_record(self):
        stock = StockHolding.objects.create(
            portfolio_id=self.portfolio_id,
            stock_symbol="MSFT",
            company_name="Microsoft",
            quantity=2,
            buy_price=3,
        )

        response = self.client.delete(
            f"/api/portfolios/{self.portfolio_id}/stocks/{stock.id}/",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(StockHolding.objects.filter(id=stock.id).exists())

    def test_update_stock_endpoint_is_not_available(self):
        stock = StockHolding.objects.create(
            portfolio_id=self.portfolio_id,
            stock_symbol="GOOG",
            company_name="Google",
            quantity=1,
            buy_price=1,
        )

        response = self.client.put(
            f"/api/portfolios/{self.portfolio_id}/stocks/{stock.id}/",
            data='{"company_name":"Alphabet Inc."}',
            content_type="application/json",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 405)

    @patch(
        "portfolio.views.get_stock_metrics",
        return_value={
            "current_price": 145.5,
            "pe_ratio": 22.1,
            "discount_level_pct": 11.3,
            "opportunity_score": 42.6,
        },
    )
    def test_get_stocks_includes_live_metrics(self, _mock_metrics):
        StockHolding.objects.create(
            portfolio_id=self.portfolio_id,
            stock_symbol="AAPL",
            company_name="Apple",
            quantity=1,
            buy_price=1,
        )

        response = self.client.get(
            f"/api/portfolios/{self.portfolio_id}/stocks/",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["current_price"], 145.5)
        self.assertEqual(payload[0]["pe_ratio"], 22.1)
        self.assertEqual(payload[0]["discount_level_pct"], 11.3)
        self.assertEqual(payload[0]["opportunity_score"], 42.6)


class StockDetailApiTests(TestCase):
    def setUp(self):
        self.email_header = {"HTTP_X_USER_EMAIL": "qa@example.com"}

    @patch(
        "portfolio.views.get_stock_detail",
        return_value={
            "symbol": "AAPL",
            "company_name": "Apple Inc.",
            "current_price": 12345.67,
            "pe_ratio": 29.4,
            "historical_prices": [
                {"date": "2026-01-10", "price": 12000, "discount_level": 5.5, "opportunity_score": 40.0}
            ],
            "max_price": 12500.0,
            "min_price": 11800.0,
            "open_price": 11900.0,
            "close_price": 12300.0,
            "average_price": 12150.0,
        },
    )
    def test_stock_detail_success(self, _mock_stock_detail):
        response = self.client.get("/api/stocks/detail/AAPL/", **self.email_header)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["symbol"], "AAPL")
        self.assertEqual(payload["company_name"], "Apple Inc.")
        self.assertEqual(payload["current_price"], 12345.67)
        self.assertEqual(len(payload["historical_prices"]), 1)

    @patch(
        "portfolio.views.get_stock_detail",
        return_value={
            "symbol": "UNKNOWN",
            "company_name": "UNKNOWN",
            "current_price": None,
            "pe_ratio": None,
            "historical_prices": [],
            "max_price": None,
            "min_price": None,
            "open_price": None,
            "close_price": None,
            "average_price": None,
        },
    )
    def test_stock_detail_not_found_when_no_data(self, _mock_stock_detail):
        response = self.client.get("/api/stocks/detail/UNKNOWN/", **self.email_header)
        self.assertEqual(response.status_code, 404)


class CompareApiTests(TestCase):
    def setUp(self):
        self.email_header = {"HTTP_X_USER_EMAIL": "qa@example.com"}

    @patch(
        "portfolio.views.build_compare_response",
        return_value={
            "left_asset": {"type": "stock", "label": "Apple", "metrics": {"current_price": 100}},
            "right_asset": {"type": "stock", "label": "Microsoft", "metrics": {"current_price": 200}},
            "trend": [{"date": "2026-03-01", "left_price": 100, "right_price": 200}],
            "radar_comparison": [],
            "metric_table": [],
        },
    )
    def test_compare_success(self, _mock_compare):
        response = self.client.post(
            "/api/compare/",
            data='{"left_type":"stock","right_type":"stock","left_value":"AAPL","right_value":"MSFT"}',
            content_type="application/json",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["left_asset"]["label"], "Apple")
        self.assertEqual(payload["right_asset"]["label"], "Microsoft")
        self.assertEqual(len(payload["trend"]), 1)

    def test_compare_bad_type(self):
        response = self.client.post(
            "/api/compare/",
            data='{"left_type":"invalid","right_type":"stock","left_value":"AAPL","right_value":"MSFT"}',
            content_type="application/json",
            **self.email_header,
        )
        self.assertEqual(response.status_code, 400)

    @patch("portfolio.views.build_compare_response", side_effect=LookupError("Portfolio not found."))
    def test_compare_not_found(self, _mock_compare):
        response = self.client.post(
            "/api/compare/",
            data='{"left_type":"portfolio","right_type":"stock","left_value":"999","right_value":"MSFT"}',
            content_type="application/json",
            **self.email_header,
        )
        self.assertEqual(response.status_code, 404)


class PortfolioReportApiTests(TestCase):
    def setUp(self):
        self.email_header = {"HTTP_X_USER_EMAIL": "qa@example.com"}
        portfolio_response = self.client.post(
            "/api/portfolios/",
            data='{"name":"Income Portfolio"}',
            content_type="application/json",
            **self.email_header,
        )
        self.assertIn(portfolio_response.status_code, (200, 201))
        self.portfolio_id = portfolio_response.json()["id"]
        StockHolding.objects.create(
            portfolio_id=self.portfolio_id,
            stock_symbol="AAPL",
            company_name="Apple Inc.",
            quantity=2,
            buy_price=100,
        )

    def test_txt_report_download_for_specific_portfolio(self):
        response = self.client.post(
            "/api/reports/portfolio/",
            data=f'{{"portfolio_id": {self.portfolio_id}, "format": "txt"}}',
            content_type="application/json",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertIn('attachment; filename="portfolio-report-income-portfolio.txt"', response["Content-Disposition"])
        content = response.content.decode("utf-8")
        self.assertIn("Portfolio Name: Income Portfolio", content)
        self.assertIn("Stock Names:", content)
        self.assertIn("  - AAPL", content)
        self.assertNotIn("Investment Amount:", content)
        self.assertNotIn("Current Value:", content)
        self.assertNotIn("Profit/Loss:", content)

    def test_pdf_report_download_for_all_portfolios(self):
        response = self.client.post(
            "/api/reports/portfolio/",
            data='{"format": "pdf"}',
            content_type="application/json",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn('attachment; filename="portfolio-report-all-portfolios.pdf"', response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_report_rejects_invalid_format(self):
        response = self.client.post(
            "/api/reports/portfolio/",
            data='{"format": "csv"}',
            content_type="application/json",
            **self.email_header,
        )

        self.assertEqual(response.status_code, 400)
