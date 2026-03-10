import { readStoredAuthUser } from "../utils/authUser";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function getUserEmailHeader() {
  const user = readStoredAuthUser();
  if (!user?.email) return {};
  return { "X-User-Email": user.email };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getUserEmailHeader(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const detail = data?.detail || "Request failed.";
    throw new Error(detail);
  }

  return data;
}

function getDownloadFilename(response, fallbackName) {
  const contentDisposition = response.headers.get("content-disposition") || "";
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallbackName;
}

async function fileRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      ...getUserEmailHeader(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      throw new Error(data?.detail || "Request failed.");
    }

    const message = await response.text();
    throw new Error(message || "Request failed.");
  }

  const blob = await response.blob();
  return {
    blob,
    filename: getDownloadFilename(response, "portfolio-report"),
  };
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function createPortfolio(payload) {
  return apiRequest("/api/portfolios/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPortfolios() {
  return apiRequest("/api/portfolios/");
}

export async function downloadPortfolioReport({ portfolioId, format }) {
  const payload = { format };
  if (portfolioId !== null && portfolioId !== undefined && portfolioId !== "") {
    payload.portfolio_id = Number(portfolioId);
  }

  const { blob, filename } = await fileRequest("/api/reports/portfolio/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  triggerBrowserDownload(blob, filename);
}

export function addStock(portfolioId, payload) {
  return apiRequest(`/api/portfolios/${portfolioId}/stocks/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPortfolioStocks(portfolioId) {
  return apiRequest(`/api/portfolios/${portfolioId}/stocks/`);
}

export function deleteStock(portfolioId, stockId) {
  return apiRequest(`/api/portfolios/${portfolioId}/stocks/${stockId}/`, {
    method: "DELETE",
  });
}

export function searchStocks(query) {
  const params = new URLSearchParams({ query: String(query || "") });
  return apiRequest(`/api/stocks/search/?${params.toString()}`);
}

export function getStockDetail(symbol) {
  return apiRequest(`/api/stocks/detail/${encodeURIComponent(String(symbol || ""))}/`);
}

export function compareAssets(payload) {
  return apiRequest("/api/compare/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMetalsHistory() {
  return apiRequest("/api/metals/history/");
}

export function predictMetalPrice(payload) {
  return apiRequest("/api/metals/predict/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPortfolioRiskAnalysis(portfolioId) {
  return apiRequest(`/api/risk/portfolio/${portfolioId}/`);
}

export function getStockRiskAnalysis(symbol) {
  return apiRequest(`/api/risk/stock/${encodeURIComponent(String(symbol || ""))}/`);
}

export function getBtcHistory() {
  return apiRequest("/api/btc/history/");
}

export function getBtcForecast() {
  return apiRequest("/api/btc/forecast/");
}

export function getPortfolioClustering(portfolioId) {
  return apiRequest(`/api/clustering/portfolio/${portfolioId}/`);
}

export function getMarketClustering(symbols) {
  const list = Array.isArray(symbols) ? symbols : [];
  const clean = list
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item, index, arr) => item && arr.indexOf(item) === index);
  const params = new URLSearchParams({ symbols: clean.join(",") });
  return apiRequest(`/api/clustering/market/?${params.toString()}`);
}
