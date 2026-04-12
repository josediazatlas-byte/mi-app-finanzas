const ALLOWED_ORIGINS = [
  'https://incontrol-finance.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
  'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'CNY', 'INR', 'KRW',
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base } = req.query;
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10 || apiKey.length > 100) {
    return res.status(400).json({ error: 'Missing or invalid API key' });
  }

  const baseCurrency = (base || 'EUR').toUpperCase();
  if (!VALID_CURRENCIES.has(baseCurrency)) {
    return res.status(400).json({ error: 'Invalid base currency' });
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/${baseCurrency}`
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Exchange rate API error' });
    }
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
