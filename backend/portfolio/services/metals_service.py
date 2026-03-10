from __future__ import annotations

from datetime import date
import time
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

try:
    from sklearn.linear_model import LinearRegression
except Exception:  # pragma: no cover - runtime fallback when sklearn isn't installed
    LinearRegression = None


GOLD_TICKER = "GC=F"
SILVER_TICKER = "SI=F"
USDINR_TICKER = "USDINR=X"
HISTORY_PERIOD = "1y"
TROY_OUNCE_IN_GRAMS = 31.1035
_CACHE_TTL_SECONDS = 900
_metals_cache: tuple[float, pd.DataFrame] | None = None


class MetalsDataError(Exception):
    pass


def _to_float(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        number = float(value)
        return number
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


def _fetch_close_series(ticker_symbol: str) -> pd.Series:
    try:
        frame = yf.Ticker(ticker_symbol).history(period=HISTORY_PERIOD)
    except Exception:
        return pd.Series(dtype="float64")

    if frame is None or frame.empty or "Close" not in frame:
        return pd.Series(dtype="float64")

    series = frame["Close"].dropna()
    if series.empty:
        return pd.Series(dtype="float64")

    return _normalize_series_index(series.astype(float))


def _fetch_latest_usd_inr_rate() -> float | None:
    try:
        ticker = yf.Ticker(USDINR_TICKER)
        fast_info = getattr(ticker, "fast_info", None) or {}
        info = getattr(ticker, "info", None) or {}
    except Exception:
        return None

    rate = (
        _to_float(fast_info.get("last_price"))
        or _to_float(info.get("currentPrice"))
        or _to_float(info.get("regularMarketPrice"))
        or _to_float(info.get("previousClose"))
    )
    if rate is None or rate <= 0:
        return None
    return float(rate)


def _get_metals_frame() -> pd.DataFrame:
    global _metals_cache

    now = time.time()
    if _metals_cache and (now - _metals_cache[0]) < _CACHE_TTL_SECONDS:
        return _metals_cache[1].copy()

    gold_usd = _fetch_close_series(GOLD_TICKER)
    silver_usd = _fetch_close_series(SILVER_TICKER)
    if gold_usd.empty or silver_usd.empty:
        raise MetalsDataError("Unable to fetch historical gold and silver data right now.")

    metals = pd.concat(
        [
            gold_usd.rename("gold_usd_per_ounce"),
            silver_usd.rename("silver_usd_per_ounce"),
        ],
        axis=1,
    ).dropna()
    if metals.empty:
        raise MetalsDataError("Insufficient overlapping history for gold and silver.")

    usd_inr = _fetch_close_series(USDINR_TICKER).rename("usd_inr")
    if usd_inr.empty:
        fallback_rate = _fetch_latest_usd_inr_rate()
        if fallback_rate is None:
            raise MetalsDataError("Unable to fetch USD to INR conversion rate.")
        metals["usd_inr"] = float(fallback_rate)
    else:
        metals = metals.join(usd_inr, how="left")
        metals["usd_inr"] = metals["usd_inr"].ffill().bfill()
        if metals["usd_inr"].isna().any():
            fallback_rate = _fetch_latest_usd_inr_rate()
            if fallback_rate is None:
                raise MetalsDataError("Unable to fill missing USD to INR conversion data.")
            metals["usd_inr"] = metals["usd_inr"].fillna(float(fallback_rate))

    metals["gold_price_inr_per_gram"] = (
        (metals["gold_usd_per_ounce"] * metals["usd_inr"]) / TROY_OUNCE_IN_GRAMS
    )
    metals["silver_price_inr_per_gram"] = (
        (metals["silver_usd_per_ounce"] * metals["usd_inr"]) / TROY_OUNCE_IN_GRAMS
    )

    result = metals[["gold_price_inr_per_gram", "silver_price_inr_per_gram"]].dropna().sort_index()
    if result.empty:
        raise MetalsDataError("Unable to prepare INR metal history.")

    _metals_cache = (now, result)
    return result.copy()


def _predict_price_for_target_date(series: pd.Series, target_date: date) -> float:
    if series.empty:
        raise MetalsDataError("No historical prices are available for prediction.")
    if len(series) == 1:
        return float(series.iloc[-1])
    clean_series = series.dropna().astype(float).sort_index()
    if clean_series.empty:
        raise MetalsDataError("No historical prices are available for prediction.")

    latest_timestamp = clean_series.index.max()
    latest_price = float(clean_series.iloc[-1])

    business_days_ahead = int(
        np.busday_count(
            latest_timestamp.date().isoformat(),
            target_date.isoformat(),
        )
    )
    horizon = max(business_days_ahead, 1)

    recent_window = min(len(clean_series), 90)
    recent_series = clean_series.tail(recent_window)

    # Smooth the recent history so the model follows the latest regime instead
    # of overreacting to the full 1-year trend.
    smoothed_series = recent_series.ewm(span=min(21, recent_window), adjust=False).mean()
    log_prices = np.log(smoothed_series.clip(lower=1e-9))
    x_axis = np.arange(len(log_prices), dtype=float)
    weights = np.linspace(0.35, 1.0, len(log_prices), dtype=float)

    if LinearRegression is not None:
        model = LinearRegression()
        model.fit(x_axis.reshape(-1, 1), log_prices.to_numpy(), sample_weight=weights)
        trend_log_price = float(
            model.predict(np.array([[len(log_prices) - 1 + horizon]], dtype=float))[0]
        )
    else:
        # Runtime fallback when sklearn is unavailable.
        slope, intercept = np.polyfit(x_axis, log_prices.to_numpy(), 1, w=weights)
        trend_log_price = float((slope * (len(log_prices) - 1 + horizon)) + intercept)

    trend_prediction = float(np.exp(trend_log_price))

    daily_returns = recent_series.pct_change().dropna()
    if daily_returns.empty:
        return round(latest_price, 2)

    recent_drift = float(daily_returns.tail(min(len(daily_returns), 15)).mean())
    volatility = float(daily_returns.tail(min(len(daily_returns), 30)).std(ddof=0) or 0.0)
    drift_prediction = latest_price * ((1 + recent_drift) ** horizon)

    # Blend a recent-trend forecast with a latest-price anchored drift forecast.
    blended_prediction = (0.65 * drift_prediction) + (0.35 * trend_prediction)

    # Limit unrealistic jumps for short horizons. For a 1-day forecast this keeps
    # the prediction near the latest close unless recent volatility supports more.
    max_move_ratio = max(0.015, min(0.12, (2.25 * volatility * np.sqrt(horizon)) + 0.005))
    lower_bound = latest_price * (1 - max_move_ratio)
    upper_bound = latest_price * (1 + max_move_ratio)
    bounded_prediction = float(np.clip(blended_prediction, lower_bound, upper_bound))

    return max(bounded_prediction, 0.0)


def get_metals_history() -> list[dict[str, Any]]:
    frame = _get_metals_frame()
    history: list[dict[str, Any]] = []
    for index, row in frame.iterrows():
        history.append(
            {
                "date": index.strftime("%Y-%m-%d"),
                "gold_price_inr_per_gram": round(float(row["gold_price_inr_per_gram"]), 2),
                "silver_price_inr_per_gram": round(float(row["silver_price_inr_per_gram"]), 2),
            }
        )
    return history


def predict_metal_price(metal: str, target_date_text: str) -> dict[str, Any]:
    metal_key = str(metal or "").strip().lower()
    if metal_key not in {"gold", "silver"}:
        raise ValueError("metal must be either 'gold' or 'silver'.")

    try:
        target_date = date.fromisoformat(str(target_date_text or "").strip())
    except ValueError as exc:
        raise ValueError("date must be in YYYY-MM-DD format.") from exc

    frame = _get_metals_frame()
    latest_history_date = frame.index.max().date()
    if target_date <= latest_history_date:
        raise ValueError(
            f"Prediction date must be after latest history date {latest_history_date.isoformat()}."
        )

    column_name = (
        "gold_price_inr_per_gram"
        if metal_key == "gold"
        else "silver_price_inr_per_gram"
    )
    series = frame[column_name]
    if series.empty:
        raise MetalsDataError("Insufficient historical data for selected metal.")

    current_price = float(series.iloc[-1])
    predicted_price = _predict_price_for_target_date(series, target_date)

    return {
        "metal": metal_key,
        "date": target_date.isoformat(),
        "latest_history_date": latest_history_date.isoformat(),
        "current_price_inr_per_gram": round(current_price, 2),
        "predicted_price_inr_per_gram": round(predicted_price, 2),
    }
