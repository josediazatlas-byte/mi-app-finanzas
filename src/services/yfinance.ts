const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export const BENCHMARK_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', color: '#3b82f6' },
  { symbol: '^IXIC', name: 'Nasdaq', color: '#8b5cf6' },
  { symbol: '^IBEX', name: 'Ibex 35', color: '#f59e0b' },
  { symbol: '^FTSE', name: 'FTSE 100', color: '#06b6d4' },
  { symbol: 'IWDA.AS', name: 'MSCI World', color: '#22c55e' },
  { symbol: 'EEM', name: 'Emerging Markets', color: '#ef4444' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', color: '#f97316' },
] as const;

export type Period = '1mo' | '3mo' | '1y' | '5y' | '10y';

export interface YfPoint {
  date: string;
  close: number;
  idx: number; // normalized base-100
}

export interface YfMetrics {
  cagr: number;
  maxDrawdown: number;
  volatility: number;
  sharpe: number;
  totalReturn: number;
}

export interface YfResult {
  symbol: string;
  points: YfPoint[];
  metrics: YfMetrics;
  currency: string;
  currentPrice: number;
}

interface CacheEntry {
  data: YfResult;
  ts: number;
}

function getCache(symbol: string, period: string): YfResult | null {
  try {
    const raw = localStorage.getItem(`yf_${symbol}_${period}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.data;
  } catch { return null; }
}

function setCache(symbol: string, period: string, data: YfResult) {
  try {
    localStorage.setItem(`yf_${symbol}_${period}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

function parseYfResponse(symbol: string, json: unknown): YfResult | null {
  try {
    const chart = (json as { chart?: { result?: unknown[] } }).chart;
    if (!chart?.result?.[0]) return null;
    const result = chart.result[0] as {
      meta?: { currency?: string; regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: {
        adjclose?: { adjclose?: number[] }[];
        quote?: { close?: number[] }[];
      };
    };
    const meta = result.meta ?? {};
    const timestamps = result.timestamp ?? [];
    const adjclose = result.indicators?.adjclose?.[0]?.adjclose
      ?? result.indicators?.quote?.[0]?.close
      ?? [];

    if (timestamps.length === 0 || adjclose.length === 0) return null;

    // Build points
    const validPairs = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 7), // YYYY-MM
      close: adjclose[i],
    })).filter(p => p.close != null && !isNaN(p.close) && p.close > 0);

    if (validPairs.length < 2) return null;

    const base = validPairs[0].close;
    const points: YfPoint[] = validPairs.map((p, _i) => ({
      date: p.date,
      close: p.close,
      idx: Math.round((p.close / base) * 100 * 10) / 10,
    }));

    // Compute metrics
    const closes = validPairs.map(p => p.close);
    const n = closes.length;
    const months = n;
    const years = months / 12;

    const totalReturn = (closes[n - 1] - closes[0]) / closes[0];
    const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : totalReturn;

    // Monthly returns
    const monthlyReturns = closes.slice(1).map((c, i) => c / closes[i] - 1);

    // Volatility (annualized)
    const meanReturn = monthlyReturns.reduce((s, r) => s + r, 0) / monthlyReturns.length;
    const variance = monthlyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / monthlyReturns.length;
    const volatility = Math.sqrt(variance * 12);

    // Sharpe (rf = 5% annual = 0.407%/month)
    const rfMonthly = 0.00407;
    const excessMean = meanReturn - rfMonthly;
    const sharpe = volatility > 0 ? (excessMean * 12) / (Math.sqrt(variance) * Math.sqrt(12)) : 0;

    // Max drawdown
    let peak = closes[0];
    let maxDd = 0;
    for (const c of closes) {
      if (c > peak) peak = c;
      const dd = (c - peak) / peak;
      if (dd < maxDd) maxDd = dd;
    }

    return {
      symbol,
      points,
      currency: meta.currency ?? 'USD',
      currentPrice: meta.regularMarketPrice ?? closes[n - 1],
      metrics: {
        cagr: Math.round(cagr * 10000) / 100,       // as %
        maxDrawdown: Math.round(maxDd * 10000) / 100, // as %
        volatility: Math.round(volatility * 10000) / 100,
        sharpe: Math.round(sharpe * 100) / 100,
        totalReturn: Math.round(totalReturn * 10000) / 100,
      },
    };
  } catch {
    return null;
  }
}

// Period → Yahoo range param
const PERIOD_MAP: Record<Period, string> = {
  '1mo': '1mo',
  '3mo': '3mo',
  '1y': '1y',
  '5y': '5y',
  '10y': '10y',
};

// Period → Yahoo interval param
const INTERVAL_MAP: Record<Period, string> = {
  '1mo': '1d',
  '3mo': '1wk',
  '1y': '1mo',
  '5y': '1mo',
  '10y': '1mo',
};

export async function getYfHistory(symbol: string, period: Period = '5y'): Promise<YfResult | null> {
  const cached = getCache(symbol, period);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/yfinance?symbol=${encodeURIComponent(symbol)}&period=${PERIOD_MAP[period]}&interval=${INTERVAL_MAP[period]}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = parseYfResponse(symbol, json);
    if (data) setCache(symbol, period, data);
    return data;
  } catch {
    return null;
  }
}

export async function getMultipleYfHistory(symbols: string[], period: Period = '5y'): Promise<Record<string, YfResult>> {
  const results = await Promise.all(symbols.map(s => getYfHistory(s, period)));
  return Object.fromEntries(symbols.map((s, i) => [s, results[i]]).filter(([, v]) => v !== null)) as Record<string, YfResult>;
}

export function clearYfCache(symbol?: string) {
  const periods: Period[] = ['1mo', '3mo', '1y', '5y', '10y'];
  if (symbol) {
    periods.forEach(p => localStorage.removeItem(`yf_${symbol}_${p}`));
  } else {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('yf_'));
    keys.forEach(k => localStorage.removeItem(k));
  }
}
