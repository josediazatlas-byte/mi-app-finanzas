const ALLOWED_ORIGINS = [
  'https://myincontrol.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const VALID_SERIES = new Set([
  'FEDFUNDS', 'CPIAUCSL', 'M2SL', 'T10Y2Y',
  'DTWEXBGS', 'GOLDAMGBD228NLBM', 'VIXCLS', 'GS10',
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-fred-key');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { seriesId, limit } = req.query;
  const apiKey = req.headers['x-fred-key'];

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 100) {
    return res.status(400).json({ error: 'Missing or invalid FRED key' });
  }

  if (!seriesId || !VALID_SERIES.has(seriesId)) {
    return res.status(400).json({ error: 'Invalid series ID' });
  }

  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 120);

  try {
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(apiKey)}&limit=${limitNum}&sort_order=desc&file_type=json`
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'FRED API error' });
    }
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
