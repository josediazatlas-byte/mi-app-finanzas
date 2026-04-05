export default async function handler(req, res) {
  const { seriesId, limit } = req.query;
  const apiKey = req.headers['x-fred-key'];
  try {
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&limit=${limit || 12}&sort_order=desc&file_type=json`
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
