export default async function handler(req, res) {
  const { symbol } = req.query;
  try {
    const response = await fetch(
      `https://openinsider.com/screener?s=${symbol}&xp=1&xs=1&cnt=10&out=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    const text = await response.text();
    res.status(200).json({ data: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
