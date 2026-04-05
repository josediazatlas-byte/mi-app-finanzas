export default async function handler(req, res) {
  const { isin } = req.query;
  try {
    const response = await fetch(
      `https://www.cnmv.es/portal/Alerta/API/GetFondosByIsin?isin=${isin}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
