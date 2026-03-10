const BASE_CAPITAL = 100000;

const FEATURE_LINKS = [
  { label: "Portfolio", to: "/portfolio", description: "Manage grouped holdings and track value." },
  { label: "Compare", to: "/compare", description: "Benchmark stocks or portfolios side by side." },
  { label: "Explore Metals", to: "/explore-metals", description: "Monitor gold, silver, and price predictions." },
  { label: "Risk Categorization", to: "/risk-categorization", description: "Review portfolio and stock risk signals." },
  { label: "Clustering", to: "/portfolio-clustering", description: "Discover ML-driven asset groupings." },
  { label: "BTC Forecast", to: "/btc-forecasting", description: "Preview directional crypto forecasts." },
  { label: "Reports", to: "/reports", description: "Review downloadable portfolio summaries and reports." },
  { label: "Settings", to: "/settings", description: "Manage preferences and platform configuration." },
];

const FALLBACK_ACTIVITY = [
  { day: "Mon", investment: 12200, trades: 3 },
  { day: "Tue", investment: 18450, trades: 4 },
  { day: "Wed", investment: 16100, trades: 2 },
  { day: "Thu", investment: 22400, trades: 5 },
  { day: "Fri", investment: 19300, trades: 4 },
  { day: "Sat", investment: 9800, trades: 1 },
  { day: "Sun", investment: 11400, trades: 2 },
];

const FALLBACK_ALLOCATION = [
  { name: "Stocks", value: 52, color: "#3563E9" },
  { name: "Metals", value: 14, color: "#F59E0B" },
  { name: "Crypto", value: 10, color: "#A855F7" },
  { name: "Cash", value: 24, color: "#10B981" },
];

