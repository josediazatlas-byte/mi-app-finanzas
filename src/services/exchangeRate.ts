const BASE = 'https://v6.exchangerate-api.com/v6';
const CACHE: Record<string, { data: unknown; ts: number }> = {};
const DAY_MS = 24 * 60 * 60 * 1000;

async function cached<T>(url: string): Promise<T> {
  if (CACHE[url] && Date.now() - CACHE[url].ts < DAY_MS) return CACHE[url].data as T;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ExchangeRate error ${r.status}`);
  const data = await r.json();
  if (data.result !== 'success') throw new Error(data['error-type'] ?? 'Unknown error');
  CACHE[url] = { data, ts: Date.now() };
  return data as T;
}

function getApiKey(): string {
  return localStorage.getItem('exchange_rate_api_key') ?? '';
}

export const FALLBACK_RATES: Record<string, number> = {
  USD_EUR: 0.92, GBP_EUR: 1.17, CHF_EUR: 1.05,
  JPY_EUR: 0.0062, CAD_EUR: 0.68, AUD_EUR: 0.61,
  SEK_EUR: 0.087, NOK_EUR: 0.087, DKK_EUR: 0.134,
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

export async function getAllRates(base = 'EUR'): Promise<AllRatesData> {
  const key = getApiKey();
  if (!key) throw new Error('No API key for ExchangeRate');
  return cached<AllRatesData>(`${BASE}/${key}/latest/${base}`);
}

export async function getRate(from: string, to: string): Promise<number> {
  const key = getApiKey();
  if (!key) return getFallback(from, to);
  try {
    const data = await cached<{ result: string; conversion_rate: number }>(`${BASE}/${key}/pair/${from}/${to}`);
    return data.conversion_rate;
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
    const r = await fetch(`${BASE}/${apiKey}/latest/EUR`);
    if (!r.ok) return false;
    const data = await r.json();
    return data.result === 'success';
  } catch { return false; }
}

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK'];
