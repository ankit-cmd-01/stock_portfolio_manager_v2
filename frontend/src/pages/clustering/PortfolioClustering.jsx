import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, Layers3, Search, Sparkles, X } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import useChartTheme from "../../hooks/useChartTheme";
import {
  getMarketClustering,
  getPortfolioClustering,
  getPortfolios,
  searchStocks,
} from "../../services/portfolioApi";

const CLUSTER_TONES = [
  {
    color: "#22c55e",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    cardClass:
      "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10",
  },
  {
    color: "#60a5fa",
    badgeClass:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    cardClass: "border-sky-200/70 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-500/10",
  },
  {
    color: "#f59e0b",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    cardClass:
      "border-amber-200/70 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10",
  },
  {
    color: "#ef4444",
    badgeClass:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    cardClass: "border-rose-200/70 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10",
  },
  {
    color: "#a855f7",
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
    cardClass:
      "border-violet-200/70 bg-violet-50/70 dark:border-violet-500/20 dark:bg-violet-500/10",
  },
  {
    color: "#06b6d4",
    badgeClass:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200",
    cardClass: "border-cyan-200/70 bg-cyan-50/70 dark:border-cyan-500/20 dark:bg-cyan-500/10",
  },
];

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatRatioPercent = (value) => {
  const n = toNumberOrNull(value);
  return n === null ? "N/A" : `${(n * 100).toFixed(2)}%`;
};

const formatLargeNumber = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return "N/A";
  if (Math.abs(n) >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
};

const formatRaw = (value) => {
  const n = toNumberOrNull(value);
  return n === null ? "N/A" : n.toFixed(3);
};

const getClusterTone = (index) => CLUSTER_TONES[index % CLUSTER_TONES.length];

const getClusterProfileName = (clusterId, insight) => {
  const text = String(insight || "").toLowerCase();
  if (text.includes("large-cap") || text.includes("stable") || text.includes("moderate")) {
    return "Stable Giants";
  }
  if (text.includes("high-growth") || text.includes("aggressive") || text.includes("high-volatility")) {
    return "Fast Movers";
  }
  if (text.includes("smaller-cap") || text.includes("sensitive")) {
    return "High Risk Picks";
  }
  if (text.includes("balanced") || text.includes("diversified") || text.includes("mix")) {
    return "Balanced Mix";
  }
  return `Cluster ${clusterId}`;
};

const getClusterRiskTag = (insight) => {
  const text = String(insight || "").toLowerCase();
  if (text.includes("stable") || text.includes("low-volatility")) return "Defensive";
  if (text.includes("large-cap") || text.includes("moderate")) return "Core";
  if (text.includes("high-growth") || text.includes("aggressive")) return "Aggressive";
  if (text.includes("smaller-cap") || text.includes("sensitive")) return "Speculative";
  return "Balanced";
};

