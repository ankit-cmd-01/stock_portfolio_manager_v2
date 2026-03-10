import { memo } from "react";

const TICKER_DATA = Object.freeze([
  { name: "RELIANCE", price: "\u20B92,945", change: "+1.2%" },
  { name: "NIFTY50", price: "", change: "+0.45%" },
  { name: "BTC", price: "$62,210", change: "-0.3%" },
  { name: "GOLD", price: "\u20B96,210/g", change: "+0.1%" },
  { name: "BAJAJ-AUTO", price: "", change: "+3.4%" },
  { name: "HCLTECH", price: "", change: "+2.8%" },
  { name: "SENSEX", price: "", change: "-0.18%" },
  { name: "ETH", price: "$3,480", change: "+0.6%" },
  { name: "SILVER", price: "\u20B974.8/g", change: "-0.2%" },
]);

function TickerRow({ ariaHidden = false }) {
  return (
    <div className="flex shrink-0 items-center whitespace-nowrap pr-8" aria-hidden={ariaHidden}>
      <span className="w-6 shrink-0" />
      {TICKER_DATA.map((item) => {
        const isPositive = !item.change.startsWith("-");
        const arrow = isPositive ? "\u25B2" : "\u25BC";

        return (
          <div key={`${ariaHidden ? "clone" : "base"}-${item.name}`} className="flex items-center">
            <span className="flex items-center gap-2 px-4 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300 xl:text-xs">
              <span className="text-slate-900 dark:text-slate-100">{item.name}</span>
              {item.price ? <span className="text-slate-700 dark:text-slate-400">{item.price}</span> : null}
              <span className={isPositive ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
                {arrow} {item.change}
              </span>
            </span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
          </div>
        );
      })}
    </div>
  );
}

function MarketTicker() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-emerald-500/10 bg-white/70 dark:bg-slate-950/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      aria-label="Live market ticker"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white via-white/85 to-transparent dark:from-slate-950 dark:via-slate-950/85" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white via-white/85 to-transparent dark:from-slate-950 dark:via-slate-950/85" />

      <div className="flex w-max animate-market-ticker items-center">
        <TickerRow />
        <TickerRow ariaHidden />
      </div>
    </div>
  );
}

export default memo(MarketTicker);
