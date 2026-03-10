from __future__ import annotations

from datetime import datetime
import math
from pathlib import Path
import time
from typing import Any
import warnings

import numpy as np
import pandas as pd
import yfinance as yf

try:
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    from sklearn.neural_network import MLPRegressor
    from sklearn.preprocessing import MinMaxScaler
except Exception:  # pragma: no cover - runtime fallback when sklearn isn't installed
    LinearRegression = None
    MinMaxScaler = None
    MLPRegressor = None
    mean_absolute_error = None
    mean_squared_error = None

try:
    from pmdarima import auto_arima
except Exception:  # pragma: no cover - optional dependency
    auto_arima = None

try:
    from statsmodels.tsa.stattools import adfuller
    from statsmodels.tsa.statespace.sarimax import SARIMAX
except Exception:  # pragma: no cover - runtime fallback when statsmodels isn't installed
    SARIMAX = None
    adfuller = None

try:
    import tensorflow as tf
    from tensorflow.keras import Sequential
    from tensorflow.keras.callbacks import EarlyStopping
    from tensorflow.keras.layers import Dense, Dropout, Input, LSTM
except Exception:  # pragma: no cover - runtime fallback when tensorflow isn't installed
    tf = None
    Sequential = None
    EarlyStopping = None
    Input = None
    LSTM = None
    Dropout = None
    Dense = None


BTC_TICKER = "BTC-USD"
HISTORY_PERIOD = "2y"
HISTORY_INTERVAL = "1h"
ROLLING_WINDOW = 24
LAG_FEATURES = [1, 3, 6, 12]
SEQUENCE_STEPS = 24
TRAIN_SPLIT_RATIO = 0.8
MIN_TRAIN_ROWS = 240
MIN_TEST_ROWS = 48
MODEL_MAX_POINTS = 3000
_CACHE_TTL_SECONDS = 900
_YFINANCE_CACHE_DIR = Path(__file__).resolve().parents[2] / ".yfinance-cache"

_history_cache: tuple[float, dict[str, Any]] | None = None
_forecast_cache: tuple[float, dict[str, Any], pd.Timestamp] | None = None


class BtcForecastError(Exception):
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
    normalized.index = index
    normalized = normalized[~normalized.index.duplicated(keep="last")]
    return normalized.sort_index()


def _fetch_history_frame() -> pd.DataFrame:
    try:
        _YFINANCE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        if hasattr(yf, "set_tz_cache_location"):
            yf.set_tz_cache_location(str(_YFINANCE_CACHE_DIR))
        frame = yf.Ticker(BTC_TICKER).history(period=HISTORY_PERIOD, interval=HISTORY_INTERVAL)
    except Exception as exc:
        raise BtcForecastError("Unable to fetch BTC historical data from yfinance.") from exc

    if frame is None or frame.empty:
        raise BtcForecastError("No BTC historical data was returned by yfinance.")

    frame = _normalize_frame_index(frame)
    required = ["Open", "High", "Low", "Close", "Volume"]
    missing_cols = [column for column in required if column not in frame.columns]
    if missing_cols:
        raise BtcForecastError(f"Missing expected columns in BTC data: {', '.join(missing_cols)}.")

    return frame[required].copy()


def _run_adf_test(close_series: pd.Series) -> dict[str, Any]:
    if adfuller is None or len(close_series.dropna()) < 50:
        return {
            "adf_statistic": None,
            "adf_p_value": None,
            "critical_values": {},
            "is_stationary": None,
        }

    try:
        stat, p_value, _, _, critical_values, _ = adfuller(close_series.dropna(), autolag="AIC")
        return {
            "adf_statistic": round(float(stat), 6),
            "adf_p_value": round(float(p_value), 6),
            "critical_values": {str(key): round(float(val), 6) for key, val in critical_values.items()},
            "is_stationary": bool(float(p_value) <= 0.05),
        }
    except Exception:
        return {
            "adf_statistic": None,
            "adf_p_value": None,
            "critical_values": {},
            "is_stationary": None,
        }


