import Card from "../ui/Card";

function TopAssetsWidget({ assets, className = "" }) {
  return (
    <Card className={className}>
      <div className="mb-4">
        <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Top Performing Assets</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Best momentum contributors across current holdings</p>
      </div>

      <div className="space-y-3">
        {assets.map((asset, index) => (
          <div
            key={asset.symbol}
            className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                #{index + 1}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{asset.symbol}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{asset.name}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-medium text-slate-900 dark:text-slate-100">{asset.value}</p>
              <p className={`text-sm font-semibold ${asset.positive ? "text-emerald-500" : "text-rose-500"}`}>
                {asset.pnl}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default TopAssetsWidget;
