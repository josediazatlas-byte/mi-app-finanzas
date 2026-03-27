export default async function handler(req, res) {
  const { type, symbols } = req.query;
  const fmpKey = req.headers['x-fmp-key'] || '';

  try {
    let data;
    if (type === 'news') {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbols}&limit=5&apikey=${fmpKey}`
      );
      data = await response.json();
    } else if (type === 'fear-greed') {
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      data = await response.json();
    } else if (type === 'ratings') {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/rating/${symbols}?apikey=${fmpKey}`
      );
      data = await response.json();
    } else if (type === 'price-target') {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/price-target-consensus/${symbols}?apikey=${fmpKey}`
      );
      data = await response.json();
    } else {
      return res.status(400).json({ error: 'Unknown type' });
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