def _build_processed_bundle() -> dict[str, Any]:
    raw = _fetch_history_frame()
    missing_cells = int(raw.isna().sum().sum())
    frame = raw.dropna().copy()
    missing_rows_removed = int(len(raw) - len(frame))
    if frame.empty:
        raise BtcForecastError("BTC data became empty after removing missing values.")

    frame["return"] = frame["Close"].pct_change()
    return_std = float(frame["return"].std(ddof=0)) if frame["return"].notna().any() else 0.0
    return_mean = float(frame["return"].mean()) if frame["return"].notna().any() else 0.0
    if return_std > 0:
        z_scores = ((frame["return"] - return_mean) / return_std).abs()
        frame["is_outlier"] = z_scores > 3.0
    else:
        frame["is_outlier"] = False

    frame["rolling_mean_24"] = frame["Close"].rolling(window=ROLLING_WINDOW, min_periods=1).mean()
    frame["rolling_volatility_24"] = frame["return"].rolling(window=ROLLING_WINDOW, min_periods=2).std(ddof=0)

    outlier_rows_detected = int(frame["is_outlier"].sum())
    adf_summary = _run_adf_test(frame["Close"])

    model_frame = frame.loc[~frame["is_outlier"]].copy()
    if len(model_frame) < 600:
        model_frame = frame.copy()

    summary = {
        "ticker": BTC_TICKER,
        "period": HISTORY_PERIOD,
        "interval": HISTORY_INTERVAL,
        "raw_rows": int(len(raw)),
        "processed_rows": int(len(frame)),
        "model_rows": int(len(model_frame)),
        "missing_cells_detected": missing_cells,
        "missing_rows_removed": missing_rows_removed,
        "outlier_rows_detected": outlier_rows_detected,
        **adf_summary,
    }

    return {"frame": frame, "model_frame": model_frame, "summary": summary}


def _get_processed_bundle() -> dict[str, Any]:
    global _history_cache
    now = time.time()
    if _history_cache and (now - _history_cache[0]) < _CACHE_TTL_SECONDS:
        cached = _history_cache[1]
        return {
            "frame": cached["frame"].copy(),
            "model_frame": cached["model_frame"].copy(),
            "summary": dict(cached["summary"]),
        }

    payload = _build_processed_bundle()
    _history_cache = (
        now,
        {
            "frame": payload["frame"].copy(),
            "model_frame": payload["model_frame"].copy(),
            "summary": dict(payload["summary"]),
        },
    )
    return payload


def _format_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float | None]:
    if len(actual) == 0 or len(predicted) == 0:
        return {"mae": None, "rmse": None, "mape": None}

    actual_array = np.asarray(actual, dtype=float)
    predicted_array = np.asarray(predicted, dtype=float)
    mask = np.isfinite(actual_array) & np.isfinite(predicted_array)
    actual_array = actual_array[mask]
    predicted_array = predicted_array[mask]
    if len(actual_array) == 0:
        return {"mae": None, "rmse": None, "mape": None}

    if mean_absolute_error is not None and mean_squared_error is not None:
        mae = float(mean_absolute_error(actual_array, predicted_array))
        rmse = float(math.sqrt(mean_squared_error(actual_array, predicted_array)))
    else:
        residual = actual_array - predicted_array
        mae = float(np.mean(np.abs(residual)))
        rmse = float(math.sqrt(np.mean(np.square(residual))))

    non_zero_mask = actual_array != 0
    if non_zero_mask.any():
        mape = float(
            np.mean(
                np.abs((actual_array[non_zero_mask] - predicted_array[non_zero_mask]) / actual_array[non_zero_mask])
            )
            * 100.0
        )
    else:
        mape = None

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4) if mape is not None else None,
    }


