from __future__ import annotations

import time
from typing import Any

import yfinance as yf

_METRICS_CACHE_TTL_SECONDS = 300
_metrics_cache: dict[str, tuple[float, dict[str, float | None]]] = {}
_FX_CACHE_TTL_SECONDS = 1800
_fx_cache: dict[str, tuple[float, float | None]] = {}


def _to_float(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        number = float(value)
        return number
    except (TypeError, ValueError):
        return None


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _compute_opportunity_score(discount_level_pct: float | None, pe_ratio: float | None) -> float | None:
    if discount_level_pct is None and pe_ratio is None:
        return None

    discount_component = _clamp(discount_level_pct or 0.0, 0.0, 100.0)
    if pe_ratio is None or pe_ratio <= 0:
        pe_component = 50.0
    else:
        pe_component = _clamp(((35.0 - pe_ratio) / 35.0) * 100.0, 0.0, 100.0)

    return round((0.65 * discount_component) + (0.35 * pe_component), 2)


def _get_inr_fx_rate(currency_code: str) -> float | None:
    code = str(currency_code or "").strip().upper()
    if not code:
        return None
    if code == "INR":
        return 1.0

    cached = _fx_cache.get(code)
    now = time.time()
    if cached and (now - cached[0]) < _FX_CACHE_TTL_SECONDS:
        return cached[1]

    rate = None
    try:
        pair_symbol = f"{code}INR=X"
        ticker = yf.Ticker(pair_symbol)
        fast_info = getattr(ticker, "fast_info", None) or {}
        info = getattr(ticker, "info", None) or {}
        rate = (
            _to_float(fast_info.get("last_price"))
            or _to_float(info.get("currentPrice"))
            or _to_float(info.get("regularMarketPrice"))
            or _to_float(info.get("previousClose"))
        )
        if rate is not None and rate <= 0:
            rate = None
    except Exception:
        rate = None

    _fx_cache[code] = (now, rate)
    return rate


def _convert_price_to_inr(price: float | None, currency_code: str) -> float | None:
    if price is None:
        return None
    code = str(currency_code or "").strip().upper()
    if not code or code == "INR":
        return price

    fx_rate = _get_inr_fx_rate(code)
    if fx_rate is None:
        return None
    return price * fx_rate


def get_stock_metrics(symbol: str) -> dict[str, float | None]:
    symbol_key = str(symbol or "").strip().upper()
    default_metrics = {
        "current_price": None,
        "pe_ratio": None,
        "discount_level_pct": None,
        "opportunity_score": None,
    }
    if not symbol_key:
        return default_metrics

    cache_entry = _metrics_cache.get(symbol_key)
    now = time.time()
    if cache_entry and (now - cache_entry[0]) < _METRICS_CACHE_TTL_SECONDS:
        return cache_entry[1]

    try:
        ticker = yf.Ticker(symbol_key)
        fast_info = getattr(ticker, "fast_info", None) or {}
        info = getattr(ticker, "info", None) or {}

        current_price = (
            _to_float(fast_info.get("last_price"))
            or _to_float(info.get("currentPrice"))
            or _to_float(info.get("regularMarketPrice"))
            or _to_float(info.get("previousClose"))
        )
        currency_code = str(
            info.get("currency")
            or info.get("financialCurrency")
            or fast_info.get("currency")
            or ""
        ).strip().upper()
        pe_ratio = _to_float(info.get("trailingPE")) or _to_float(info.get("forwardPE"))
        year_high = _to_float(fast_info.get("year_high")) or _to_float(info.get("fiftyTwoWeekHigh"))

        discount_level_pct = None
        if current_price is not None and year_high is not None and year_high > 0:
            discount_level_pct = round(_clamp(((year_high - current_price) / year_high) * 100.0, -100.0, 100.0), 2)

        current_price_inr = _convert_price_to_inr(current_price, currency_code)
        metrics = {
            "current_price": round(current_price_inr, 2) if current_price_inr is not None else None,
            "pe_ratio": round(pe_ratio, 2) if pe_ratio is not None else None,
            "discount_level_pct": discount_level_pct,
            "opportunity_score": _compute_opportunity_score(discount_level_pct, pe_ratio),
        }
    except Exception:
        metrics = default_metrics

    _metrics_cache[symbol_key] = (now, metrics)
    return metrics


def get_stock_detail(symbol: str) -> dict[str, Any]:
    symbol_key = str(symbol or "").strip().upper()
    payload: dict[str, Any] = {
        "symbol": symbol_key,
        "company_name": symbol_key,
        "current_price": None,
        "pe_ratio": None,
        "historical_prices": [],
        "max_price": None,
        "min_price": None,
        "open_price": None,
        "close_price": None,
        "average_price": None,
    }
    if not symbol_key:
        return payload

    try:
        ticker = yf.Ticker(symbol_key)
        info = getattr(ticker, "info", None) or {}
        fast_info = getattr(ticker, "fast_info", None) or {}

        company_name = str(
            info.get("longName")
            or info.get("shortName")
            or info.get("displayName")
            or info.get("name")
            or symbol_key
        ).strip()
        payload["company_name"] = company_name or symbol_key

        currency_code = str(
            info.get("currency")
            or info.get("financialCurrency")
            or fast_info.get("currency")
            or ""
        ).strip().upper()

        pe_ratio = _to_float(info.get("trailingPE")) or _to_float(info.get("forwardPE"))
        payload["pe_ratio"] = round(pe_ratio, 2) if pe_ratio is not None else None

        current_price_native = (
            _to_float(fast_info.get("last_price"))
            or _to_float(info.get("currentPrice"))
            or _to_float(info.get("regularMarketPrice"))
            or _to_float(info.get("previousClose"))
        )
        current_price_inr = _convert_price_to_inr(current_price_native, currency_code)
        payload["current_price"] = round(current_price_inr, 2) if current_price_inr is not None else None

        history = ticker.history(period="3mo")
        historical_prices: list[dict[str, Any]] = []
        close_series_inr: list[float] = []
        first_open_inr: float | None = None
        rolling_max_close_native: float | None = None

        if history is not None and not history.empty:
            for idx, row in history.iterrows():
                close_native = _to_float(row.get("Close"))
                open_native = _to_float(row.get("Open"))
                if close_native is None:
                    continue

                close_inr = _convert_price_to_inr(close_native, currency_code)
                if close_inr is None:
                    continue

                open_inr = _convert_price_to_inr(open_native, currency_code)
                if first_open_inr is None and open_inr is not None:
                    first_open_inr = open_inr

                if rolling_max_close_native is None:
                    rolling_max_close_native = close_native
                else:
                    rolling_max_close_native = max(rolling_max_close_native, close_native)

                discount_level_pct = None
                if rolling_max_close_native and rolling_max_close_native > 0:
                    discount_level_pct = round(
                        _clamp(((rolling_max_close_native - close_native) / rolling_max_close_native) * 100.0, -100.0, 100.0),
                        2,
                    )

                historical_prices.append(
                    {
                        "date": idx.strftime("%Y-%m-%d"),
                        "price": round(close_inr, 2),
                        "discount_level": discount_level_pct,
                        "opportunity_score": _compute_opportunity_score(discount_level_pct, pe_ratio),
                    }
                )
                close_series_inr.append(close_inr)

        payload["historical_prices"] = historical_prices

        if close_series_inr:
            close_price = close_series_inr[-1]
            payload["max_price"] = round(max(close_series_inr), 2)
            payload["min_price"] = round(min(close_series_inr), 2)
            payload["open_price"] = round(first_open_inr, 2) if first_open_inr is not None else None
            payload["close_price"] = round(close_price, 2)
            payload["average_price"] = round(sum(close_series_inr) / len(close_series_inr), 2)
            if payload["current_price"] is None:
                payload["current_price"] = round(close_price, 2)
    except Exception:
        return payload

    return payload


def search_stocks(query: str, max_results: int = 10) -> list[dict[str, str]]:
    clean_query = (query or "").strip()
    if not clean_query:
        return []

    try:
        search = yf.Search(query=clean_query, max_results=max_results)
        quotes = getattr(search, "quotes", []) or []
    except Exception:
        return []

    matches: list[dict[str, str]] = []
    seen_symbols: set[str] = set()

    for quote in quotes:
        if not isinstance(quote, dict):
            continue

        symbol = str(quote.get("symbol") or "").strip()
        company_name = str(
            quote.get("shortname")
            or quote.get("longname")
            or quote.get("displayName")
            or quote.get("name")
            or ""
        ).strip()

        if not symbol or not company_name:
            continue

        symbol_key = symbol.upper()
        if symbol_key in seen_symbols:
            continue

        seen_symbols.add(symbol_key)
        matches.append(
            {
                "symbol": symbol,
                "company_name": company_name,
            }
        )

        if len(matches) >= max_results:
            break

    return matches