const getShortLabel = (label) => {
  const words = String(label || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return label;
  return words.slice(0, 2).join(" ");
};

const getSourceLabel = (payload) => {
  if (!payload) return "N/A";
  if (payload.source === "portfolio") {
    return payload.source_meta?.portfolio_name || "Saved portfolio";
  }
  return "Manual stock basket";
};

function ClusterBadge({ summary, compact = false }) {
  if (!summary) return null;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${summary.tone.badgeClass}`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: summary.tone.color }} />
      {compact ? summary.label : `Group ${summary.clusterId} - ${summary.label}`}
    </span>
  );
}

function PortfolioClustering() {
  const chartTheme = useChartTheme();
  const [datasetType, setDatasetType] = useState("portfolio");
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [symbolInput, setSymbolInput] = useState("");
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [stockSuggestions, setStockSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [searchingStocks, setSearchingStocks] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [clusterFilter, setClusterFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    const loadPortfolios = async () => {
      try {
        setLoadingPortfolios(true);
        const payload = await getPortfolios();
        if (!mounted) return;
        const safe = Array.isArray(payload) ? payload : [];
        setPortfolios(safe);
        if (safe.length > 0) {
          setSelectedPortfolioId(String(safe[0].id));
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load portfolios.");
      } finally {
        if (mounted) setLoadingPortfolios(false);
      }
    };
    loadPortfolios();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (datasetType !== "manual") return;
    const query = symbolInput.trim();
    if (query.length < 2) {
      setStockSuggestions([]);
      return;
    }

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

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [datasetType, symbolInput]);

  const addSymbol = (value) => {
    const clean = String(value || "")
      .trim()
      .toUpperCase();
    if (!clean) return;
    setSelectedSymbols((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setSymbolInput("");
    setSearchOpen(false);
  };

  const removeSymbol = (symbol) => {
    setSelectedSymbols((prev) => prev.filter((item) => item !== symbol));
  };

  const runAnalysis = async () => {
    try {
      setError("");
      setLoadingAnalysis(true);
      setClusterFilter("all");

      if (datasetType === "portfolio") {
        if (!selectedPortfolioId) {
          throw new Error("Please select a portfolio.");
        }
        const payload = await getPortfolioClustering(selectedPortfolioId);
        setResult(payload);
        return;
      }

      if (selectedSymbols.length < 2) {
        throw new Error("Add at least 2 symbols for manual clustering.");
      }
      const payload = await getMarketClustering(selectedSymbols);
      setResult(payload);
    } catch (err) {
      setResult(null);
      setError(err.message || "Unable to run clustering analysis.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const stocks = useMemo(() => (Array.isArray(result?.stocks) ? result.stocks : []), [result]);
  const distribution = useMemo(
    () => (Array.isArray(result?.cluster_distribution) ? result.cluster_distribution : []),
    [result]
  );
  const comparison = useMemo(
    () => (Array.isArray(result?.cluster_comparison) ? result.cluster_comparison : []),
    [result]
  );
  const insights = useMemo(
    () => (Array.isArray(result?.cluster_insights) ? result.cluster_insights : []),
    [result]
  );
  const dataIssues = useMemo(() => (Array.isArray(result?.data_issues) ? result.data_issues : []), [result]);

  const clusterIds = useMemo(() => {
    const ids = new Set(stocks.map((item) => Number(item.cluster_id)).filter(Number.isFinite));
    return Array.from(ids).sort((a, b) => a - b);
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    if (clusterFilter === "all") return stocks;
    return stocks.filter((item) => String(item.cluster_id) === String(clusterFilter));
  }, [stocks, clusterFilter]);

  const scatterByCluster = useMemo(() => {
    const grouped = {};
    clusterIds.forEach((id) => {
      grouped[id] = stocks
        .filter((item) => Number(item.cluster_id) === id)
        .map((item) => ({
          symbol: item.symbol,
          company_name: item.company_name,
          pca_component_1: toNumberOrNull(item.pca_component_1),
          pca_component_2: toNumberOrNull(item.pca_component_2),
          cluster_id: item.cluster_id,
          average_return: item.average_return,
          volatility: item.volatility,
        }))
        .filter((point) => point.pca_component_1 !== null && point.pca_component_2 !== null);
    });
    return grouped;
  }, [clusterIds, stocks]);

  const clusterSummaries = useMemo(() => {
    const comparisonMap = new Map(comparison.map((item) => [Number(item.cluster_id), item]));
    const insightMap = new Map(insights.map((item) => [Number(item.cluster_id), item]));

    return clusterIds.map((clusterId, index) => {
      const insightRow = insightMap.get(clusterId);
      const comparisonRow = comparisonMap.get(clusterId);
      const tone = getClusterTone(index);
      const label = getClusterProfileName(clusterId, insightRow?.insight);
      const members = stocks
        .filter((item) => Number(item.cluster_id) === clusterId)
        .map((item) => item.symbol)
        .slice(0, 4);

      return {
        clusterId,
        label,
        shortLabel: getShortLabel(label),
        insight: insightRow?.insight || "Stocks grouped by similar behavior patterns.",
        riskTag: getClusterRiskTag(insightRow?.insight),
        stockCount: comparisonRow?.stock_count ?? insightRow?.stock_count ?? 0,
        averageReturn: comparisonRow?.average_return,
        averageVolatility: comparisonRow?.average_volatility,
        averageMarketCap: comparisonRow?.average_market_cap,
        averageBeta: comparisonRow?.average_beta,
        averageVolume: comparisonRow?.average_volume,
        members,
        tone,
      };
    });
  }, [clusterIds, comparison, insights, stocks]);

  const clusterSummaryMap = useMemo(
    () => new Map(clusterSummaries.map((item) => [item.clusterId, item])),
    [clusterSummaries]
  );

  const distributionChartData = useMemo(
    () =>
      distribution.map((item) => {
        const summary = clusterSummaryMap.get(Number(item.cluster_id));
        return {
          ...item,
          short_label: summary?.shortLabel || `Cluster ${item.cluster_id}`,
          full_label: summary?.label || `Cluster ${item.cluster_id}`,
          color: summary?.tone.color || getClusterTone(0).color,
        };
      }),
    [distribution, clusterSummaryMap]
  );

  const largestCluster = useMemo(() => {
    if (clusterSummaries.length === 0) return null;
    return [...clusterSummaries].sort((a, b) => b.stockCount - a.stockCount)[0];
  }, [clusterSummaries]);

  const panelClass = chartTheme.panelCardClass;
  const metricCardClass = chartTheme.metricCardClass;
  const panelTitleClass = chartTheme.panelTitleClass;
  const bodyTextClass = chartTheme.bodyTextClass;
  const mutedTextClass = chartTheme.mutedTextClass;
  const controlClass = chartTheme.controlClass;
  const helperCardClass =
    "rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80";
  const selectionAreaClass =
    "rounded-2xl border border-slate-200/80 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-950/30";

  return (
    <div className="space-y-6">
      <Card className={chartTheme.heroCardClass}>
        <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-rose-400/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className={chartTheme.sectionTitleClass}>Portfolio Clustering</p>
              <p className={`mt-2 ${bodyTextClass}`}>
                Group stocks by similar market behavior so you can quickly see which names are
                defensive, aggressive, balanced, or more sensitive to market swings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/40 bg-white/60 px-4 py-3 backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/40">
                <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Model</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">K-Means + PCA</p>
              </div>
              <div className="rounded-2xl border border-white/40 bg-white/60 px-4 py-3 backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/40">
                <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Signals</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Return, risk, volume
                </p>
              </div>
              <div className="rounded-2xl border border-white/40 bg-white/60 px-4 py-3 backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/40">
                <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Use</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Spot stock behavior groups
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      <Card className={panelClass}>
        <div className="mb-4">
          <p className={panelTitleClass}>Dataset Selection</p>
          <p className={bodyTextClass}>
            Analyze an existing portfolio or create a manual watchlist to see which stocks behave alike.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-start">
          <div className="space-y-1">
            <label className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Source</label>
            <select
              value={datasetType}
              onChange={(event) => {
                setDatasetType(event.target.value);
                setResult(null);
                setError("");
                setClusterFilter("all");
              }}
              className={controlClass}
            >
              <option value="portfolio">Portfolio</option>
              <option value="manual">Manual Stock Selection</option>
            </select>
          </div>

          <div className={`${selectionAreaClass} min-h-[132px]`}>
            {datasetType === "portfolio" ? (
              <div className="space-y-1">
                <label className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                  Portfolio
                </label>
                <select
                  value={selectedPortfolioId}
                  onChange={(event) => setSelectedPortfolioId(event.target.value)}
                  disabled={loadingPortfolios}
                  className={controlClass}
                >
                  {portfolios.length === 0 ? (
                    <option value="">No portfolios available</option>
                  ) : (
                    portfolios.map((portfolio) => (
                      <option key={portfolio.id} value={String(portfolio.id)}>
                        {portfolio.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                    Add Symbols
                  </label>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="relative">
                    <Search
                      size={15}
                        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                          chartTheme.isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      />
                      <input
                        value={symbolInput}
                        onChange={(event) => {
                          setSymbolInput(event.target.value);
                          setSearchOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addSymbol(symbolInput);
                          }
                        }}
                        onFocus={() => setSearchOpen(true)}
                        onBlur={() => {
                          setTimeout(() => setSearchOpen(false), 150);
                        }}
                        placeholder="Search symbol or company (AAPL, MSFT, INFY.NS)"
                        className={`pl-10 ${controlClass}`}
                      />
                      {searchOpen ? (
                        <div className={chartTheme.dropdownClass}>
                          {searchingStocks ? (
                            <p className={`px-4 py-3 text-sm ${bodyTextClass}`}>Searching...</p>
                          ) : stockSuggestions.length === 0 ? (
                            <p className={`px-4 py-3 text-sm ${bodyTextClass}`}>No matches found.</p>
                          ) : (
                            stockSuggestions.map((item) => (
                              <button
                                key={`${item.symbol}-${item.company_name}`}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  addSymbol(item.symbol);
                                }}
                                className={chartTheme.dropdownItemClass}
                              >
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {item.symbol} - {item.company_name}
                                </p>
                              </button>
                            ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

                <div className="flex min-h-6 flex-wrap gap-2">
                  {selectedSymbols.map((symbol) => (
                    <span
                      key={symbol}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {symbol}
                      <button
                        type="button"
                        onClick={() => removeSymbol(symbol)}
                        className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-100"
                        aria-label={`Remove ${symbol}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {selectedSymbols.length === 0 ? (
                    <p className={mutedTextClass}>
                      Add at least 2 symbols for clustering.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={runAnalysis}
            disabled={loadingAnalysis || loadingPortfolios}
            className="lg:self-start xl:justify-self-end"
          >
            {loadingAnalysis ? "Analyzing..." : "Run Clustering"}
          </Button>
        </div>
      </Card>

      {result ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className={metricCardClass}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Groups Found</p>
              <p className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
                {toNumberOrNull(result.cluster_count) ?? 0}
              </p>
            </Card>
            <Card className={metricCardClass}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Stocks Analyzed</p>
              <p className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">{stocks.length}</p>
            </Card>
            <Card className={metricCardClass}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Largest Group</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">
                {largestCluster?.label || "N/A"}
              </p>
            </Card>
            <Card className={metricCardClass}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Source</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">
                {getSourceLabel(result)}
              </p>
            </Card>
          </section>

          <Card className={panelClass}>
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  <Sparkles size={16} />
                </span>
                <div>
                  <p className={panelTitleClass}>How To Read This Analysis</p>
                </div>
              </div>
              <p className={`mt-3 ${bodyTextClass}`}>
                Stocks in the same group move with similar risk and return behavior. Use the persona
                cards below to understand what each group represents before diving into the tables.
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className={helperCardClass}>
                <div className="flex items-center gap-2">
                  <Layers3 size={15} className={chartTheme.isDark ? "text-slate-400" : "text-slate-500"} />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Same color = same behavior</p>
                </div>
                <p className={`mt-2 text-sm ${bodyTextClass}`}>
                  Points and rows sharing a color belong to one cluster of similar stocks.
                </p>
              </div>
              <div className={helperCardClass}>
                <div className="flex items-center gap-2">
                  <Info size={15} className={chartTheme.isDark ? "text-slate-400" : "text-slate-500"} />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Personas explain the why</p>
                </div>
                <p className={`mt-2 text-sm ${bodyTextClass}`}>
                  Each group is renamed into a readable theme like Stable Giants or Fast Movers.
                </p>
              </div>
              <div className={helperCardClass}>
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className={chartTheme.isDark ? "text-slate-400" : "text-slate-500"} />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Use tables for action</p>
                </div>
                <p className={`mt-2 text-sm ${bodyTextClass}`}>
                  Once a group looks interesting, scan its stocks to decide whether it fits your portfolio style.
                </p>
              </div>
            </div>
          </Card>

          {dataIssues.length > 0 ? (
            <Card className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Some symbols were skipped because data could not be fetched: {dataIssues.slice(0, 3).join(" | ")}
              {dataIssues.length > 3 ? ` | +${dataIssues.length - 3} more` : ""}
            </Card>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clusterSummaries.map((summary) => (
              <Card key={summary.clusterId} className={`overflow-hidden p-0 ${summary.tone.cardClass}`}>
                <div className="h-1.5 w-full" style={{ backgroundColor: summary.tone.color }} />
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                        Group {summary.clusterId}
                      </p>
                      <p className="mt-1 font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {summary.label}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${summary.tone.badgeClass}`}>
                      {summary.riskTag}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{summary.insight}</p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Avg Return</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatRatioPercent(summary.averageReturn)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Volatility</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatRatioPercent(summary.averageVolatility)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Market Cap</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatLargeNumber(summary.averageMarketCap)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Stocks</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{summary.stockCount}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Sample Stocks</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summary.members.map((symbol) => (
                        <span
                          key={`${summary.clusterId}-${symbol}`}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${summary.tone.badgeClass}`}
                        >
                          {symbol}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className={panelClass}>
              <div className="mb-4">
                <p className={panelTitleClass}>Behavior Map</p>
                <p className={bodyTextClass}>
                  Stocks that sit closer together on this map behave more similarly across the clustering signals.
                </p>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: 10, right: 12, top: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis
                      type="number"
                      dataKey="pca_component_1"
                      stroke={chartTheme.axis}
                      fontSize={11}
                      tickFormatter={formatRaw}
                    />
                    <YAxis
                      type="number"
                      dataKey="pca_component_2"
                      stroke={chartTheme.axis}
                      fontSize={11}
                      tickFormatter={formatRaw}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={chartTheme.tooltipStyle}
                      formatter={(value, name) => [formatRaw(value), name]}
                      labelFormatter={(_, payload) => {
                        const point = payload?.[0]?.payload;
                        if (!point) return "";
                        const summary = clusterSummaryMap.get(Number(point.cluster_id));
                        return `${point.symbol} - ${summary?.label || `Cluster ${point.cluster_id}`}`;
                      }}
                    />
                    <Legend wrapperStyle={chartTheme.legendStyle} />
                    {clusterSummaries.map((summary) => (
                      <Scatter
                        key={summary.clusterId}
                        name={summary.label}
                        data={scatterByCluster[summary.clusterId] || []}
                        fill={summary.tone.color}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className={panelClass}>
              <div className="mb-4">
                <p className={panelTitleClass}>Group Size Distribution</p>
                <p className={bodyTextClass}>
                  See how many stocks landed in each behavior group.
                </p>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionChartData} margin={{ left: 4, right: 8, top: 12, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="short_label" stroke={chartTheme.axis} fontSize={11} interval={0} />
                    <YAxis stroke={chartTheme.axis} fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={chartTheme.tooltipStyle}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full_label || ""}
                      formatter={(value) => [value, "Stocks"]}
                    />
                    <Bar dataKey="count" name="Stocks">
                      {distributionChartData.map((entry) => (
                        <Cell key={`cluster-bar-${entry.cluster_id}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          <Card className={panelClass}>
            <div className="mb-4">
              <p className={panelTitleClass}>Group Comparison</p>
              <p className={bodyTextClass}>
                Compare the average profile of each group before drilling into individual names.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className={chartTheme.tableClass}>
                <thead>
                  <tr className={chartTheme.tableHeadClass}>
                    <th className="py-3 font-medium">Group</th>
                    <th className="py-3 font-medium">Average Return</th>
                    <th className="py-3 font-medium">Average Volatility</th>
                    <th className="py-3 font-medium">Average Market Cap</th>
                    <th className="py-3 font-medium">Average Risk</th>
                    <th className="py-3 font-medium">Average Volume</th>
                    <th className="py-3 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody className={chartTheme.tableBodyClass}>
                  {comparison.map((row) => {
                    const summary = clusterSummaryMap.get(Number(row.cluster_id));
                    return (
                      <tr key={row.cluster_id}>
                        <td className="py-3 text-slate-900 dark:text-slate-100">
                          <ClusterBadge summary={summary} />
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-200">{formatRatioPercent(row.average_return)}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-200">{formatRatioPercent(row.average_volatility)}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-200">{formatLargeNumber(row.average_market_cap)}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-200">{formatRaw(row.average_beta)}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-200">{formatLargeNumber(row.average_volume)}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-200">{row.stock_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className={panelClass}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={panelTitleClass}>Stocks Inside Each Group</p>
                <p className={bodyTextClass}>
                  Review the stocks inside each cluster with their behavior metrics and switch between groups.
                </p>
              </div>
              <div className="w-full sm:w-60">
                <label className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                  Filter by Group
                </label>
                <select
                  value={clusterFilter}
                  onChange={(event) => setClusterFilter(event.target.value)}
                  className={controlClass}
                >
                  <option value="all">All Groups</option>
                  {clusterSummaries.map((summary) => (
                    <option key={summary.clusterId} value={String(summary.clusterId)}>
                      {summary.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className={chartTheme.tableClass}>
                <thead>
                  <tr className={chartTheme.tableHeadClass}>
                    <th className="py-3 font-medium">Stock</th>
                    <th className="py-3 font-medium">Group</th>
                    <th className="py-3 font-medium">Return</th>
                    <th className="py-3 font-medium">Volatility</th>
                    <th className="py-3 font-medium">Market Cap</th>
                    <th className="py-3 font-medium">Risk</th>
                    <th className="py-3 font-medium">Volume</th>
                  </tr>
                </thead>
                <tbody className={chartTheme.tableBodyClass}>
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No stocks match the selected group.
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((row) => {
                      const summary = clusterSummaryMap.get(Number(row.cluster_id));
                      return (
                        <tr key={row.symbol}>
                          <td className="py-3 text-slate-900 dark:text-slate-100">
                            <p className="font-semibold">{row.symbol}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{row.company_name}</p>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-200">
                            <ClusterBadge summary={summary} compact />
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-200">{formatRatioPercent(row.average_return)}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-200">{formatRatioPercent(row.volatility)}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-200">{formatLargeNumber(row.market_cap)}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-200">{formatRaw(row.beta)}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-200">{formatLargeNumber(row.average_volume)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className={panelClass}>
          <div className="flex min-h-28 items-center justify-center">
            <p className={`max-w-3xl text-center text-sm ${bodyTextClass}`}>
              Select a dataset and run clustering to see readable stock groups, a behavior map, and a clearer explanation of what each cluster means.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default PortfolioClustering;
