const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

export interface InsiderTransaction {
  date: string;
  name: string;
  title: string;
  type: string;
  typeFull: string;
  shares: number;
  value: number;
  price: number;
}

interface CacheEntry {
  data: InsiderTransaction[];
  ts: number;
}

function getCache(symbol: string): InsiderTransaction[] | null {
  try {
    const raw = localStorage.getItem(`insider_${symbol}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.data;
  } catch { return null; }
}

function setCache(symbol: string, data: InsiderTransaction[]) {
  try {
    localStorage.setItem(`insider_${symbol}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore storage errors */ }
}

function parseHtml(html: string): InsiderTransaction[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('table.tinytable tbody tr'));
    if (rows.length === 0) return [];

    return rows.slice(0, 10).map(row => {
      const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() ?? '');
      // OpenInsider columns: X | Filing Date | Trade Date | Ticker | Name | Title | Trade Type | Price | Qty | Owned | ΔOwn | Value
      const tradeType = cells[6] ?? '';
      const shares = parseInt((cells[8] ?? '').replace(/,/g, '')) || 0;
      const value = parseInt((cells[11] ?? '').replace(/[$,+]/g, '')) || 0;
      const price = parseFloat((cells[7] ?? '').replace(/[$,]/g, '')) || 0;
      return {
        date: cells[2] || cells[1] || '',
        name: cells[4] || '',
        title: cells[5] || '',
        type: tradeType.startsWith('P') ? 'P' : tradeType.startsWith('S') ? 'S' : tradeType.charAt(0),
        typeFull: tradeType,
        shares,
        value,
        price,
      };
    }).filter(t => t.name && t.date);
  } catch {
    return [];
  }
}

export async function getInsiderTransactions(symbol: string): Promise<InsiderTransaction[]> {
  const cached = getCache(symbol);
  if (cached !== null) return cached;
  try {
    const res = await fetch(`/api/insider?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data: html } = await res.json() as { data: string };
    const transactions = parseHtml(html);
    setCache(symbol, transactions);
    return transactions;
  } catch {
    return [];
  }
}

export function getInsiderSignal(txs: InsiderTransaction[]): 'buying' | 'selling' | 'mixed' | 'none' {
  if (txs.length === 0) return 'none';
  const buys = txs.filter(t => t.type === 'P');
  const sells = txs.filter(t => t.type === 'S');
  if (buys.length === 0 && sells.length === 0) return 'none';
  if (buys.length > sells.length * 1.5) return 'buying';
  if (sells.length > buys.length * 1.5) return 'selling';
  return 'mixed';
}
