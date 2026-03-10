from django.contrib import admin

from .models import StockHolding, UserPortfolio


@admin.register(UserPortfolio)
class UserPortfolioAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "created_at")
    search_fields = ("name", "user__username", "user__email")
    list_filter = ("created_at",)


@admin.register(StockHolding)
class StockHoldingAdmin(admin.ModelAdmin):
    list_display = ("id", "stock_symbol", "company_name", "portfolio", "quantity", "buy_price", "created_at")
    search_fields = ("stock_symbol", "company_name", "portfolio__name", "portfolio__user__username")
    list_filter = ("created_at",)
