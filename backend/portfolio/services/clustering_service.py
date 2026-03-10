from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
try:
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import StandardScaler
except Exception:  # pragma: no cover - runtime fallback when sklearn isn't installed
    KMeans = None
    PCA = None
    silhouette_score = None
    StandardScaler = None

from ..models import StockHolding, UserPortfolio

HISTORY_PERIOD = "1y"
DEFAULT_K_RANGE = (3, 5)
MODEL_RANDOM_STATE = 42


class ClusteringError(Exception):
    pass


def _to_float(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_frame_index(frame: pd.DataFrame) -> pd.DataFrame:
    index = pd.to_datetime(frame.index)
    if getattr(index, "tz", None) is not None:
        index = index.tz_convert(None)
    normalized = frame.copy()
    normalized.index = index.normalize()
    normalized = normalized[~normalized.index.duplicated(keep="last")]
    return normalized.sort_index()


def _fetch_history(symbol: str) -> pd.DataFrame:
    try:
        frame = yf.Ticker(symbol).history(period=HISTORY_PERIOD)
    except Exception:
        return pd.DataFrame()

    if frame is None or frame.empty:
        return pd.DataFrame()

    return _normalize_frame_index(frame)


def _fetch_info(symbol: str) -> dict[str, Any]:
    try:
        info = getattr(yf.Ticker(symbol), "info", None) or {}
    except Exception:
        info = {}
    return info if isinstance(info, dict) else {}


def _extract_features(symbol: str, company_name_hint: str | None = None) -> dict[str, Any]:
    symbol_key = str(symbol or "").strip().upper()
    if not symbol_key:
        raise ClusteringError("Stock symbol is required.")

    history = _fetch_history(symbol_key)
    if history.empty or "Close" not in history:
        raise ClusteringError(f"Unable to fetch historical data for {symbol_key}.")

    close_prices = history["Close"].dropna().astype(float)
    if len(close_prices) < 40:
        raise ClusteringError(f"Not enough historical data for {symbol_key}.")

    returns = close_prices.pct_change().dropna()
    if returns.empty:
        raise ClusteringError(f"Unable to compute returns for {symbol_key}.")

    volatility = float(np.std(returns.to_numpy(), ddof=0))
    average_return = float(np.mean(returns.to_numpy()))

    ma50 = _to_float(close_prices.rolling(window=50, min_periods=20).mean().iloc[-1])
    ma200 = _to_float(close_prices.rolling(window=200, min_periods=80).mean().iloc[-1])

    volume_series = (
        history["Volume"].dropna().astype(float)
        if "Volume" in history
        else pd.Series(dtype="float64")
    )
    avg_volume_history = _to_float(volume_series.mean()) if not volume_series.empty else None

    info = _fetch_info(symbol_key)
    company_name = str(
        info.get("longName")
        or info.get("shortName")
        or info.get("displayName")
        or info.get("name")
        or company_name_hint
        or symbol_key
    ).strip() or symbol_key

    market_cap = _to_float(info.get("marketCap"))
    beta = _to_float(info.get("beta"))
    average_volume = (
        _to_float(info.get("averageVolume"))
        or _to_float(info.get("averageDailyVolume10Day"))
        or avg_volume_history
    )

    return {
        "symbol": symbol_key,
        "company_name": company_name,
        "average_return": average_return,
        "volatility": volatility,
        "market_cap": market_cap,
        "beta": beta,
        "average_volume": average_volume,
        "moving_average_50": ma50,
        "moving_average_200": ma200,
    }


def _clean_and_scale_feature_matrix(rows: list[dict[str, Any]]) -> tuple[pd.DataFrame, np.ndarray]:
    if not rows:
        raise ClusteringError("No stock rows found for clustering.")
    if StandardScaler is None:
        raise ClusteringError("scikit-learn is required for clustering analysis.")

    feature_cols = [
        "average_return",
        "volatility",
        "market_cap",
        "beta",
        "average_volume",
        "moving_average_50",
        "moving_average_200",
    ]
    frame = pd.DataFrame(rows)
    matrix = frame[feature_cols].copy()

    for col in feature_cols:
        matrix[col] = pd.to_numeric(matrix[col], errors="coerce")
        col_values = matrix[col].dropna()
        if col_values.empty:
            matrix[col] = matrix[col].fillna(0.0)
        else:
            matrix[col] = matrix[col].fillna(float(col_values.median()))

    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix.to_numpy(dtype=float))
    frame[feature_cols] = matrix
    return frame, scaled