def _build_supervised_dataset(model_frame: pd.DataFrame) -> dict[str, Any]:
    working = model_frame.copy()
    working["return_1h"] = working["Close"].pct_change()
    working["rolling_mean_24"] = working["Close"].rolling(window=ROLLING_WINDOW, min_periods=ROLLING_WINDOW).mean()
    working["rolling_std_24"] = working["Close"].rolling(window=ROLLING_WINDOW, min_periods=ROLLING_WINDOW).std(ddof=0)

    for lag in LAG_FEATURES:
        working[f"close_lag_{lag}"] = working["Close"].shift(lag)

    feature_columns = [
        "Close",
        "Volume",
        "return_1h",
        "rolling_mean_24",
        "rolling_std_24",
        *[f"close_lag_{lag}" for lag in LAG_FEATURES],
    ]

    working["target"] = working["Close"].shift(-1)
    working["target_timestamp"] = pd.Series(working.index, index=working.index).shift(-1)

    next_feature_row = working.iloc[[-1]].copy()
    if next_feature_row[feature_columns].isna().any(axis=None):
        raise BtcForecastError("Unable to build next-hour BTC features from the latest history row.")

    supervised = working.dropna(subset=feature_columns + ["target", "target_timestamp"]).copy()
    if len(supervised) < (MIN_TRAIN_ROWS + MIN_TEST_ROWS):
        raise BtcForecastError("Not enough engineered BTC rows for model training.")

    if len(supervised) > MODEL_MAX_POINTS:
        supervised = supervised.iloc[-MODEL_MAX_POINTS:].copy()

    split_index = int(len(supervised) * TRAIN_SPLIT_RATIO)
    split_index = max(split_index, MIN_TRAIN_ROWS)
    split_index = min(split_index, len(supervised) - MIN_TEST_ROWS)
    if split_index <= 0 or split_index >= len(supervised):
        raise BtcForecastError("Unable to create a valid 80/20 train/test split for BTC forecasting.")

    train_frame = supervised.iloc[:split_index].copy()
    test_frame = supervised.iloc[split_index:].copy()
    if len(train_frame) < MIN_TRAIN_ROWS or len(test_frame) < MIN_TEST_ROWS:
        raise BtcForecastError("BTC train/test split does not have enough rows for forecasting.")

    next_timestamp = pd.Timestamp(model_frame.index[-1]) + pd.Timedelta(hours=1)
    return {
        "feature_columns": feature_columns,
        "supervised": supervised,
        "train": train_frame,
        "test": test_frame,
        "next_feature_row": next_feature_row[feature_columns].copy(),
        "next_timestamp": next_timestamp,
    }


def _predict_linear_regression(dataset: dict[str, Any]) -> dict[str, Any]:
    if LinearRegression is None:
        raise BtcForecastError("scikit-learn is required for the linear regression forecaster.")

    feature_columns = dataset["feature_columns"]
    train_frame = dataset["train"]
    test_frame = dataset["test"]
    next_feature_row = dataset["next_feature_row"]

    x_train = train_frame[feature_columns].to_numpy(dtype=float)
    y_train = train_frame["target"].to_numpy(dtype=float)
    x_test = test_frame[feature_columns].to_numpy(dtype=float)
    y_test = test_frame["target"].to_numpy(dtype=float)

    model = LinearRegression()
    model.fit(x_train, y_train)

    predicted = model.predict(x_test).astype(float)
    next_prediction = float(model.predict(next_feature_row.to_numpy(dtype=float))[0])

    return {
        "timestamps": pd.DatetimeIndex(test_frame["target_timestamp"]),
        "actual": y_test,
        "predicted": predicted,
        "next_prediction": max(next_prediction, 0.0),
        "metrics": _format_metrics(y_test, predicted),
        "model_note": "linear_regression_with_engineered_features",
    }


