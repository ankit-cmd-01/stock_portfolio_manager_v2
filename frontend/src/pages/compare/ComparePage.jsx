import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BriefcaseBusiness, CandlestickChart, CircleHelp, Search } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import useTheme from "../../hooks/useTheme";
import {
  compareAssets,
  getPortfolioStocks,
  getPortfolios,
  searchStocks,
} from "../../services/portfolioApi";

const METRIC_META = {
  "Current Price": { format: "currency", better: "higher" },
  "Predicted Next Day Price": { format: "currency", better: "higher" },
  "1 Month Growth %": { format: "percent", better: "higher" },
  "3 Month Growth %": { format: "percent", better: "higher" },
  Volatility: { format: "percent", better: "lower" },
  "PE Ratio": { format: "number", better: "lower" },
  EPS: { format: "number", better: "higher" },
  "Market Cap": { format: "large-number", better: "higher" },
  "Dividend Yield": { format: "percent", better: "higher" },
  "Average Volume": { format: "large-number", better: "higher" },
  "Total Value": { format: "currency", better: "higher" },
};

const TOP_CARD_METRICS = [
  "Current Price",
  "Predicted Next Day Price",
  "1 Month Growth %",
  "Volatility",
];

const METRIC_DEFINITIONS = {
  "Current Price": "Latest traded market price for the selected asset.",
  "Predicted Next Day Price": "Next trading day price estimated with linear regression on 3-month close prices.",
  "1 Month Growth %": "Percentage change over roughly the last 21 trading sessions.",
  "3 Month Growth %": "Percentage change from the oldest to latest point in the 3-month window.",
  Growth: "Percentage change across the comparison window, used to show momentum over time.",
  Volatility: "Standard deviation of daily returns; higher values indicate larger price swings.",
  "PE Ratio": "Price divided by earnings per share, used to evaluate valuation.",
  EPS: "Earnings Per Share, the profit allocated to each outstanding share.",
  "Market Cap": "Total market value of company shares.",
  "Dividend Yield": "Annual dividend as a percentage of the current price.",
  "Average Volume": "Average number of shares traded per day.",
  "Total Value": "Aggregated current value of the selected asset or portfolio.",
};

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

const formatPercent = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "N/A";
  return `${parsed.toFixed(2)}%`;
};

const formatNumber = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "N/A";
  return parsed.toFixed(2);
};

const formatLargeNumber = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "N/A";
  if (Math.abs(parsed) >= 1_000_000_000_000) return `${(parsed / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(parsed) >= 1_000_000_000) return `${(parsed / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(parsed) >= 1_000_000) return `${(parsed / 1_000_000).toFixed(2)}M`;
  return parsed.toLocaleString("en-IN");
};

const formatMetricValue = (label, value) => {
  const meta = METRIC_META[label] || { format: "number" };
  if (meta.format === "currency") return formatCurrency(value);
  if (meta.format === "percent") return formatPercent(value);
  if (meta.format === "large-number") return formatLargeNumber(value);
  return formatNumber(value);
};

const getBetterSide = (metricLabel, leftValue, rightValue) => {
  const left = toNumberOrNull(leftValue);
  const right = toNumberOrNull(rightValue);
  if (left === null || right === null || left === right) return null;
  const betterRule = (METRIC_META[metricLabel] || {}).better || "higher";
  if (betterRule === "lower") return left < right ? "left" : "right";
  return left > right ? "left" : "right";
};

const getMetricDefinition = (metricLabel) => {
  const normalized = String(metricLabel || "").trim();
  return (
    METRIC_DEFINITIONS[normalized] ||
    METRIC_DEFINITIONS[normalized.replace(/\s+/g, " ")] ||
    null
  );
};

function InfoPopover({
  id,
  label,
  definition,
  activeId,
  onToggle,
  align = "left",
  className = "",
}) {
  if (!definition) return null;

  const isOpen = activeId === id;
  const panelPosition =
    align === "center"
      ? "left-1/2 -translate-x-1/2"
      : align === "right"
        ? "right-0"
        : "left-0";

  return (
    <span className={`relative inline-flex ${className}`} data-info-popover>
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        className="rounded text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-slate-200"
        aria-label={`Show definition for ${label}`}
        aria-expanded={isOpen}
      >
        <CircleHelp size={14} />
      </button>
      {isOpen ? (
        <span
          className={`absolute top-full z-40 mt-2 w-64 max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-5 text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 ${panelPosition}`}
        >
          {definition}
        </span>
      ) : null}
    </span>
  );
}

