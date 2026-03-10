import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AddStockModal from "../../components/AddStockModal";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { addStock, deleteStock, getPortfolioStocks, getPortfolios } from "../../services/portfolioApi";

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return parsed.toFixed(2);
};

const formatPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "N/A";
  return `${parsed.toFixed(2)}%`;
};

function PortfolioDetail() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const [portfolioName, setPortfolioName] = useState("Portfolio");
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState("");

  const loadDetails = async () => {
    if (!portfolioId) return;
    try {
      setIsLoading(true);
      setError("");
      const [portfolioList, stockList] = await Promise.all([getPortfolios(), getPortfolioStocks(portfolioId)]);

      const matched = (Array.isArray(portfolioList) ? portfolioList : []).find(
        (portfolio) => String(portfolio.id) === String(portfolioId)
      );
      if (matched?.name) {
        setPortfolioName(matched.name);
      }
      setStocks(Array.isArray(stockList) ? stockList : []);
    } catch (err) {
      setError(err.message || "Unable to load portfolio details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [portfolioId]);

  const handleAddStock = async (payload) => {
    if (!portfolioId) return;
    await addStock(portfolioId, payload);
    await loadDetails();
  };

  const handleConfirmRemove = async () => {
    if (!portfolioId || !pendingRemove) return;
    try {
      setIsRemoving(true);
      setError("");
      await deleteStock(portfolioId, pendingRemove.id);
      setStocks((prev) => prev.filter((stock) => stock.id !== pendingRemove.id));
      setPendingRemove(null);
    } catch (err) {
      setError(err.message || "Unable to remove stock.");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleStockRowClick = (stockSymbol) => {
    navigate(`/stocks/${stockSymbol}`, {
      state: {
        portfolioId,
        portfolioName,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/portfolio")}>
            <ArrowLeft size={16} /> Back
          </Button>
          <div>
            <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">{portfolioName}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Stocks in this portfolio</p>
          </div>
        </div>
        <Button onClick={() => setIsAddStockOpen(true)}>
          <Plus size={16} /> Add Stock
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      <Card>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading stocks...</p>
        ) : stocks.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">No stocks added yet</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Add your first stock to start tracking this portfolio.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="py-3 font-medium">Stock Symbol</th>
                  <th className="py-3 font-medium">Company Name</th>
                  <th className="py-3 font-medium">Current Price (INR)</th>
                  <th className="py-3 font-medium">PE Ratio</th>
                  <th className="py-3 font-medium">Discount Level</th>
                  <th className="py-3 font-medium">Opportunity Score</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stocks.map((stock) => {
                  return (
                    <tr
                      key={stock.id}
                      onClick={() => handleStockRowClick(stock.stock_symbol)}
                      className="cursor-pointer transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-100">{stock.stock_symbol}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{stock.company_name}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{formatCurrency(stock.current_price)}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{formatNumber(stock.pe_ratio)}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{formatPercent(stock.discount_level_pct)}</td>
                      <td className="py-3 font-medium text-slate-800 dark:text-slate-100">
                        {formatNumber(stock.opportunity_score)}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingRemove(stock);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddStockModal open={isAddStockOpen} onClose={() => setIsAddStockOpen(false)} onSubmit={handleAddStock} />

      <Transition.Root show={Boolean(pendingRemove)} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPendingRemove(null)}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/70" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="transform transition duration-200"
              enterFrom="translate-y-4 opacity-0"
              enterTo="translate-y-0 opacity-100"
              leave="transform transition duration-150"
              leaveFrom="translate-y-0 opacity-100"
              leaveTo="translate-y-4 opacity-0"
            >
              <Dialog.Panel className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-soft">
                <Dialog.Title className="font-display text-xl font-semibold text-slate-100">Remove Stock</Dialog.Title>
                <p className="mt-2 text-sm text-slate-400">Remove this stock from portfolio?</p>

                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setPendingRemove(null)} className="text-slate-200 hover:bg-slate-800">
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmRemove}
                    className="bg-red-600 text-white hover:bg-red-700"
                    disabled={isRemoving}
                  >
                    {isRemoving ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}

export default PortfolioDetail;
