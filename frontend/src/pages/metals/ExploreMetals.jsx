import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import useChartTheme from "../../hooks/useChartTheme";
import { getMetalsHistory, predictMetalPrice } from "../../services/portfolioApi";

const VOLATILITY_WINDOW_DAYS = 30;

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "N/A";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatCompactCurrency = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "N/A";
  return `INR ${Math.round(parsed).toLocaleString("en-IN")}`;
};

const formatAxisTickCurrency = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "N/A";
  const compact = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(parsed);
  return `INR ${compact}`;
};

const formatPercent = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "N/A";
  return new Intl.NumberFormat("en-IN", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
};

const defaultFutureDate = () => {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return next.toISOString().slice(0, 10);
};

const computeRegression = (points, xKey, yKey) => {
  if (points.length < 2) return null;

  const n = points.length;
  const sumX = points.reduce((acc, point) => acc + point[xKey], 0);
  const sumY = points.reduce((acc, point) => acc + point[yKey], 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;
  points.forEach((point) => {
    const dx = point[xKey] - meanX;
    const dy = point[yKey] - meanY;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  });

  if (ssXX === 0) return null;

  const slope = ssXY / ssXX;
  const intercept = meanY - (slope * meanX);
  const correlation = ssYY === 0 ? 0 : ssXY / Math.sqrt(ssXX * ssYY);

  return {
    slope,
    intercept,
    rSquared: correlation * correlation,
  };
};

const paddedDomain = (minValue, maxValue) => {
  const min = toNumberOrNull(minValue);
  const max = toNumberOrNull(maxValue);
  if (min === null || max === null) {
    return [0, "auto"];
  }
  if (min === max) {
    const pad = Math.abs(min || 1) * 0.05;
    return [min - pad, max + pad];
  }
  const span = max - min;
  const pad = span * 0.08;
  return [min - pad, max + pad];
};

const calculateStandardDeviation = (values) => {
  if (values.length < 2) return null;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1);

  return Math.sqrt(variance);
};

const buildRollingVolatilityData = (points, windowSize) => {
  if (points.length <= windowSize) return [];

  const dailyReturns = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (
      previous.gold_price_inr_per_gram <= 0 ||
      previous.silver_price_inr_per_gram <= 0
    ) {
      continue;
    }

    dailyReturns.push({
      date: current.date,
      gold_return:
        (current.gold_price_inr_per_gram / previous.gold_price_inr_per_gram) - 1,
      silver_return:
        (current.silver_price_inr_per_gram / previous.silver_price_inr_per_gram) - 1,
    });
  }

  const rollingVolatility = [];

  for (let index = windowSize - 1; index < dailyReturns.length; index += 1) {
    const window = dailyReturns.slice(index - windowSize + 1, index + 1);
    rollingVolatility.push({
      date: dailyReturns[index].date,
      gold_volatility: calculateStandardDeviation(window.map((entry) => entry.gold_return)),
      silver_volatility: calculateStandardDeviation(window.map((entry) => entry.silver_return)),
    });
  }

  return rollingVolatility;
};

