import Card from "../ui/Card";

const SIMPLE_CLUSTER_LABELS = {
  "Core Compounders": "Steady Stocks",
  "Momentum Leaders": "Rising Stocks",
  "Value Rebounds": "Recovery Stocks",
  "High Beta": "Risky Stocks",
};

function ClusteringSummaryWidget({ data, className = "" }) {
  const totalAssets = data.clusters.reduce((sum, cluster) => sum + cluster.count, 0) || 1;
  const dominantClusterLabel = SIMPLE_CLUSTER_LABELS[data.dominantCluster] || data.dominantCluster;

  return (
    <Card className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Clustering Summary</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Grouped by similar stock movement</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Score</p>
          <p className="mt-1 font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
            {data.silhouetteScore}
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Portfolios</p>
          <p className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {data.portfoliosAnalyzed}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Main group</p>
          <p className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {dominantClusterLabel}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {data.clusters.map((cluster) => (
          <div key={cluster.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {SIMPLE_CLUSTER_LABELS[cluster.name] || cluster.name}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {cluster.count} assets · {Math.round((cluster.count / totalAssets) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max(10, Math.round((cluster.count / totalAssets) * 100))}%`,
                  backgroundColor: cluster.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default ClusteringSummaryWidget;
