const PROXY = '/api/exchangerate';
const CACHE: Record<string, { data: AllRatesData; ts: number }> = {};
const HOUR_MS = 60 * 60 * 1000;

function getApiKey(): string {
  return localStorage.getItem('exchange_rate_api_key') ?? '';
}

export const FALLBACK_RATES: Record<string, number> = {
  USD_EUR: 0.92,  GBP_EUR: 1.17,  CHF_EUR: 1.05,
  JPY_EUR: 0.0062, CAD_EUR: 0.68,  AUD_EUR: 0.61,
  SEK_EUR: 0.087, NOK_EUR: 0.087, DKK_EUR: 0.134,
  MXN_EUR: 0.053, BRL_EUR: 0.185, CNY_EUR: 0.127,
  INR_EUR: 0.011, KRW_EUR: 0.00068,
};

function getFallback(from: string, to: string): number {
  const key = `${from}_${to}`;
  const keyRev = `${to}_${from}`;
  if (FALLBACK_RATES[key]) return FALLBACK_RATES[key];
  if (FALLBACK_RATES[keyRev]) return 1 / FALLBACK_RATES[keyRev];
  return 1;
}

export interface AllRatesData {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
  time_last_update_utc: string;
}

async function fetchFromProxy(base: string): Promise<AllRatesData> {
  if (CACHE[base] && Date.now() - CACHE[base].ts < HOUR_MS) return CACHE[base].data;
  const key = getApiKey();
  if (!key) throw new Error('No API key for ExchangeRate');
  const r = await fetch(`${PROXY}?base=${base}`, { headers: { 'x-api-key': key } });
  if (!r.ok) throw new Error(`ExchangeRate proxy error ${r.status}`);
  const data = await r.json();
  if (data.result !== 'success') throw new Error(data['error-type'] ?? 'Unknown error');
  CACHE[base] = { data, ts: Date.now() };
  return data;
}

export async function getAllRates(base = 'EUR'): Promise<AllRatesData> {
  return fetchFromProxy(base);
}

export async function getRate(from: string, to: string): Promise<number> {
  const key = getApiKey();
  if (!key) return getFallback(from, to);
  try {
    const data = await getAllRates('EUR');
    const r = data.conversion_rates;
    return (r[to] ?? 1) / (r[from] ?? 1);
  } catch {
    return getFallback(from, to);
  }
}

export async function convertAmount(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return amount;
  return amount * (await getRate(from, to));
}

export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    const r = await fetch(`${PROXY}?base=EUR`, { headers: { 'x-api-key': apiKey } });
    if (!r.ok) return false;
    const data = await r.json();
    return data.result === 'success';
  } catch { return false; }
}

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
  'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'CNY', 'INR', 'KRW',
];
