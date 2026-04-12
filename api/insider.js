const ALLOWED_ORIGINS = [
  'https://in-control.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

// Stock ticker: 1-10 alphanumeric chars, dots or hyphens allowed
const TICKER_REGEX = /^[A-Za-z0-9.\-^]{1,20}$/;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string' || !TICKER_REGEX.test(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  try {
    const response = await fetch(
      `https://openinsider.com/screener?s=${encodeURIComponent(symbol)}&xp=1&xs=1&cnt=10&out=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    const text = await response.text();
    res.status(200).json({ data: text });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
