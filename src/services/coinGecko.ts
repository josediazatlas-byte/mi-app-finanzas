const BASE = 'https://api.coingecko.com/api/v3';
const CACHE: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 60_000;

async function cached<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  if (CACHE[url] && Date.now() - CACHE[url].ts < ttl) return CACHE[url].data as T;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`CoinGecko error ${r.status}`);
  const data = await r.json();
  CACHE[url] = { data, ts: Date.now() };
  return data as T;
}

export const CRYPTO_SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  XRP: 'ripple', DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink',
  AVAX: 'avalanche-2', UNI: 'uniswap', DOGE: 'dogecoin', SHIB: 'shiba-inu',
  LTC: 'litecoin', BCH: 'bitcoin-cash', ATOM: 'cosmos',
};

export function symbolToId(symbol: string): string {
  return CRYPTO_SYMBOL_TO_ID[symbol.toUpperCase()] ?? symbol.toLowerCase();
}

export function isCryptoSymbol(symbol: string): boolean {
  return symbol.toUpperCase() in CRYPTO_SYMBOL_TO_ID;
}

export interface CgPrice {
  eur: number;
  usd: number;
  eur_24h_change?: number;
  usd_24h_change?: number;
}

export async function cgGetPrices(coinIds: string[]): Promise<Record<string, CgPrice>> {
  if (!coinIds.length) return {};
  const ids = [...new Set(coinIds)].join(',');
  const url = `${BASE}/simple/price?ids=${ids}&vs_currencies=eur,usd&include_24hr_change=true`;
  return cached<Record<string, CgPrice>>(url);
}

export interface CgCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
}

export async function cgSearchCoin(query: string): Promise<CgCoin[]> {
  const url = `${BASE}/search?query=${encodeURIComponent(query)}`;
  const data = await cached<{ coins: CgCoin[] }>(url, 5 * 60_000);
  return data.coins?.slice(0, 8) ?? [];
}

export interface CgTopCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

export async function cgGetTopCoins(limit = 10): Promise<CgTopCoin[]> {
  const url = `${BASE}/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=${limit}&page=1`;
  return cached<CgTopCoin[]>(url, 2 * 60_000);
}

export interface CgHistoryPoint { timestamp: number; price: number; }

export async function cgGetHistory(coinId: string, days: number): Promise<CgHistoryPoint[]> {
  const url = `${BASE}/coins/${coinId}/market_chart?vs_currency=eur&days=${days}`;
  const data = await cached<{ prices: [number, number][] }>(url, 5 * 60_000);
  return data.prices?.map(([ts, p]) => ({ timestamp: ts, price: p })) ?? [];
}
