import { useMercadoStore } from '../stores/useMercadoStore';

const BASE = 'https://www.alphavantage.co/query';

// Mock prices for demo mode (March 2026 estimates)
const MOCK_PRICES: Record<string, { price: number; change: number; name: string }> = {
  MSFT: { price: 415.20, change: 1.35, name: 'Microsoft Corp' },
  V: { price: 310.50, change: -0.48, name: 'Visa Inc' },
  GOOG: { price: 195.80, change: 2.10, name: 'Alphabet Inc' },
  META: { price: 598.40, change: 0.87, name: 'Meta Platforms' },
  AAPL: { price: 238.90, change: -0.23, name: 'Apple Inc' },
  AMZN: { price: 228.10, change: 1.15, name: 'Amazon.com' },
  NVDA: { price: 875.30, change: 3.42, name: 'NVIDIA Corp' },
  TSLA: { price: 285.60, change: -1.80, name: 'Tesla Inc' },
  SPY: { price: 565.40, change: 0.45, name: 'SPDR S&P 500 ETF' },
  QQQ: { price: 486.20, change: 0.72, name: 'Invesco QQQ Trust' },
  BTC: { price: 87500, change: 2.30, name: 'Bitcoin' },
  ETH: { price: 3850, change: 1.75, name: 'Ethereum' },
  GLD: { price: 225.80, change: 0.35, name: 'SPDR Gold Shares' },
};

function getApiKey(): string {
  return localStorage.getItem('av_api_key') || '';
}

export async function getQuote(symbol: string): Promise<{ price: number; change: number; name: string; rateLimited?: boolean }> {
  const cached = useMercadoStore.getState().getPrice(symbol);
  if (cached) return { price: cached.precio, change: cached.variacion, name: symbol };

  const apiKey = getApiKey();
  if (!apiKey) {
    const mock = MOCK_PRICES[symbol.toUpperCase()];
    if (mock) {
      // Add small random variation for demo feel
      const jitter = (Math.random() - 0.5) * 0.5;
      const price = mock.price * (1 + jitter / 100);
      const change = mock.change + jitter * 0.1;
      useMercadoStore.getState().setPrice(symbol, price, change);
      return { price, change, name: mock.name };
    }
    return { price: 0, change: 0, name: symbol };
  }

  let rateLimited = false;
  try {
    const res = await fetch(`${BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
    const data = await res.json();
    const limitMsg: string = data.Information || data.Note || '';
    if (limitMsg && (limitMsg.includes('rate limit') || limitMsg.includes('25 requests') || limitMsg.includes('API call frequency') || limitMsg.includes('premium'))) {
      rateLimited = true;
    } else {
      const q = data['Global Quote'];
      if (q && q['05. price']) {
        const price = parseFloat(q['05. price']);
        const change = parseFloat(q['10. change percent']?.replace('%', '') || '0');
        useMercadoStore.getState().setPrice(symbol, price, change);
        return { price, change, name: symbol };
      }
    }
  } catch { /* fall through to mock */ }

  const mock = MOCK_PRICES[symbol.toUpperCase()];
  if (mock) return { ...mock, rateLimited };
  return { price: 0, change: 0, name: symbol, rateLimited };
}

export async function searchSymbol(keywords: string): Promise<Array<{ symbol: string; name: string; type: string }>> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return Object.entries(MOCK_PRICES)
      .filter(([sym, v]) => sym.includes(keywords.toUpperCase()) || v.name.toLowerCase().includes(keywords.toLowerCase()))
      .map(([sym, v]) => ({ symbol: sym, name: v.name, type: 'Equity' }))
      .slice(0, 8);
  }

  try {
    const res = await fetch(`${BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${apiKey}`);
    const data = await res.json();
    if (data.bestMatches) {
      return data.bestMatches.slice(0, 8).map((m: Record<string, string>) => ({
        symbol: m['1. symbol'],
        name: m['2. name'],
        type: m['3. type'],
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function getCryptoRate(symbol: string): Promise<number> {
  const apiKey = getApiKey();
  const mock = MOCK_PRICES[symbol.toUpperCase()];
  if (!apiKey) return mock?.price || 0;

  try {
    const res = await fetch(`${BASE}?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${apiKey}`);
    const data = await res.json();
    const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
    return rate ? parseFloat(rate) : (mock?.price || 0);
  } catch {
    return mock?.price || 0;
  }
}

export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}?function=GLOBAL_QUOTE&symbol=MSFT&apikey=${apiKey}`);
    const data = await res.json();
    return !!data['Global Quote']?.['05. price'];
  } catch {
    return false;
  }
}

export const MOCK_TICKERS = Object.entries(MOCK_PRICES).map(([sym, v]) => ({
  symbol: sym,
  price: v.price,
  change: v.change,
  name: v.name,
}));