def _choose_cluster_count(scaled_matrix: np.ndarray) -> tuple[int, list[dict[str, Any]], list[dict[str, Any]]]:
    if KMeans is None:
        raise ClusteringError("scikit-learn is required for clustering analysis.")

    n_samples = int(scaled_matrix.shape[0])
    min_k, max_k = DEFAULT_K_RANGE
    candidate_ks = [k for k in range(min_k, max_k + 1) if k <= n_samples]

    if n_samples <= 1:
        return 1, [{"k": 1, "inertia": 0.0}], []

    elbow = []
    silhouettes = []
    for k in candidate_ks:
        model = KMeans(n_clusters=k, n_init=20, random_state=MODEL_RANDOM_STATE)
        labels = model.fit_predict(scaled_matrix)
        elbow.append({"k": int(k), "inertia": float(model.inertia_)})
        if 1 < k < n_samples and silhouette_score is not None:
            try:
                score = float(silhouette_score(scaled_matrix, labels))
                silhouettes.append({"k": int(k), "score": score})
            except Exception:
                pass

    if silhouettes:
        best = max(silhouettes, key=lambda item: item["score"])
        return int(best["k"]), elbow, silhouettes

    if candidate_ks:
        return int(candidate_ks[0]), elbow, silhouettes

    # for n_samples == 2 only
    return 2, elbow, silhouettes


def _compute_pca_coordinates(scaled_matrix: np.ndarray) -> np.ndarray:
    n_samples = int(scaled_matrix.shape[0])
    if n_samples <= 1:
        return np.zeros((n_samples, 2), dtype=float)
    if PCA is None:
        return np.zeros((n_samples, 2), dtype=float)

    try:
        pca = PCA(n_components=2, random_state=MODEL_RANDOM_STATE)
        return pca.fit_transform(scaled_matrix)
    except Exception:
        return np.zeros((n_samples, 2), dtype=float)


def _cluster_insight_text(
    avg_return: float,
    avg_volatility: float,
    avg_market_cap: float,
    return_quantiles: tuple[float, float],
    volatility_quantiles: tuple[float, float],
    cap_quantiles: tuple[float, float],
) -> str:
    ret_lo, ret_hi = return_quantiles
    vol_lo, vol_hi = volatility_quantiles
    cap_lo, cap_hi = cap_quantiles

    if avg_volatility <= vol_lo and avg_return >= ret_lo:
        return "Low-volatility stable stocks with relatively steady returns."
    if avg_return >= ret_hi and avg_volatility >= vol_hi:
        return "High-growth and high-volatility stocks with aggressive behavior."
    if avg_market_cap >= cap_hi:
        return "Large-cap stocks with moderate overall risk characteristics."
    if avg_market_cap <= cap_lo and avg_volatility >= vol_lo:
        return "Smaller-cap names with comparatively sensitive price movement."
    return "Balanced mix of return and volatility across diversified behaviors."


def _build_result_payload(
    frame: pd.DataFrame,
    labels: np.ndarray,
    pca_points: np.ndarray,
    selected_k: int,
    elbow: list[dict[str, Any]],
    silhouettes: list[dict[str, Any]],
    source: str,
    source_meta: dict[str, Any],
) -> dict[str, Any]:
    cluster_ids = (labels.astype(int) + 1).tolist()
    frame = frame.copy()
    frame["cluster_id"] = cluster_ids
    frame["pca_component_1"] = pca_points[:, 0]
    frame["pca_component_2"] = pca_points[:, 1]

    stocks = []
    for _, row in frame.iterrows():
        stocks.append(
            {
                "symbol": str(row["symbol"]),
                "company_name": str(row.get("company_name") or row["symbol"]),
                "cluster_id": int(row["cluster_id"]),
                "average_return": round(float(row["average_return"]), 6),
                "volatility": round(float(row["volatility"]), 6),
                "market_cap": round(float(row["market_cap"]), 2),
                "beta": round(float(row["beta"]), 6),
                "average_volume": round(float(row["average_volume"]), 2),
                "moving_average_50": round(float(row["moving_average_50"]), 4),
                "moving_average_200": round(float(row["moving_average_200"]), 4),
                "pca_component_1": round(float(row["pca_component_1"]), 6),
                "pca_component_2": round(float(row["pca_component_2"]), 6),
            }
        )

    distribution = (
        frame.groupby("cluster_id")["symbol"]
        .count()
        .reset_index(name="count")
        .sort_values("cluster_id")
    )
    distribution_payload = [
        {"cluster_id": int(item.cluster_id), "count": int(item.count)}
        for item in distribution.itertuples(index=False)
    ]

    comparison = (
        frame.groupby("cluster_id")
        .agg(
            average_return=("average_return", "mean"),
            average_volatility=("volatility", "mean"),
            average_market_cap=("market_cap", "mean"),
            average_beta=("beta", "mean"),
            average_volume=("average_volume", "mean"),
            stock_count=("symbol", "count"),
        )
        .reset_index()
        .sort_values("cluster_id")
    )

    return_quantiles = (
        float(frame["average_return"].quantile(0.35)),
        float(frame["average_return"].quantile(0.65)),
    )
    volatility_quantiles = (
        float(frame["volatility"].quantile(0.35)),
        float(frame["volatility"].quantile(0.65)),
    )
    cap_quantiles = (
        float(frame["market_cap"].quantile(0.35)),
        float(frame["market_cap"].quantile(0.65)),
    )

    comparison_payload = []
    insights_payload = []
    for item in comparison.itertuples(index=False):
        cluster_id = int(item.cluster_id)
        avg_return = float(item.average_return)
        avg_volatility = float(item.average_volatility)
        avg_market_cap = float(item.average_market_cap)
        avg_beta = float(item.average_beta)
        avg_volume = float(item.average_volume)
        stock_count = int(item.stock_count)

        comparison_payload.append(
            {
                "cluster_id": cluster_id,
                "average_return": round(avg_return, 6),
                "average_volatility": round(avg_volatility, 6),
                "average_market_cap": round(avg_market_cap, 2),
                "average_beta": round(avg_beta, 6),
                "average_volume": round(avg_volume, 2),
                "stock_count": stock_count,
            }
        )
        insights_payload.append(
            {
                "cluster_id": cluster_id,
                "stock_count": stock_count,
                "insight": _cluster_insight_text(
                    avg_return=avg_return,
                    avg_volatility=avg_volatility,
                    avg_market_cap=avg_market_cap,
                    return_quantiles=return_quantiles,
                    volatility_quantiles=volatility_quantiles,
                    cap_quantiles=cap_quantiles,
                ),
            }
        )

    return {
        "source": source,
        "source_meta": source_meta,
        "cluster_count": int(selected_k),
        "model_diagnostics": {
            "elbow": elbow,
            "silhouette": silhouettes,
            "selected_k": int(selected_k),
        },
        "stocks": stocks,
        "cluster_distribution": distribution_payload,
        "cluster_comparison": comparison_payload,
        "cluster_insights": insights_payload,
    }


