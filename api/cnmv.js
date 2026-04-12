const ALLOWED_ORIGINS = [
  'https://in-control.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

// ISIN format: 2 uppercase letters + 10 alphanumeric chars
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/;

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

  const { isin } = req.query;

  if (!isin || typeof isin !== 'string' || !ISIN_REGEX.test(isin)) {
    return res.status(400).json({ error: 'Invalid ISIN format' });
  }

  try {
    const response = await fetch(
      `https://www.cnmv.es/portal/Alerta/API/GetFondosByIsin?isin=${encodeURIComponent(isin)}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
