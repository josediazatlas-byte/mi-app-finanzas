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
  // Ibex 35 (Spain)
  'SAN.MC': { price: 4.85, change: 0.62, name: 'Banco Santander' },
  'BBVA.MC': { price: 10.20, change: 0.95, name: 'BBVA' },
  'ITX.MC': { price: 50.20, change: 1.15, name: 'Inditex' },
  'TEF.MC': { price: 4.12, change: -0.30, name: 'Telefónica' },
  'REP.MC': { price: 14.30, change: 0.45, name: 'Repsol' },
  'IBE.MC': { price: 13.85, change: 0.20, name: 'Iberdrola' },
  'ACS.MC': { price: 42.10, change: 0.75, name: 'ACS' },
  'CABK.MC': { price: 5.80, change: 0.88, name: 'CaixaBank' },
  'MAP.MC': { price: 3.15, change: 0.35, name: 'MAPFRE' },
  'ELE.MC': { price: 21.50, change: -0.15, name: 'Endesa' },
  // Euronext Paris
  'MC.PA': { price: 680.50, change: 1.25, name: 'LVMH' },
  'OR.PA': { price: 415.30, change: 0.85, name: "L'Oréal" },
  'TTE.PA': { price: 58.20, change: -0.35, name: 'TotalEnergies' },
  'BNP.PA': { price: 72.40, change: 0.55, name: 'BNP Paribas' },
  'AIR.PA': { price: 168.90, change: 1.80, name: 'Airbus' },
  // Xetra (Germany)
  'SAP.DE': { price: 225.80, change: 1.10, name: 'SAP SE' },
  'SIE.DE': { price: 185.40, change: 0.65, name: 'Siemens AG' },
  'ALV.DE': { price: 280.60, change: 0.45, name: 'Allianz SE' },
  'ADS.DE': { price: 215.90, change: 2.10, name: 'Adidas AG' },
  'BMW.DE': { price: 78.50, change: -0.80, name: 'BMW' },
  'VOW3.DE': { price: 95.20, change: -0.60, name: 'Volkswagen' },
  // London Stock Exchange
  'HSBA.L': { price: 780.50, change: 0.40, name: 'HSBC Holdings' },
  'BP.L': { price: 438.20, change: -0.55, name: 'BP' },
  'SHEL.L': { price: 2680.00, change: 0.30, name: 'Shell' },
  'AZN.L': { price: 11200.00, change: 1.20, name: 'AstraZeneca' },
  'ULVR.L': { price: 3850.00, change: 0.15, name: 'Unilever' },
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