def _run_clustering(
    symbol_to_company: dict[str, str],
    source: str,
    source_meta: dict[str, Any],
) -> dict[str, Any]:
    if not symbol_to_company:
        raise ClusteringError("No valid stock symbols provided.")

    rows = []
    errors = []
    for symbol, company_name in symbol_to_company.items():
        try:
            rows.append(_extract_features(symbol, company_name_hint=company_name))
        except Exception as exc:
            errors.append(f"{symbol}: {exc}")

    if len(rows) < 2:
        detail = "Need at least 2 stocks with valid data for clustering."
        if errors:
            detail = f"{detail} Failed symbols: {'; '.join(errors[:5])}"
        raise ClusteringError(detail)

    frame, scaled_matrix = _clean_and_scale_feature_matrix(rows)
    selected_k, elbow, silhouettes = _choose_cluster_count(scaled_matrix)
    model = KMeans(n_clusters=selected_k, n_init=20, random_state=MODEL_RANDOM_STATE)
    labels = model.fit_predict(scaled_matrix)
    pca_points = _compute_pca_coordinates(scaled_matrix)

    payload = _build_result_payload(
        frame=frame,
        labels=labels,
        pca_points=pca_points,
        selected_k=selected_k,
        elbow=elbow,
        silhouettes=silhouettes,
        source=source,
        source_meta=source_meta,
    )
    payload["data_issues"] = errors
    return payload


def cluster_portfolio_stocks(user: Any, portfolio_id: Any) -> dict[str, Any]:
    portfolio = UserPortfolio.objects.filter(id=portfolio_id, user=user).first()
    if not portfolio:
        raise LookupError("Portfolio not found.")

    holdings = list(StockHolding.objects.filter(portfolio=portfolio))
    if not holdings:
        raise LookupError("Selected portfolio has no stocks.")

    symbol_to_company: dict[str, str] = {}
    for item in holdings:
        symbol = str(item.stock_symbol or "").strip().upper()
        if not symbol:
            continue
        symbol_to_company[symbol] = str(item.company_name or symbol).strip() or symbol

    if not symbol_to_company:
        raise LookupError("Selected portfolio has no valid stock symbols.")

    return _run_clustering(
        symbol_to_company=symbol_to_company,
        source="portfolio",
        source_meta={
            "portfolio_id": portfolio.id,
            "portfolio_name": portfolio.name,
            "symbol_count": len(symbol_to_company),
        },
    )


def cluster_market_stocks(symbols: list[str]) -> dict[str, Any]:
    clean_symbols = []
    seen = set()
    for symbol in symbols:
        symbol_key = str(symbol or "").strip().upper()
        if not symbol_key or symbol_key in seen:
            continue
        seen.add(symbol_key)
        clean_symbols.append(symbol_key)

    if len(clean_symbols) < 2:
        raise ValueError("Provide at least two symbols for market clustering.")

    return _run_clustering(
        symbol_to_company={symbol: symbol for symbol in clean_symbols},
        source="market",
        source_meta={
            "symbols": clean_symbols,
            "symbol_count": len(clean_symbols),
        },
    )