def _select_sarimax_order(y_train: pd.Series, x_train: pd.DataFrame) -> tuple[int, int, int] | None:
    if SARIMAX is None:
        return None

    candidate_orders: list[tuple[int, int, int]] = []
    for d_value in (0, 1):
        for p_value in range(0, 4):
            for q_value in range(0, 4):
                if p_value == 0 and q_value == 0:
                    continue
                candidate_orders.append((p_value, d_value, q_value))

    best_order = None
    best_aic = float("inf")
    for order in candidate_orders:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = SARIMAX(
                    y_train,
                    exog=x_train,
                    order=order,
                    trend="c",
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                )
                fitted = model.fit(disp=False)
            aic = float(fitted.aic)
            if np.isfinite(aic) and aic < best_aic:
                best_aic = aic
                best_order = order
        except Exception:
            continue
    return best_order


def _predict_arima(dataset: dict[str, Any]) -> dict[str, Any]:
    feature_columns = dataset["feature_columns"]
    train_frame = dataset["train"]
    test_frame = dataset["test"]
    supervised = dataset["supervised"]
    next_feature_row = dataset["next_feature_row"]

    y_train = train_frame["target"].astype(float)
    x_train = train_frame[feature_columns].astype(float)
    y_test = test_frame["target"].to_numpy(dtype=float)
    x_test = test_frame[feature_columns].astype(float)

    model_note = "auto_arima_with_exogenous_features"
    order: tuple[int, int, int] | None = None

    if auto_arima is not None:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = auto_arima(
                    y_train.to_numpy(dtype=float),
                    X=x_train.to_numpy(dtype=float),
                    start_p=0,
                    start_q=0,
                    max_p=4,
                    max_q=4,
                    max_d=2,
                    seasonal=False,
                    stepwise=True,
                    suppress_warnings=True,
                    error_action="ignore",
                    trace=False,
                    information_criterion="aic",
                )
            predicted = np.asarray(
                model.predict(n_periods=len(x_test), X=x_test.to_numpy(dtype=float)),
                dtype=float,
            )
            next_prediction = float(
                model.predict(n_periods=1, X=next_feature_row.to_numpy(dtype=float))[0]
            )
            order = getattr(model, "order", None)
        except Exception:
            model = None
            predicted = np.array([], dtype=float)
            next_prediction = float("nan")
    else:
        model = None
        predicted = np.array([], dtype=float)
        next_prediction = float("nan")

    if model is None or len(predicted) != len(x_test):
        if SARIMAX is None:
            shifted = test_frame["Close"].to_numpy(dtype=float)
            fallback_predicted = np.roll(shifted, 1)
            if len(fallback_predicted) > 1:
                fallback_predicted[0] = float(train_frame["target"].iloc[-1])
            else:
                fallback_predicted[0] = float(train_frame["target"].iloc[-1])
            return {
                "timestamps": pd.DatetimeIndex(test_frame["target_timestamp"]),
                "actual": y_test,
                "predicted": fallback_predicted,
                "next_prediction": max(float(supervised["target"].iloc[-1]), 0.0),
                "metrics": _format_metrics(y_test, fallback_predicted),
                "model_note": "naive_fallback_no_sarimax",
                "order": None,
            }

        order = _select_sarimax_order(y_train, x_train)
        if order is None:
            shifted = test_frame["Close"].to_numpy(dtype=float)
            fallback_predicted = np.roll(shifted, 1)
            fallback_predicted[0] = float(train_frame["target"].iloc[-1])
            return {
                "timestamps": pd.DatetimeIndex(test_frame["target_timestamp"]),
                "actual": y_test,
                "predicted": fallback_predicted,
                "next_prediction": max(float(supervised["target"].iloc[-1]), 0.0),
                "metrics": _format_metrics(y_test, fallback_predicted),
                "model_note": "naive_fallback_no_valid_order",
                "order": None,
            }

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            eval_model = SARIMAX(
                y_train,
                exog=x_train,
                order=order,
                trend="c",
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit(disp=False)
            predicted = eval_model.get_forecast(
                steps=len(x_test),
                exog=x_test,
            ).predicted_mean.to_numpy(dtype=float)

            full_model = SARIMAX(
                supervised["target"].astype(float),
                exog=supervised[feature_columns].astype(float),
                order=order,
                trend="c",
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit(disp=False)
            next_prediction = float(
                full_model.get_forecast(
                    steps=1,
                    exog=next_feature_row.astype(float),
                ).predicted_mean.iloc[0]
            )
        model_note = "sarimax_fallback_with_engineered_features"

    return {
        "timestamps": pd.DatetimeIndex(test_frame["target_timestamp"]),
        "actual": y_test,
        "predicted": predicted,
        "next_prediction": max(next_prediction, 0.0),
        "metrics": _format_metrics(y_test, predicted),
        "model_note": model_note,
        "order": order,
    }


def _build_lstm_sequences(
    x_scaled: np.ndarray,
    y_scaled: np.ndarray,
    timestamps: pd.DatetimeIndex,
    steps: int,
) -> tuple[np.ndarray, np.ndarray, pd.DatetimeIndex, np.ndarray]:
    sequences = []
    targets = []
    target_timestamps: list[pd.Timestamp] = []
    target_indices = []
    for idx in range(steps - 1, len(x_scaled)):
        sequences.append(x_scaled[idx - steps + 1 : idx + 1])
        targets.append(y_scaled[idx])
        target_timestamps.append(pd.Timestamp(timestamps[idx]))
        target_indices.append(idx)

    if not sequences:
        return (
            np.empty((0, steps, x_scaled.shape[1]), dtype=float),
            np.empty((0,), dtype=float),
            pd.DatetimeIndex([]),
            np.empty((0,), dtype=int),
        )

    return (
        np.asarray(sequences, dtype=float),
        np.asarray(targets, dtype=float),
        pd.DatetimeIndex(target_timestamps),
        np.asarray(target_indices, dtype=int),
    )


def _predict_lstm(dataset: dict[str, Any]) -> dict[str, Any]:
    if MinMaxScaler is None:
        raise BtcForecastError("scikit-learn is required for the LSTM forecaster.")

    feature_columns = dataset["feature_columns"]
    supervised = dataset["supervised"]
    train_frame = dataset["train"]
    next_feature_row = dataset["next_feature_row"]

    x_all = supervised[feature_columns].to_numpy(dtype=float)
    y_all = supervised["target"].to_numpy(dtype=float)
    target_timestamps = pd.DatetimeIndex(supervised["target_timestamp"])
    split_index = len(train_frame)
    if split_index <= SEQUENCE_STEPS:
        raise BtcForecastError("Not enough train rows to build LSTM sequences.")

    x_scaler = MinMaxScaler()
    y_scaler = MinMaxScaler()
    x_scaler.fit(x_all[:split_index])
    y_scaler.fit(y_all[:split_index].reshape(-1, 1))

    x_all_scaled = x_scaler.transform(x_all)
    y_all_scaled = y_scaler.transform(y_all.reshape(-1, 1)).reshape(-1)
    next_feature_scaled = x_scaler.transform(next_feature_row.to_numpy(dtype=float))

    sequence_x, sequence_y, sequence_timestamps, sequence_indices = _build_lstm_sequences(
        x_all_scaled,
        y_all_scaled,
        target_timestamps,
        steps=SEQUENCE_STEPS,
    )
    if len(sequence_x) == 0:
        raise BtcForecastError("Unable to create LSTM sequence samples for BTC forecasting.")

    train_mask = sequence_indices < split_index
    test_mask = sequence_indices >= split_index
    x_train = sequence_x[train_mask]
    y_train = sequence_y[train_mask]
    x_test = sequence_x[test_mask]
    y_test_scaled = sequence_y[test_mask]
    test_timestamps = sequence_timestamps[test_mask]

    if len(x_train) < 64 or len(x_test) == 0:
        raise BtcForecastError("Insufficient train/test sequences for the LSTM forecaster.")

    model_note = "tensorflow_lstm_with_minmax_scaling"
    if tf is not None and Sequential is not None and Input is not None and LSTM is not None:
        tf.random.set_seed(42)
        model = Sequential(
            [
                Input(shape=(SEQUENCE_STEPS, x_train.shape[2])),
                LSTM(64, return_sequences=True),
                Dropout(0.2),
                LSTM(32),
                Dense(16, activation="relu"),
                Dense(1),
            ]
        )
        model.compile(optimizer="adam", loss="mse")

        callbacks = []
        if EarlyStopping is not None:
            callbacks.append(EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True))

        fit_kwargs: dict[str, Any] = {
            "epochs": 25,
            "batch_size": 32,
            "verbose": 0,
            "shuffle": False,
            "callbacks": callbacks,
        }
        if len(x_train) >= 128:
            fit_kwargs["validation_split"] = 0.1

        model.fit(x_train, y_train, **fit_kwargs)
        predicted_scaled = model.predict(x_test, verbose=0).reshape(-1)
        if SEQUENCE_STEPS > 1:
            next_sequence = np.concatenate(
                [x_all_scaled[-(SEQUENCE_STEPS - 1) :], next_feature_scaled],
                axis=0,
            ).reshape(1, SEQUENCE_STEPS, x_train.shape[2])
        else:
            next_sequence = next_feature_scaled.reshape(1, SEQUENCE_STEPS, x_train.shape[2])
        next_prediction_scaled = float(model.predict(next_sequence, verbose=0).reshape(-1)[0])
    elif MLPRegressor is not None:
        model_note = "sequence_mlp_fallback_with_minmax_scaling"
        x_train_flat = x_train.reshape((x_train.shape[0], -1))
        x_test_flat = x_test.reshape((x_test.shape[0], -1))
        model = MLPRegressor(hidden_layer_sizes=(128, 64), max_iter=600, random_state=42)
        model.fit(x_train_flat, y_train)
        predicted_scaled = model.predict(x_test_flat).reshape(-1)
        if SEQUENCE_STEPS > 1:
            next_sequence = np.concatenate(
                [x_all_scaled[-(SEQUENCE_STEPS - 1) :], next_feature_scaled],
                axis=0,
            ).reshape(1, -1)
        else:
            next_sequence = next_feature_scaled.reshape(1, -1)
        next_prediction_scaled = float(model.predict(next_sequence)[0])
    else:
        model_note = "naive_sequence_fallback"
        predicted_scaled = x_test[:, -1, 0]
        next_prediction_scaled = float(next_feature_scaled[0, 0])

    actual = y_scaler.inverse_transform(y_test_scaled.reshape(-1, 1)).reshape(-1)
    predicted = y_scaler.inverse_transform(predicted_scaled.reshape(-1, 1)).reshape(-1)
    next_prediction = y_scaler.inverse_transform(
        np.array([[next_prediction_scaled]], dtype=float)
    ).reshape(-1)[0]

    return {
        "timestamps": pd.DatetimeIndex(test_timestamps),
        "actual": actual,
        "predicted": predicted,
        "next_prediction": max(float(next_prediction), 0.0),
        "metrics": _format_metrics(actual, predicted),
        "model_note": model_note,
    }


def _build_forecast_payload(bundle: dict[str, Any]) -> dict[str, Any]:
    dataset = _build_supervised_dataset(bundle["model_frame"])
    next_timestamp = dataset["next_timestamp"]

    linear_output = _predict_linear_regression(dataset)
    arima_output = _predict_arima(dataset)
    lstm_output = _predict_lstm(dataset)

    row_map: dict[pd.Timestamp, dict[str, Any]] = {}
    for output in (linear_output, arima_output, lstm_output):
        for timestamp, actual_value, predicted_value in zip(
            output["timestamps"],
            output["actual"],
            output["predicted"],
        ):
            ts = pd.Timestamp(timestamp)
            row = row_map.setdefault(
                ts,
                {
                    "timestamp": ts.isoformat(),
                    "actual_price": round(float(actual_value), 4) if actual_value is not None else None,
                    "lr_prediction": None,
                    "lr_error": None,
                    "arima_prediction": None,
                    "arima_error": None,
                    "lstm_prediction": None,
                    "lstm_error": None,
                    "is_next_forecast": False,
                },
            )
            row["actual_price"] = round(float(actual_value), 4) if actual_value is not None else None

            if output is linear_output:
                row["lr_prediction"] = round(float(predicted_value), 4)
                row["lr_error"] = (
                    round(abs(float(actual_value) - float(predicted_value)), 4)
                    if actual_value is not None
                    else None
                )
            elif output is arima_output:
                row["arima_prediction"] = round(float(predicted_value), 4)
                row["arima_error"] = (
                    round(abs(float(actual_value) - float(predicted_value)), 4)
                    if actual_value is not None
                    else None
                )
            else:
                row["lstm_prediction"] = round(float(predicted_value), 4)
                row["lstm_error"] = (
                    round(abs(float(actual_value) - float(predicted_value)), 4)
                    if actual_value is not None
                    else None
                )

    history_rows = [row_map[timestamp] for timestamp in sorted(row_map.keys())]
    next_row = {
        "timestamp": next_timestamp.isoformat(),
        "actual_price": None,
        "lr_prediction": round(float(linear_output["next_prediction"]), 4),
        "lr_error": None,
        "arima_prediction": round(float(arima_output["next_prediction"]), 4),
        "arima_error": None,
        "lstm_prediction": round(float(lstm_output["next_prediction"]), 4),
        "lstm_error": None,
        "is_next_forecast": True,
    }

    metrics = {
        "linear_regression": linear_output["metrics"],
        "arima": arima_output["metrics"],
        "lstm": lstm_output["metrics"],
    }

    return {
        "ticker": BTC_TICKER,
        "next_forecast_timestamp": next_timestamp.isoformat(),
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "rows": [next_row] + list(reversed(history_rows)),
        "chart_rows": history_rows + [next_row],
        "metrics": metrics,
        "model_notes": {
            "linear_regression": linear_output["model_note"],
            "arima": arima_output["model_note"],
            "lstm": lstm_output["model_note"],
            "arima_order": arima_output.get("order"),
            "sequence_steps": SEQUENCE_STEPS,
            "lag_features": LAG_FEATURES,
            "rolling_window": ROLLING_WINDOW,
            "train_rows": int(len(dataset["train"])),
            "test_rows": int(len(dataset["test"])),
            "train_split_ratio": TRAIN_SPLIT_RATIO,
            "auto_arima_available": bool(auto_arima is not None),
            "tensorflow_available": bool(tf is not None),
        },
    }


def get_btc_history() -> dict[str, Any]:
    bundle = _get_processed_bundle()
    frame = bundle["frame"]
    data_rows = []
    for ts, row in frame.iterrows():
        data_rows.append(
            {
                "timestamp": pd.Timestamp(ts).isoformat(),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": round(float(row["Volume"]), 4),
                "rolling_mean_24": round(float(row["rolling_mean_24"]), 4)
                if pd.notna(row["rolling_mean_24"])
                else None,
                "rolling_volatility_24": round(float(row["rolling_volatility_24"]), 8)
                if pd.notna(row["rolling_volatility_24"])
                else None,
                "is_outlier": bool(row["is_outlier"]),
            }
        )

    return {"summary": dict(bundle["summary"]), "data": data_rows}


def get_btc_forecast() -> dict[str, Any]:
    global _forecast_cache
    now = time.time()
    bundle = _get_processed_bundle()
    latest_timestamp = pd.Timestamp(bundle["model_frame"].index.max())

    if _forecast_cache and (now - _forecast_cache[0]) < _CACHE_TTL_SECONDS:
        cached_payload, cached_latest = _forecast_cache[1], _forecast_cache[2]
        if cached_latest == latest_timestamp:
            return dict(cached_payload)

    payload = _build_forecast_payload(bundle)
    _forecast_cache = (now, dict(payload), latest_timestamp)
    return payload
