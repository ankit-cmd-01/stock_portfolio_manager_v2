
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import {
  getPortfolioRiskAnalysis,
  getPortfolios,
  getStockRiskAnalysis,
  searchStocks,
} from "../../services/portfolioApi";
import useChartTheme from "../../hooks/useChartTheme";

const RISK_COLORS = { "Low Risk": "#22c55e", "Medium Risk": "#f59e0b", "High Risk": "#ef4444" };
const toNumberOrNull = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const formatRatioPercent = (v) => (toNumberOrNull(v) === null ? "N/A" : `${(Number(v) * 100).toFixed(2)}%`);
const formatValuePercent = (v) => (toNumberOrNull(v) === null ? "N/A" : `${Number(v).toFixed(2)}%`);
const formatScatterPercent = (v) => (toNumberOrNull(v) === null ? "N/A" : `${(Number(v) * 100).toFixed(1)}%`);
const formatSignedRatioPercent = (v, positiveWord = "Up", negativeWord = "Down") => {
  const n = toNumberOrNull(v);
  if (n === null) return "N/A";
  if (n > 0) return `${positiveWord} ${(n * 100).toFixed(2)}%`;
  if (n < 0) return `${negativeWord} ${Math.abs(n * 100).toFixed(2)}%`;
  return "Flat";
};
const formatDrawdownLabel = (v) => {
  const n = toNumberOrNull(v);
  if (n === null) return "N/A";
  if (n < 0) return `${Math.abs(n * 100).toFixed(2)}% below peak`;
  if (n > 0) return `${(n * 100).toFixed(2)}% above prior peak`;
  return "At recent peak";
};
const formatDateLabel = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v || "") : d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }); };
const formatCurrency = (v, c = "INR") => {
  const n = toNumberOrNull(v);
  if (n === null) return "N/A";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n); }
  catch { return `${c} ${n.toFixed(2)}`; }
};
const formatCompactCurrency = (v, c = "INR") => {
  const n = toNumberOrNull(v);
  if (n === null) return "N/A";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: c, notation: "compact", maximumFractionDigits: 2 }).format(n); }
  catch { return formatCurrency(v, c); }
};
const formatLargeNumber = (v) => {
  const n = toNumberOrNull(v);
  if (n === null) return "N/A";
  if (Math.abs(n) >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return Math.round(n).toLocaleString("en-IN");
};
const getCurrencyLabel = (currencyCode) => (currencyCode === "INR" ? "₹" : currencyCode || "");
const paddedDomain = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return [0, "auto"];
  const min = Math.min(...arr); const max = Math.max(...arr);
  if (min === max) { const pad = Math.abs(min || 0.01) * 0.2; return [min - pad, max + pad]; }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
};
const riskBadgeStyle = (r) => ({
  color: RISK_COLORS[r] || "#cbd5e1",
  backgroundColor: r === "Low Risk" ? "rgba(34,197,94,0.15)" : r === "Medium Risk" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
});

const insightToneClasses = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  negative: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
  warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  neutral: "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100",
};

const insightToneLabels = {
  positive: "Looks Healthy",
  negative: "Needs Caution",
  warning: "Watch Closely",
  neutral: "For Context",
};

const describeReturn = (value, periodLabel) => {
  const n = toNumberOrNull(value);
  if (n === null) {
    return {
      summary: "No recent data",
      detail: `No ${periodLabel.toLowerCase()} return is available.`,
      tone: "neutral",
    };
  }
  if (n >= 0.12) return { summary: `Strong ${periodLabel.toLowerCase()} gain`, detail: `The stock has risen sharply over the last ${periodLabel.toLowerCase()}.`, tone: "positive" };
  if (n > 0) return { summary: `Positive ${periodLabel.toLowerCase()} move`, detail: `The stock is up over the last ${periodLabel.toLowerCase()}.`, tone: "positive" };
  if (n <= -0.12) return { summary: `Heavy ${periodLabel.toLowerCase()} fall`, detail: `The stock has dropped sharply over the last ${periodLabel.toLowerCase()}.`, tone: "negative" };
  if (n < 0) return { summary: `Negative ${periodLabel.toLowerCase()} move`, detail: `The stock is down over the last ${periodLabel.toLowerCase()}.`, tone: "negative" };
  return { summary: "Flat performance", detail: `The stock is mostly unchanged over the last ${periodLabel.toLowerCase()}.`, tone: "neutral" };
};

const describePeRatio = (value) => {
  const n = toNumberOrNull(value);
  if (n === null || n <= 0) return { summary: "Earnings comparison unavailable", detail: "PE ratio needs positive earnings to be meaningful.", tone: "neutral" };
  if (n < 15) return { summary: "Lower valuation vs earnings", detail: `Investors are paying about ${n.toFixed(2)} times yearly earnings, which is relatively modest.`, tone: "positive" };
  if (n <= 30) return { summary: "Moderate valuation", detail: `Investors are paying about ${n.toFixed(2)} times yearly earnings.`, tone: "neutral" };
  return { summary: "High valuation", detail: `Investors are paying about ${n.toFixed(2)} times yearly earnings, so expectations are high.`, tone: "warning" };
};

const describePriceToBook = (value) => {
  const n = toNumberOrNull(value);
  if (n === null || n <= 0) return { summary: "Book value comparison unavailable", detail: "Price to book ratio is not meaningful here.", tone: "neutral" };
  if (n < 1) return { summary: "Trading below book value", detail: `The market price is below the company's accounting asset value (${n.toFixed(2)}x book value).`, tone: "positive" };
  if (n <= 3) return { summary: "Moderate premium to assets", detail: `The market price is ${n.toFixed(2)} times book value.`, tone: "neutral" };
  return { summary: "High premium to assets", detail: `The market price is ${n.toFixed(2)} times book value, so investors are valuing the business far above its balance-sheet assets.`, tone: "warning" };
};

