import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { searchStocks } from "../services/portfolioApi";

const DEFAULT_FORM = {
  companySearch: "",
  stockSymbol: "",
  companyName: "",
};

function AddStockModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM);
      setSuggestions([]);
      setError("");
      setShowSuggestions(false);
    }
  }, [open]);

  const query = useMemo(() => form.companySearch.trim(), [form.companySearch]);

  useEffect(() => {
    if (!open) return;
    if (query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        setSearching(true);
        const result = await searchStocks(query);
        if (!active) return;
        setSuggestions(Array.isArray(result) ? result : []);
      } catch {
        if (!active) return;
        setSuggestions([]);
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [open, query]);

  const handleSelectSuggestion = (item) => {
    setForm((prev) => ({
      ...prev,
      companySearch: `${item.symbol} â€” ${item.company_name}`,
      stockSymbol: item.symbol,
      companyName: item.company_name,
    }));
    setShowSuggestions(false);
  };

  const handleChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      stock_symbol: form.stockSymbol.trim().toUpperCase(),
      company_name: form.companyName.trim(),
    };

    if (!payload.stock_symbol || !payload.company_name) {
      setError("Please enter valid stock details.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || "Unable to add stock.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
            <Dialog.Panel className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-soft">
              <Dialog.Title className="font-display text-2xl font-semibold text-slate-100">Add Stock</Dialog.Title>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="relative sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-300">Search Company</label>
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={form.companySearch}
                      onChange={handleChange("companySearch")}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Type company name (e.g., Wipro)"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-10 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                    {searching ? (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                    ) : null}
                  </div>

                  {showSuggestions && query.length >= 2 ? (
                    <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                      {suggestions.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-slate-400">No matching stocks found.</p>
                      ) : (
                        suggestions.map((item) => (
                          <button
                            key={`${item.symbol}-${item.company_name}`}
                            type="button"
                            onClick={() => handleSelectSuggestion(item)}
                            className="block w-full border-b border-slate-800 px-4 py-3 text-left text-sm text-slate-200 transition last:border-b-0 hover:bg-slate-800"
                          >
                            <span className="font-semibold text-slate-100">{item.symbol}</span>
                            <span className="text-slate-400"> â€” {item.company_name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                <Input
                  id="stock_symbol"
                  label="Stock Symbol"
                  value={form.stockSymbol}
                  onChange={handleChange("stockSymbol")}
                  placeholder="AAPL"
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                  required
                />
                <Input
                  id="company_name"
                  label="Company Name"
                  value={form.companyName}
                  onChange={handleChange("companyName")}
                  placeholder="Apple Inc."
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                  required
                />

                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={onClose} className="text-slate-200 hover:bg-slate-800">
                    Cancel
                  </Button>
                  <Button type="submit" className="min-w-28" disabled={submitting}>
                    {submitting ? "Adding..." : "Add Stock"}
                  </Button>
                </div>
              </form>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export default AddStockModal;