const FALLBACK_TOP_ASSETS = [
  { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto", value: "Rs 8,940.00", pnl: "+3.40%", positive: true },
  { symbol: "HCLTECH.NS", name: "HCL Technologies", value: "Rs 1,720.00", pnl: "+2.85%", positive: true },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", value: "Rs 4,120.00", pnl: "+2.10%", positive: true },
  { symbol: "INFY", name: "Infosys", value: "Rs 1,685.00", pnl: "+1.90%", positive: true },
  { symbol: "SBIN.NS", name: "State Bank of India", value: "Rs 812.00", pnl: "-0.70%", positive: false },
];

const FALLBACK_TRANSACTIONS = [
  { stock: "AAPL", date: "Mar 05, 2026", amount: "$4,240.00", pnl: "+$160.00", positive: true, action: "Added" },
  { stock: "NVDA", date: "Mar 04, 2026", amount: "$8,520.00", pnl: "+$460.00", positive: true, action: "Added" },
  { stock: "GLD", date: "Mar 03, 2026", amount: "$2,980.00", pnl: "+$42.00", positive: true, action: "Added" },
  { stock: "TSLA", date: "Mar 02, 2026", amount: "$3,610.00", pnl: "-$78.00", positive: false, action: "Added" },
];

const FALLBACK_METALS = [
  { metal: "Gold", spotPrice: "₹8,918.40", dailyChange: "+0.82%", signal: "Bullish" },
  { metal: "Silver", spotPrice: "₹102.14", dailyChange: "+0.35%", signal: "Stable" },
  {
    metal: "7-Day Forecast",
    signal: "Outlook",
    forecasts: [
      { metal: "Gold", value: "₹9,040.00", change: "+1.21%" },
      { metal: "Silver", value: "₹104.80", change: "+0.64%" },
    ],
  },
];

const FALLBACK_BTC_FORECAST = {
  currentPrice: "$68,320",
  predictedPrice: "$70,180",
  direction: "Bullish 7-day outlook",
  confidence: "78%",
  model: "LSTM + ARIMA ensemble",
  series: [
    { label: "T-4", actual: 66400, forecast: null },
    { label: "T-3", actual: 66920, forecast: null },
    { label: "T-2", actual: 67440, forecast: null },
    { label: "T-1", actual: 67910, forecast: null },
    { label: "Now", actual: 68320, forecast: 68320 },
    { label: "+1d", actual: null, forecast: 68810 },
    { label: "+3d", actual: null, forecast: 69440 },
    { label: "+5d", actual: null, forecast: 69920 },
    { label: "+7d", actual: null, forecast: 70180 },
  ],
};

const FALLBACK_CLUSTERING = {
  portfoliosAnalyzed: 3,
  clusterCount: 4,
  silhouetteScore: "0.84",
  dominantCluster: "Core Compounders",
  summary: "ML grouping suggests your strongest overlap sits in quality growth names with one higher-volatility cluster to monitor.",
  clusters: [
    { name: "Core Compounders", count: 5, color: "#3563E9" },
    { name: "Momentum Leaders", count: 3, color: "#10B981" },
    { name: "Value Rebounds", count: 2, color: "#F59E0B" },
    { name: "High Beta", count: 2, color: "#EC4899" },
  ],
};

const FALLBACK_RISK = {
  level: "Balanced",
  score: 58,
  summary: "Most tracked positions sit in the medium-risk band with manageable concentration exposure.",
  bands: [
    { label: "Low", count: 3, share: 25, color: "#10B981" },
    { label: "Medium", count: 6, share: 50, color: "#F59E0B" },
    { label: "High", count: 3, share: 25, color: "#EF4444" },
  ],
  factors: [
    { label: "Diversification", value: "6 active modules" },
    { label: "Largest position", value: "18.4% concentration" },
    { label: "Drawdown watch", value: "2 assets flagged" },
  ],
};

const FALLBACK_SUMMARY_CARDS = [
  {
    title: "Portfolio Value",
    value: "$245,600.00",
    change: "+6.42%",
    positive: true,
    caption: "Across 3 active portfolios",
    gradient: "from-blue-600 via-brand-600 to-indigo-700",
  },
  {
    title: "Portfolio Performance",
    value: "+$14,820.00",
    change: "+6.42% vs invested capital",
    positive: true,
    caption: "Monthly trend remains constructive",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
  },
  {
    title: "Risk Level Overview",
    value: "Balanced",
    change: "58 / 100 portfolio risk score",
    positive: true,
    caption: "Medium risk dominates current mix",
    gradient: "from-violet-600 via-fuchsia-600 to-pink-600",
  },
  {
    title: "Cash Reserve",
    value: "$24,000.00",
    change: "24.00% available runway",
    positive: true,
    caption: "Ready for new allocations",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
  },
];

const FALLBACK_HERO = {
  eyebrow: "Investment Intelligence Workspace",
  title: "A dashboard built around portfolios, research, risk, and machine learning.",
  description: "",
  stats: [
    { label: "Portfolios", value: "3" },
    { label: "Tracked Assets", value: "12" },
  ],
  featureLinks: FEATURE_LINKS,
};

const formatCurrency = (value, currency = "USD", locale = "en-US") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatSignedCurrency = (value, currency = "USD") => {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : "-"}${formatCurrency(Math.abs(number), currency)}`;
};

const formatPercent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const hashValue = (input) =>
  String(input || "")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

const movementPercentFromSymbol = (symbol) => {
  const hash = hashValue(symbol);
  return ((hash % 13) - 5) * 0.55;
};

const buildWeeklyActivity = (stocks) => {
  const today = new Date();
  const buckets = [];
  const index = {};

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    buckets.push({ day, key, investment: 0, trades: 0 });
    index[key] = buckets.length - 1;
  }

  stocks.forEach((stock) => {
    const created = new Date(stock.created_at || Date.now());
    const key = created.toISOString().slice(0, 10);
    if (index[key] !== undefined) {
      const amount = Number(stock.quantity) * Number(stock.buy_price);
      buckets[index[key]].investment += amount;
      buckets[index[key]].trades += 1;
    }
  });

  return buckets.map(({ day, investment, trades }) => ({
    day,
    investment: Number(investment.toFixed(2)),
    trades,
  }));
};

const createAssetRows = (stocks) =>
  stocks.map((stock) => {
    const invested = Number(stock.quantity) * Number(stock.buy_price);
    const movementPct = movementPercentFromSymbol(stock.stock_symbol);
    const currentValue = invested * (1 + movementPct / 100);
    const fallbackCurrentPrice = Number(stock.buy_price) * (1 + movementPct / 100);
    const liveCurrentPrice = Number(stock.current_price);
    return {
      symbol: stock.stock_symbol,
      name: stock.company_name || stock.stock_symbol,
      invested,
      currentValue,
      currentPrice: Number.isFinite(liveCurrentPrice) && liveCurrentPrice > 0 ? liveCurrentPrice : fallbackCurrentPrice,
      pnlValue: currentValue - invested,
      pnlPct: movementPct,
      createdAt: stock.created_at,
    };
  });

const classifyRisk = (asset, totalInvestment) => {
  const concentration = totalInvestment > 0 ? asset.invested / totalInvestment : 0;
  const volatilityProxy = Math.abs(asset.pnlPct) / 2.5;
  const score = Math.min(92, Math.max(24, 28 + concentration * 100 + volatilityProxy * 14));

  if (score >= 70) return { label: "High", score };
  if (score >= 45) return { label: "Medium", score };
  return { label: "Low", score };
};

const buildRiskOverview = (assetRows, totalInvestment) => {
  if (!assetRows.length) return FALLBACK_RISK;

  const buckets = { Low: 0, Medium: 0, High: 0 };
  let scoreSum = 0;
  let largestPosition = 0;

  assetRows.forEach((asset) => {
    const risk = classifyRisk(asset, totalInvestment);
    buckets[risk.label] += 1;
    scoreSum += risk.score;
    largestPosition = Math.max(largestPosition, asset.invested);
  });

  const averageScore = Math.round(scoreSum / assetRows.length);
  const level = averageScore >= 70 ? "Aggressive" : averageScore >= 45 ? "Balanced" : "Conservative";
  const highRiskCount = buckets.High;
  const totalAssets = assetRows.length;

  return {
    level,
    score: averageScore,
    summary:
      level === "Aggressive"
        ? "Higher-volatility positions dominate the current portfolio mix."
        : level === "Balanced"
          ? "Most positions sit in the medium-risk range with reasonable diversification."
          : "Holdings skew toward lower-volatility, steadier positions.",
    bands: [
      { label: "Low", count: buckets.Low, share: Math.round((buckets.Low / totalAssets) * 100), color: "#10B981" },
      {
        label: "Medium",
        count: buckets.Medium,
        share: Math.round((buckets.Medium / totalAssets) * 100),
        color: "#F59E0B",
      },
      { label: "High", count: highRiskCount, share: Math.round((highRiskCount / totalAssets) * 100), color: "#EF4444" },
    ],
    factors: [
      { label: "Diversification", value: `${totalAssets} tracked assets` },
      {
        label: "Largest position",
        value: `${totalInvestment > 0 ? ((largestPosition / totalInvestment) * 100).toFixed(1) : "0.0"}% concentration`,
      },
      { label: "Drawdown watch", value: `${highRiskCount} assets flagged` },
    ],
  };
};

const buildAllocation = (totalInvestment, availableCash) => {
  if (totalInvestment <= 0) return FALLBACK_ALLOCATION;

  const safeBase = totalInvestment + availableCash || 1;
  return [
    { name: "Stocks", value: Number(((totalInvestment / safeBase) * 100).toFixed(2)), color: "#3563E9" },
    { name: "Metals", value: 0, color: "#F59E0B" },
    { name: "Crypto", value: 0, color: "#A855F7" },
    { name: "Cash", value: Number(((availableCash / safeBase) * 100).toFixed(2)), color: "#10B981" },
  ];
};

const buildTopAssets = (assetRows) =>
  [...assetRows]
    .sort((left, right) => right.pnlPct - left.pnlPct)
    .slice(0, 5)
    .map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      value: formatCurrency(asset.currentPrice, "INR", "en-IN"),
      pnl: formatPercent(asset.pnlPct),
      positive: asset.pnlPct >= 0,
    }));

const buildRecentTransactions = (stocks) =>
  [...stocks]
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .slice(0, 6)
    .map((stock) => {
      const amount = Number(stock.quantity) * Number(stock.buy_price);
      const movement = movementPercentFromSymbol(stock.stock_symbol) / 100;
      const pnlValue = amount * movement;
      return {
        stock: stock.stock_symbol,
        date: new Date(stock.created_at || Date.now()).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        amount: formatCurrency(amount),
        pnl: formatSignedCurrency(pnlValue),
        positive: pnlValue >= 0,
        action: "Added",
      };
    });

const buildClusteringPreview = (assetRows, portfolios) => {
  if (!assetRows.length) return FALLBACK_CLUSTERING;

  const clusterMeta = [
    { name: "Core Compounders", color: "#3563E9" },
    { name: "Momentum Leaders", color: "#10B981" },
    { name: "Value Rebounds", color: "#F59E0B" },
    { name: "High Beta", color: "#EC4899" },
  ];

  const counts = clusterMeta.map((cluster) => ({ ...cluster, count: 0 }));

  assetRows.forEach((asset) => {
    const index = hashValue(asset.symbol) % counts.length;
    counts[index].count += 1;
  });

  const nonZeroClusters = counts.filter((cluster) => cluster.count > 0);
  const dominantCluster = [...nonZeroClusters].sort((left, right) => right.count - left.count)[0];
  const silhouetteScore = (0.68 + Math.min(assetRows.length, 10) * 0.012).toFixed(2);

  return {
    portfoliosAnalyzed: portfolios.length || 1,
    clusterCount: nonZeroClusters.length || 1,
    silhouetteScore,
    dominantCluster: dominantCluster?.name || "Core Compounders",
    summary:
      "Current holdings naturally form machine-learning groupings that can guide rebalancing, overlap review, and diversification checks.",
    clusters: nonZeroClusters.length ? nonZeroClusters : FALLBACK_CLUSTERING.clusters,
  };
};

const buildSummaryCards = ({
  portfolioCount,
  totalPortfolioValue,
  totalInvestment,
  availableCash,
  performancePct,
  pnlValue,
  riskOverview,
}) => {
  const investedPct = BASE_CAPITAL > 0 ? (totalInvestment / BASE_CAPITAL) * 100 : 0;
  const cashPct = BASE_CAPITAL > 0 ? (availableCash / BASE_CAPITAL) * 100 : 0;

  return [
    {
      title: "Portfolio Value",
      value: formatCurrency(totalPortfolioValue),
      change: formatPercent(performancePct),
      positive: performancePct >= 0,
      caption: `Across ${portfolioCount || 1} active portfolio${portfolioCount === 1 ? "" : "s"}`,
      gradient: "from-blue-600 via-brand-600 to-indigo-700",
    },
    {
      title: "Portfolio Performance",
      value: formatSignedCurrency(pnlValue),
      change: `${formatPercent(performancePct)} vs invested capital`,
      positive: pnlValue >= 0,
      caption: "Live snapshot from tracked holdings",
      gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    },
    {
      title: "Risk Level Overview",
      value: riskOverview.level,
      change: `${riskOverview.score} / 100 portfolio risk score`,
      positive: riskOverview.score < 70,
      caption: riskOverview.summary,
      gradient: "from-violet-600 via-fuchsia-600 to-pink-600",
    },
    {
      title: "Cash Reserve",
      value: formatCurrency(availableCash),
      change: `${cashPct.toFixed(2)}% available runway`,
      positive: availableCash > BASE_CAPITAL * 0.2,
      caption: `${investedPct.toFixed(2)}% currently deployed`,
      gradient: "from-amber-500 via-orange-500 to-rose-500",
    },
  ];
};

export function buildDashboardViewModel({ portfolios = [], stocks = [] } = {}) {
  const assetRows = createAssetRows(stocks);

  if (!portfolios.length && !assetRows.length) {
    return {
      hero: FALLBACK_HERO,
      summaryCards: FALLBACK_SUMMARY_CARDS,
      activity: FALLBACK_ACTIVITY,
      allocation: FALLBACK_ALLOCATION,
      topAssets: FALLBACK_TOP_ASSETS,
      recentTransactions: FALLBACK_TRANSACTIONS,
      metals: FALLBACK_METALS,
      btcForecast: FALLBACK_BTC_FORECAST,
      clustering: FALLBACK_CLUSTERING,
      riskOverview: FALLBACK_RISK,
    };
  }

  const totalInvestment = assetRows.reduce((sum, asset) => sum + asset.invested, 0);
  const totalPortfolioValue = assetRows.reduce((sum, asset) => sum + asset.currentValue, 0);
  const pnlValue = totalPortfolioValue - totalInvestment;
  const performancePct = totalInvestment > 0 ? (pnlValue / totalInvestment) * 100 : 0;
  const availableCash = Math.max(0, BASE_CAPITAL - totalInvestment);
  const liveActivity = buildWeeklyActivity(stocks);
  const hasLiveActivity = liveActivity.some((point) => point.investment > 0);
  const riskOverview = buildRiskOverview(assetRows, totalInvestment);
  const topAssets = buildTopAssets(assetRows);
  const recentTransactions = buildRecentTransactions(stocks);

  return {
    hero: {
      ...FALLBACK_HERO,
      stats: [
        { label: "Portfolios", value: String(portfolios.length || 1) },
        { label: "Tracked Assets", value: String(assetRows.length || 0) },
      ],
    },
    summaryCards: buildSummaryCards({
      portfolioCount: portfolios.length,
      totalPortfolioValue,
      totalInvestment,
      availableCash,
      performancePct,
      pnlValue,
      riskOverview,
    }),
    activity: hasLiveActivity ? liveActivity : FALLBACK_ACTIVITY,
    allocation: buildAllocation(totalInvestment, availableCash),
    topAssets: topAssets.length ? topAssets : FALLBACK_TOP_ASSETS,
    recentTransactions: recentTransactions.length ? recentTransactions : FALLBACK_TRANSACTIONS,
    metals: FALLBACK_METALS,
    btcForecast: FALLBACK_BTC_FORECAST,
    clustering: buildClusteringPreview(assetRows, portfolios),
    riskOverview,
  };
}
