import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { getStockDetail } from "../../services/portfolioApi";

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return parsed.toFixed(2);
};

const formatPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return `${parsed.toFixed(2)}%`;
};

const toNumericOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function StockDetailPage() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [stockDetail, setStockDetail] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadStockDetail = async () => {
      if (!symbol) return;
      try {
        setIsLoading(true);
        setError("");
        const payload = await getStockDetail(symbol);
        if (!mounted) return;
        setStockDetail(payload);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load stock details.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadStockDetail();
    return () => {
      mounted = false;
    };
  }, [symbol]);

  const backToPortfolioPath = useMemo(() => {
    const state = location.state || {};
    if (state.portfolioId) {
      return `/portfolio/${state.portfolioId}`;
    }
    return "/portfolio";
  }, [location.state]);

  const chartData = useMemo(
    () =>
      (stockDetail?.historical_prices || []).map((point) => ({
        date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
        price: toNumericOrNull(point.price),
        discount_level: toNumericOrNull(point.discount_level),
        opportunity_score: toNumericOrNull(point.opportunity_score),
      })),
    [stockDetail]
  );

  const metricCards = useMemo(
    () => [
      {
        title: "Current Price",
        value: formatCurrency(stockDetail?.current_price),
        note: "Latest available price in INR from yfinance",
      },
      {
        title: "PE Ratio",
        value: formatNumber(stockDetail?.pe_ratio),
        note: "Trailing/forward PE from company fundamentals",
      },
      {
        title: "Discount Level",
        value: formatPercent(stockDetail?.historical_prices?.at(-1)?.discount_level),
        note: "Drawdown from rolling 3-month high",
      },
      {
        title: "Opportunity Score",
        value: formatNumber(stockDetail?.historical_prices?.at(-1)?.opportunity_score),
        note: "Discount-adjusted score based on PE",
      },
    ],
    [stockDetail]
  );

  const statCards = useMemo(
    () => [
      { title: "Maximum Price", value: formatCurrency(stockDetail?.max_price) },
      { title: "Minimum Price", value: formatCurrency(stockDetail?.min_price) },
      { title: "Open Price", value: formatCurrency(stockDetail?.open_price) },
      { title: "Close Price", value: formatCurrency(stockDetail?.close_price) },
      { title: "Average Price", value: formatCurrency(stockDetail?.average_price) },
    ],
    [stockDetail]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {stockDetail?.company_name || symbol || "Stock"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{(symbol || "").toUpperCase()}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(backToPortfolioPath)}>
          <ArrowLeft size={16} /> Back to Portfolio
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.title}</p>
            <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {isLoading ? "..." : card.value}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{card.note}</p>
          </Card>
        ))}
      </section>

      <Card>
        <div className="mb-4">
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            3-Month Trend: Discount and Opportunity
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Historical price trend with discount level and opportunity score.
          </p>
        </div>
        <div className="h-80">
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading chart...</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No historical data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b81f" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => `INR ${Number(value || 0).toLocaleString("en-IN")}`}
                />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    borderColor: "#cbd5e1",
                    backgroundColor: "#0f172a",
                    color: "#ffffff",
                  }}
                  formatter={(value, name) => {
                    if (name === "Price") return [formatCurrency(value), "Price"];
                    if (name === "Discount Level") return [formatPercent(value), "Discount Level"];
                    return [formatNumber(value), "Opportunity Score"];
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="price" name="Price" stroke="#3563E9" dot={false} strokeWidth={2.5} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="discount_level"
                  name="Discount Level"
                  stroke="#F59E0B"
                  dot={false}
                  strokeWidth={2.2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="opportunity_score"
                  name="Opportunity Score"
                  stroke="#10B981"
                  dot={false}
                  strokeWidth={2.2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Stock Statistics</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map((stat) => (
            <article
              key={stat.title}
              className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.title}</p>
              <p className="mt-2 font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
                {isLoading ? "..." : stat.value}
              </p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default StockDetailPage;
