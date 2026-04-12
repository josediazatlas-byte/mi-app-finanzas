const ALLOWED_ORIGINS = [
  'https://incontrol-finance.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, payload } = req.body ?? {};

  // Input validation
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 20 || apiKey.length > 200) {
    return res.status(400).json({ error: 'Invalid API key' });
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return res.status(400).json({ error: 'Messages required' });
  }
  if (payload.messages.length > 50) {
    return res.status(400).json({ error: 'Too many messages' });
  }
  // Ensure max_tokens is within bounds
  const maxTokens = Math.min(Number(payload.max_tokens) || 1024, 4096);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...payload, max_tokens: maxTokens }),
    });
    const data = await response.json();
    // Do not forward raw error details that may leak internal info
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message ?? 'API error' });
    }
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