const describeEps = (value, currency) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "Profit per share unavailable", detail: "EPS data is not available.", tone: "neutral" };
  if (n > 0) return { summary: "Company is profitable", detail: `The business earned about ${currency} ${n.toFixed(2)} per share.`, tone: "positive" };
  if (n < 0) return { summary: "Company is loss-making", detail: `The business lost about ${currency} ${Math.abs(n).toFixed(2)} per share.`, tone: "negative" };
  return { summary: "Break-even earnings", detail: "The business is close to break-even on a per-share basis.", tone: "neutral" };
};

const describeDividendYield = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "Dividend data unavailable", detail: "Dividend yield is not available.", tone: "neutral" };
  if (n <= 0) return { summary: "No dividend payout", detail: "The company is not currently paying a dividend.", tone: "neutral" };
  if (n < 2) return { summary: "Small dividend income", detail: `This stock pays a relatively small cash yield of ${n.toFixed(2)}%.`, tone: "neutral" };
  if (n <= 5) return { summary: "Healthy dividend income", detail: `This stock offers a meaningful yield of ${n.toFixed(2)}%.`, tone: "positive" };
  return { summary: "Very high dividend yield", detail: `A yield of ${n.toFixed(2)}% is high, which can be attractive but may also signal risk.`, tone: "warning" };
};

const describeRevenueGrowth = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "Revenue trend unavailable", detail: "Revenue growth data is not available.", tone: "neutral" };
  if (n >= 12) return { summary: "Revenue growing strongly", detail: `Sales are growing at about ${n.toFixed(2)}%, which is strong.`, tone: "positive" };
  if (n > 0) return { summary: "Revenue growing slowly", detail: `Sales are growing at about ${n.toFixed(2)}%.`, tone: "neutral" };
  if (n === 0) return { summary: "Revenue is flat", detail: "Sales are roughly unchanged.", tone: "neutral" };
  return { summary: "Revenue is shrinking", detail: `Sales are down about ${Math.abs(n).toFixed(2)}%, which can pressure future profits.`, tone: "negative" };
};

const describeVolatility = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "Price swing data unavailable", detail: "Volatility data is not available.", tone: "neutral" };
  if (n < 0.015) return { summary: "Relatively stable", detail: "The stock usually has smaller day-to-day price swings.", tone: "positive" };
  if (n < 0.03) return { summary: "Moderate price swings", detail: "The stock moves a noticeable amount day to day, but not excessively.", tone: "neutral" };
  return { summary: "Sharp price swings", detail: "The stock can move a lot in short periods, which increases risk.", tone: "warning" };
};

const describeMomentum = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "Momentum unavailable", detail: "Momentum data is not available.", tone: "neutral" };
  if (n > 0.1) return { summary: "Strong upward momentum", detail: "The stock has been trending higher over the recent period.", tone: "positive" };
  if (n > 0) return { summary: "Slight upward momentum", detail: "The stock is a bit stronger than it was 90 days ago.", tone: "positive" };
  if (n < -0.1) return { summary: "Weak momentum", detail: "The stock is clearly weaker than it was 90 days ago.", tone: "negative" };
  if (n < 0) return { summary: "Slightly weaker trend", detail: "The stock is a bit weaker than it was 90 days ago.", tone: "negative" };
  return { summary: "Flat momentum", detail: "The recent trend is mostly sideways.", tone: "neutral" };
};

const describeRsi = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "RSI unavailable", detail: "RSI data is not available.", tone: "neutral" };
  if (n < 30) return { summary: "May be oversold", detail: "The stock has been sold heavily and could be near a bounce zone.", tone: "positive" };
  if (n <= 70) return { summary: "Momentum is balanced", detail: "The stock is not in an extreme overbought or oversold zone.", tone: "neutral" };
  return { summary: "May be overbought", detail: "The stock has risen strongly and may be overheating in the short term.", tone: "warning" };
};

const describeBeta = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "Market sensitivity unavailable", detail: "Beta data is not available.", tone: "neutral" };
  if (n < 0.8) return { summary: "Moves less than the market", detail: `A beta of ${n.toFixed(2)} means it is usually less volatile than the overall market.`, tone: "positive" };
  if (n <= 1.2) return { summary: "Moves similar to the market", detail: `A beta of ${n.toFixed(2)} means it usually behaves close to the broader market.`, tone: "neutral" };
  return { summary: "Moves more than the market", detail: `A beta of ${n.toFixed(2)} means it usually reacts more strongly than the broader market.`, tone: "warning" };
};

const describeAverageVolume = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return { summary: "Trading activity unavailable", detail: "Average volume data is not available.", tone: "neutral" };
  if (n >= 5_000_000) return { summary: "Highly traded stock", detail: `Around ${formatLargeNumber(n)} shares trade on a normal day, so buying and selling is usually easier.`, tone: "positive" };
  if (n >= 1_000_000) return { summary: "Good trading activity", detail: `Around ${formatLargeNumber(n)} shares trade on a normal day.`, tone: "neutral" };
  return { summary: "Lighter trading activity", detail: `Only about ${formatLargeNumber(n)} shares trade on a normal day, so price moves can be less smooth.`, tone: "warning" };
};

