from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Iterable

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from ..models import UserPortfolio


@dataclass
class HoldingReportRow:
    symbol: str


@dataclass
class PortfolioReportBlock:
    portfolio_name: str
    assets: list[HoldingReportRow]


def build_portfolio_report_blocks(portfolios: Iterable[UserPortfolio]) -> list[PortfolioReportBlock]:
    blocks: list[PortfolioReportBlock] = []
    for portfolio in portfolios:
        assets = [HoldingReportRow(symbol=stock.stock_symbol) for stock in portfolio.stocks.all()]

        blocks.append(
            PortfolioReportBlock(
                portfolio_name=portfolio.name,
                assets=assets,
            )
        )

    return blocks


def render_portfolio_report_txt(blocks: list[PortfolioReportBlock], scope_label: str) -> bytes:
    lines = [f"Portfolio Report - {scope_label}", "=" * 72, ""]

    if not blocks:
        lines.append("No portfolios found.")
    for block in blocks:
        lines.extend(
            [
                f"Portfolio Name: {block.portfolio_name}",
                "Stock Names:",
            ]
        )
        if not block.assets:
            lines.append("  - No stocks.")
        for asset in block.assets:
            lines.append(f"  - {asset.symbol}")
        lines.append("")

    return "\n".join(lines).encode("utf-8")


def render_portfolio_report_pdf(blocks: list[PortfolioReportBlock], scope_label: str) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y_position = height - 48

    def draw_line(text: str, font_name: str = "Helvetica", font_size: int = 10, gap: int = 14) -> None:
        nonlocal y_position
        if y_position < 64:
            pdf.showPage()
            y_position = height - 48
        pdf.setFont(font_name, font_size)
        pdf.drawString(40, y_position, text)
        y_position -= gap

    draw_line(f"Portfolio Report - {scope_label}", "Helvetica-Bold", 16, 22)
    draw_line("")

    if not blocks:
        draw_line("No portfolios found.")

    for block in blocks:
        draw_line(f"Portfolio Name: {block.portfolio_name}", "Helvetica-Bold", 12, 18)
        draw_line("Stock Names:", "Helvetica-Bold", 10, 16)
        if not block.assets:
            draw_line("No stocks in this portfolio.")
        for asset in block.assets:
            draw_line(asset.symbol)
        draw_line("")

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()
