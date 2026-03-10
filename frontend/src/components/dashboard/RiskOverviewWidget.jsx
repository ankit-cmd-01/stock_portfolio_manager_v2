import Card from "../ui/Card";

function RiskOverviewWidget({ data, className = "" }) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Risk Level Overview</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.summary}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Score</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.score}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{data.level}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {data.bands.map((band) => (
          <div key={band.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">{band.label} Risk</span>
              <span className="text-slate-500 dark:text-slate-400">{band.count} assets · {band.share}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full"
                style={{ width: `${Math.max(8, band.share)}%`, backgroundColor: band.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default RiskOverviewWidget;
