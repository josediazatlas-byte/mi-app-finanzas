const BASE = 'https://financialmodelingprep.com/api/v3';
const CACHE: Record<string, { data: unknown; ts: number }> = {};
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

async function cached<T>(url: string, ttl: number): Promise<T> {
  if (CACHE[url] && Date.now() - CACHE[url].ts < ttl) return CACHE[url].data as T;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FMP error ${r.status}`);
  const data = await r.json();
  CACHE[url] = { data, ts: Date.now() };
  return data as T;
}

// Rate limiting: max 2 req/sec
let lastReqTs = 0;
async function rateLimit() {
  const elapsed = Date.now() - lastReqTs;
  if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed));
  lastReqTs = Date.now();
}

function getKey(): string {
  return localStorage.getItem('fmp_api_key') ?? '';
}

export interface CompanyProfile {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  country: string;
  description: string;
  fullTimeEmployees: string;
  image: string;
  price: number;
  mktCap: number;
  beta: number;
  volAvg: number;
  lastDiv: number;
  currency: string;
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const key = getKey();
  if (!key) return null;
  await rateLimit();
  try {
    const data = await cached<CompanyProfile[]>(`${BASE}/profile/${symbol}?apikey=${key}`, DAY_MS);
    return Array.isArray(data) ? data[0] ?? null : null;
  } catch { return null; }
}

export interface KeyMetrics {
  peRatioTTM: number;
  pbRatioTTM: number;
  evToEbitdaTTM: number;
  dividendYieldTTM: number;
  debtToEquityTTM: number;
  freeCashFlowPerShareTTM: number;
  roicTTM: number;
  roeTTM: number;
  netProfitMarginTTM: number;
  revenuePerShareTTM: number;
}

export async function getKeyMetrics(symbol: string): Promise<KeyMetrics | null> {
  const key = getKey();
  if (!key) return null;
  await rateLimit();
  try {
    const data = await cached<KeyMetrics[]>(`${BASE}/key-metrics-ttm/${symbol}?apikey=${key}`, DAY_MS);
    return Array.isArray(data) ? data[0] ?? null : null;
  } catch { return null; }
}

export interface IncomeStatement {
  revenue: number;
  grossProfitRatio: number;
  operatingIncomeRatio: number;
  netIncomeRatio: number;
  ebitda: number;
  date: string;
}

export async function getIncomeStatement(symbol: string): Promise<IncomeStatement | null> {
  const key = getKey();
  if (!key) return null;
  await rateLimit();
  try {
    const data = await cached<IncomeStatement[]>(`${BASE}/income-statement/${symbol}?limit=1&apikey=${key}`, DAY_MS);
    return Array.isArray(data) ? data[0] ?? null : null;
  } catch { return null; }
}

export interface Rating {
  rating: string;
  ratingScore: number;
  ratingRecommendation: string;
}

export async function getRatings(symbol: string): Promise<Rating | null> {
  const key = getKey();
  if (!key) return null;
  await rateLimit();
  try {
    const data = await cached<Rating[]>(`${BASE}/rating/${symbol}?apikey=${key}`, HOUR_MS);
    return Array.isArray(data) ? data[0] ?? null : null;
  } catch { return null; }
}

export interface DividendRecord {
  date: string;
  dividend: number;
  adjDividend: number;
}

export async function getDividendHistory(symbol: string): Promise<DividendRecord[]> {
  const key = getKey();
  if (!key) return [];
  await rateLimit();
  try {
    const data = await cached<{ historical?: DividendRecord[] }>(
      `${BASE}/historical-price-full/stock_dividend/${symbol}?apikey=${key}`, DAY_MS
    );
    return data.historical ?? [];
  } catch { return []; }
}

export interface PriceTarget {
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetConsensus: number;
  targetMedian: number;
}

export async function getPriceTarget(symbol: string): Promise<PriceTarget | null> {
  const key = getKey();
  if (!key) return null;
  await rateLimit();
  try {
    const data = await cached<PriceTarget>(`${BASE}/price-target-consensus/${symbol}?apikey=${key}`, HOUR_MS);
    return (data as PriceTarget)?.symbol ? (data as PriceTarget) : null;
  } catch { return null; }
}

export async function testFMPConnection(apiKey: string): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/profile/AAPL?apikey=${apiKey}`);
    if (!r.ok) return false;
    const data = await r.json();
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

export function clearFMPCache() {
  Object.keys(CACHE).forEach(k => delete CACHE[k]);
}
