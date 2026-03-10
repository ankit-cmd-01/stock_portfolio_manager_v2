import { useEffect, useState } from "react";
import { Download, FileText, FolderOpen, Layers3 } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import useTheme from "../hooks/useTheme";
import { downloadPortfolioReport, getPortfolios } from "../services/portfolioApi";

const scopeOptions = [
  { value: "all", label: "All Portfolios" },
  { value: "specific", label: "Specific Portfolio" },
];

const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function Reports() {
  const { theme } = useTheme();
  const [scope, setScope] = useState("all");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [portfolios, setPortfolios] = useState([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPortfolios() {
      try {
        const data = await getPortfolios();
        if (!isMounted) {
          return;
        }

        setPortfolios(Array.isArray(data) ? data : []);
        setSelectedPortfolioId((currentId) => {
          if (currentId) {
            return currentId;
          }
          return data?.[0]?.id ? String(data[0].id) : "";
        });
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.message || "Unable to load portfolios.");
        }
      } finally {
        if (isMounted) {
          setLoadingPortfolios(false);
        }
      }
    }

    loadPortfolios();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPortfolio =
    scope === "specific" ? portfolios.find((item) => String(item.id) === String(selectedPortfolioId)) : null;
  const reportSubject = selectedPortfolio?.name || "All Portfolios";

  const previewLines = [
    `Portfolio Report - ${reportSubject}`,
    "========================================================================",
    `Portfolio Name: ${reportSubject}`,
    "Stock Names:",
    "  - AAPL",
    "  - MSFT",
    "  - NVDA",
  ];

  const isDark = theme === "dark";
  const infoBannerClass = isDark
    ? "rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100"
    : "rounded-2xl border border-cyan-200 bg-cyan-50/90 px-4 py-3 text-sm text-cyan-900";
  const builderHeroClass = isDark
    ? "border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-950/80 px-6 py-6 text-white"
    : "border-b border-slate-200 bg-gradient-to-r from-brand-50 via-white to-slate-100 px-6 py-6 text-slate-900";
  const builderIconClass = isDark
    ? "rounded-2xl bg-white/10 p-3 text-white"
    : "rounded-2xl bg-slate-900 p-3 text-white shadow-sm";
  const builderBodyClass = isDark ? "mt-2 max-w-2xl text-sm text-slate-300" : "mt-2 max-w-2xl text-sm text-slate-600";
  const selectionPanelClass = isDark
    ? "space-y-4 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/70 p-5"
    : "space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5";
  const selectionIconClass = isDark
    ? "rounded-xl bg-slate-800 p-2 text-slate-100 shadow-sm"
    : "rounded-xl bg-white p-2 text-slate-700 shadow-sm";
  const statCardClass = isDark
    ? "rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-sm"
    : "rounded-xl border border-white bg-white px-4 py-3 shadow-sm";
  const includesCardClass = isDark
    ? "rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-4"
    : "rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4";
  const previewIconClass = isDark
    ? "rounded-2xl bg-slate-100 p-3 text-slate-900"
    : "rounded-2xl bg-slate-900 p-3 text-white";
  const previewBlockClass = isDark
    ? "mt-4 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-100"
    : "mt-4 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100 shadow-inner";

  async function handleDownload(format) {
    if (scope === "specific" && !selectedPortfolioId) {
      setError("Select a portfolio before downloading a specific report.");
      return;
    }

    setDownloadingFormat(format);
    setError("");
    setStatusMessage("");

    try {
      await downloadPortfolioReport({
        portfolioId: scope === "specific" ? selectedPortfolioId : null,
        format,
      });
      setStatusMessage(`${format.toUpperCase()} download started for ${reportSubject}.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to download the report.");
    } finally {
      setDownloadingFormat("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Generate PDF and TXT summaries for your complete portfolio book or any single portfolio.
          </p>
        </div>
        <div className={infoBannerClass}>
          Files download directly to the browser as attachments from `/api/reports/portfolio/`.
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden p-0">
          <div className={builderHeroClass}>
            <div className="flex items-start gap-4">
              <div className={builderIconClass}>
                <FileText size={22} />
              </div>
              <div>
                <p className="font-display text-xl font-semibold">Portfolio Report Builder</p>
                <p className={builderBodyClass}>
                  Choose whether to export all portfolios or a single portfolio, then download a ready-to-share PDF or
                  TXT summary with holdings, values, P/L, and allocation detail.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="report-scope">
                  Report scope
                </label>
                <select
                  id="report-scope"
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value);
                    setError("");
                    setStatusMessage("");
                  }}
                  className={selectClassName}
                >
                  {scopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {scope === "specific" ? (
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    htmlFor="portfolio-select"
                  >
                    Portfolio
                  </label>
                  <select
                    id="portfolio-select"
                    value={selectedPortfolioId}
                    onChange={(event) => {
                      setSelectedPortfolioId(event.target.value);
                      setError("");
                      setStatusMessage("");
                    }}
                    className={selectClassName}
                    disabled={loadingPortfolios || portfolios.length === 0}
                  >
                    <option value="">
                      {loadingPortfolios ? "Loading portfolios..." : portfolios.length ? "Select portfolio" : "No portfolios"}
                    </option>
                    {portfolios.map((portfolio) => (
                      <option key={portfolio.id} value={portfolio.id}>
                        {portfolio.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="w-full"
                  onClick={() => handleDownload("pdf")}
                  disabled={loadingPortfolios || downloadingFormat !== "" || (scope === "specific" && !selectedPortfolioId)}
                >
                  <Download size={16} />
                  {downloadingFormat === "pdf" ? "Preparing PDF..." : "Download PDF"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDownload("txt")}
                  disabled={loadingPortfolios || downloadingFormat !== "" || (scope === "specific" && !selectedPortfolioId)}
                >
                  <Download size={16} />
                  {downloadingFormat === "txt" ? "Preparing TXT..." : "Download TXT"}
                </Button>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {statusMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {statusMessage}
                </div>
              ) : null}
            </div>

            <div className={selectionPanelClass}>
              <div className="flex items-center gap-3">
                <div className={selectionIconClass}>
                  <Layers3 size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Current selection</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{reportSubject}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={statCardClass}>
                  <p className="break-words text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Scope</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {scope === "all" ? "All portfolios" : "Single portfolio"}
                  </p>
                </div>
                <div className={statCardClass}>
                  <p className="text-xs font-medium tracking-[0.2em] text-slate-400">
                    Portfolio
                    <br />
                    Count
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {loadingPortfolios ? "Loading..." : portfolios.length}
                  </p>
                </div>
              </div>

              <div className={includesCardClass}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <FolderOpen size={16} />
                  Report includes
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p>Portfolio name</p>
                  <p>Stock names in that portfolio</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className={previewIconClass}>
              <FileText size={20} />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Example TXT Output</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                A minimal export preview matching the backend text report format.
              </p>
            </div>
          </div>

          <pre className={previewBlockClass}>
            {previewLines.join("\n")}
          </pre>
        </Card>
      </section>
    </div>
  );
}

export default Reports;
