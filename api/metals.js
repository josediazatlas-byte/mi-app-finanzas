const ALLOWED_ORIGINS = [
  'https://myincontrol.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-metals-key');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.METALS_API_KEY || req.headers['x-metals-key'];

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 8) {
    return res.status(400).json({ error: 'Missing or invalid API key' });
  }

  const symbols = (req.query.symbols || 'XAU,XAG,XPT,XPD').toUpperCase();
  const validSymbols = new Set(['XAU', 'XAG', 'XPT', 'XPD', 'XCU']);
  const requestedSymbols = symbols.split(',').filter(s => validSymbols.has(s)).join(',');

  if (!requestedSymbols) return res.status(400).json({ error: 'Invalid symbols' });

  try {
    const response = await fetch(
      `https://metals-api.com/api/latest?access_key=${encodeURIComponent(apiKey)}&base=USD&symbols=${requestedSymbols}`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      return res.status(response.status || 500).json({ error: data.error?.info || 'Metals API error' });
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
