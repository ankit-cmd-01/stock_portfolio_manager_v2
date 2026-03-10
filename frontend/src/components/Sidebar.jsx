import { NavLink } from "react-router-dom";
import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  LineChart,
  Settings,
  ShieldAlert,
  WalletCards,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { name: "Portfolio", icon: BriefcaseBusiness, to: "/portfolio" },
  { name: "Compare", icon: GitCompareArrows, to: "/compare" },
  { name: "Explore Metals", icon: WalletCards, to: "/explore-metals" },
  { name: "Risk Categorization", icon: ShieldAlert, to: "/risk-categorization" },
  { name: "Portfolio Clustering", icon: LineChart, to: "/portfolio-clustering" },
  { name: "BTC Forecasting", icon: BarChart3, to: "/btc-forecasting" },
  { name: "Reports", icon: FileText, to: "/reports" },
  { name: "Settings", icon: Settings, to: "/settings" },
];

function Sidebar({ onNavigate }) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-8">
        <p className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
           Ankit Capital
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Portfolio Management</p>
      </div>

      <nav className="space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.to === "/dashboard"}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`
              }
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
