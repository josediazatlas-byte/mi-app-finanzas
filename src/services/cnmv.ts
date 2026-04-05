const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export const CNMV_FUNDS: Record<string, string> = {
  'IE00BYX5MX67': 'Fidelity S&P 500',
  'IE00BYX5NX33': 'Fidelity MSCI World',
  'IE0031786696': 'Vanguard Emerging Markets',
};

export interface CnmvFundData {
  isin: string;
  nombre: string;
  vl: number;
  fecha: string;
  variacion: number;
}

interface CacheEntry {
  data: CnmvFundData | null;
  ts: number;
}

function getCache(isin: string): CnmvFundData | null | undefined {
  try {
    const raw = localStorage.getItem(`cnmv_${isin}`);
    if (!raw) return undefined;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) return undefined;
    return entry.data;
  } catch { return undefined; }
}

function setCache(isin: string, data: CnmvFundData | null) {
  try {
    localStorage.setItem(`cnmv_${isin}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

function parseCnmvResponse(isin: string, json: unknown): CnmvFundData | null {
  try {
    // CNMV API can return different structures
    const arr = Array.isArray(json) ? json : (json as { resultado?: unknown[] }).resultado;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const item = arr[0] as Record<string, unknown>;
    // Try various field names the CNMV API might use
    const vl = parseFloat(String(item.vl ?? item.valor ?? item.navValue ?? item.nav ?? 0));
    const fecha = String(item.fecha ?? item.date ?? item.fechaVl ?? '');
    const variacion = parseFloat(String(item.variacion ?? item.change ?? item.rentDiaria ?? 0));
    if (vl <= 0) return null;
    return { isin, nombre: CNMV_FUNDS[isin] ?? isin, vl, fecha, variacion };
  } catch { return null; }
}

export async function getCnmvFundData(isin: string): Promise<CnmvFundData | null> {
  const cached = getCache(isin);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`/api/cnmv?isin=${encodeURIComponent(isin)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = parseCnmvResponse(isin, json);
    setCache(isin, data);
    return data;
  } catch {
    setCache(isin, null);
    return null;
  }
}

export async function getAllCnmvFunds(): Promise<CnmvFundData[]> {
  const results = await Promise.all(Object.keys(CNMV_FUNDS).map(isin => getCnmvFundData(isin)));
  return results.filter((d): d is CnmvFundData => d !== null);
}

export function clearCnmvCache() {
  Object.keys(CNMV_FUNDS).forEach(isin => localStorage.removeItem(`cnmv_${isin}`));
}