function MetricInsight({ label, value, summary, detail, tone = "neutral" }) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border p-4 sm:p-5 ${insightToneClasses[tone] || insightToneClasses.neutral}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
        <span className="max-w-full rounded-full border border-current/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
          {insightToneLabels[tone] || insightToneLabels.neutral}
        </span>
      </div>
      <p className="mt-3 break-words text-xl font-semibold">{value}</p>
      <p className="mt-2 text-sm font-medium">{summary}</p>
      <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}

function RiskCategorization() {
  const chartTheme = useChartTheme();
  const [analysisType, setAnalysisType] = useState("portfolio");
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [selectedStockSymbol, setSelectedStockSymbol] = useState("");
  const [stockSuggestions, setStockSuggestions] = useState([]);
  const [stockSearchOpen, setStockSearchOpen] = useState(false);
  const [searchingStocks, setSearchingStocks] = useState(false);
  const [result, setResult] = useState(null);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const analysisRequestRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const loadPortfolios = async () => {
      try {
        setLoadingPortfolios(true);
        const payload = await getPortfolios();
        if (!mounted) return;
        const safe = Array.isArray(payload) ? payload : [];
        setPortfolios(safe);
        if (safe.length > 0) setSelectedPortfolioId(String(safe[0].id));
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load portfolios.");
      } finally {
        if (mounted) setLoadingPortfolios(false);
      }
    };
    loadPortfolios();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (analysisType !== "stock") return;
    const query = stockQuery.trim();
    if (query.length < 2) { setStockSuggestions([]); return; }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setSearchingStocks(true);
        const payload = await searchStocks(query);
        if (!active) return;
        setStockSuggestions(Array.isArray(payload) ? payload : []);
      } catch {
        if (!active) return;
        setStockSuggestions([]);
      } finally {
        if (active) setSearchingStocks(false);
      }
    }, 260);
    return () => { active = false; clearTimeout(timer); };
  }, [analysisType, stockQuery]);

  useEffect(() => {
    analysisRequestRef.current += 1;
    setLoadingAnalysis(false);
    setResult(null);
    setError("");

    if (analysisType === "portfolio") {
      setStockSearchOpen(false);
      setStockSuggestions([]);
    }
  }, [analysisType]);

  const rows = useMemo(() => {
    if (!result) return [];
    if (result.analysis_type === "stock" && result.stock) return [result.stock];
    return Array.isArray(result.stocks) ? result.stocks : [];
  }, [result]);

  const summary = result?.summary || { low_risk_count: 0, medium_risk_count: 0, high_risk_count: 0 };
  const distribution = useMemo(() => (Array.isArray(result?.distribution) ? result.distribution : []).filter((i) => Number(i.count || 0) > 0), [result]);
  const scatterPoints = useMemo(() => rows.map((r) => ({ symbol: r.symbol, volatility: toNumberOrNull(r.volatility), average_return: toNumberOrNull(r.average_return), risk_category: r.risk_category })).filter((r) => r.volatility !== null && r.average_return !== null), [rows]);
  const scatterByRisk = useMemo(() => ({ low: scatterPoints.filter((p) => p.risk_category === "Low Risk"), medium: scatterPoints.filter((p) => p.risk_category === "Medium Risk"), high: scatterPoints.filter((p) => p.risk_category === "High Risk") }), [scatterPoints]);
  const volatilityDomain = useMemo(() => paddedDomain(scatterPoints.map((p) => p.volatility)), [scatterPoints]);
  const returnDomain = useMemo(() => paddedDomain(scatterPoints.map((p) => p.average_return)), [scatterPoints]);
  const portfolioRiskGroups = useMemo(() => ({
    low: rows.filter((row) => row.risk_category === "Low Risk"),
    medium: rows.filter((row) => row.risk_category === "Medium Risk"),
    high: rows.filter((row) => row.risk_category === "High Risk"),
  }), [rows]);
  const portfolioRiskCards = useMemo(() => ([
    {
      key: "low",
      title: "Low Risk Count",
      count: summary.low_risk_count || 0,
      stocks: portfolioRiskGroups.low,
      cardClass: "border-emerald-200 bg-emerald-50/90 dark:border-emerald-500/40 dark:bg-emerald-500/10",
      titleClass: "text-emerald-700 dark:text-emerald-200",
      countClass: "text-emerald-950 dark:text-emerald-50",
      chipClass: "border-emerald-200 bg-white text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
      noteClass: "text-emerald-700/80 dark:text-emerald-200/80",
    },
    {
      key: "medium",
      title: "Medium Risk Count",
      count: summary.medium_risk_count || 0,
      stocks: portfolioRiskGroups.medium,
      cardClass: "border-amber-200 bg-amber-50/90 dark:border-amber-500/40 dark:bg-amber-500/10",
      titleClass: "text-amber-700 dark:text-amber-200",
      countClass: "text-amber-950 dark:text-amber-50",
      chipClass: "border-amber-200 bg-white text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
      noteClass: "text-amber-700/80 dark:text-amber-200/80",
    },
    {
      key: "high",
      title: "High Risk Count",
      count: summary.high_risk_count || 0,
      stocks: portfolioRiskGroups.high,
      cardClass: "border-rose-200 bg-rose-50/90 dark:border-red-500/40 dark:bg-red-500/10",
      titleClass: "text-rose-700 dark:text-red-200",
      countClass: "text-rose-950 dark:text-red-50",
      chipClass: "border-rose-200 bg-white text-rose-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
      noteClass: "text-rose-700/80 dark:text-red-200/80",
    },
  ]), [portfolioRiskGroups, summary.high_risk_count, summary.low_risk_count, summary.medium_risk_count]);

  const isPortfolioResult = result?.analysis_type === "portfolio";
  const isStockResult = result?.analysis_type === "stock";
  const stockInsight = isStockResult ? result?.stock_insight || null : null;
  const stockCurrency = stockInsight?.basic_information?.currency || "INR";
  const stockRiskCategory = stockInsight?.risk_evaluation?.risk_category || result?.stock?.risk_category || "N/A";
  const gaugeScore = toNumberOrNull(stockInsight?.risk_evaluation?.risk_gauge_score) || 0;
  const clampedGaugeScore = Math.min(Math.max(gaugeScore, 0), 100);
  const gaugeData = [{ name: "risk", value: gaugeScore, fill: RISK_COLORS[stockRiskCategory] || "#64748b" }];
  const gaugeBand = clampedGaugeScore >= 70
    ? {
        label: "High-risk zone",
        range: "70 - 100",
        detail: "The score is sitting in the caution band, where capital swings and downside pressure are stronger.",
      }
    : clampedGaugeScore >= 35
      ? {
          label: "Moderate-risk zone",
          range: "35 - 69",
          detail: "The stock is in a middle band where some signals are stable but the trend still needs monitoring.",
        }
      : {
          label: "Lower-risk zone",
          range: "0 - 34",
          detail: "The score is in the steadier band, where price behavior is comparatively calmer.",
        };
  const stockTrend = useMemo(() => (stockInsight?.trend || []).map((p) => ({ date: p.date, close: toNumberOrNull(p.close) })), [stockInsight]);
  const currentPrice = toNumberOrNull(stockInsight?.price_performance?.current_price);
  const stockRiskHeadline = stockRiskCategory === "High Risk"
    ? "This stock is showing a high-risk profile right now."
    : stockRiskCategory === "Medium Risk"
      ? "This stock carries a moderate level of risk right now."
      : "This stock is currently sitting in a lower-risk zone.";
  const stockRiskSupportText = stockRiskCategory === "High Risk"
    ? "The model is seeing larger downside pressure, stronger swings, or weaker trend behavior."
    : stockRiskCategory === "Medium Risk"
      ? "Some signals look stable, but a few metrics still need attention before this looks comfortable."
      : "Most signals are relatively steady, though the stock should still be monitored with market changes.";

  const stockMetricCards = useMemo(() => {
    if (!stockInsight) {
      return {
        performance: [],
        fundamentals: [],
        trading: [],
        technical: [],
        risk: [],
      };
    }

    const oneDayChange = toNumberOrNull(stockInsight.price_performance?.one_day_change_pct);
    const oneMonthReturn = toNumberOrNull(stockInsight.price_performance?.one_month_return_pct);
    const threeMonthReturn = toNumberOrNull(stockInsight.price_performance?.three_month_return_pct);
    const oneYearReturn = toNumberOrNull(stockInsight.price_performance?.one_year_return_pct);
    const peRatio = toNumberOrNull(stockInsight.fundamental_metrics?.pe_ratio);
    const eps = toNumberOrNull(stockInsight.fundamental_metrics?.eps);
    const pbRatio = toNumberOrNull(stockInsight.fundamental_metrics?.price_to_book_ratio);
    const dividendYield = toNumberOrNull(stockInsight.fundamental_metrics?.dividend_yield_pct);
    const revenueGrowth = toNumberOrNull(stockInsight.fundamental_metrics?.revenue_growth_pct);
    const averageVolume = toNumberOrNull(stockInsight.trading_activity?.average_volume);
    const week52High = toNumberOrNull(stockInsight.trading_activity?.week_52_high);
    const week52Low = toNumberOrNull(stockInsight.trading_activity?.week_52_low);
    const volatility = toNumberOrNull(stockInsight.technical_indicators?.volatility);
    const momentum = toNumberOrNull(stockInsight.technical_indicators?.momentum);
    const ma50 = toNumberOrNull(stockInsight.technical_indicators?.moving_average_50);
    const ma200 = toNumberOrNull(stockInsight.technical_indicators?.moving_average_200);
    const rsi = toNumberOrNull(stockInsight.technical_indicators?.rsi);
    const drawdown = toNumberOrNull(stockInsight.risk_evaluation?.drawdown);
    const beta = toNumberOrNull(stockInsight.risk_evaluation?.beta);
    const averageReturn = toNumberOrNull(stockInsight.risk_evaluation?.average_return);

    const performance = [
      {
        label: "Current Price",
        value: formatCurrency(currentPrice, stockCurrency),
        summary: "Current market price",
        detail: "This is the latest price investors are paying for one share.",
        tone: "neutral",
      },
      {
        label: "1 Day Change",
        value: formatSignedRatioPercent(oneDayChange),
        ...describeReturn(oneDayChange, "1 day"),
      },
      {
        label: "1 Month Return",
        value: formatSignedRatioPercent(oneMonthReturn),
        ...describeReturn(oneMonthReturn, "1 month"),
      },
      {
        label: "3 Month Return",
        value: formatSignedRatioPercent(threeMonthReturn),
        ...describeReturn(threeMonthReturn, "3 months"),
      },
      {
        label: "1 Year Return",
        value: formatSignedRatioPercent(oneYearReturn),
        ...describeReturn(oneYearReturn, "1 year"),
      },
    ];

    const fundamentals = [
      { label: "PE Ratio", value: peRatio?.toFixed(2) || "N/A", ...describePeRatio(peRatio) },
      { label: "EPS", value: formatCurrency(eps, stockCurrency), ...describeEps(eps, getCurrencyLabel(stockCurrency)) },
      { label: "Price to Book Ratio", value: pbRatio?.toFixed(2) || "N/A", ...describePriceToBook(pbRatio) },
      { label: "Dividend Yield", value: formatValuePercent(dividendYield), ...describeDividendYield(dividendYield) },
      { label: "Revenue Growth", value: formatValuePercent(revenueGrowth), ...describeRevenueGrowth(revenueGrowth) },
    ];

    const trading = [
      { label: "Average Volume", value: formatLargeNumber(averageVolume), ...describeAverageVolume(averageVolume) },
      {
        label: "52 Week High",
        value: formatCurrency(week52High, stockCurrency),
        summary: week52High !== null && currentPrice !== null ? `${(((week52High - currentPrice) / week52High) * 100).toFixed(2)}% room below the yearly high` : "Highest point in the last year",
        detail: "This is the highest price the stock reached during the past 12 months.",
        tone: "warning",
      },
      {
        label: "52 Week Low",
        value: formatCurrency(week52Low, stockCurrency),
        summary: week52Low !== null && currentPrice !== null ? `${(((currentPrice - week52Low) / week52Low) * 100).toFixed(2)}% above the yearly low` : "Lowest point in the last year",
        detail: "This is the lowest price the stock reached during the past 12 months.",
        tone: "neutral",
      },
    ];

    const technical = [
      { label: "Volatility", value: formatRatioPercent(volatility), ...describeVolatility(volatility) },
      { label: "Momentum (90d)", value: formatSignedRatioPercent(momentum, "Stronger by", "Weaker by"), ...describeMomentum(momentum) },
      {
        label: "Moving Average 50",
        value: formatCurrency(ma50, stockCurrency),
        summary: currentPrice !== null && ma50 !== null ? (currentPrice >= ma50 ? "Price is above short-term trend" : "Price is below short-term trend") : "Short-term trend line",
        detail: "This is the average price over the last 50 trading days.",
        tone: currentPrice !== null && ma50 !== null ? (currentPrice >= ma50 ? "positive" : "negative") : "neutral",
      },
      {
        label: "Moving Average 200",
        value: formatCurrency(ma200, stockCurrency),
        summary: currentPrice !== null && ma200 !== null ? (currentPrice >= ma200 ? "Price is above long-term trend" : "Price is below long-term trend") : "Long-term trend line",
        detail: "This is the average price over the last 200 trading days.",
        tone: currentPrice !== null && ma200 !== null ? (currentPrice >= ma200 ? "positive" : "negative") : "neutral",
      },
      { label: "RSI", value: rsi?.toFixed(2) || "N/A", ...describeRsi(rsi) },
    ];

    const risk = [
      {
        label: "Gauge Score",
        value: `${gaugeScore.toFixed(1)} / 100`,
        summary: stockRiskCategory === "High Risk" ? "Risk is elevated" : stockRiskCategory === "Medium Risk" ? "Risk is moderate" : "Risk is relatively controlled",
        detail: "This combines volatility, return, drawdown, momentum, and beta into one easy score.",
        tone: stockRiskCategory === "High Risk" ? "negative" : stockRiskCategory === "Medium Risk" ? "warning" : "positive",
      },
      { label: "Drawdown", value: formatDrawdownLabel(drawdown), summary: drawdown !== null ? `${Math.abs(drawdown * 100).toFixed(2)}% below a recent peak` : "Drawdown unavailable", detail: "Drawdown tells you how far the stock has fallen from a previous high point.", tone: drawdown !== null && drawdown < -0.2 ? "negative" : "warning" },
      { label: "Beta", value: beta?.toFixed(2) || "N/A", ...describeBeta(beta) },
      { label: "Average Return", value: formatSignedRatioPercent(averageReturn), ...describeReturn(averageReturn, "average period") },
      { label: "Momentum", value: formatSignedRatioPercent(momentum, "Stronger by", "Weaker by"), ...describeMomentum(momentum) },
    ];

    return { performance, fundamentals, trading, technical, risk };
  }, [stockInsight, stockCurrency, currentPrice, gaugeScore, stockRiskCategory]);

  const runPortfolioAnalysis = async () => {
    if (!selectedPortfolioId) { setError("Please select a portfolio."); return; }
    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    try {
      setLoadingAnalysis(true); setError("");
      const payload = await getPortfolioRiskAnalysis(selectedPortfolioId);
      if (analysisRequestRef.current !== requestId) return;
      setResult(payload);
    } catch (err) {
      if (analysisRequestRef.current !== requestId) return;
      setResult(null); setError(err.message || "Unable to analyze portfolio risk.");
    } finally {
      if (analysisRequestRef.current === requestId) setLoadingAnalysis(false);
    }
  };

  const runStockAnalysis = async () => {
    const symbol = String(selectedStockSymbol || stockQuery || "").trim().toUpperCase();
    if (!symbol) { setError("Please enter or select a stock symbol."); return; }
    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    try {
      setLoadingAnalysis(true); setError("");
      const payload = await getStockRiskAnalysis(symbol);
      if (analysisRequestRef.current !== requestId) return;
      setResult(payload); setSelectedStockSymbol(symbol); setStockQuery(symbol); setStockSearchOpen(false);
    } catch (err) {
      if (analysisRequestRef.current !== requestId) return;
      setResult(null); setError(err.message || "Unable to analyze stock risk.");
    } finally {
      if (analysisRequestRef.current === requestId) setLoadingAnalysis(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className={chartTheme.heroCardClass}>
        <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-rose-400/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative">
          <p className={chartTheme.sectionTitleClass}>Risk Categorization</p>
          <p className={`mt-2 ${chartTheme.bodyTextClass}`}>Classify stock risk as Low, Medium, or High using volatility, return, drawdown, momentum, and beta.</p>
        </div>
      </Card>

      {error ? <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</Card> : null}
      <Card className={chartTheme.panelCardClass}>
        <div className="mb-4">
          <p className={chartTheme.panelTitleClass}>Analysis Type</p>
          <p className={chartTheme.bodyTextClass}>Choose portfolio analysis or single stock analysis.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
          <div className="space-y-1">
            <label className={`text-xs font-semibold uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Type</label>
            <select value={analysisType} onChange={(event) => setAnalysisType(event.target.value)} className={chartTheme.controlClass}>
              <option value="portfolio">Portfolio</option>
              <option value="stock">Single Stock</option>
            </select>
          </div>

          {analysisType === "portfolio" ? (
            <div className="space-y-1">
              <label className={`text-xs font-semibold uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Portfolio</label>
              <select value={selectedPortfolioId} onChange={(event) => { setSelectedPortfolioId(event.target.value); setResult(null); setError(""); }} className={chartTheme.controlClass} disabled={loadingPortfolios}>
                {portfolios.length === 0 ? <option value="">No portfolios available</option> : portfolios.map((portfolio) => <option key={portfolio.id} value={String(portfolio.id)}>{portfolio.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className={`text-xs font-semibold uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Stock</label>
              <div className="relative">
                <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${chartTheme.isDark ? "text-slate-400" : "text-slate-500"}`} />
                <input value={stockQuery} onChange={(event) => { setStockQuery(event.target.value); setSelectedStockSymbol(""); setStockSearchOpen(true); setResult(null); setError(""); }} onFocus={() => setStockSearchOpen(true)} onBlur={() => { setTimeout(() => setStockSearchOpen(false), 150); }} placeholder="Search symbol or company (AAPL, TSLA, INFY.NS)" className={`pl-10 ${chartTheme.controlClass}`} />
                {stockSearchOpen ? (
                  <div className={chartTheme.dropdownClass}>
                    {searchingStocks ? <p className={`px-4 py-3 text-sm ${chartTheme.bodyTextClass}`}>Searching...</p> : stockSuggestions.length === 0 ? <p className={`px-4 py-3 text-sm ${chartTheme.bodyTextClass}`}>No matches found.</p> : stockSuggestions.map((item) => (
                      <button key={item.symbol} type="button" onMouseDown={(event) => { event.preventDefault(); const symbol = String(item.symbol || "").toUpperCase(); setSelectedStockSymbol(symbol); setStockQuery(symbol); setStockSearchOpen(false); setResult(null); setError(""); }} className={chartTheme.dropdownItemClass}>
                        <p className={`font-semibold ${chartTheme.tableStrongCellClass}`}>{item.symbol} - {item.company_name}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <Button onClick={analysisType === "portfolio" ? runPortfolioAnalysis : runStockAnalysis} disabled={loadingAnalysis || loadingPortfolios}>
            {loadingAnalysis ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      </Card>

      {result ? (
        <>
          {isPortfolioResult ? (
            <section className="grid gap-4 sm:grid-cols-3">
              {portfolioRiskCards.map((item) => {
                const stockLabels = item.stocks.slice(0, 4);
                const remaining = Math.max(item.stocks.length - stockLabels.length, 0);
                return (
                  <Card key={item.key} className={`border ${item.cardClass}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${item.titleClass}`}>{item.title}</p>
                    <p className={`mt-2 font-display text-3xl font-semibold ${item.countClass}`}>{item.count}</p>
                    <div className="mt-4 min-h-[56px]">
                      {stockLabels.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {stockLabels.map((stock) => (
                            <span key={stock.symbol} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${item.chipClass}`}>
                              {stock.symbol}
                            </span>
                          ))}
                          {remaining > 0 ? (
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${item.chipClass}`}>
                              +{remaining} more
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className={`text-sm ${item.noteClass}`}>No stocks in this bucket.</p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </section>
          ) : null}

          {isPortfolioResult ? (
            <>
              <section className="grid gap-6 xl:grid-cols-2">
                <Card className={chartTheme.panelCardClass}>
                  <div className="mb-4"><p className={chartTheme.panelTitleClass}>Risk Distribution</p><p className={chartTheme.bodyTextClass}>Portfolio distribution across risk categories</p></div>
                  <div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={120} label={({ cx, cy, midAngle, outerRadius, category, count }) => {
                    const radius = outerRadius + 22;
                    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
                    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
                    return (
                      <text x={x} y={y} fill={chartTheme.isDark ? "#e2e8f0" : "#334155"} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12} fontWeight={600}>
                        {`${category}: ${count}`}
                      </text>
                    );
                  }} labelLine={{ stroke: chartTheme.axis }}>{distribution.map((entry) => <Cell key={entry.category} fill={RISK_COLORS[entry.category] || "#64748b"} />)}</Pie><Tooltip contentStyle={chartTheme.tooltipStyle} labelStyle={{ color: chartTheme.isDark ? "#f8fafc" : "#0f172a", fontWeight: 600 }} itemStyle={{ color: chartTheme.isDark ? "#e2e8f0" : "#0f172a" }} formatter={(value, _name, payload) => [value, payload?.payload?.category || "Count"]} /><Legend wrapperStyle={chartTheme.legendStyle} /></PieChart></ResponsiveContainer></div>
                </Card>

                <Card className={chartTheme.panelCardClass}>
                  <div className="mb-4"><p className={chartTheme.panelTitleClass}>Risk Scatter</p></div>
                  <div className="h-80"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 12, bottom: 44, left: 18 }}><CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} /><XAxis type="number" dataKey="volatility" stroke={chartTheme.axis} fontSize={11} tickFormatter={formatScatterPercent} domain={volatilityDomain} tickCount={6} label={{ value: "Volatility", position: "insideBottom", offset: -2, fill: chartTheme.axis, fontSize: 12, fontWeight: 600 }} /><YAxis type="number" dataKey="average_return" stroke={chartTheme.axis} fontSize={11} tickFormatter={formatScatterPercent} domain={returnDomain} tickCount={6} label={{ value: "Average Return", angle: -90, position: "insideLeft", fill: chartTheme.axis, fontSize: 12, fontWeight: 600, dx: -4 }} /><Tooltip cursor={{ stroke: chartTheme.axis, strokeOpacity: 0.3 }} contentStyle={chartTheme.tooltipStyle} labelStyle={{ color: chartTheme.isDark ? "#f8fafc" : "#0f172a", fontWeight: 700 }} itemStyle={{ color: chartTheme.isDark ? "#e2e8f0" : "#0f172a" }} formatter={(value, name) => [formatRatioPercent(value), name === "volatility" ? "Volatility" : "Average Return"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.symbol || "Selected stock"} /><Legend verticalAlign="bottom" wrapperStyle={{ ...chartTheme.legendStyle, paddingTop: 18 }} /><Scatter name="Low Risk" data={scatterByRisk.low} fill={RISK_COLORS["Low Risk"]} /><Scatter name="Medium Risk" data={scatterByRisk.medium} fill={RISK_COLORS["Medium Risk"]} /><Scatter name="High Risk" data={scatterByRisk.high} fill={RISK_COLORS["High Risk"]} /></ScatterChart></ResponsiveContainer></div>
                </Card>
              </section>

              <Card className={chartTheme.panelCardClass}>
                <div className="mb-4"><p className={chartTheme.panelTitleClass}>Risk Table</p><p className={chartTheme.bodyTextClass}>Stock-wise volatility, return, and model risk category</p></div>
                <div className="overflow-x-auto"><table className={chartTheme.tableClass}><thead><tr className={chartTheme.tableHeadClass}><th className="py-3 font-medium">Stock</th><th className="py-3 font-medium">Volatility</th><th className="py-3 font-medium">Return</th><th className="py-3 font-medium">Drawdown</th><th className="py-3 font-medium">Momentum</th><th className="py-3 font-medium">Beta</th><th className="py-3 font-medium">Risk Category</th></tr></thead><tbody className={chartTheme.tableBodyClass}>{rows.map((row) => <tr key={row.symbol}><td className={`py-3 ${chartTheme.tableStrongCellClass}`}><p className="font-semibold">{row.symbol}</p><p className={chartTheme.mutedTextClass}>{row.company_name}</p></td><td className={`py-3 ${chartTheme.tableCellClass}`}>{formatRatioPercent(row.volatility)}</td><td className={`py-3 ${chartTheme.tableCellClass}`}>{formatRatioPercent(row.average_return)}</td><td className={`py-3 ${chartTheme.tableCellClass}`}>{formatRatioPercent(row.max_drawdown)}</td><td className={`py-3 ${chartTheme.tableCellClass}`}>{formatRatioPercent(row.momentum)}</td><td className={`py-3 ${chartTheme.tableCellClass}`}>{toNumberOrNull(row.beta)?.toFixed(2) || "N/A"}</td><td className="py-3"><span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={riskBadgeStyle(row.risk_category)}>{row.risk_category}</span></td></tr>)}</tbody></table></div>
              </Card>
            </>
          ) : null}
          {isStockResult && stockInsight ? (
            <>
              <Card className={chartTheme.panelCardClass}>
                <p className={chartTheme.panelTitleClass}>Basic Information</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div><p className={`text-xs uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Stock Symbol</p><p className={`mt-1 font-semibold ${chartTheme.tableStrongCellClass}`}>{stockInsight.basic_information?.stock_symbol || "N/A"}</p></div>
                  <div><p className={`text-xs uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Company Name</p><p className={`mt-1 font-semibold ${chartTheme.tableStrongCellClass}`}>{stockInsight.basic_information?.company_name || "N/A"}</p></div>
                  <div><p className={`text-xs uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Sector</p><p className={`mt-1 font-semibold ${chartTheme.tableStrongCellClass}`}>{stockInsight.basic_information?.sector || "N/A"}</p></div>
                  <div><p className={`text-xs uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Industry</p><p className={`mt-1 font-semibold ${chartTheme.tableStrongCellClass}`}>{stockInsight.basic_information?.industry || "N/A"}</p></div>
                  <div><p className={`text-xs uppercase tracking-wide ${chartTheme.mutedTextClass}`}>Market Cap</p><p className={`mt-1 font-semibold ${chartTheme.tableStrongCellClass}`}>{formatCompactCurrency(stockInsight.basic_information?.market_cap, stockCurrency)}</p></div>
                </div>
              </Card>

              <Card className={chartTheme.panelCardClass}>
                <p className={chartTheme.panelTitleClass}>Price Performance</p>
                <p className={`mt-1 ${chartTheme.bodyTextClass}`}>Numbers below are translated into simple performance signals.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {stockMetricCards.performance.map((item) => (
                    <MetricInsight key={item.label} {...item} />
                  ))}
                </div>
              </Card>

              <section className="grid gap-6 xl:grid-cols-2">
                <Card className={chartTheme.panelCardClass}>
                  <p className={chartTheme.panelTitleClass}>Fundamental Metrics</p>
                  <p className={`mt-1 ${chartTheme.bodyTextClass}`}>These numbers tell you whether the stock looks cheap, expensive, profitable, or income-producing.</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {stockMetricCards.fundamentals.map((item) => (
                      <MetricInsight key={item.label} {...item} />
                    ))}
                  </div>
                </Card>

                <Card className={chartTheme.panelCardClass}>
                  <p className={chartTheme.panelTitleClass}>Trading Activity</p>
                  <p className={`mt-1 ${chartTheme.bodyTextClass}`}>This helps you judge how actively the stock trades and where it sits in its 1-year range.</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {stockMetricCards.trading.map((item) => (
                      <MetricInsight key={item.label} {...item} />
                    ))}
                  </div>
                </Card>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <Card className={chartTheme.panelCardClass}>
                  <p className={chartTheme.panelTitleClass}>Technical Indicators</p>
                  <p className={`mt-1 ${chartTheme.bodyTextClass}`}>These signals try to show trend strength, trading pressure, and how jumpy the stock is.</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {stockMetricCards.technical.map((item) => (
                      <MetricInsight key={item.label} {...item} />
                    ))}
                  </div>
                </Card>

                <Card className={chartTheme.panelCardClass}>
                  <p className={chartTheme.panelTitleClass}>Risk Evaluation</p>
                  <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
                    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-5 shadow-inner shadow-slate-200/70 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:shadow-slate-950/60">
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart cx="50%" cy="50%" innerRadius="64%" outerRadius="96%" barSize={18} data={gaugeData} startAngle={225} endAngle={-45}>
                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                            <RadialBar dataKey="value" background cornerRadius={10} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="-mt-3 text-center">
                        <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${chartTheme.mutedTextClass}`}>Risk Gauge</p>
                        <p className={`mt-2 font-display text-3xl font-semibold ${chartTheme.tableStrongCellClass}`}>{gaugeScore.toFixed(1)}<span className={`text-lg ${chartTheme.mutedTextClass}`}>/100</span></p>
                        <span className="mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold" style={riskBadgeStyle(stockRiskCategory)}>{stockRiskCategory}</span>
                      </div>
                      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-700/80 dark:bg-slate-900/60">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-sm font-semibold ${chartTheme.tableStrongCellClass}`}>{gaugeBand.label}</p>
                          <span className={`text-xs font-medium ${chartTheme.mutedTextClass}`}>{gaugeBand.range}</span>
                        </div>
                        <div className="relative mt-4">
                          <div className="grid h-2 grid-cols-3 overflow-hidden rounded-full">
                            <div className="bg-emerald-400/80 dark:bg-emerald-500/70" />
                            <div className="bg-amber-400/80 dark:bg-amber-500/70" />
                            <div className="bg-rose-400/80 dark:bg-rose-500/70" />
                          </div>
                          <span
                            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow-md dark:border-slate-950 dark:bg-white"
                            style={{ left: `calc(${clampedGaugeScore}% - 8px)` }}
                            aria-hidden="true"
                          />
                        </div>
                        <div className={`mt-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide ${chartTheme.mutedTextClass}`}>
                          <span>Low</span>
                          <span>Medium</span>
                          <span>High</span>
                        </div>
                        <p className={`mt-4 text-sm leading-6 ${chartTheme.bodyTextClass}`}>{gaugeBand.detail}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                      <p className={`text-lg font-semibold ${chartTheme.tableStrongCellClass}`}>{stockRiskHeadline}</p>
                      <p className={`mt-2 text-sm leading-6 ${chartTheme.bodyTextClass}`}>{stockRiskSupportText}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:col-span-2 xl:grid-cols-3">
                      {stockMetricCards.risk.map((item) => (
                        <MetricInsight key={item.label} {...item} />
                      ))}
                    </div>
                  </div>
                </Card>
              </section>

              <Card className={chartTheme.panelCardClass}>
                <div className="mb-4"><p className={chartTheme.panelTitleClass}>Price Trend (1 Year)</p><p className={chartTheme.bodyTextClass}>Daily closing price over last 1 year</p></div>
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={stockTrend}><CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} /><XAxis dataKey="date" stroke={chartTheme.axis} fontSize={11} minTickGap={28} tickFormatter={formatDateLabel} /><YAxis stroke={chartTheme.axis} fontSize={11} tickFormatter={(value) => formatCurrency(value, stockCurrency)} /><Tooltip contentStyle={chartTheme.tooltipStyle} labelStyle={{ color: chartTheme.isDark ? "#f8fafc" : "#0f172a", fontWeight: 600 }} itemStyle={{ color: chartTheme.isDark ? "#e2e8f0" : "#0f172a" }} labelFormatter={(label) => new Date(label).toLocaleDateString("en-US")} formatter={(value) => [formatCurrency(value, stockCurrency), "Close Price"]} /><Legend wrapperStyle={chartTheme.legendStyle} /><Line type="monotone" dataKey="close" name={`Close (${stockCurrency})`} stroke="#60a5fa" strokeWidth={2.4} dot={false} /></LineChart></ResponsiveContainer></div>
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <Card className={chartTheme.panelCardClass}>
          <p className={chartTheme.bodyTextClass}>{loadingPortfolios ? "Loading portfolios..." : "Select analysis inputs and click Run Analysis to view risk categorization."}</p>
        </Card>
      )}
    </div>
  );
}

export default RiskCategorization;
