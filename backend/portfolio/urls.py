from django.urls import path

from .views import (
    BtcForecastView,
    BtcHistoryView,
    ClusteringMarketView,
    ClusteringPortfolioView,
    CompareView,
    HealthCheckView,
    MetalsHistoryView,
    MetalsPredictView,
    PortfolioReportView,
    PortfolioStockDetailView,
    PortfolioStocksView,
    PortfoliosView,
    RiskPortfolioView,
    RiskStockView,
    StockDetailView,
    StockSearchView,
)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("stocks/search/", StockSearchView.as_view(), name="stocks-search"),
    path("stocks/detail/<str:symbol>/", StockDetailView.as_view(), name="stock-detail"),
    path("compare/", CompareView.as_view(), name="compare"),
    path("metals/history/", MetalsHistoryView.as_view(), name="metals-history"),
    path("metals/predict/", MetalsPredictView.as_view(), name="metals-predict"),
    path("btc/history/", BtcHistoryView.as_view(), name="btc-history"),
    path("btc/forecast/", BtcForecastView.as_view(), name="btc-forecast"),
    path("risk/portfolio/<int:portfolio_id>/", RiskPortfolioView.as_view(), name="risk-portfolio"),
    path("risk/stock/<str:symbol>/", RiskStockView.as_view(), name="risk-stock"),
    path("clustering/portfolio/<int:portfolio_id>/", ClusteringPortfolioView.as_view(), name="clustering-portfolio"),
    path("clustering/market/", ClusteringMarketView.as_view(), name="clustering-market"),
    path("reports/portfolio/", PortfolioReportView.as_view(), name="portfolio-report"),
    path("portfolios/", PortfoliosView.as_view(), name="portfolios"),
    path("portfolios/<int:portfolio_id>/stocks/", PortfolioStocksView.as_view(), name="portfolio-stocks"),
    path(
        "portfolios/<int:portfolio_id>/stocks/<int:stock_id>/",
        PortfolioStockDetailView.as_view(),
        name="portfolio-stock-detail",
    ),
]
