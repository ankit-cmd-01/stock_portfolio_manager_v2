import { Link } from "react-router-dom";
import Card from "../ui/Card";

function DashboardHero({ eyebrow, title, description, stats, featureLinks }) {
  return (
    <Card className="relative overflow-hidden border border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-cyan-50/90 p-0 shadow-soft dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/40">
      <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-400/10" />
      <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-brand-500/15 blur-3xl dark:bg-brand-400/10" />

      <div className="relative grid gap-6 px-6 py-6 lg:grid-cols-[1.5fr,1fr] lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-300">
            {eyebrow}
          </p>
          <p className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </p>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {featureLinks.map((feature) => (
              <Link
                key={feature.label}
                to={feature.to}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:text-brand-200"
              >
                {feature.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/70"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default DashboardHero;
