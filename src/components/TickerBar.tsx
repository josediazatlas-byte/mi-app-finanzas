import { useEffect, useState } from 'react';
import { MOCK_TICKERS, getQuote } from '../services/alphaVantage';
import { cgGetPrices, symbolToId } from '../services/coinGecko';
import { useConfigStore } from '../stores/useConfigStore';
import { fmt } from '../utils/format';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  name: string;
  isCrypto?: boolean;
}

const STOCK_SYMBOLS = ['MSFT', 'AAPL', 'GOOG', 'META', 'NVDA', 'AMZN', 'TSLA', 'SPY'];
const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'SOL'];

export default function TickerBar() {
  const { apiKey } = useConfigStore();
  const [tickers, setTickers] = useState<TickerItem[]>(MOCK_TICKERS.slice(0, 10));

  useEffect(() => {
    const load = async () => {
      // Load stocks via Alpha Vantage
      const stockResults = await Promise.all(STOCK_SYMBOLS.map(async (s) => {
        const q = await getQuote(s);
        const mock = MOCK_TICKERS.find(t => t.symbol === s);
        return {
          symbol: s,
          price: q?.price ?? mock?.price ?? 0,
          change: q?.change ?? mock?.change ?? 0,
          name: mock?.name ?? s,
        };
      }));

      // Load crypto via CoinGecko (free, no key needed)
      const cryptoResults: TickerItem[] = [];
      try {
        const coinIds = CRYPTO_SYMBOLS.map(s => symbolToId(s));
        const prices = await cgGetPrices(coinIds);
        CRYPTO_SYMBOLS.forEach(symbol => {
          const coinId = symbolToId(symbol);
          const data = prices[coinId];
          if (data) {
            cryptoResults.push({
              symbol,
              price: data.eur,
              change: data.eur_24h_change ?? 0,
              name: symbol === 'BTC' ? 'Bitcoin' : symbol === 'ETH' ? 'Ethereum' : 'Solana',
              isCrypto: true,
            });
          }
        });
      } catch {
        // Fallback to mock if CoinGecko fails
        CRYPTO_SYMBOLS.forEach(s => {
          const mock = MOCK_TICKERS.find(t => t.symbol === s);
          if (mock) cryptoResults.push({ ...mock, isCrypto: true });
        });
      }

      setTickers([...stockResults, ...cryptoResults]);
    };
    load();
  }, [apiKey]);

  const items = [...tickers, ...tickers]; // duplicate for seamless loop

  return (
    <div className="ticker-bar" style={{ padding: '8px 0' }}>
      <div className="ticker-content">
        {items.map((t, i) => (
          <span key={`${t.symbol}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 24px', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{t.symbol}</span>
            <span>{t.isCrypto ? `€${fmt(t.price)}` : `$${fmt(t.price)}`}</span>
            <span style={{ color: (t.change ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
              {(t.change ?? 0) >= 0 ? '+' : ''}{(t.change ?? 0).toFixed(2)}%
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
