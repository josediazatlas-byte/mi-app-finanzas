const ALLOWED_ORIGINS = [
  'https://myincontrol.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const TICKER_REGEX = /^[\^]?[A-Za-z0-9.\-]{1,20}$/;
const VALID_PERIODS = new Set(['1mo', '3mo', '1y', '5y', '10y']);
const VALID_INTERVALS = new Set(['1d', '1wk', '1mo']);

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

  const { symbol, period, interval } = req.query;

  if (!symbol || typeof symbol !== 'string' || !TICKER_REGEX.test(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  const validPeriod = VALID_PERIODS.has(period) ? period : '5y';
  const validInterval = VALID_INTERVALS.has(interval) ? interval : '1mo';

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${validInterval}&range=${validPeriod}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Yahoo Finance API error' });
    }
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
