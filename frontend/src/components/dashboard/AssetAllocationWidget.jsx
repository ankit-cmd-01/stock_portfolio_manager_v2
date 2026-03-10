import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Card from "../ui/Card";
import useChartTheme from "../../hooks/useChartTheme";

function AssetAllocationWidget({ data, className = "" }) {
  const chartTheme = useChartTheme();

  return (
    <Card className={className}>
      <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Asset Allocation</p>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Current mix across tracked capital</p>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={54} outerRadius={84} paddingAngle={3}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={chartTheme.tooltipStyle}
              formatter={(value) => [`${Number(value || 0).toFixed(2)}%`, "Allocation"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {data.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-slate-700 dark:text-slate-200">{item.name}</span>
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {Number(item.value).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default AssetAllocationWidget;
