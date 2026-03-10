import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const PortfolioDetail = lazy(() => import("./pages/PortfolioDetail"));
const Compare = lazy(() => import("./pages/Compare"));
const ExploreMetals = lazy(() => import("./pages/ExploreMetals"));
const RiskCategorization = lazy(() => import("./pages/RiskCategorization"));
const PortfolioClustering = lazy(() => import("./pages/PortfolioClustering"));
const BTCForecasting = lazy(() => import("./pages/BTCForecasting"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const StockDetail = lazy(() => import("./pages/StockDetail"));

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

function LegacyPortfolioRedirect() {
  const { portfolioId } = useParams();
  return <Navigate to={portfolioId ? `/portfolio/${portfolioId}` : "/portfolio"} replace />;
}

function LegacyStockRedirect() {
  const { symbol } = useParams();
  return <Navigate to={symbol ? `/stocks/${symbol}` : "/portfolio"} replace />;
}

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          Loading...
        </div>
      }
    >
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route path="/" element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="portfolio/:portfolioId" element={<PortfolioDetail />} />
            <Route path="compare" element={<Compare />} />
            <Route path="explore-metals" element={<ExploreMetals />} />
            <Route path="risk-categorization" element={<RiskCategorization />} />
            <Route path="portfolio-clustering" element={<PortfolioClustering />} />
            <Route path="btc-forecasting" element={<BTCForecasting />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="stocks/:symbol" element={<StockDetail />} />
            <Route path="btc-forecast" element={<Navigate to="/btc-forecasting" replace />} />
            <Route path="dashboard/portfolio" element={<LegacyPortfolioRedirect />} />
            <Route path="dashboard/portfolio/:portfolioId" element={<LegacyPortfolioRedirect />} />
            <Route path="stock/:symbol" element={<LegacyStockRedirect />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
