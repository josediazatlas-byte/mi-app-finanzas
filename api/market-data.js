const ALLOWED_ORIGINS = [
  'https://in-control.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const VALID_TYPES = new Set(['news', 'fear-greed', 'ratings', 'price-target']);
const TICKER_REGEX = /^[A-Za-z0-9.,\-^]{1,100}$/;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-fmp-key');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, symbols } = req.query;
  const fmpKey = req.headers['x-fmp-key'] || '';

  if (!type || !VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  // fear-greed doesn't need symbols or key
  if (type !== 'fear-greed') {
    if (symbols && !TICKER_REGEX.test(symbols)) {
      return res.status(400).json({ error: 'Invalid symbols' });
    }
    if (!fmpKey || typeof fmpKey !== 'string' || fmpKey.length < 10 || fmpKey.length > 100) {
      return res.status(400).json({ error: 'Missing or invalid FMP key' });
    }
  }

  try {
    let data;
    if (type === 'news') {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/stock_news?tickers=${encodeURIComponent(symbols || '')}&limit=5&apikey=${encodeURIComponent(fmpKey)}`
      );
      if (!response.ok) return res.status(response.status).json({ error: 'Market data API error' });
      data = await response.json();
    } else if (type === 'fear-greed') {
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!response.ok) return res.status(response.status).json({ error: 'Fear greed API error' });
      data = await response.json();
    } else if (type === 'ratings') {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/rating/${encodeURIComponent(symbols || '')}?apikey=${encodeURIComponent(fmpKey)}`
      );
      if (!response.ok) return res.status(response.status).json({ error: 'Market data API error' });
      data = await response.json();
    } else if (type === 'price-target') {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/price-target-consensus/${encodeURIComponent(symbols || '')}?apikey=${encodeURIComponent(fmpKey)}`
      );
      if (!response.ok) return res.status(response.status).json({ error: 'Market data API error' });
      data = await response.json();
    }
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
