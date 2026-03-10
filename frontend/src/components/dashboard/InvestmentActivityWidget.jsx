import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "../ui/Card";
import useChartTheme from "../../hooks/useChartTheme";

function InvestmentActivityWidget({ data, isLoading, className = "" }) {
  const chartTheme = useChartTheme();
  const totalActivity = data.reduce((sum, point) => sum + Number(point.investment || 0), 0);

  return (
    <Card className={className}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Investment Activity</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Weekly capital deployment and transaction intensity{isLoading ? " (syncing...)" : ""}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-right dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            7-day total
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalActivity)}
          </p>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="dashboardActivityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3563E9" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#3563E9" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis dataKey="day" stroke={chartTheme.axis} fontSize={12} />
            <YAxis
              stroke={chartTheme.axis}
              fontSize={12}
              tickFormatter={(value) =>
                new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
              }
            />
            <Tooltip
              contentStyle={chartTheme.tooltipStyle}
              formatter={(value) => [
                new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0)),
                "Investment",
              ]}
            />
            <Area
              type="monotone"
              dataKey="investment"
              stroke="#3563E9"
              fill="url(#dashboardActivityGradient)"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default InvestmentActivityWidget;
