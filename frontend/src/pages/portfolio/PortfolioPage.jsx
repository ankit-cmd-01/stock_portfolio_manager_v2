import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import { createPortfolio, getPortfolios } from "../../services/portfolioApi";

function PortfolioPage() {
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState("");

  const loadPortfolios = async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await getPortfolios();
      setPortfolios(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load portfolios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  const handleCreatePortfolio = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    if (!name) return;

    try {
      await createPortfolio({ name });
      setIsCreateOpen(false);
      form.reset();
      await loadPortfolios();
    } catch (err) {
      setError(err.message || "Unable to create portfolio.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Portfolio</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create and manage grouped stock portfolios.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> Create Portfolio
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      {isLoading ? (
        <Card>Loading portfolios...</Card>
      ) : portfolios.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
            <Wallet size={22} />
          </div>
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">No portfolios yet</p>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            Start by creating portfolios like Automobile, Banking, Tech, or Long Term.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>Create Portfolio</Button>
        </Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              type="button"
              onClick={() => navigate(`/portfolio/${portfolio.id}`)}
              className="text-left"
            >
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg dark:hover:border-brand-500/40">
                <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{portfolio.name}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {portfolio.stock_count || 0} stock{portfolio.stock_count === 1 ? "" : "s"}
                </p>
                <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                  Created: {new Date(portfolio.created_at).toLocaleDateString()}
                </p>
              </Card>
            </button>
          ))}
        </section>
      )}

      <Transition.Root show={isCreateOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setIsCreateOpen}>
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
              <Dialog.Panel className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-900">
                <Dialog.Title className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Create Portfolio
                </Dialog.Title>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Group stocks by your investment strategy.
                </p>

                <form onSubmit={handleCreatePortfolio} className="mt-5 space-y-4">
                  <Input id="name" name="name" label="Portfolio Name" placeholder="Tech" required />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Portfolio</Button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}

export default PortfolioPage;
