const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export const FRED_SERIES = {
  FEDFUNDS: { id: 'FEDFUNDS', name: 'Fed Funds Rate', unit: '%', icon: '🏦', category: 'monetary' },
  CPIAUCSL: { id: 'CPIAUCSL', name: 'Inflación CPI', unit: '%', icon: '📊', category: 'inflation' },
  M2SL: { id: 'M2SL', name: 'M2 Money Supply', unit: 'B$', icon: '💰', category: 'monetary' },
  T10Y2Y: { id: 'T10Y2Y', name: 'Curva Tipos 10Y-2Y', unit: '%', icon: '📈', category: 'bonds' },
  DTWEXBGS: { id: 'DTWEXBGS', name: 'USD Index (DXY)', unit: '', icon: '💱', category: 'forex' },
  GOLDAMGBD228NLBM: { id: 'GOLDAMGBD228NLBM', name: 'Oro (USD/oz)', unit: '$', icon: '🥇', category: 'commodities' },
  VIXCLS: { id: 'VIXCLS', name: 'VIX Volatilidad', unit: '', icon: '😨', category: 'volatility' },
  GS10: { id: 'GS10', name: 'Bono EEUU 10Y', unit: '%', icon: '📜', category: 'bonds' },
} as const;

export type FredSeriesId = keyof typeof FRED_SERIES;

export interface FredObservation {
  date: string;
  value: number;
}

interface CacheEntry {
  data: FredObservation[];
  ts: number;
}

function getCache(seriesId: string, limit: number): FredObservation[] | null {
  try {
    const raw = localStorage.getItem(`fred_${seriesId}_${limit}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.data;
  } catch { return null; }
}

function setCache(seriesId: string, limit: number, data: FredObservation[]) {
  try {
    localStorage.setItem(`fred_${seriesId}_${limit}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

export async function getFredSeries(seriesId: string, apiKey: string, limit = 12): Promise<FredObservation[]> {
  if (!apiKey) return [];
  const cached = getCache(seriesId, limit);
  if (cached !== null) return cached;
  try {
    const res = await fetch(`/api/fred?seriesId=${seriesId}&limit=${limit}`, {
      headers: { 'x-fred-key': apiKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { observations?: { date: string; value: string }[] };
    const data: FredObservation[] = (json.observations ?? [])
      .filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)))
      .map(o => ({ date: o.date, value: parseFloat(o.value) }))
      .reverse(); // oldest first
    setCache(seriesId, limit, data);
    return data;
  } catch {
    return [];
  }
}

export function getFredSignal(seriesId: FredSeriesId, values: FredObservation[]): 'positivo' | 'negativo' | 'neutral' {
  if (values.length < 2) return 'neutral';
  const last = values[values.length - 1].value;
  const prev = values[values.length - 2].value;
  const change = last - prev;

  switch (seriesId) {
    case 'FEDFUNDS': return last > 4 ? 'negativo' : last < 2 ? 'positivo' : 'neutral';
    case 'CPIAUCSL': {
      // CPI is level, compute YoY change
      const yearAgo = values.length >= 12 ? values[values.length - 12] : null;
      if (!yearAgo) return 'neutral';
      const yoy = (last - yearAgo.value) / yearAgo.value * 100;
      return yoy < 2.5 ? 'positivo' : yoy > 4 ? 'negativo' : 'neutral';
    }
    case 'T10Y2Y': return last > 0 ? 'positivo' : last < -0.5 ? 'negativo' : 'neutral';
    case 'VIXCLS': return last < 15 ? 'positivo' : last > 25 ? 'negativo' : 'neutral';
    case 'GS10': return last < 3 ? 'positivo' : last > 4.5 ? 'negativo' : 'neutral';
    case 'GOLDAMGBD228NLBM': return change > 0 ? 'positivo' : 'neutral';
    case 'DTWEXBGS': return change > 0 ? 'neutral' : 'positivo';
    case 'M2SL': return change > 0 ? 'positivo' : 'neutral';
    default: return 'neutral';
  }
}

export function formatFredValue(seriesId: FredSeriesId, value: number): string {
  const info = FRED_SERIES[seriesId];
  switch (seriesId) {
    case 'M2SL': return `${(value / 1000).toFixed(1)}T$`;
    case 'GOLDAMGBD228NLBM': return `$${value.toFixed(0)}`;
    case 'DTWEXBGS': return value.toFixed(1);
    default: return `${value.toFixed(2)}${info.unit}`;
  }
}

export function clearFredCache() {
  Object.keys(FRED_SERIES).forEach(id => {
    for (let i = 1; i <= 24; i++) localStorage.removeItem(`fred_${id}_${i}`);
    localStorage.removeItem(`fred_${id}_12`);
  });
}
