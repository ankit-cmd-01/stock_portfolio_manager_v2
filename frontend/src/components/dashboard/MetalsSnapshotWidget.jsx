import Card from "../ui/Card";

function MetalsSnapshotWidget({ metals, className = "" }) {
  const normalizePrice = (value) =>
    String(value || "")
      .replaceAll("â‚¹", "Rs ")
      .replaceAll("₹", "Rs ");

  const getSignalClasses = (signal) => {
    if (signal === "Bullish") {
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300";
    }
    if (signal === "Stable") {
      return "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300";
    }
    if (signal === "Outlook") {
      return "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300";
    }
    return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300";
  };

  return (
    <Card className={className}>
      <div className="mb-4">
        <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Metal Price Snapshot</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Quick metals watchlist</p>
      </div>

      <div className="space-y-3">
        {metals.map((metal) => (
          <div
            key={metal.metal}
            className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{metal.metal}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getSignalClasses(metal.signal)}`}>
                {metal.signal}
              </span>
            </div>
            {metal.forecasts ? (
              <div className="mt-3 space-y-2">
                {metal.forecasts.map((forecast) => (
                  <div key={forecast.metal} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{forecast.metal}</p>
                      <p className="text-slate-500 dark:text-slate-400">{normalizePrice(forecast.value)} per gram</p>
                    </div>
                    <p className={`font-semibold ${forecast.change.startsWith("-") ? "text-rose-500" : "text-emerald-500"}`}>
                      {forecast.change}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {normalizePrice(metal.spotPrice)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">per gram</p>
                </div>
                <p className={`text-sm font-semibold ${metal.dailyChange.startsWith("-") ? "text-rose-500" : "text-emerald-500"}`}>
                  {metal.dailyChange}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default MetalsSnapshotWidget;
