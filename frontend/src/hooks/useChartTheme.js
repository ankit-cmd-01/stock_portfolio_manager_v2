import { useMemo } from "react";
import useTheme from "./useTheme";

function useChartTheme() {
  const { theme } = useTheme();

  return useMemo(() => {
    const isDark = theme === "dark";

    return {
      isDark,
      axis: isDark ? "#94a3b8" : "#64748b",
      grid: isDark ? "rgba(148, 163, 184, 0.14)" : "rgba(148, 163, 184, 0.24)",
      tooltipStyle: {
        borderRadius: "12px",
        borderColor: isDark ? "#334155" : "#cbd5e1",
        backgroundColor: isDark ? "#020617" : "#ffffff",
        color: isDark ? "#f8fafc" : "#0f172a",
      },
      legendStyle: {
        color: isDark ? "#cbd5e1" : "#475569",
      },
      heroCardClass:
        "relative overflow-hidden border border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-cyan-50/80 text-slate-900 shadow-soft dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/30 dark:text-slate-100",
      panelCardClass:
        "border border-slate-200/80 bg-white/95 shadow-soft dark:border-slate-800 dark:bg-slate-950/95",
      metricCardClass:
        "border border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95",
      panelTitleClass: "font-display text-lg font-semibold text-slate-900 dark:text-slate-100",
      sectionTitleClass: "font-display text-2xl font-semibold text-slate-900 dark:text-slate-100",
      bodyTextClass: "text-sm text-slate-600 dark:text-slate-300",
      mutedTextClass: "text-xs text-slate-500 dark:text-slate-400",
      controlClass:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
      dropdownClass:
        "absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900",
      dropdownItemClass:
        "block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800",
      tableClass: "min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800",
      tableHeadClass: "text-left text-slate-500 dark:text-slate-400",
      tableBodyClass: "divide-y divide-slate-100 dark:divide-slate-800",
      tableCellClass: "text-slate-600 dark:text-slate-300",
      tableStrongCellClass: "text-slate-900 dark:text-slate-100",
    };
  }, [theme]);
}

export default useChartTheme;
