import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "../ui/Card";
import useChartTheme from "../../hooks/useChartTheme";

function BtcForecastWidget({ data, className = "" }) {
  const chartTheme = useChartTheme();

  return (
    <Card className={className}>
      <div className="mb-4">
        <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">BTC Forecast Preview</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{data.model}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Current Price</p>
          <p className="mt-1 font-display text-xl font-semibold text-slate-900 dark:text-slate-100">{data.currentPrice}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">7-Day Forecast</p>
          <p className="mt-1 font-display text-xl font-semibold text-slate-900 dark:text-slate-100">{data.predictedPrice}</p>
          <p className="mt-1 text-xs font-medium text-emerald-500">{data.direction}</p>
        </div>
      </div>

      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series}>
            <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={12} />
            <YAxis
              stroke={chartTheme.axis}
              fontSize={12}
              domain={["dataMin - 1200", "dataMax + 1200"]}
              tickFormatter={(value) =>
                new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
              }
            />
            <Tooltip
              contentStyle={chartTheme.tooltipStyle}
              formatter={(value, name) => {
                if (value === null || value === undefined) return ["N/A", name];
                return [new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value)), name];
              }}
            />
            <Legend wrapperStyle={chartTheme.legendStyle} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#3563E9" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2 dark:border-slate-700">
        <span className="text-sm text-slate-500 dark:text-slate-400">Model confidence</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data.confidence}</span>
      </div>
    </Card>
  );
}

export default BtcForecastWidget;
