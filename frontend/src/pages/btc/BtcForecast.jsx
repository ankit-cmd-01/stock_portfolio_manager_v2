import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import useChartTheme from "../../hooks/useChartTheme";
import { getBtcForecast, getBtcHistory } from "../../services/portfolioApi";

const TABLE_PAGE_SIZE = 20;

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatDateTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || "");
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const downsample = (rows, maxPoints = 900) => {
  if (!Array.isArray(rows) || rows.length <= maxPoints) return rows || [];
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, idx) => idx % step === 0 || idx === rows.length - 1);
};

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatCurrency = (value) => {
  const n = toNumberOrNull(value);
  return n === null ? "N/A" : USD_FORMATTER.format(n);
};

const formatVolatility = (value) => {
  const n = toNumberOrNull(value);
  return n === null ? "N/A" : `${(n * 100).toFixed(3)}%`;
};

const formatMetric = (value, suffix = "") => {
  const n = toNumberOrNull(value);
  return n === null ? "N/A" : `${n.toFixed(4)}${suffix}`;
};

const formatCompactNumber = (value) => {
  const n = toNumberOrNull(value);
  return n === null ? "N/A" : new Intl.NumberFormat("en-US").format(n);
};

function BtcForecast() {
  const chartTheme = useChartTheme();
  const [historyPayload, setHistoryPayload] = useState(null);
  const [forecastPayload, setForecastPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tablePage, setTablePage] = useState(1);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [history, forecast] = await Promise.all([getBtcHistory(), getBtcForecast()]);
      setHistoryPayload(history);
      setForecastPayload(forecast);
    } catch (err) {
      setError(err.message || "Unable to load BTC forecasting data.");
      setHistoryPayload(null);
      setForecastPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const historyRows = useMemo(() => {
    const raw = Array.isArray(historyPayload?.data) ? historyPayload.data : [];
    return downsample(raw, 900);
  }, [historyPayload]);

  const trendRows = useMemo(
    () =>
      historyRows.map((row) => ({
        timestamp: row.timestamp,
        close: toNumberOrNull(row.close),
        rolling_mean_24: toNumberOrNull(row.rolling_mean_24),
      })),
    [historyRows]
  );

  const volatilityRows = useMemo(
    () =>
      historyRows.map((row) => ({
        timestamp: row.timestamp,
        rolling_volatility_24: toNumberOrNull(row.rolling_volatility_24),
      })),
    [historyRows]
  );

  const forecastChartRows = useMemo(
    () => (Array.isArray(forecastPayload?.chart_rows) ? forecastPayload.chart_rows : []),
    [forecastPayload]
  );

  const forecastTableRows = useMemo(
    () => (Array.isArray(forecastPayload?.rows) ? forecastPayload.rows : []),
    [forecastPayload]
  );
  const forecastChartDomain = useMemo(() => {
    const values = forecastChartRows.flatMap((row) =>
      ["actual_price", "lr_prediction", "arima_prediction", "lstm_prediction"]
        .map((key) => toNumberOrNull(row[key]))
        .filter((value) => value !== null)
    );

    if (values.length === 0) {
      return { min: 0, max: 1 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const padding = Math.max(range * 0.18, min * 0.01, 250);

    return {
      min: Math.max(0, min - padding),
      max: max + padding,
    };
  }, [forecastChartRows]);
  const tablePageCount = useMemo(
    () => Math.max(1, Math.ceil(forecastTableRows.length / TABLE_PAGE_SIZE)),
    [forecastTableRows.length]
  );
  const paginatedForecastRows = useMemo(() => {
    const startIndex = (tablePage - 1) * TABLE_PAGE_SIZE;
    return forecastTableRows.slice(startIndex, startIndex + TABLE_PAGE_SIZE);
  }, [forecastTableRows, tablePage]);

  const metrics = forecastPayload?.metrics || {};
  const summary = historyPayload?.summary || {};
  const panelClass = chartTheme.panelCardClass;
  const metricCardClass = chartTheme.metricCardClass;
  const panelTitleClass = chartTheme.panelTitleClass;
  const bodyTextClass = chartTheme.bodyTextClass;
  const mutedTextClass = chartTheme.mutedTextClass;
  const tableRangeStart = forecastTableRows.length === 0 ? 0 : (tablePage - 1) * TABLE_PAGE_SIZE + 1;
  const tableRangeEnd = Math.min(tablePage * TABLE_PAGE_SIZE, forecastTableRows.length);

  useEffect(() => {
    setTablePage(1);
  }, [forecastTableRows]);

  return (
    <div className="space-y-6">
      <Card className={chartTheme.heroCardClass}>
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={chartTheme.sectionTitleClass}>BTC Price Forecasting</p>
            <p className={`mt-2 ${bodyTextClass}`}>
              See recent Bitcoin price movement, how much it has been swinging, and where different models expect the next price to go.
            </p>
          </div>
          <Button onClick={loadData} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={metricCardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Market</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">{summary.ticker || "BTC-USD"}</p>
          <p className={`mt-2 text-sm ${bodyTextClass}`}>The Bitcoin price feed used for this forecast.</p>
        </Card>
        <Card className={metricCardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Price Points Checked</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">{formatCompactNumber(summary.processed_rows ?? 0)}</p>
          <p className={`mt-2 text-sm ${bodyTextClass}`}>How many hourly price records were used in the analysis.</p>
        </Card>
        <Card className={metricCardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Unusual Price Moves</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">{formatCompactNumber(summary.outlier_rows_detected ?? 0)}</p>
          <p className={`mt-2 text-sm ${bodyTextClass}`}>Large jumps or drops that looked unusual compared with normal movement.</p>
        </Card>
        <Card className={metricCardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Trend Stability Check</p>
          <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">
            {summary.adf_p_value ?? "N/A"}
          </p>
          <p className={`mt-2 text-sm ${bodyTextClass}`}>A technical signal showing whether the price pattern is stable enough for time-series forecasting.</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className={panelClass}>
          <div className="mb-4">
            <p className={panelTitleClass}>BTC Trend with 24h Average</p>
            <p className={bodyTextClass}>
              The orange line is the actual BTC price. The blue line smooths the last 24 hours so the overall direction is easier to see.
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows} margin={{ left: 6, right: 12, top: 10, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timestamp" stroke={chartTheme.axis} fontSize={11} minTickGap={36} tickFormatter={formatDateTime} />
                <YAxis
                  stroke={chartTheme.axis}
                  fontSize={11}
                  tickFormatter={(value) => formatCurrency(value)}
                  width={90}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltipStyle}
                  labelFormatter={(label) => formatDateTime(label)}
                  formatter={(value, name) => [formatCurrency(value), name === "close" ? "Close" : "Rolling Mean (24h)"]}
                />
                <Legend wrapperStyle={chartTheme.legendStyle} />
                <Line type="monotone" dataKey="close" name="BTC Close" stroke="#f59e0b" strokeWidth={2.1} dot={false} />
                <Line type="monotone" dataKey="rolling_mean_24" name="Rolling Mean (24h)" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className={panelClass}>
          <div className="mb-4">
            <p className={panelTitleClass}>Price Swing Level (24h)</p>
            <p className={bodyTextClass}>
              This shows how jumpy Bitcoin has been over the last 24 hours. Higher spikes mean more sudden price movement.
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volatilityRows} margin={{ left: 6, right: 12, top: 10, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timestamp" stroke={chartTheme.axis} fontSize={11} minTickGap={36} tickFormatter={formatDateTime} />
                <YAxis
                  stroke={chartTheme.axis}
                  fontSize={11}
                  tickFormatter={(value) => formatVolatility(value)}
                  width={82}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltipStyle}
                  labelFormatter={(label) => formatDateTime(label)}
                  formatter={(value) => [formatVolatility(value), "Price Swing Level (24h)"]}
                />
                <Legend wrapperStyle={chartTheme.legendStyle} />
                <Line
                  type="monotone"
                  dataKey="rolling_volatility_24"
                  name="Price Swing Level"
                  stroke="#60a5fa"
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card className={panelClass}>
        <div className="mb-4">
          <p className={panelTitleClass}>Forecast Chart</p>
          <p className={bodyTextClass}>
            Compare the real BTC price with the prices predicted by each forecasting model.
          </p>
          <p className={`mt-1 text-xs ${mutedTextClass}`}>
            The chart is zoomed to the forecast range so smaller differences between lines are easier to spot.
          </p>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastChartRows} margin={{ left: 6, right: 12, top: 10, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="timestamp" stroke={chartTheme.axis} fontSize={11} minTickGap={28} tickFormatter={formatDateTime} />
              <YAxis
                stroke={chartTheme.axis}
                fontSize={11}
                tickFormatter={(value) => formatCurrency(value)}
                width={90}
                domain={[forecastChartDomain.min, forecastChartDomain.max]}
              />
              <Tooltip
                contentStyle={chartTheme.tooltipStyle}
                labelFormatter={(label) => formatDateTime(label)}
                formatter={(value, name) => [formatCurrency(value), name]}
              />
              <Legend wrapperStyle={chartTheme.legendStyle} />
              <Line
                type="monotone"
                dataKey="actual_price"
                name="Actual Price"
                stroke={chartTheme.isDark ? "#f8fafc" : "#0f172a"}
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lr_prediction"
                name="Linear Regression"
                stroke="#22c55e"
                strokeWidth={2.2}
                strokeDasharray="8 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="arima_prediction"
                name="ARIMA"
                stroke="#f59e0b"
                strokeWidth={2.4}
                strokeDasharray="3 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lstm_prediction"
                name="LSTM"
                stroke="#60a5fa"
                strokeWidth={2.2}
                strokeDasharray="10 3 2 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className={panelClass}>
        <div className="mb-4">
          <p className={panelTitleClass}>Forecast Details Table</p>
          <p className={bodyTextClass}>
            The first row is the next-hour forecast. "Gap" means how far a model prediction was from the real price when the real price is known.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className={chartTheme.tableClass}>
            <thead>
              <tr className={chartTheme.tableHeadClass}>
                <th className="py-3 font-medium">Timestamp</th>
                <th className="py-3 font-medium">Actual Price</th>
                <th className="py-3 font-medium">Linear Regression Forecast</th>
                <th className="py-3 font-medium">Linear Regression Gap</th>
                <th className="py-3 font-medium">ARIMA Forecast</th>
                <th className="py-3 font-medium">ARIMA Gap</th>
                <th className="py-3 font-medium">LSTM Forecast</th>
                <th className="py-3 font-medium">LSTM Gap</th>
              </tr>
            </thead>
            <tbody className={chartTheme.tableBodyClass}>
              {paginatedForecastRows.map((row) => (
                <tr key={row.timestamp} className={row.is_next_forecast ? "bg-amber-500/10" : ""}>
                  <td className="py-3 text-slate-900 dark:text-slate-100">
                    <p className="font-semibold">{formatDateTime(row.timestamp)}</p>
                    {row.is_next_forecast ? (
                      <span className="mt-1 inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Next Hour Forecast
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-200">{formatCurrency(row.actual_price)}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-200">{formatCurrency(row.lr_prediction)}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-200">{formatCurrency(row.lr_error)}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-200">{formatCurrency(row.arima_prediction)}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-200">{formatCurrency(row.arima_error)}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-200">{formatCurrency(row.lstm_prediction)}</td>
                  <td className="py-3 text-slate-600 dark:text-slate-200">{formatCurrency(row.lstm_error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {forecastTableRows.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${bodyTextClass}`}>
              Showing {tableRangeStart}-{tableRangeEnd} of {forecastTableRows.length} rows
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setTablePage((current) => Math.max(1, current - 1))}
                disabled={tablePage === 1}
                className="px-3 py-2 text-xs"
              >
                Previous
              </Button>
              <span className="min-w-24 text-center text-sm font-medium text-slate-900 dark:text-slate-100">
                Page {tablePage} of {tablePageCount}
              </span>
              <Button
                variant="outline"
                onClick={() => setTablePage((current) => Math.min(tablePageCount, current + 1))}
                disabled={tablePage === tablePageCount}
                className="px-3 py-2 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border border-emerald-500/40 bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Linear Regression</p>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-100">A simple trend-based model that follows recent movement.</p>
          <div className="mt-3 space-y-1 text-sm text-emerald-800 dark:text-emerald-100">
            <p>Average miss: {formatMetric(metrics?.linear_regression?.mae)}</p>
            <p>Bigger misses: {formatMetric(metrics?.linear_regression?.rmse)}</p>
            <p>Average % miss: {formatMetric(metrics?.linear_regression?.mape, "%")}</p>
          </div>
        </Card>
        <Card className="border border-amber-500/40 bg-amber-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">ARIMA</p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-100">A time-series model that looks for repeating short-term price patterns.</p>
          <div className="mt-3 space-y-1 text-sm text-amber-800 dark:text-amber-100">
            <p>Average miss: {formatMetric(metrics?.arima?.mae)}</p>
            <p>Bigger misses: {formatMetric(metrics?.arima?.rmse)}</p>
            <p>Average % miss: {formatMetric(metrics?.arima?.mape, "%")}</p>
          </div>
        </Card>
        <Card className="border border-cyan-500/40 bg-cyan-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-200">LSTM</p>
          <p className="mt-2 text-sm text-cyan-800 dark:text-cyan-100">A neural-network model designed to learn patterns across longer sequences.</p>
          <div className="mt-3 space-y-1 text-sm text-cyan-800 dark:text-cyan-100">
            <p>Average miss: {formatMetric(metrics?.lstm?.mae)}</p>
            <p>Bigger misses: {formatMetric(metrics?.lstm?.rmse)}</p>
            <p>Average % miss: {formatMetric(metrics?.lstm?.mape, "%")}</p>
          </div>
        </Card>
      </section>

    </div>
  );
}

export default BtcForecast;
