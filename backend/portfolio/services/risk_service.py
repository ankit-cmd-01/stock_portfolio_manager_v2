from __future__ import annotations

import time
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

from ..models import StockHolding, UserPortfolio
from .stock_service import _convert_price_to_inr

try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
except Exception:  # pragma: no cover - runtime fallback when sklearn isn't installed
    LogisticRegression = None
    StandardScaler = None


HISTORY_PERIOD = "1y"
MARKET_SYMBOLS = ["^NSEI", "^GSPC"]
_CACHE_TTL_SECONDS = 600
_feature_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_market_vol_cache: tuple[float, float] | None = None

RISK_LEVELS = ("Low Risk", "Medium Risk", "High Risk")

_TEMPLATE_ROWS = [
    {"volatility": 0.0085, "average_return": 0.0011, "max_drawdown": -0.10, "momentum": 0.08, "beta": 0.70, "label": "Low Risk"},
    {"volatility": 0.0100, "average_return": 0.0008, "max_drawdown": -0.13, "momentum": 0.06, "beta": 0.82, "label": "Low Risk"},
    {"volatility": 0.0170, "average_return": 0.0003, "max_drawdown": -0.22, "momentum": 0.03, "beta": 0.98, "label": "Medium Risk"},
    {"volatility": 0.0200, "average_return": 0.0001, "max_drawdown": -0.27, "momentum": 0.01, "beta": 1.10, "label": "Medium Risk"},
    {"volatility": 0.0300, "average_return": -0.0002, "max_drawdown": -0.36, "momentum": -0.04, "beta": 1.32, "label": "High Risk"},
    {"volatility": 0.0360, "average_return": -0.0005, "max_drawdown": -0.44, "momentum": -0.09, "beta": 1.55, "label": "High Risk"},
]


class RiskAnalysisError(Exception):
    pass


