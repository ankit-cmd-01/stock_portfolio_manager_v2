from django.conf import settings
from django.db import models


class UserPortfolio(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portfolios")
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "name")

    def __str__(self):
        return f"{self.user} - {self.name}"


class StockHolding(models.Model):
    portfolio = models.ForeignKey(UserPortfolio, on_delete=models.CASCADE, related_name="stocks")
    stock_symbol = models.CharField(max_length=20)
    company_name = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    buy_price = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.stock_symbol} ({self.portfolio.name})"
