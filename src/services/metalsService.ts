import { type MetalSimbolo, FALLBACK_PRICES } from '../stores/useMetalesPreciososStore';

// metals-api.com response shape
interface MetalsApiResponse {
  success: boolean;
  base: string;
  rates: Record<string, number>; // e.g. { XAU: 0.000312... } (units per 1 USD)
}

// Yahoo Finance used as primary free source for real-time spot prices
const YAHOO_SYMBOLS: Record<MetalSimbolo, string> = {
  XAU: 'GC=F',
  XAG: 'SI=F',
  XPT: 'PL=F',
  XPD: 'PA=F',
  XCU: 'HG=F',
};

// metals-api returns how many troy oz (or lb for copper) equal 1 USD
// → price per oz = 1 / rate
function parseMetalsApi(data: MetalsApiResponse): Partial<Record<MetalSimbolo, number>> {
  const result: Partial<Record<MetalSimbolo, number>> = {};
  const metals: MetalSimbolo[] = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU'];
  for (const m of metals) {
    const rate = data.rates?.[m];
    if (rate && rate > 0) result[m] = 1 / rate;
  }
  return result;
}

/** Fetch live prices via Yahoo Finance futures (free, no key required) */
async function fetchViaYahoo(): Promise<Partial<Record<MetalSimbolo, number>>> {
  const result: Partial<Record<MetalSimbolo, number>> = {};
  const metals = Object.entries(YAHOO_SYMBOLS) as [MetalSimbolo, string][];

  await Promise.all(metals.map(async ([metal, symbol]) => {
    try {
      const res = await fetch(
        `/api/yfinance?symbol=${encodeURIComponent(symbol)}&period=5d&interval=1d`
      );
      if (!res.ok) return;
      const json = await res.json();
      const closes: number[] | undefined =
        json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      if (!closes) return;
      const last = [...closes].reverse().find(v => v != null);
      if (last && last > 0) result[metal] = last;
    } catch { /* keep fallback */ }
  }));

  return result;
}

/** Fetch via metals-api.com proxy (requires API key) */
async function fetchViaMetalsApi(apiKey: string): Promise<Partial<Record<MetalSimbolo, number>>> {
  const res = await fetch('/api/metals?symbols=XAU,XAG,XPT,XPD', {
    headers: { 'x-metals-key': apiKey },
  });
  if (!res.ok) throw new Error(`Metals API error ${res.status}`);
  const data: MetalsApiResponse = await res.json();
  if (!data.success) throw new Error('Metals API returned failure');
  return parseMetalsApi(data);
}

/**
 * Fetch all metal spot prices.
 * Strategy: Yahoo Finance (free) → metals-api (if key provided) → fallback constants
 */
export async function fetchMetalPrices(
  metalsApiKey?: string
): Promise<Record<MetalSimbolo, number>> {
  // Start with fallback values
  const prices: Record<MetalSimbolo, number> = { ...FALLBACK_PRICES };

  // Try Yahoo Finance first (free, good coverage)
  try {
    const yahoo = await fetchViaYahoo();
    Object.assign(prices, yahoo);
  } catch { /* keep fallbacks */ }

  // Optionally enrich with metals-api if key provided
  if (metalsApiKey) {
    try {
      const metals = await fetchViaMetalsApi(metalsApiKey);
      Object.assign(prices, metals);
    } catch { /* keep Yahoo/fallback */ }
  }

  return prices;
}

/** Fetch historical OHLC for a metal (uses existing yfinance proxy) */
export async function fetchMetalHistory(
  metal: MetalSimbolo,
  period: '1mo' | '3mo' | '1y' = '3mo'
): Promise<Array<{ date: string; close: number }>> {
  const symbol = YAHOO_SYMBOLS[metal];
  try {
    const res = await fetch(
      `/api/yfinance?symbol=${encodeURIComponent(symbol)}&period=${period}&interval=1d`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i] ?? 0,
      }))
      .filter(d => d.close > 0);
  } catch {
    return [];
  }
}