def _to_float(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_series_index(series: pd.Series) -> pd.Series:
    index = pd.to_datetime(series.index)
    if getattr(index, "tz", None) is not None:
        index = index.tz_convert(None)
    normalized = series.copy()
    normalized.index = index.normalize()
    normalized = normalized[~normalized.index.duplicated(keep="last")]
    return normalized.sort_index()


def _normalize_frame_index(frame: pd.DataFrame) -> pd.DataFrame:
    index = pd.to_datetime(frame.index)
    if getattr(index, "tz", None) is not None:
        index = index.tz_convert(None)
    normalized = frame.copy()
    normalized.index = index.normalize()
    normalized = normalized[~normalized.index.duplicated(keep="last")]
    return normalized.sort_index()


def _fetch_history_frame(symbol: str) -> pd.DataFrame:
    try:
        frame = yf.Ticker(symbol).history(period=HISTORY_PERIOD)
    except Exception:
        return pd.DataFrame()

    if frame is None or frame.empty:
        return pd.DataFrame()

    return _normalize_frame_index(frame)


def _fetch_close_series(symbol: str) -> pd.Series:
    frame = _fetch_history_frame(symbol)
    if frame is None or frame.empty or "Close" not in frame:
        return pd.Series(dtype="float64")

    series = frame["Close"].dropna()
    if series.empty:
        return pd.Series(dtype="float64")
    return _normalize_series_index(series.astype(float))


def _fetch_ticker_info(symbol: str) -> dict[str, Any]:
    try:
        info = getattr(yf.Ticker(symbol), "info", None) or {}
    except Exception:
        info = {}
    return info if isinstance(info, dict) else {}


def _get_market_volatility() -> float:
    global _market_vol_cache

    now = time.time()
    if _market_vol_cache and (now - _market_vol_cache[0]) < _CACHE_TTL_SECONDS:
        return _market_vol_cache[1]

    market_vol = None
    for symbol in MARKET_SYMBOLS:
        close_prices = _fetch_close_series(symbol)
        returns = close_prices.pct_change().dropna()
        if returns.empty:
            continue
        market_vol = float(np.std(returns.to_numpy(), ddof=0))
        if market_vol > 0:
            break

    if market_vol is None or market_vol <= 0:
        market_vol = 0.012

    _market_vol_cache = (now, market_vol)
    return market_vol


def _compute_risk_score(row: dict[str, Any]) -> float:
    volatility = float(row["volatility"])
    average_return = float(row["average_return"])
    drawdown = abs(float(row["max_drawdown"]))
    momentum = float(row["momentum"])
    beta = float(row["beta"])
    return (
        (volatility * 4.6)
        + (drawdown * 2.8)
        + (max(beta - 1.0, 0.0) * 1.1)
        - (average_return * 2.2)
        - (momentum * 1.3)
    )


def _feature_vector(row: dict[str, Any]) -> list[float]:
    return [
        float(row["volatility"]),
        float(row["average_return"]),
        float(row["max_drawdown"]),
        float(row["momentum"]),
        float(row["beta"]),
    ]


def _normalize_growth_percent(value: Any) -> float | None:
    parsed = _to_float(value)
    if parsed is None:
        return None
    return parsed * 100.0 if abs(parsed) <= 1.0 else parsed


def _compute_period_return(close_prices: pd.Series, lookback_days: int) -> float | None:
    if close_prices.empty or len(close_prices) < 2:
        return None
    index = max(0, len(close_prices) - 1 - max(lookback_days, 1))
    base = float(close_prices.iloc[index])
    latest = float(close_prices.iloc[-1])
    if base == 0:
        return None
    return (latest - base) / base


def _compute_rsi(close_prices: pd.Series, period: int = 14) -> float | None:
    if close_prices.empty or len(close_prices) <= period:
        return None

    delta = close_prices.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.rolling(window=period, min_periods=period).mean()
    avg_loss = losses.rolling(window=period, min_periods=period).mean()
    latest_avg_gain = _to_float(avg_gain.iloc[-1])
    latest_avg_loss = _to_float(avg_loss.iloc[-1])

    if latest_avg_gain is None or latest_avg_loss is None:
        return None
    if latest_avg_loss == 0:
        return 100.0

    rs = latest_avg_gain / latest_avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return float(rsi)


def _risk_gauge_score(risk_score: float) -> float:
    template_scores = [_compute_risk_score(row) for row in _TEMPLATE_ROWS]
    min_score = min(template_scores)
    max_score = max(template_scores)
    if max_score == min_score:
        return 50.0
    normalized = ((risk_score - min_score) / (max_score - min_score)) * 100.0
    return float(max(0.0, min(100.0, normalized)))


def _fallback_label_for_score(score: float, low_threshold: float, high_threshold: float) -> str:
    if score <= low_threshold:
        return "Low Risk"
    if score >= high_threshold:
        return "High Risk"
    return "Medium Risk"


def _classify_rows(rows: list[dict[str, Any]]) -> list[str]:
    if not rows:
        return []

    actual_scores = [_compute_risk_score(row) for row in rows]
    template_scores = [_compute_risk_score(template) for template in _TEMPLATE_ROWS]

    if len(actual_scores) >= 3:
        low_threshold = float(np.quantile(actual_scores, 0.33))
        high_threshold = float(np.quantile(actual_scores, 0.67))
        if low_threshold == high_threshold:
            low_threshold = float(np.quantile(template_scores, 0.33))
            high_threshold = float(np.quantile(template_scores, 0.67))
    else:
        low_threshold = float(np.quantile(template_scores, 0.33))
        high_threshold = float(np.quantile(template_scores, 0.67))

    pseudo_labels = [
        _fallback_label_for_score(score, low_threshold, high_threshold)
        for score in actual_scores
    ]

    if LogisticRegression is None or StandardScaler is None:
        return pseudo_labels

    train_rows = _TEMPLATE_ROWS + rows
    train_labels = [template["label"] for template in _TEMPLATE_ROWS] + pseudo_labels
    if len(set(train_labels)) < 2:
        return pseudo_labels

    try:
        scaler = StandardScaler()
        train_x = np.array([_feature_vector(row) for row in train_rows], dtype=float)
        train_x_scaled = scaler.fit_transform(train_x)

        model = LogisticRegression(max_iter=1200, multi_class="auto")
        model.fit(train_x_scaled, train_labels)

        predict_x = np.array([_feature_vector(row) for row in rows], dtype=float)
        predict_x_scaled = scaler.transform(predict_x)
        predictions = model.predict(predict_x_scaled)
        return [str(item) for item in predictions]
    except Exception:
        return pseudo_labels


def _fetch_stock_features(symbol: str, company_name_hint: str | None = None) -> dict[str, Any]:
    symbol_key = str(symbol or "").strip().upper()
    if not symbol_key:
        raise RiskAnalysisError("Stock symbol is required.")

    now = time.time()
    cache_hit = _feature_cache.get(symbol_key)
    if cache_hit and (now - cache_hit[0]) < _CACHE_TTL_SECONDS:
        cached_payload = dict(cache_hit[1])
        if company_name_hint and cached_payload.get("company_name") == symbol_key:
            cached_payload["company_name"] = company_name_hint
        return cached_payload

    close_prices = _fetch_close_series(symbol_key)
    if len(close_prices) < 30:
        raise RiskAnalysisError(f"Not enough historical data for {symbol_key}.")

    returns = close_prices.pct_change().dropna()
    if returns.empty:
        raise RiskAnalysisError(f"Unable to compute return series for {symbol_key}.")

    volatility = float(np.std(returns.to_numpy(), ddof=0))
    average_return = float(np.mean(returns.to_numpy()))
    running_max = close_prices.cummax()
    drawdown_series = (close_prices / running_max) - 1.0
    max_drawdown = float(drawdown_series.min())

    lookback_days = min(90, len(close_prices) - 1)
    base_price = float(close_prices.iloc[-1 - lookback_days])
    latest_price = float(close_prices.iloc[-1])
    momentum = 0.0 if base_price == 0 else ((latest_price - base_price) / base_price)

    market_volatility = _get_market_volatility()
    beta = volatility / market_volatility if market_volatility > 0 else 1.0

    company_name = symbol_key
    info = _fetch_ticker_info(symbol_key)
    company_name = str(
        info.get("longName")
        or info.get("shortName")
        or info.get("displayName")
        or info.get("name")
        or company_name_hint
        or symbol_key
    ).strip() or symbol_key

    payload = {
        "symbol": symbol_key,
        "company_name": company_name,
        "volatility": volatility,
        "average_return": average_return,
        "max_drawdown": max_drawdown,
        "beta": beta,
        "momentum": momentum,
    }
    _feature_cache[symbol_key] = (now, payload)
    return dict(payload)


def _serialize_row(row: dict[str, Any], risk_category: str) -> dict[str, Any]:
    return {
        "symbol": row["symbol"],
        "company_name": row["company_name"],
        "volatility": round(float(row["volatility"]), 6),
        "average_return": round(float(row["average_return"]), 6),
        "max_drawdown": round(float(row["max_drawdown"]), 6),
        "beta": round(float(row["beta"]), 6),
        "momentum": round(float(row["momentum"]), 6),
        "risk_category": risk_category,
    }


def _build_stock_insight_payload(
    symbol: str,
    classified_row: dict[str, Any],
    risk_score: float,
    gauge_score: float,
) -> dict[str, Any]:
    symbol_key = str(symbol or "").strip().upper()
    history_frame = _fetch_history_frame(symbol_key)
    if history_frame.empty or "Close" not in history_frame:
        raise RiskAnalysisError(f"Unable to fetch stock trend data for {symbol_key}.")

    close_prices = history_frame["Close"].dropna().astype(float)
    if close_prices.empty:
        raise RiskAnalysisError(f"Unable to fetch valid close prices for {symbol_key}.")

    volume_series = (
        history_frame["Volume"].dropna().astype(float)
        if "Volume" in history_frame
        else pd.Series(dtype="float64")
    )

    info = _fetch_ticker_info(symbol_key)
    currency = str(info.get("currency") or "").strip().upper() or None
    display_currency = "INR" if _convert_price_to_inr(1.0, currency) is not None else currency

    current_price = (
        _to_float(info.get("currentPrice"))
        or _to_float(info.get("regularMarketPrice"))
        or float(close_prices.iloc[-1])
    )
    previous_close = _to_float(info.get("previousClose"))
    if previous_close is None and len(close_prices) >= 2:
        previous_close = float(close_prices.iloc[-2])
    one_day_change = None
    if current_price is not None and previous_close not in (None, 0):
        one_day_change = (float(current_price) - float(previous_close)) / float(previous_close)

    ma50 = _to_float(close_prices.rolling(window=50, min_periods=50).mean().iloc[-1]) if len(close_prices) >= 50 else None
    ma200 = _to_float(close_prices.rolling(window=200, min_periods=200).mean().iloc[-1]) if len(close_prices) >= 200 else None

    average_volume = (
        _to_float(info.get("averageVolume"))
        or _to_float(info.get("averageDailyVolume10Day"))
        or (_to_float(volume_series.mean()) if not volume_series.empty else None)
    )
    week_52_high = _to_float(info.get("fiftyTwoWeekHigh")) or _to_float(close_prices.max())
    week_52_low = _to_float(info.get("fiftyTwoWeekLow")) or _to_float(close_prices.min())
    one_month_return = _compute_period_return(close_prices, 21)
    three_month_return = _compute_period_return(close_prices, 63)
    one_year_return = _compute_period_return(close_prices, len(close_prices) - 1)
    rsi_value = _compute_rsi(close_prices)

    if display_currency == "INR":
        current_price = _convert_price_to_inr(current_price, currency)
        ma50 = _convert_price_to_inr(ma50, currency)
        ma200 = _convert_price_to_inr(ma200, currency)
        week_52_high = _convert_price_to_inr(week_52_high, currency)
        week_52_low = _convert_price_to_inr(week_52_low, currency)
        market_cap = _convert_price_to_inr(_to_float(info.get("marketCap")), currency)
        eps = _convert_price_to_inr(
            _to_float(info.get("trailingEps")) or _to_float(info.get("epsTrailingTwelveMonths")),
            currency,
        )
    else:
        market_cap = _to_float(info.get("marketCap"))
        eps = _to_float(info.get("trailingEps")) or _to_float(info.get("epsTrailingTwelveMonths"))

    trend = [
        {
            "date": idx.strftime("%Y-%m-%d"),
            "close": round(float(_convert_price_to_inr(float(price), currency) if display_currency == "INR" else price), 4),
        }
        for idx, price in close_prices.items()
    ]

    return {
        "basic_information": {
            "stock_symbol": classified_row["symbol"],
            "company_name": classified_row["company_name"],
            "sector": str(info.get("sector") or "").strip() or None,
            "industry": str(info.get("industry") or "").strip() or None,
            "market_cap": market_cap,
            "currency": display_currency,
        },
        "price_performance": {
            "current_price": round(float(current_price), 4) if current_price is not None else None,
            "one_day_change_pct": round(float(one_day_change), 6) if one_day_change is not None else None,
            "one_month_return_pct": round(float(one_month_return), 6) if one_month_return is not None else None,
            "three_month_return_pct": round(float(three_month_return), 6) if three_month_return is not None else None,
            "one_year_return_pct": round(float(one_year_return), 6) if one_year_return is not None else None,
        },
        "fundamental_metrics": {
            "pe_ratio": _to_float(info.get("trailingPE")) or _to_float(info.get("forwardPE")),
            "eps": round(float(eps), 4) if eps is not None else None,
            "price_to_book_ratio": _to_float(info.get("priceToBook")),
            "dividend_yield_pct": _normalize_growth_percent(info.get("dividendYield")),
            "revenue_growth_pct": _normalize_growth_percent(info.get("revenueGrowth")),
        },
        "trading_activity": {
            "average_volume": round(float(average_volume), 2) if average_volume is not None else None,
            "week_52_high": round(float(week_52_high), 4) if week_52_high is not None else None,
            "week_52_low": round(float(week_52_low), 4) if week_52_low is not None else None,
        },
        "technical_indicators": {
            "volatility": classified_row["volatility"],
            "momentum": classified_row["momentum"],
            "moving_average_50": round(float(ma50), 4) if ma50 is not None else None,
            "moving_average_200": round(float(ma200), 4) if ma200 is not None else None,
            "rsi": round(float(rsi_value), 4) if rsi_value is not None else None,
        },
        "risk_evaluation": {
            "volatility": classified_row["volatility"],
            "average_return": classified_row["average_return"],
            "drawdown": classified_row["max_drawdown"],
            "momentum": classified_row["momentum"],
            "beta": classified_row["beta"],
            "risk_category": classified_row["risk_category"],
            "risk_score": round(float(risk_score), 6),
            "risk_gauge_score": round(float(gauge_score), 2),
        },
        "trend": trend,
    }


def _build_summary(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts = {level: 0 for level in RISK_LEVELS}
    for row in rows:
        category = str(row.get("risk_category") or "")
        if category in counts:
            counts[category] += 1
    return {
        "low_risk_count": counts["Low Risk"],
        "medium_risk_count": counts["Medium Risk"],
        "high_risk_count": counts["High Risk"],
    }


def _build_distribution(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summary = _build_summary(rows)
    return [
        {"category": "Low Risk", "count": summary["low_risk_count"]},
        {"category": "Medium Risk", "count": summary["medium_risk_count"]},
        {"category": "High Risk", "count": summary["high_risk_count"]},
    ]


def analyze_portfolio_risk(user: Any, portfolio_id: Any) -> dict[str, Any]:
    portfolio = UserPortfolio.objects.filter(id=portfolio_id, user=user).first()
    if not portfolio:
        raise LookupError("Portfolio not found.")

    holdings = list(StockHolding.objects.filter(portfolio=portfolio))
    if not holdings:
        raise LookupError("Selected portfolio has no stocks.")

    symbol_map: dict[str, str] = {}
    for holding in holdings:
        symbol = str(holding.stock_symbol or "").strip().upper()
        if not symbol:
            continue
        symbol_map[symbol] = str(holding.company_name or symbol).strip() or symbol

    if not symbol_map:
        raise LookupError("Selected portfolio has no valid stock symbols.")

    feature_rows: list[dict[str, Any]] = []
    for symbol, company_name in symbol_map.items():
        feature_rows.append(_fetch_stock_features(symbol, company_name_hint=company_name))

    risk_categories = _classify_rows(feature_rows)
    classified_rows = [
        _serialize_row(row, category)
        for row, category in zip(feature_rows, risk_categories)
    ]

    return {
        "analysis_type": "portfolio",
        "portfolio": {
            "id": portfolio.id,
            "name": portfolio.name,
            "stock_count": len(classified_rows),
        },
        "stocks": classified_rows,
        "summary": _build_summary(classified_rows),
        "distribution": _build_distribution(classified_rows),
        "scatter_points": [
            {
                "symbol": row["symbol"],
                "volatility": row["volatility"],
                "average_return": row["average_return"],
                "risk_category": row["risk_category"],
            }
            for row in classified_rows
        ],
    }


def analyze_single_stock_risk(symbol: str) -> dict[str, Any]:
    row = _fetch_stock_features(symbol)
    risk_category = _classify_rows([row])[0]
    classified = _serialize_row(row, risk_category)
    risk_score = _compute_risk_score(row)
    gauge_score = _risk_gauge_score(risk_score)
    stock_insight = _build_stock_insight_payload(
        symbol=classified["symbol"],
        classified_row=classified,
        risk_score=risk_score,
        gauge_score=gauge_score,
    )

    return {
        "analysis_type": "stock",
        "stock": classified,
        "summary": _build_summary([classified]),
        "distribution": _build_distribution([classified]),
        "stock_insight": stock_insight,
        "scatter_points": [
            {
                "symbol": classified["symbol"],
                "volatility": classified["volatility"],
                "average_return": classified["average_return"],
                "risk_category": classified["risk_category"],
            }
        ],
    }