function AssetSelector({
  id,
  title,
  selection,
  onChange,
  suggestions,
  searching,
  open,
  onOpen,
  onClose,
  onPick,
  hideTypeSwitch = false,
  hint,
}) {
  const placeholder =
    selection.type === "portfolio"
      ? "Search your portfolio name"
      : "Search stock symbol or company name (e.g., AAPL, Apple)";

  return (
    <div
      className={`relative space-y-2 ${open ? "z-30" : ""}`}
      data-compare-selector={id}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90">
        {!hideTypeSwitch ? (
          <div className="mb-3 inline-flex rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => onChange({ ...selection, type: "portfolio", query: "", value: "", label: "" })}
              className={`px-3 py-1.5 text-xs font-semibold ${
                selection.type === "portfolio"
                  ? "bg-brand-600 text-white"
                  : "bg-transparent text-slate-600 dark:text-slate-300"
              }`}
            >
              Portfolio
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...selection, type: "stock", query: "", value: "", label: "" })}
              className={`px-3 py-1.5 text-xs font-semibold ${
                selection.type === "stock"
                  ? "bg-brand-600 text-white"
                  : "bg-transparent text-slate-600 dark:text-slate-300"
              }`}
            >
              Stock
            </button>
          </div>
        ) : (
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {selection.type === "portfolio" ? "Portfolio Selection" : "Stock Selection"}
          </p>
        )}
        {hint ? <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={selection.query}
            onChange={(event) =>
              onChange({
                ...selection,
                query: event.target.value,
                value: "",
                label: "",
              })
            }
            onFocus={onOpen}
            onBlur={() => {
              setTimeout(onClose, 150);
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-10 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {open ? (
            <div className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {searching ? (
                <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Searching...</p>
              ) : suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No matches found.</p>
              ) : (
                suggestions.map((item) => (
                  <button
                    key={`${item.kind}-${item.value}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onPick(item);
                    }}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ComparePage() {
  const { theme } = useTheme();
  const [portfolios, setPortfolios] = useState([]);
  const [ownedStocks, setOwnedStocks] = useState([]);
  const [compareMode, setCompareMode] = useState("portfolio");
  const [leftSelection, setLeftSelection] = useState({
    type: "portfolio",
    query: "",
    value: "",
    label: "",
  });
  const [rightSelection, setRightSelection] = useState({
    type: "portfolio",
    query: "",
    value: "",
    label: "",
  });
  const [leftExternalSuggestions, setLeftExternalSuggestions] = useState([]);
  const [rightExternalSuggestions, setRightExternalSuggestions] = useState([]);
  const [leftSearching, setLeftSearching] = useState(false);
  const [rightSearching, setRightSearching] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState("");
  const [activeTooltipMetric, setActiveTooltipMetric] = useState(null);
  const isDark = theme === "dark";

  const applyCompareMode = (mode) => {
    const nextType = mode === "portfolio" ? "portfolio" : "stock";
    setCompareMode(mode);
    setComparison(null);
    setError("");
    setOpenDropdown(null);
    setActiveTooltipMetric(null);
    setLeftSelection({
      type: nextType,
      query: "",
      value: "",
      label: "",
    });
    setRightSelection({
      type: nextType,
      query: "",
      value: "",
      label: "",
    });
  };

  useEffect(() => {
    let mounted = true;

    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        const portfolioList = await getPortfolios();
        const normalizedPortfolios = Array.isArray(portfolioList) ? portfolioList : [];

        const stockLists = await Promise.all(
          normalizedPortfolios.map((portfolio) =>
            getPortfolioStocks(portfolio.id).catch(() => [])
          )
        );

        const stockMap = new Map();
        stockLists.flat().forEach((stock) => {
          const symbol = String(stock.stock_symbol || "").trim().toUpperCase();
          if (!symbol || stockMap.has(symbol)) return;
          stockMap.set(symbol, {
            symbol,
            company_name: stock.company_name || symbol,
          });
        });

        if (!mounted) return;
        setPortfolios(normalizedPortfolios);
        setOwnedStocks(Array.from(stockMap.values()));
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load compare options.");
      } finally {
        if (mounted) {
          setLoadingOptions(false);
        }
      }
    };

    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setOpenDropdown(null);
        setActiveTooltipMetric(null);
        return;
      }

      if (!target.closest("[data-compare-selector]")) {
        setOpenDropdown(null);
      }

      if (!target.closest("[data-info-popover]")) {
        setActiveTooltipMetric(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpenDropdown(null);
      setActiveTooltipMetric(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (leftSelection.type !== "stock") {
      setLeftExternalSuggestions([]);
      return;
    }
    const query = leftSelection.query.trim();
    if (query.length < 2) {
      setLeftExternalSuggestions([]);
      return;
    }

    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        setLeftSearching(true);
        const results = await searchStocks(query);
        if (!active) return;
        setLeftExternalSuggestions(Array.isArray(results) ? results : []);
      } catch {
        if (!active) return;
        setLeftExternalSuggestions([]);
      } finally {
        if (active) setLeftSearching(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [leftSelection.query, leftSelection.type]);

  useEffect(() => {
    if (rightSelection.type !== "stock") {
      setRightExternalSuggestions([]);
      return;
    }
    const query = rightSelection.query.trim();
    if (query.length < 2) {
      setRightExternalSuggestions([]);
      return;
    }

    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        setRightSearching(true);
        const results = await searchStocks(query);
        if (!active) return;
        setRightExternalSuggestions(Array.isArray(results) ? results : []);
      } catch {
        if (!active) return;
        setRightExternalSuggestions([]);
      } finally {
        if (active) setRightSearching(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [rightSelection.query, rightSelection.type]);

  const portfolioSuggestions = (query) =>
    portfolios
      .filter((portfolio) =>
        portfolio.name.toLowerCase().includes(query.trim().toLowerCase())
      )
      .slice(0, 10)
      .map((portfolio) => ({
        kind: "portfolio",
        value: String(portfolio.id),
        label: portfolio.name,
        subtitle: `${portfolio.stock_count || 0} stocks`,
      }));

  const stockSuggestions = (query, externalSuggestions) => {
    const cleanQuery = query.trim().toLowerCase();
    const ownedMatches = ownedStocks
      .filter(
        (item) =>
          item.symbol.toLowerCase().includes(cleanQuery) ||
          item.company_name.toLowerCase().includes(cleanQuery)
      )
      .slice(0, 10)
      .map((item) => ({
        kind: "stock",
        value: item.symbol,
        label: `${item.symbol} - ${item.company_name}`,
        subtitle: "From your portfolios",
      }));

    const merged = new Map(ownedMatches.map((item) => [item.value, item]));
    externalSuggestions.forEach((item) => {
      const symbol = String(item.symbol || "").trim().toUpperCase();
      if (!symbol || merged.has(symbol)) return;
      merged.set(symbol, {
        kind: "stock",
        value: symbol,
        label: `${symbol} - ${item.company_name || symbol}`,
        subtitle: "From market search",
      });
    });
    return Array.from(merged.values()).slice(0, 12);
  };

  const leftSuggestions = useMemo(() => {
    if (leftSelection.type === "portfolio") return portfolioSuggestions(leftSelection.query);
    return stockSuggestions(leftSelection.query, leftExternalSuggestions);
  }, [leftExternalSuggestions, leftSelection.query, leftSelection.type, ownedStocks, portfolios]);

  const rightSuggestions = useMemo(() => {
    if (rightSelection.type === "portfolio") return portfolioSuggestions(rightSelection.query);
    return stockSuggestions(rightSelection.query, rightExternalSuggestions);
  }, [ownedStocks, portfolios, rightExternalSuggestions, rightSelection.query, rightSelection.type]);

  const resolveSelection = (selection) => {
    if (selection.type === "stock") {
      const symbol = String(selection.value || selection.query || "")
        .trim()
        .toUpperCase();
      if (!symbol) return null;
      return { type: "stock", value: symbol };
    }

    const value = String(selection.value || "").trim();
    if (value) return { type: "portfolio", value };

    const portfolio = portfolios.find(
      (item) => item.name.toLowerCase() === String(selection.query || "").trim().toLowerCase()
    );
    if (!portfolio) return null;
    return { type: "portfolio", value: String(portfolio.id) };
  };

  const handleCompare = async () => {
    const left = resolveSelection(leftSelection);
    const right = resolveSelection(rightSelection);
    if (!left || !right) {
      setError("Please select valid assets on both sides before comparing.");
      return;
    }

    try {
      setLoadingCompare(true);
      setError("");
      const payload = await compareAssets({
        left_type: left.type,
        right_type: right.type,
        left_value: left.value,
        right_value: right.value,
      });
      setComparison(payload);
    } catch (err) {
      setError(err.message || "Unable to compare selected assets.");
    } finally {
      setLoadingCompare(false);
    }
  };

  const trendChartData = useMemo(
    () =>
      (comparison?.trend || []).map((point) => ({
        date: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        }),
        left_price: toNumberOrNull(point.left_price),
        right_price: toNumberOrNull(point.right_price),
        left_growth_1m_pct: toNumberOrNull(point.left_growth_1m_pct),
        right_growth_1m_pct: toNumberOrNull(point.right_growth_1m_pct),
      })),
    [comparison]
  );

  const radarData = useMemo(
    () =>
      (comparison?.radar_comparison || []).map((item) => ({
        metric: item.metric,
        left: toNumberOrNull(item.left) ?? 0,
        right: toNumberOrNull(item.right) ?? 0,
      })),
    [comparison]
  );

  const topCards = useMemo(
    () =>
      TOP_CARD_METRICS.map((metricLabel) => {
        const row = (comparison?.metric_table || []).find((item) => item.metric === metricLabel);
        return {
          metric: metricLabel,
          left: row?.left ?? null,
          right: row?.right ?? null,
          better: getBetterSide(metricLabel, row?.left, row?.right),
        };
      }),
    [comparison]
  );

  const radarMetrics = useMemo(
    () =>
      (comparison?.radar_comparison || []).map((item) => ({
        metric: item.metric,
        definition: getMetricDefinition(item.metric),
      })),
    [comparison]
  );

  const chartPalette = useMemo(
    () => ({
      axis: isDark ? "#94a3b8" : "#64748b",
      grid: isDark ? "rgba(148, 163, 184, 0.14)" : "rgba(148, 163, 184, 0.24)",
      tooltipBackground: isDark ? "#020617" : "#ffffff",
      tooltipBorder: isDark ? "#334155" : "#cbd5e1",
      tooltipText: isDark ? "#f8fafc" : "#0f172a",
      leftSeries: "#3563E9",
      rightSeries: "#14B8A6",
      growthLeftSeries: "#F59E0B",
      growthRightSeries: "#0F766E",
    }),
    [isDark]
  );

  const tooltipStyle = useMemo(
    () => ({
      borderRadius: "12px",
      borderColor: chartPalette.tooltipBorder,
      backgroundColor: chartPalette.tooltipBackground,
      color: chartPalette.tooltipText,
    }),
    [chartPalette]
  );

  const leftLabel = comparison?.left_asset?.label || "Left Asset";
  const rightLabel = comparison?.right_asset?.label || "Right Asset";
  const modeTitle = compareMode === "portfolio" ? "Portfolio vs Portfolio" : "Stock vs Stock";
  const modeHint =
    compareMode === "portfolio"
      ? "Choose two portfolios to compare allocation-level performance and risk."
      : "Choose two stocks to compare movement, volatility, and valuation metrics.";
  const leftSelectionText =
    leftSelection.label || leftSelection.query || `Select ${compareMode === "portfolio" ? "portfolio" : "stock"} on left`;
  const rightSelectionText =
    rightSelection.label || rightSelection.query || `Select ${compareMode === "portfolio" ? "portfolio" : "stock"} on right`;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-cyan-50/90 p-0 shadow-soft dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/25 blur-2xl dark:bg-cyan-400/15" />
        <div className="absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl dark:bg-brand-400/10" />
        <div className="relative px-6 py-5">
          <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Compare</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {modeTitle} workspace with side-by-side selection and deep metric analysis.
          </p>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => applyCompareMode("portfolio")}
          className={`group rounded-2xl border-2 p-4 text-left transition ${
            compareMode === "portfolio"
              ? "border-brand-500 bg-gradient-to-br from-brand-50 via-white to-cyan-50 text-slate-950 shadow-xl shadow-brand-500/10 dark:border-brand-400 dark:from-brand-500/15 dark:via-slate-900 dark:to-cyan-400/10 dark:text-slate-50 dark:shadow-brand-950/30"
              : "border-slate-200/80 bg-white/90 text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:border-slate-500"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                compareMode === "portfolio"
                  ? "bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <BriefcaseBusiness size={18} />
            </span>
            <p className="font-display text-lg font-semibold">Portfolio</p>
          </div>
          <p
            className={`mt-2 text-xs ${
              compareMode === "portfolio"
                ? "text-slate-600 dark:text-slate-300"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Compare one portfolio against another.
          </p>
        </button>
        <button
          type="button"
          onClick={() => applyCompareMode("stock")}
          className={`group rounded-2xl border-2 p-4 text-left transition ${
            compareMode === "stock"
              ? "border-brand-500 bg-gradient-to-br from-brand-50 via-white to-cyan-50 text-slate-950 shadow-xl shadow-brand-500/10 dark:border-brand-400 dark:from-brand-500/15 dark:via-slate-900 dark:to-cyan-400/10 dark:text-slate-50 dark:shadow-brand-950/30"
              : "border-slate-200/80 bg-white/90 text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:border-slate-500"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                compareMode === "stock"
                  ? "bg-brand-600 text-white dark:bg-brand-500 dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <CandlestickChart size={18} />
            </span>
            <p className="font-display text-lg font-semibold">Stocks</p>
          </div>
          <p
            className={`mt-2 text-xs ${
              compareMode === "stock"
                ? "text-slate-600 dark:text-slate-300"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Compare one stock against another.
          </p>
        </button>
      </div>

      <Card className="border border-slate-200/80 p-0 shadow-soft dark:border-slate-800">
        <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{modeTitle}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{modeHint}</p>
        </div>
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="space-y-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800 lg:border-b-0 lg:border-r">
            <div className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Left Side</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{leftSelectionText}</p>
            </div>
            <AssetSelector
              id="left"
              title={compareMode === "portfolio" ? "Portfolio A" : "Stock A"}
              selection={leftSelection}
              onChange={setLeftSelection}
              suggestions={leftSuggestions}
              searching={leftSearching}
              open={openDropdown === "left"}
              onOpen={() => setOpenDropdown("left")}
              onClose={() => setOpenDropdown((current) => (current === "left" ? null : current))}
              hideTypeSwitch
              hint={compareMode === "portfolio" ? "Search one of your saved portfolios." : "Search by symbol or company name."}
              onPick={(item) => {
                setLeftSelection((prev) => ({
                  ...prev,
                  value: item.value,
                  label: item.label,
                  query: item.label,
                }));
                setOpenDropdown(null);
              }}
            />
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Right Side</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{rightSelectionText}</p>
            </div>
            <AssetSelector
              id="right"
              title={compareMode === "portfolio" ? "Portfolio B" : "Stock B"}
              selection={rightSelection}
              onChange={setRightSelection}
              suggestions={rightSuggestions}
              searching={rightSearching}
              open={openDropdown === "right"}
              onOpen={() => setOpenDropdown("right")}
              onClose={() => setOpenDropdown((current) => (current === "right" ? null : current))}
              hideTypeSwitch
              hint={compareMode === "portfolio" ? "Choose the portfolio to benchmark against." : "Choose the stock to benchmark against."}
              onPick={(item) => {
                setRightSelection((prev) => ({
                  ...prev,
                  value: item.value,
                  label: item.label,
                  query: item.label,
                }));
                setOpenDropdown(null);
              }}
            />
          </div>
        </div>
        <div className="border-t border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex justify-end">
            <Button onClick={handleCompare} disabled={loadingCompare || loadingOptions}>
              {loadingCompare ? "Comparing..." : "Compare"}
            </Button>
          </div>
        </div>
      </Card>

      {comparison ? (
        <>
          <div>
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Quick Comparison Cards</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Snapshot of key metrics with better-value highlighting.
            </p>
          </div>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {topCards.map((card) => (
              <Card key={card.metric}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {card.metric}
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">{leftLabel}: </span>
                    {formatMetricValue(card.metric, card.left)}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">{rightLabel}: </span>
                    {formatMetricValue(card.metric, card.right)}
                  </p>
                </div>
                {card.better ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Better: {card.better === "left" ? leftLabel : rightLabel}
                  </p>
                ) : null}
              </Card>
            ))}
          </section>

          <Card>
            <div className="mb-4">
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Price Trend Comparison</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">3-month price movement for both selections</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                  <XAxis dataKey="date" stroke={chartPalette.axis} fontSize={12} />
                  <YAxis
                    stroke={chartPalette.axis}
                    fontSize={12}
                    tickFormatter={(value) => `INR ${Number(value || 0).toLocaleString("en-IN")}`}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatCurrency(value), name]} />
                  <Legend wrapperStyle={{ color: chartPalette.axis }} />
                  <Line
                    type="monotone"
                    dataKey="left_price"
                    name={leftLabel}
                    stroke={chartPalette.leftSeries}
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="right_price"
                    name={rightLabel}
                    stroke={chartPalette.rightSeries}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="mb-4">
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">1-Month Growth Comparison</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Rolling 1-month growth percentage trend</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                  <XAxis dataKey="date" stroke={chartPalette.axis} fontSize={12} />
                  <YAxis
                    stroke={chartPalette.axis}
                    fontSize={12}
                    tickFormatter={(value) => `${Number(value || 0).toFixed(0)}%`}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatPercent(value), name]} />
                  <Legend wrapperStyle={{ color: chartPalette.axis }} />
                  <Line
                    type="monotone"
                    dataKey="left_growth_1m_pct"
                    name={leftLabel}
                    stroke={chartPalette.growthLeftSeries}
                    strokeWidth={2.2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="right_growth_1m_pct"
                    name={rightLabel}
                    stroke={chartPalette.growthRightSeries}
                    strokeWidth={2.2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Radar Comparison</p>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                PE ratio, EPS, dividend yield, volatility, and growth
              </p>
              {radarMetrics.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {radarMetrics.map((item) => (
                    <span
                      key={item.metric}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                    >
                      <span>{item.metric}</span>
                      <InfoPopover
                        id={`radar-${item.metric}`}
                        label={item.metric}
                        definition={item.definition}
                        activeId={activeTooltipMetric}
                        onToggle={setActiveTooltipMetric}
                        align="left"
                      />
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="h-[26rem] sm:h-[28rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="44%" outerRadius="74%">
                    <PolarGrid stroke={chartPalette.grid} />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: chartPalette.axis, fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fill: chartPalette.axis, fontSize: 11 }} />
                    <Radar
                      name={leftLabel}
                      dataKey="left"
                      stroke={chartPalette.leftSeries}
                      fill={chartPalette.leftSeries}
                      fillOpacity={0.2}
                    />
                    <Radar
                      name={rightLabel}
                      dataKey="right"
                      stroke={chartPalette.rightSeries}
                      fill={chartPalette.rightSeries}
                      fillOpacity={0.2}
                    />
                    <Legend wrapperStyle={{ color: chartPalette.axis }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Metric Comparison</p>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Side-by-side metric comparison with better-value highlight</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="py-3 font-medium">Metric</th>
                      <th className="py-3 font-medium">{leftLabel}</th>
                      <th className="py-3 font-medium">{rightLabel}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(comparison.metric_table || []).map((row) => {
                      const betterSide = getBetterSide(row.metric, row.left, row.right);
                      const definition = getMetricDefinition(row.metric);
                      return (
                        <tr key={row.metric}>
                          <td className="py-3 font-medium text-slate-700 dark:text-slate-200">
                            <div className="flex items-center gap-2">
                              <span>{row.metric}</span>
                              <InfoPopover
                                id={`table-${row.metric}`}
                                label={row.metric}
                                definition={definition}
                                activeId={activeTooltipMetric}
                                onToggle={setActiveTooltipMetric}
                                align="left"
                              />
                            </div>
                          </td>
                          <td
                            className={`py-3 ${
                              betterSide === "left"
                                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                                : "text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {formatMetricValue(row.metric, row.left)}
                          </td>
                          <td
                            className={`py-3 ${
                              betterSide === "right"
                                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                                : "text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {formatMetricValue(row.metric, row.right)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      ) : (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loadingOptions
              ? "Loading your portfolios and stocks..."
              : "Select both sides and click Compare to see detailed analysis."}
          </p>
        </Card>
      )}
    </div>
  );
}

export default ComparePage;
