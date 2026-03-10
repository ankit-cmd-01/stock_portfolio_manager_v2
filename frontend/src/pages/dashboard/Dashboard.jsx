import { useEffect, useState } from "react";
import BtcForecastWidget from "../../components/dashboard/BtcForecastWidget";
import ClusteringSummaryWidget from "../../components/dashboard/ClusteringSummaryWidget";
import DashboardHero from "../../components/dashboard/DashboardHero";
import MetalsSnapshotWidget from "../../components/dashboard/MetalsSnapshotWidget";
import RecentTransactionsWidget from "../../components/dashboard/RecentTransactionsWidget";
import RiskOverviewWidget from "../../components/dashboard/RiskOverviewWidget";
import TopAssetsWidget from "../../components/dashboard/TopAssetsWidget";
import { buildDashboardViewModel } from "../../components/dashboard/dashboardData";
import Card from "../../components/ui/Card";
import { getPortfolioStocks, getPortfolios } from "../../services/portfolioApi";

function Dashboard() {
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(() => buildDashboardViewModel());

  useEffect(() => {
    let mounted = true;

    const loadDashboardData = async () => {
      try {
        setError("");

        const portfolios = await getPortfolios();
        const safePortfolios = Array.isArray(portfolios) ? portfolios : [];
        const stockLists = await Promise.all(
          safePortfolios.map((portfolio) => getPortfolioStocks(portfolio.id).catch(() => []))
        );
        const stocks = stockLists.flat();

        if (!mounted) return;
        setDashboard(buildDashboardViewModel({ portfolios: safePortfolios, stocks }));
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load live dashboard data.");
        setDashboard(buildDashboardViewModel());
      }
    };

    loadDashboardData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHero {...dashboard.hero} />

      {/* Removed error message Card for live dashboard data sync issues */}

      <section className="grid gap-6 xl:grid-cols-4">
        <TopAssetsWidget assets={dashboard.topAssets} className="xl:col-span-2" />
        <RiskOverviewWidget data={dashboard.riskOverview} className="xl:col-span-2" />
      </section>

      <section className="grid gap-6 xl:grid-cols-4">
        <BtcForecastWidget data={dashboard.btcForecast} className="xl:col-span-2" />
        <ClusteringSummaryWidget data={dashboard.clustering} />
        <MetalsSnapshotWidget metals={dashboard.metals} />
      </section>

      <section>
        <RecentTransactionsWidget transactions={dashboard.recentTransactions} />
      </section>
    </div>
  );
}

export default Dashboard;
