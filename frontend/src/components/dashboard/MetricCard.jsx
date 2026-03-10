import { ArrowDownRight, ArrowUpRight } from "lucide-react";

function MetricCard({ title, value, change, positive, caption, gradient }) {
  return (
    <article className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-soft`}>
      <p className="text-sm text-white/80">{title}</p>
      <p className="mt-4 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/90">
        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {change}
      </p>
      <p className="mt-4 text-xs text-white/75">{caption}</p>
    </article>
  );
}

export default MetricCard;