function ExploreMetals() {
  const chartTheme = useChartTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMetal, setSelectedMetal] = useState("gold");
  const [predictionDate, setPredictionDate] = useState(defaultFutureDate());
  const [predicting, setPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState("");
  const [predictionResult, setPredictionResult] = useState(null);
  const dateInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadMetalsData = async () => {
      try {
        setLoading(true);
        setError("");
        const historyPayload = await getMetalsHistory();
        if (!mounted) return;
        setHistory(Array.isArray(historyPayload) ? historyPayload : []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load metals analysis.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMetalsData();
    return () => {
      mounted = false;
    };
  }, []);

  const trendData = useMemo(
    () =>
      history
        .map((row) => ({
          date: row.date,
          gold_price_inr_per_gram: toNumberOrNull(row.gold_price_inr_per_gram),
          silver_price_inr_per_gram: toNumberOrNull(row.silver_price_inr_per_gram),
        }))
        .filter(
          (row) =>
            row.gold_price_inr_per_gram !== null &&
            row.silver_price_inr_per_gram !== null
        ),
    [history]
  );

  const scatterGoldSilver = useMemo(() => {
    const base = trendData.map((point) => ({
      x_gold: point.gold_price_inr_per_gram,
      y_silver: point.silver_price_inr_per_gram,
    }));
    const regression = computeRegression(base, "x_gold", "y_silver");
    const data = [...base]
      .sort((a, b) => a.x_gold - b.x_gold)
      .map((point) => ({
        ...point,
        regression_line: regression
          ? (regression.slope * point.x_gold) + regression.intercept
          : null,
    }));
    return { data, regression };
  }, [trendData]);

  const volatilityComparisonData = useMemo(
    () => buildRollingVolatilityData(trendData, VOLATILITY_WINDOW_DAYS),
    [trendData]
  );

  const goldValues = useMemo(
    () =>
      trendData
        .map((point) => point.gold_price_inr_per_gram)
        .filter((value) => value !== null),
    [trendData]
  );
  const silverValues = useMemo(
    () =>
      trendData
        .map((point) => point.silver_price_inr_per_gram)
        .filter((value) => value !== null),
    [trendData]
  );

  const goldDomain = useMemo(() => {
    if (goldValues.length === 0) return [0, "auto"];
    return paddedDomain(Math.min(...goldValues), Math.max(...goldValues));
  }, [goldValues]);

  const silverDomain = useMemo(() => {
    if (silverValues.length === 0) return [0, "auto"];
    return paddedDomain(Math.min(...silverValues), Math.max(...silverValues));
  }, [silverValues]);

  const goldSilverXDomain = useMemo(() => {
    const values = scatterGoldSilver.data.map((point) => point.x_gold);
    if (values.length === 0) return [0, "auto"];
    return paddedDomain(Math.min(...values), Math.max(...values));
  }, [scatterGoldSilver.data]);

  const goldSilverYDomain = useMemo(() => {
    const values = scatterGoldSilver.data.map((point) => point.y_silver);
    if (values.length === 0) return [0, "auto"];
    return paddedDomain(Math.min(...values), Math.max(...values));
  }, [scatterGoldSilver.data]);

  const volatilityDomain = useMemo(() => {
    const values = volatilityComparisonData
      .flatMap((point) => [point.gold_volatility, point.silver_volatility])
      .filter((value) => value !== null);
    if (values.length === 0) return [0, "auto"];
    return paddedDomain(Math.min(...values), Math.max(...values));
  }, [volatilityComparisonData]);

  const handlePredict = async () => {
    if (!predictionDate) {
      setPredictionError("Please select a prediction date.");
      return;
    }

    try {
      setPredicting(true);
      setPredictionError("");
      const payload = await predictMetalPrice({
        metal: selectedMetal,
        date: predictionDate,
      });
      setPredictionResult(payload);
    } catch (err) {
      setPredictionResult(null);
      setPredictionError(err.message || "Unable to predict metal price.");
    } finally {
      setPredicting(false);
    }
  };

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        input.focus();
      }
      return;
    }
    input.focus();
  };

  const panelClass = chartTheme.panelCardClass;
  const panelTitleClass = chartTheme.panelTitleClass;
  const bodyTextClass = chartTheme.bodyTextClass;
  const mutedTextClass = chartTheme.mutedTextClass;
  const controlClass = chartTheme.controlClass;

  return (
    <div className="space-y-6">
      <Card className={chartTheme.heroCardClass}>
        <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative">
          <p className={chartTheme.sectionTitleClass}>Explore Metals</p>
          <p className={`mt-2 ${bodyTextClass}`}>
            Analyze 1-year trends and correlations with values in INR per gram, plus future prediction by selected date.
          </p>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      <Card className={panelClass}>
        <div className="mb-4">
          <p className={panelTitleClass}>Gold vs Silver Price Trend</p>
          <p className={bodyTextClass}>Last 1 year daily close prices in INR per gram</p>
          <p className={`mt-1 ${mutedTextClass}`}>
            X axis: trading date. Left Y axis: Gold price (INR/g). Right Y axis: Silver price (INR/g).
          </p>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis
                dataKey="date"
                stroke={chartTheme.axis}
                fontSize={11}
                minTickGap={38}
                tickMargin={10}
                interval="preserveStartEnd"
                tickFormatter={formatDateLabel}
              />
              <YAxis
                yAxisId="gold"
                stroke={chartTheme.axis}
                fontSize={11}
                tickFormatter={formatAxisTickCurrency}
                domain={goldDomain}
                tickCount={5}
                width={66}
              />
              <YAxis
                yAxisId="silver"
                orientation="right"
                stroke={chartTheme.axis}
                fontSize={11}
                tickFormatter={formatAxisTickCurrency}
                domain={silverDomain}
                tickCount={5}
                width={66}
              />
              <Tooltip
                contentStyle={chartTheme.tooltipStyle}
                labelFormatter={(label) => new Date(label).toLocaleDateString("en-IN")}
                formatter={(value, name) => [
                  `${formatCurrency(value)} / g`,
                  name === "gold_price_inr_per_gram" || name === "Gold Price (INR/g)"
                    ? "Gold Price (INR/g)"
                    : "Silver Price (INR/g)",
                ]}
              />
              <Legend wrapperStyle={chartTheme.legendStyle} />
              <Line
                yAxisId="gold"
                type="monotone"
                dataKey="gold_price_inr_per_gram"
                name="Gold Price (INR/g)"
                stroke="#facc15"
                strokeWidth={2.4}
                dot={false}
              />
              <Line
                yAxisId="silver"
                type="monotone"
                dataKey="silver_price_inr_per_gram"
                name="Silver Price (INR/g)"
                stroke="#38bdf8"
                strokeWidth={2.4}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className={panelClass}>
          <div className="mb-4">
            <p className={panelTitleClass}>Gold vs Silver Correlation</p>
            <p className={bodyTextClass}>
              This chart shows how silver prices usually move when gold prices go up or down.
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={scatterGoldSilver.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  type="number"
                  dataKey="x_gold"
                  name="Gold Price"
                  stroke={chartTheme.axis}
                  fontSize={11}
                  tickFormatter={formatAxisTickCurrency}
                  domain={goldSilverXDomain}
                  tickCount={5}
                  tickMargin={8}
                  label={{
                    value: "Gold Price (INR/g)",
                    position: "insideBottom",
                    offset: -4,
                    style: { fill: chartTheme.axis, fontSize: 12 },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y_silver"
                  name="Silver Price"
                  stroke={chartTheme.axis}
                  fontSize={11}
                  tickFormatter={formatAxisTickCurrency}
                  domain={goldSilverYDomain}
                  tickCount={5}
                  width={66}
                  label={{
                    value: "Silver Price (INR/g)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: chartTheme.axis, fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltipStyle}
                  formatter={(value, name) => [
                    `${formatCurrency(value)} / g`,
                    name === "x_gold"
                      ? "Gold price"
                      : name === "y_silver"
                        ? "Silver price"
                        : "Typical silver price from the overall trend",
                  ]}
                />
                <Legend wrapperStyle={chartTheme.legendStyle} />
                <Scatter name="Daily Price Pair" dataKey="y_silver" fill="#f97316" />
                {scatterGoldSilver.regression ? (
                  <Line
                    type="monotone"
                    dataKey="regression_line"
                    name="Regression Trend Line"
                    stroke="#06b6d4"
                    strokeWidth={2.2}
                    dot={false}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className={panelClass}>
          <div className="mb-4">
            <p className={panelTitleClass}>Volatility Comparison</p>
            <p className={bodyTextClass}>
              Rolling 30-day price volatility — lower means more stable
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volatilityComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="date"
                  stroke={chartTheme.axis}
                  fontSize={11}
                  minTickGap={38}
                  tickMargin={10}
                  interval="preserveStartEnd"
                  tickFormatter={formatDateLabel}
                />
                <YAxis
                  stroke={chartTheme.axis}
                  fontSize={11}
                  tickFormatter={formatPercent}
                  domain={volatilityDomain}
                  tickCount={5}
                  width={66}
                  label={{
                    value: "30-Day Volatility",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: chartTheme.axis, fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltipStyle}
                  labelFormatter={(label) => new Date(label).toLocaleDateString("en-IN")}
                  formatter={(value, name) => [
                    formatPercent(value),
                    name === "gold_volatility"
                      ? "Gold 30-day volatility"
                      : "Silver 30-day volatility",
                  ]}
                />
                <Legend wrapperStyle={chartTheme.legendStyle} />
                <Line
                  type="monotone"
                  dataKey="gold_volatility"
                  name="Gold 30-day volatility"
                  stroke="#facc15"
                  strokeWidth={2.4}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="silver_volatility"
                  name="Silver 30-day volatility"
                  stroke="#38bdf8"
                  strokeWidth={2.4}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card className={panelClass}>
        <div className="mb-4">
          <p className={panelTitleClass}>Prediction Tool</p>
          <p className={bodyTextClass}>
            Select metal and future date to estimate INR per gram using recent price movement and short-term trend.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[180px_220px_auto] md:items-end">
          <div className="space-y-1">
            <label className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Metal</label>
            <select
              value={selectedMetal}
              onChange={(event) => setSelectedMetal(event.target.value)}
              className={controlClass}
            >
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Future Date</label>
            <div className="relative">
              <input
                ref={dateInputRef}
                type="date"
                value={predictionDate}
                onChange={(event) => setPredictionDate(event.target.value)}
                onClick={openDatePicker}
                onFocus={openDatePicker}
                className={controlClass}
              />
            </div>
          </div>

          <Button onClick={handlePredict} disabled={predicting || loading}>
            {predicting ? "Predicting..." : "Predict"}
          </Button>
        </div>

        {predictionError ? (
          <p className="mt-3 text-sm text-red-500 dark:text-red-400">{predictionError}</p>
        ) : null}

        {predictionResult ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/80">
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Current Price</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(predictionResult.current_price_inr_per_gram)} / g
              </p>
              <p className={`mt-1 ${mutedTextClass}`}>
                Latest history date: {predictionResult.latest_history_date}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Predicted Price</p>
              <p className="mt-2 font-display text-2xl font-semibold text-emerald-800 dark:text-emerald-100">
                {formatCurrency(predictionResult.predicted_price_inr_per_gram)} / g
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
                For {predictionResult.metal.toUpperCase()} on {predictionResult.date}
              </p>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default ExploreMetals;
