import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useInversionesStore } from '../stores/useInversionesStore';
import { useMercadoStore } from '../stores/useMercadoStore';
import { useDividendosStore } from '../stores/useDividendosStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import { usePlanesAhorroStore } from '../stores/usePlanesAhorroStore';
import { useConfigStore } from '../stores/useConfigStore';
import { getQuote, MOCK_TICKERS } from '../services/alphaVantage';
import { cgGetPrices, symbolToId, isCryptoSymbol } from '../services/coinGecko';
import { getCompanyProfile, getKeyMetrics, getRatings, getPriceTarget, type CompanyProfile, type KeyMetrics, type Rating, type PriceTarget } from '../services/financialModelingPrep';
import { getInsiderTransactions, getInsiderSignal, type InsiderTransaction } from '../services/openInsider';
import { getFredSeries, getFredSignal, formatFredValue, FRED_SERIES, type FredObservation } from '../services/fred';
import { getMultipleYfHistory, BENCHMARK_INDICES, type YfResult } from '../services/yfinance';
import { fmtEur, toEur, USD_TO_EUR } from '../utils/format';
import { calcScoreCartera } from '../utils/scoreCartera';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

type Badge = 'Comprar' | 'Mantener' | 'Vender';

function getBadge(pnlPct: number, rating?: Rating | null): Badge {
  if (rating) {
    const rec = rating.ratingRecommendation?.toLowerCase() ?? '';
    if (rec.includes('strong buy') || rec.includes('buy')) return 'Comprar';
    if (rec.includes('strong sell') || rec.includes('sell')) return 'Vender';
    return 'Mantener';
  }
  if (pnlPct > 5) return 'Comprar';
  if (pnlPct < -5) return 'Vender';
  return 'Mantener';
}

interface FMPData {
  profile: CompanyProfile | null;
  metrics: KeyMetrics | null;
  rating: Rating | null;
  priceTarget: PriceTarget | null;
}

const MACRO_SIGNALS = [
  { name: 'S&P 500', valor: '+18.4%', desc: 'YTD', estado: 'positivo' },
  { name: 'Nasdaq 100', valor: '+22.1%', desc: 'YTD', estado: 'positivo' },
  { name: 'EUR/USD', valor: '1.085', desc: 'Tipo de cambio', estado: 'neutral' },
  { name: 'Fed Funds Rate', valor: '5.25%', desc: 'Tasa interés EEUU', estado: 'negativo' },
  { name: 'Oro (XAU/USD)', valor: '$2,340', desc: 'Precio onza', estado: 'positivo' },
  { name: 'VIX', valor: '14.2', desc: 'Índice de volatilidad', estado: 'positivo' },
];


// Spanish capital gains tax brackets
function calcIRPF(ganancia: number): number {
  if (ganancia <= 0) return 0;
  let tax = 0;
  if (ganancia > 200000) { tax += (ganancia - 200000) * 0.23; ganancia = 200000; }
  if (ganancia > 50000) { tax += (ganancia - 50000) * 0.21; ganancia = 50000; }
  tax += ganancia * 0.19;
  return tax;
}

export default function Analisis() {
  const [searchParams] = useSearchParams();
  const focusSymbol = searchParams.get('symbol') ?? '';
  const { posiciones } = useInversionesStore();
  const { precios, setPrice } = useMercadoStore();
  const { dividendos } = useDividendosStore();
  const { inmuebles } = useInmuebleStore();
  useDeudaStore();
  const { planes: planesAhorro } = usePlanesAhorroStore();
  const { fmpKey, fredKey } = useConfigStore();
  const [tab, setTab] = useState<'empresas' | 'macro' | 'backtest' | 'fiscalidad'>('empresas');
  const [refreshing, setRefreshing] = useState(false);
  const [fmpData, setFmpData] = useState<Record<string, FMPData>>({});
  const [expandedFmp, setExpandedFmp] = useState<Record<string, boolean>>({});
  const [expandedInsider, setExpandedInsider] = useState<Record<string, boolean>>({});
  const [insiderData, setInsiderData] = useState<Record<string, InsiderTransaction[]>>({});
  const [fredData, setFredData] = useState<Record<string, FredObservation[]>>({});
  const [fredLoading, setFredLoading] = useState(false);
  const [backtestData, setBacktestData] = useState<Record<string, YfResult>>({});
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState(['^GSPC', '^IBEX', 'IWDA.AS']);
  const [backtestPeriod, setBacktestPeriod] = useState<'1y' | '5y' | '10y'>('5y');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-expand and scroll to focused symbol
  useEffect(() => {
    if (!focusSymbol) return;
    setExpandedFmp(prev => ({ ...prev, [focusSymbol]: true }));
    setTimeout(() => {
      const el = cardRefs.current[focusSymbol];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }, [focusSymbol]);

  // Price helper: fondos use VL, never Alpha Vantage
  const getPriceOf = (p: typeof posiciones[0]): number => {
    if (p.tipo === 'Fondo Indexado') return p.vl || p.precioMedio || 0;
    const cached = precios[p.simbolo];
    const mock = MOCK_TICKERS.find(t => t.symbol === p.simbolo);
    return cached?.precio ?? mock?.price ?? p.precioMedio ?? 0;
  };

  const getChange = (simbolo: string): number => {
    const cached = precios[simbolo];
    const mock = MOCK_TICKERS.find(t => t.symbol === simbolo);
    return cached?.variacion ?? mock?.change ?? 0;
  };

  // Refresh: stocks via Alpha Vantage + crypto via CoinGecko
  const refresh = async () => {
    setRefreshing(true);
    const cryptoPos = posiciones.filter(p => p.tipo === 'Crypto' || isCryptoSymbol(p.simbolo));
    const stockPos = posiciones.filter(p => p.tipo !== 'Fondo Indexado' && p.tipo !== 'Crypto' && !isCryptoSymbol(p.simbolo));
    await Promise.all(stockPos.map(async (p) => {
      const q = await getQuote(p.simbolo);
      if (q) setPrice(p.simbolo, q.price, q.change);
    }));
    if (cryptoPos.length > 0) {
      try {
        const coinIds = cryptoPos.map(p => symbolToId(p.simbolo));
        const prices = await cgGetPrices(coinIds);
        cryptoPos.forEach(p => {
          const data = prices[symbolToId(p.simbolo)];
          if (data) {
            const priceInDivisa = p.divisa === 'EUR' ? data.eur : data.usd ?? data.eur / 0.92;
            setPrice(p.simbolo, priceInDivisa, data.eur_24h_change ?? 0);
          }
        });
      } catch { /* keep cached prices */ }
    }
    setRefreshing(false);
  };

  useEffect(() => { refresh(); }, []);

  // Load FMP data for tradeable positions only (not fondos, not crypto)
  useEffect(() => {
    if (!fmpKey) return;
    const stockPositions = posiciones.filter(p => p.tipo !== 'Crypto' && p.tipo !== 'Fondo Indexado');
    stockPositions.forEach(async (p) => {
      if (fmpData[p.simbolo]) return;
      const [profile, metrics, rating, priceTarget] = await Promise.all([
        getCompanyProfile(p.simbolo),
        getKeyMetrics(p.simbolo),
        getRatings(p.simbolo),
        getPriceTarget(p.simbolo),
      ]);
      setFmpData(prev => ({ ...prev, [p.simbolo]: { profile, metrics, rating, priceTarget } }));
    });
  }, [posiciones, fmpKey]);

  // Load insider data for stock positions (lazy - load when empresas tab is active)
  useEffect(() => {
    if (tab !== 'empresas') return;
    const stockPos = posiciones.filter(p => p.tipo !== 'Crypto' && p.tipo !== 'Fondo Indexado' && !isCryptoSymbol(p.simbolo));
    stockPos.forEach(async (p) => {
      if (insiderData[p.simbolo] !== undefined) return;
      const txs = await getInsiderTransactions(p.simbolo);
      setInsiderData(prev => ({ ...prev, [p.simbolo]: txs }));
    });
  }, [tab, posiciones]);

  // Load FRED data when macro tab becomes active
  useEffect(() => {
    if (tab !== 'macro' || !fredKey || Object.keys(fredData).length > 0) return;
    setFredLoading(true);
    Promise.all(Object.keys(FRED_SERIES).map(async (id) => {
      const obs = await getFredSeries(id, fredKey, 12);
      return [id, obs] as [string, FredObservation[]];
    })).then(results => {
      setFredData(Object.fromEntries(results));
      setFredLoading(false);
    });
  }, [tab, fredKey]);

  // Load backtest data when backtest tab becomes active
  useEffect(() => {
    if (tab !== 'backtest') return;
    const missing = selectedIndices.filter(s => !backtestData[s]);
    if (missing.length === 0) return;
    setBacktestLoading(true);
    getMultipleYfHistory(missing, backtestPeriod).then(results => {
      setBacktestData(prev => ({ ...prev, ...results }));
      setBacktestLoading(false);
    });
  }, [tab, selectedIndices, backtestPeriod]);

  // Score: same logic as Inversiones
  const totalValor = posiciones.reduce((s, p) => s + toEur(getPriceOf(p) * p.acciones, p.divisa), 0);
  const scoreData = calcScoreCartera(posiciones, getPriceOf, totalValor);
  const portfolioScore = scoreData.total;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
        {(['empresas', 'macro', 'backtest', 'fiscalidad'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: tab === t ? 'var(--blue)' : 'none', color: tab === t ? 'white' : 'var(--text2)', transition: 'all .2s' }}>
            {t === 'fiscalidad' ? 'Fiscalidad' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* === EMPRESAS === */}
      {tab === 'empresas' && (
        <>
          {/* Portfolio score */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>Score de Cartera</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: portfolioScore >= 60 ? 'var(--green)' : portfolioScore >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                  {portfolioScore}<span style={{ fontSize: 20, color: 'var(--text2)' }}>/100</span>
                </div>
              </div>
              <button className="btn-icon" onClick={refresh}>
                <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${portfolioScore}%`, background: portfolioScore >= 60 ? 'var(--green)' : portfolioScore >= 40 ? 'var(--amber)' : 'var(--red)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
              {[
                { label: 'Diversificación sector', v: scoreData.diversificacionSector, max: 30 },
                { label: 'Tipos activo', v: scoreData.diversificacionTipo, max: 25 },
                { label: 'Concentración', v: scoreData.concentracionMaxima, max: 20 },
                { label: 'Calidad', v: scoreData.calidadFundamental, max: 15 },
                { label: 'Liquidez', v: scoreData.liquidez, max: 10 },
              ].map(f => {
                const pct = f.v / f.max;
                const col = pct >= 0.8 ? 'var(--green)' : pct >= 0.5 ? 'var(--amber)' : 'var(--red)';
                return (
                  <div key={f.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: col }}>{f.v}<span style={{ fontSize: 10, color: 'var(--text2)' }}>/{f.max}</span></div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 2, height: 3, marginTop: 4 }}>
                      <div style={{ height: '100%', width: `${pct * 100}%`, background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Position cards */}
          {posiciones.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
              No tienes posiciones. Añade activos en la sección de Inversiones.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {posiciones.map((p) => {
                const esFondo = p.tipo === 'Fondo Indexado';
                const precio = getPriceOf(p) || 0;
                const cambio = esFondo ? 0 : (getChange(p.simbolo) || 0);
                const precioMedio = p.precioMedio || 0;
                const pnlPct = precioMedio > 0 ? ((precio - precioMedio) / precioMedio) * 100 : 0;
                // For fondos: PnL = participaciones × VL - participaciones × precio compra (all in EUR)
                const pnlEur = esFondo
                  ? p.acciones * precio - p.acciones * precioMedio
                  : toEur((precio - precioMedio) * (p.acciones || 0), p.divisa);
                const fmp = fmpData[p.simbolo];
                const badge = getBadge(pnlPct, fmp?.rating);
                const valorPos = toEur(precio * (p.acciones || 0), p.divisa);
                const peso = totalValor > 0 ? (valorPos / totalValor) * 100 : 0;
                const isExpanded = expandedFmp[p.simbolo];
                const isFocused = focusSymbol === p.simbolo || focusSymbol === p.isin;

                return (
                  <div
                    key={p.id}
                    ref={el => { cardRefs.current[p.simbolo] = el; if (p.isin) cardRefs.current[p.isin] = el; }}
                    className="card"
                    style={isFocused ? { border: '2px solid var(--blue)', boxShadow: '0 0 0 3px rgba(59,130,246,0.15)' } : {}}
                  >
                    {esFondo ? (
                      /* ── FONDO INDEXADO CARD ── */
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#a855f7' }}>
                              {p.nombre.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.nombre.slice(0, 40)}</div>
                              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                                {p.gestora ? `${p.gestora} · ` : ''}Fondo Indexado{p.isin ? ` · ${p.isin}` : ''}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: 11, background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                            VL manual
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                          {[
                            { label: 'VL actual (€)', value: precio > 0 ? `€${precio.toFixed(4)}` : 'Sin actualizar', note: p.vlFecha ? `Fecha: ${p.vlFecha}` : undefined },
                            { label: 'Precio compra (€)', value: `€${precioMedio.toFixed(4)}` },
                            { label: 'Participaciones', value: p.acciones.toString() },
                            { label: 'P&L total', value: `${pnlEur >= 0 ? '+' : ''}${fmtEur(pnlEur)}`, color: pnlEur >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'P&L %', value: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`, color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'Peso cartera', value: `${peso.toFixed(1)}%` },
                          ].map((m) => (
                            <div key={m.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{m.label}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: (m as { color?: string }).color || 'var(--text)' }}>{m.value}</div>
                              {(m as { note?: string }).note && <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>{(m as { note?: string }).note}</div>}
                            </div>
                          ))}
                        </div>
                        {/* Fondo details */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                          {[
                            { label: 'Índice replicado', value: p.nombre.includes('S&P') || p.nombre.includes('SP') ? 'S&P 500' : p.nombre.includes('World') ? 'MSCI World' : p.nombre.includes('Nasdaq') ? 'Nasdaq 100' : p.nombre.includes('Euro') ? 'Euro Stoxx' : 'Ver nombre del fondo' },
                            { label: 'TER', value: p.ter != null ? `${p.ter}%` : 'No especificado' },
                            { label: 'Gestora', value: p.gestora ?? 'No especificada' },
                            { label: 'Valor total posición', value: fmtEur(valorPos) },
                          ].map(m => (
                            <div key={m.label} style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', borderRadius: 8, padding: '7px 10px' }}>
                              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>{m.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.value}</div>
                            </div>
                          ))}
                        </div>
                        {precio === 0 && (
                          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--amber)', background: 'rgba(245,158,11,0.08)', borderRadius: 6, padding: '8px 12px' }}>
                            ⚠️ Sin VL actualizado. Ve a Inversiones → actualiza el VL manualmente con el botón "VL".
                          </div>
                        )}
                      </>
                    ) : (
                      /* ── EMPRESA / ETF / CRYPTO / MATERIA PRIMA CARD ── */
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {fmp?.profile?.image ? (
                              <img src={fmp.profile.image} alt={p.simbolo} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', background: 'white', padding: 4 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--blue)' }}>
                                {p.simbolo.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.simbolo}</div>
                              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                                {fmp?.profile?.sector ? `${fmp.profile.sector} · ` : ''}{p.nombre}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {fmp?.priceTarget?.targetConsensus && (
                              <span style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', padding: '3px 8px', borderRadius: 6 }}>
                                🎯 ${fmp.priceTarget.targetConsensus.toFixed(0)}
                              </span>
                            )}
                            <span className={`badge-${badge === 'Comprar' ? 'buy' : badge === 'Vender' ? 'sell' : 'hold'}`}>
                              {badge}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          {[
                            { label: 'Precio actual', value: `$${Number(precio ?? 0).toFixed(2)}` },
                            { label: 'Precio compra', value: `$${Number(precioMedio ?? 0).toFixed(2)}` },
                            { label: 'Variación hoy', value: `${cambio >= 0 ? '+' : ''}${Number(cambio ?? 0).toFixed(2)}%`, color: cambio >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'P&L total', value: `${pnlEur >= 0 ? '+' : ''}${fmtEur(pnlEur)}`, color: pnlEur >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'P&L %', value: `${pnlPct >= 0 ? '+' : ''}${Number(pnlPct ?? 0).toFixed(2)}%`, color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'Peso cartera', value: `${Number(peso ?? 0).toFixed(1)}%` },
                          ].map((m) => (
                            <div key={m.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{m.label}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: (m as { color?: string }).color || 'var(--text)' }}>{m.value}</div>
                            </div>
                          ))}
                        </div>
                        {/* FMP fundamentals */}
                        {fmp?.metrics && (
                          <>
                            <button onClick={() => setExpandedFmp(prev => ({ ...prev, [p.simbolo]: !isExpanded }))}
                              style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              {isExpanded ? 'Ocultar' : 'Ver'} fundamentales
                            </button>
                            {isExpanded && (
                              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                {[
                                  { label: 'PER', value: fmp.metrics.peRatioTTM ? fmp.metrics.peRatioTTM.toFixed(1) + 'x' : 'N/A' },
                                  { label: 'P/B', value: fmp.metrics.pbRatioTTM ? fmp.metrics.pbRatioTTM.toFixed(2) + 'x' : 'N/A' },
                                  { label: 'ROE', value: fmp.metrics.roeTTM ? (fmp.metrics.roeTTM * 100).toFixed(1) + '%' : 'N/A', color: (fmp.metrics.roeTTM ?? 0) > 0.15 ? 'var(--green)' : undefined },
                                  { label: 'Margen Neto', value: fmp.metrics.netProfitMarginTTM ? (fmp.metrics.netProfitMarginTTM * 100).toFixed(1) + '%' : 'N/A' },
                                  { label: 'Div Yield', value: fmp.metrics.dividendYieldTTM ? (fmp.metrics.dividendYieldTTM * 100).toFixed(2) + '%' : '—', color: (fmp.metrics.dividendYieldTTM ?? 0) > 0.02 ? 'var(--green)' : undefined },
                                  { label: 'Beta', value: fmp.profile?.beta ? fmp.profile.beta.toFixed(2) : 'N/A', color: (fmp.profile?.beta ?? 1) > 1.5 ? 'var(--amber)' : undefined },
                                ].map(m => (
                                  <div key={m.label} style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8, padding: '7px 10px' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>{m.label}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: m.color || 'var(--text)' }}>{m.value}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {!fmpKey && (
                          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)', opacity: .7 }}>
                            Conecta Financial Modeling Prep en Ajustes → APIs para ver métricas fundamentales reales
                          </div>
                        )}
                        {/* Insider Trading */}
                        {!esFondo && (() => {
                          const txs = insiderData[p.simbolo];
                          const signal = txs ? getInsiderSignal(txs) : 'none';
                          const isExpI = expandedInsider[p.simbolo];
                          return (
                            <div style={{ marginTop: 10 }}>
                              <button onClick={() => setExpandedInsider(prev => ({ ...prev, [p.simbolo]: !isExpI }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                                {isExpI ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                Insider Trading
                                {txs === undefined ? (
                                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(152,152,168,0.1)', borderRadius: 6 }}>cargando…</span>
                                ) : signal === 'buying' ? (
                                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(34,197,94,0.15)', color: 'var(--green)', borderRadius: 6, fontWeight: 700 }}>🟢 Comprando</span>
                                ) : signal === 'selling' ? (
                                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', borderRadius: 6, fontWeight: 700 }}>🔴 Vendiendo</span>
                                ) : signal === 'mixed' ? (
                                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', borderRadius: 6, fontWeight: 700 }}>🟡 Mixto</span>
                                ) : (
                                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(152,152,168,0.1)', color: 'var(--text2)', borderRadius: 6 }}>Sin actividad</span>
                                )}
                              </button>
                              {isExpI && (
                                <div style={{ marginTop: 8 }}>
                                  {!txs || txs.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 0' }}>Sin transacciones de insiders disponibles.</div>
                                  ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                        <thead>
                                          <tr style={{ color: 'var(--text2)' }}>
                                            {['Fecha', 'Directivo', 'Cargo', 'Tipo', 'Acciones', 'Valor'].map(h => (
                                              <th key={h} style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {txs.slice(0, 6).map((tx, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                              <td style={{ padding: '4px 6px' }}>{tx.date.slice(0, 10)}</td>
                                              <td style={{ padding: '4px 6px', fontWeight: 600 }}>{tx.name}</td>
                                              <td style={{ padding: '4px 6px', color: 'var(--text2)' }}>{tx.title}</td>
                                              <td style={{ padding: '4px 6px' }}>
                                                <span style={{ color: tx.type === 'P' ? 'var(--green)' : tx.type === 'S' ? 'var(--red)' : 'var(--text2)', fontWeight: 700 }}>
                                                  {tx.type === 'P' ? '▲ Compra' : tx.type === 'S' ? '▼ Venta' : tx.typeFull}
                                                </span>
                                              </td>
                                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{tx.shares.toLocaleString('es-ES')}</td>
                                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>${tx.value.toLocaleString('es-ES')}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* === MACRO === */}
      {tab === 'macro' && (
        <>
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Macro Dashboard · FRED (St. Louis Fed)</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {fredKey ? 'Datos reales en tiempo real · caché 24h' : 'Configura tu FRED API Key en Ajustes → APIs para datos reales'}
                </div>
              </div>
              {fredKey && (
                <button className="btn-icon" onClick={() => { setFredLoading(true); setFredData({}); }} title="Actualizar datos FRED">
                  <RefreshCw size={14} style={{ animation: fredLoading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              )}
            </div>
          </div>

          {/* FRED live data */}
          {fredKey ? (
            fredLoading ? (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                <div>Cargando datos macroeconómicos de FRED…</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {(Object.keys(FRED_SERIES) as (keyof typeof FRED_SERIES)[]).map(id => {
                  const info = FRED_SERIES[id];
                  const obs = fredData[id] ?? [];
                  const last = obs.length > 0 ? obs[obs.length - 1] : null;
                  const prev = obs.length > 1 ? obs[obs.length - 2] : null;
                  const signal = last ? getFredSignal(id, obs) : 'neutral';
                  const change = last && prev ? last.value - prev.value : null;
                  // Sparkline: last 6 points
                  const sparkData = obs.slice(-6).map((o, i) => ({ i, v: o.value }));
                  return (
                    <div key={id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{info.icon} {info.name}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: signal === 'positivo' ? 'var(--green)' : signal === 'negativo' ? 'var(--red)' : 'var(--text)' }}>
                            {last ? formatFredValue(id, last.value) : '—'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                            {last?.date ?? 'sin datos'}
                            {change !== null && (
                              <span style={{ marginLeft: 6, color: change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}{info.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: signal === 'positivo' ? 'rgba(34,197,94,0.15)' : signal === 'negativo' ? 'rgba(239,68,68,0.15)' : 'rgba(152,152,168,0.12)', color: signal === 'positivo' ? 'var(--green)' : signal === 'negativo' ? 'var(--red)' : 'var(--text2)' }}>
                            {signal === 'positivo' ? '▲ Alcista' : signal === 'negativo' ? '▼ Bajista' : '→ Neutral'}
                          </div>
                          {sparkData.length > 1 && (
                            <ResponsiveContainer width={70} height={28}>
                              <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                                <Line type="monotone" dataKey="v" stroke={signal === 'positivo' ? '#22c55e' : signal === 'negativo' ? '#ef4444' : '#6366f1'} strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Static fallback */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {MACRO_SIGNALS.map((s) => (
                <div key={s.name} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{s.name}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: s.estado === 'positivo' ? 'var(--green)' : s.estado === 'negativo' ? 'var(--red)' : 'var(--text)' }}>{s.valor}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.desc}</div>
                    </div>
                    <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.estado === 'positivo' ? 'rgba(34,197,94,0.15)' : s.estado === 'negativo' ? 'rgba(239,68,68,0.15)' : 'rgba(152,152,168,0.15)', color: s.estado === 'positivo' ? 'var(--green)' : s.estado === 'negativo' ? 'var(--red)' : 'var(--text2)' }}>
                      {s.estado === 'positivo' ? 'Alcista' : s.estado === 'negativo' ? 'Bajista' : 'Neutral'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FRED chart for Fed Funds + 10Y when data available */}
          {fredKey && fredData['FEDFUNDS'] && fredData['GS10'] && (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Fed Funds Rate vs Bono 10Y · últimos 12 meses</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  data={(fredData['FEDFUNDS'] ?? []).map((o, i) => ({
                    date: o.date.slice(0, 7),
                    fed: o.value,
                    gs10: (fredData['GS10'] ?? [])[i]?.value,
                  }))}>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="fed" stroke="#ef4444" strokeWidth={2} dot={false} name="Fed Funds" />
                  <Line type="monotone" dataKey="gs10" stroke="#3b82f6" strokeWidth={2} dot={false} name="Bono 10Y" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* === BACKTEST === */}
      {tab === 'backtest' && (
        <>
          {/* Index selector */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Índices de referencia</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {BENCHMARK_INDICES.map(idx => {
                const active = selectedIndices.includes(idx.symbol);
                return (
                  <button key={idx.symbol} onClick={() => setSelectedIndices(prev =>
                    active ? prev.filter(s => s !== idx.symbol) : [...prev, idx.symbol]
                  )} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? idx.color : 'var(--border)'}`, background: active ? `${idx.color}22` : 'var(--bg3)', color: active ? idx.color : 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 400 }}>
                    {idx.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['1y', '5y', '10y'] as const).map(p => (
                <button key={p} onClick={() => { setBacktestPeriod(p); setBacktestData({}); }} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: backtestPeriod === p ? 'var(--blue)' : 'var(--bg3)', color: backtestPeriod === p ? 'white' : 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: backtestPeriod === p ? 700 : 400 }}>
                  {p === '1y' ? '1 año' : p === '5y' ? '5 años' : '10 años'}
                </button>
              ))}
              <button onClick={() => { setBacktestData({}); setBacktestLoading(false); }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={11} style={{ animation: backtestLoading ? 'spin 1s linear infinite' : 'none' }} /> Actualizar
              </button>
            </div>
          </div>

          {backtestLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <div>Cargando datos de Yahoo Finance…</div>
            </div>
          ) : (
            <>
              {/* Combined chart */}
              {selectedIndices.some(s => backtestData[s]) && (() => {
                // Align data by date
                const allDates = [...new Set(selectedIndices.flatMap(s => (backtestData[s]?.points ?? []).map(p => p.date)))].sort();
                const chartData = allDates.map(date => {
                  const row: Record<string, unknown> = { date };
                  selectedIndices.forEach(s => {
                    const pt = backtestData[s]?.points.find(p => p.date === date);
                    if (pt) row[s] = pt.idx;
                  });
                  return row;
                });
                return (
                  <div className="card">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Comparativa base 100 · {backtestPeriod === '1y' ? '1 año' : backtestPeriod === '5y' ? '5 años' : '10 años'}</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 6)} />
                        <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                          formatter={(v: unknown, name: unknown) => {
                            const sym = String(name ?? '');
                            const idx = BENCHMARK_INDICES.find(b => b.symbol === sym);
                            return [`${Number(v).toFixed(1)}`, idx?.name ?? sym];
                          }} />
                        <ReferenceLine y={100} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                        {selectedIndices.map(s => {
                          const idx = BENCHMARK_INDICES.find(b => b.symbol === s);
                          if (!backtestData[s]) return null;
                          return <Line key={s} type="monotone" dataKey={s} stroke={idx?.color ?? '#6366f1'} strokeWidth={2} dot={false} name={s} />;
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {selectedIndices.filter(s => backtestData[s]).map(s => {
                        const idx = BENCHMARK_INDICES.find(b => b.symbol === s);
                        return (
                          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                            <div style={{ width: 12, height: 3, background: idx?.color ?? '#6366f1', borderRadius: 2 }} />
                            <span>{idx?.name ?? s}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Metrics per index */}
              {selectedIndices.some(s => backtestData[s]) && (
                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Métricas comparativas</div>
                  <div className="table-scroll">
                    <table className="backtest-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                          {['Índice', 'Retorno total', 'CAGR', 'Max Drawdown', 'Volatilidad', 'Sharpe'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedIndices.filter(s => backtestData[s]).map(s => {
                          const d = backtestData[s]!;
                          const idx = BENCHMARK_INDICES.find(b => b.symbol === s);
                          return (
                            <tr key={s} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}><span style={{ color: idx?.color ?? 'var(--text)' }}>{idx?.name ?? s}</span></td>
                              <td style={{ padding: '8px 10px', color: d.metrics.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>{d.metrics.totalReturn >= 0 ? '+' : ''}{d.metrics.totalReturn}%</td>
                              <td style={{ padding: '8px 10px', color: d.metrics.cagr >= 0 ? 'var(--green)' : 'var(--red)' }}>{d.metrics.cagr >= 0 ? '+' : ''}{d.metrics.cagr}%</td>
                              <td style={{ padding: '8px 10px', color: 'var(--red)' }}>{d.metrics.maxDrawdown}%</td>
                              <td style={{ padding: '8px 10px' }}>{d.metrics.volatility}%</td>
                              <td style={{ padding: '8px 10px', color: d.metrics.sharpe >= 1 ? 'var(--green)' : d.metrics.sharpe >= 0 ? 'var(--amber)' : 'var(--red)' }}>{d.metrics.sharpe}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedIndices.every(s => !backtestData[s]) && !backtestLoading && (
                <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
                  Selecciona al menos un índice para comparar datos reales de Yahoo Finance.
                </div>
              )}
            </>
          )}
        </>
      )}
      {/* === FISCALIDAD === */}
      {tab === 'fiscalidad' && (() => {
        // P&L calculations per position (using correct price for fondos)
        const posicionesConPnl = posiciones.map(p => {
          const precio = getPriceOf(p) || 0;
          const pnlBruto = p.tipo === 'Fondo Indexado'
            ? p.acciones * precio - p.acciones * p.precioMedio
            : toEur((precio - p.precioMedio) * p.acciones, p.divisa);
          const impuesto = calcIRPF(Math.max(pnlBruto, 0));
          return { ...p, precio, pnlBruto, impuesto, pnlNeto: pnlBruto - impuesto };
        });
        const totalPlusvalias = posicionesConPnl.filter(p => p.pnlBruto > 0).reduce((s, p) => s + p.pnlBruto, 0);
        const totalMinusvalias = posicionesConPnl.filter(p => p.pnlBruto < 0).reduce((s, p) => s + p.pnlBruto, 0);
        const baseImponible = Math.max(totalPlusvalias + totalMinusvalias, 0);
        const impuestoEstimado = calcIRPF(baseImponible);

        // Dividends fiscal calculation
        const currentYear = new Date().getFullYear().toString();
        const divYear = dividendos.filter(d => d.fecha.startsWith(currentYear));
        const totalBrutoDivs = divYear.reduce((s, d) => s + (d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR), 0);
        const totalRetencionDivs = divYear.reduce((s, d) => {
          const brutoEur = d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR;
          return s + brutoEur * (d.retencion / 100);
        }, 0);
        const totalNetoDivs = totalBrutoDivs - totalRetencionDivs;
        const impuestoDivs = calcIRPF(totalBrutoDivs);
        const diferenciaDivs = impuestoDivs - totalRetencionDivs;

        const lossHarvest = posicionesConPnl.filter(p => p.pnlBruto < -500);

        return (
          <>
            {/* Resumen fiscal anual */}
            <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42' }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Resumen fiscal {new Date().getFullYear()} · Base: tramos IRPF (19/21/23%)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                <div><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Plusvalías latentes</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{fmtEur(totalPlusvalias)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Minusvalías latentes</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(totalMinusvalias)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Base imponible neta</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtEur(baseImponible)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Impuesto estimado</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--amber)' }}>{fmtEur(impuestoEstimado)}</div></div>
              </div>
            </div>

            {/* Plus/minusvalías por posición */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Plus/minusvalías por posición (latentes)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {posicionesConPnl.map((p, i) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, padding: '10px 0', borderBottom: i < posicionesConPnl.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--blue)' }}>{p.simbolo.slice(0,2)}</div>
                      <span style={{ fontWeight: 600 }}>{p.simbolo}</span>
                    </div>
                    <span style={{ fontSize: 13, color: p.pnlBruto >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {p.pnlBruto >= 0 ? '+' : ''}{fmtEur(p.pnlBruto)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--amber)' }}>
                      {p.pnlBruto > 0 ? `IRPF: ${fmtEur(p.impuesto)}` : 'Sin impuesto'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {p.pnlBruto > 0 ? `Neto: ${fmtEur(p.pnlNeto)}` : `Compensa: ${fmtEur(Math.abs(p.pnlBruto))}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dividendos */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Dividendos {new Date().getFullYear()} · Retención en origen</div>
              {divYear.length === 0 ? (
                <p style={{ color: 'var(--text2)', fontSize: 14 }}>No hay dividendos registrados este año</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Bruto total</div><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green)' }}>{fmtEur(totalBrutoDivs)}</div></div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Retención origen</div><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--red)' }}>{fmtEur(totalRetencionDivs)}</div></div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Neto recibido</div><div style={{ fontWeight: 700, fontSize: 16 }}>{fmtEur(totalNetoDivs)}</div></div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>A regularizar</div><div style={{ fontWeight: 700, fontSize: 16, color: diferenciaDivs > 0 ? 'var(--red)' : 'var(--green)' }}>{diferenciaDivs > 0 ? '+' : ''}{fmtEur(diferenciaDivs)}</div></div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                    💡 Si la retención en origen supera el IRPF español (19%), puedes solicitar la diferencia como deducción en la declaración.
                  </div>
                </>
              )}
            </div>

            {/* Loss harvesting */}
            {lossHarvest.length > 0 && (
              <div className="card" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--amber)' }}>💡 Oportunidades de tax-loss harvesting</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                  Estas posiciones tienen minusvalías latentes significativas. Venderlas antes de fin de año permitiría compensar plusvalías y reducir la base imponible.
                </div>
                {lossHarvest.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600 }}>{p.simbolo} — {p.nombre}</span>
                    <span style={{ color: 'var(--red)', fontWeight: 600 }}>{fmtEur(p.pnlBruto)}</span>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 10 }}>
                  Potencial ahorro fiscal: {fmtEur(calcIRPF(Math.abs(lossHarvest.reduce((s, p) => s + p.pnlBruto, 0))))}
                </div>
              </div>
            )}

            {/* Fiscalidad Inmobiliaria */}
            {inmuebles.length > 0 && (() => {
              const inmueblesRenta = inmuebles.filter(i => i.generaRenta && i.rentaMensualBruta > 0);
              const totalRentaAnual = inmueblesRenta.reduce((s, i) => s + i.rentaMensualBruta * 12, 0);
              const totalGastosAnual = inmueblesRenta.reduce((s, i) => s + (i.gastosIbiMes + i.gastosComunidad + i.gastosSeguro + i.gastosMantenimiento + i.gastosOtros) * 12, 0);
              const rendimientoNeto = totalRentaAnual - totalGastosAnual;
              const reduccion60 = rendimientoNeto * 0.6;
              const baseIRPFAlquiler = rendimientoNeto - reduccion60;
              const impuestoAlquiler = calcIRPF(Math.max(baseIRPFAlquiler, 0));

              const inmueblesConPlusvalia = inmuebles.map(i => {
                const plusvalia = i.valorActual - i.precioCompra;
                const impuestoPlusv = plusvalia > 0 ? calcIRPF(plusvalia) : 0;
                return { ...i, plusvalia, impuestoPlusv };
              });

              return (
                <div className="card" style={{ border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 18 }}>🏠</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Fiscalidad Inmobiliaria</span>
                  </div>

                  {inmueblesRenta.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--amber)' }}>Rendimientos del capital inmobiliario (arrendamiento)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Renta bruta anual</div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)' }}>{fmtEur(totalRentaAnual)}</div>
                        </div>
                        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Gastos deducibles</div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--red)' }}>-{fmtEur(totalGastosAnual)}</div>
                        </div>
                        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Reducción 60% (habitual)</div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--blue)' }}>-{fmtEur(reduccion60)}</div>
                        </div>
                        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>IRPF estimado</div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--amber)' }}>{fmtEur(impuestoAlquiler)}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 16 }}>
                        💡 La reducción del 60% se aplica a viviendas habituales arrendadas. Verifica con tu asesor si aplica a cada inmueble.
                      </div>
                    </>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Plusvalía fiscal (si vendes)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {inmueblesConPlusvalia.map(i => (
                      <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8, fontSize: 13, alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{i.nombre}</span>
                        <span style={{ color: 'var(--text2)', fontSize: 12 }}>Compra: {fmtEur(i.precioCompra)}</span>
                        <span style={{ color: i.plusvalia >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {i.plusvalia >= 0 ? '+' : ''}{fmtEur(i.plusvalia)}
                        </span>
                        <span style={{ color: 'var(--amber)', fontSize: 12 }}>
                          {i.plusvalia > 0 ? `IRPF: ${fmtEur(i.impuestoPlusv)}` : 'Sin plusvalía'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Planes de Ahorro — Fiscalidad */}
            {planesAhorro.length > 0 && (() => {
              const now = new Date();
              const currentYear = now.getFullYear();
              const ppPlanes = planesAhorro.filter(p => p.tipo === 'Plan de Pensiones' || p.tipo === 'PPA');
              const piasPlanes = planesAhorro.filter(p => p.tipo === 'PIAS');
              const ppAportadoEstimado = ppPlanes.reduce((s, p) => {
                const startYear = parseInt(p.fechaInicio.slice(0, 4));
                const startMonth = startYear === currentYear ? parseInt(p.fechaInicio.slice(5, 7)) - 1 : 0;
                const months = now.getMonth() - startMonth + 1;
                return s + p.aportacionMensual * Math.max(0, months);
              }, 0);
              const maxDeduccion = 1500;
              const restanteDeduccion = Math.max(0, maxDeduccion - ppAportadoEstimado);
              const tipoMarginalEstimado = 0.19; // conservative
              const ahorroFiscalEstimado = Math.min(ppAportadoEstimado, maxDeduccion) * tipoMarginalEstimado;
              return (
                <div className="card">
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Fiscalidad — Planes de Ahorro</div>
                  {ppPlanes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      <div style={{ background: 'rgba(30,64,175,0.08)', border: '1px solid rgba(30,64,175,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', marginBottom: 8 }}>🏦 Planes de Pensiones / PPA · Deducción IRPF {currentYear}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Aportado este año (est.)</div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{ppAportadoEstimado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Deducción disponible</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: restanteDeduccion > 0 ? 'var(--green)' : 'var(--text2)' }}>
                              {restanteDeduccion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text2)' }}>de {maxDeduccion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} máx.</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Ahorro fiscal est. (19%)</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
                              {ahorroFiscalEstimado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min((ppAportadoEstimado / maxDeduccion) * 100, 100)}%`, background: '#3b82f6', borderRadius: 3 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>
                            <span>0€</span>
                            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{ppAportadoEstimado.toFixed(0)}€ aportado</span>
                            <span>{maxDeduccion}€ máx.</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
                          ⚠️ Aportación estimada según pagos mensuales. El rescate tributa como rendimientos del trabajo (tarifa general IRPF).
                        </div>
                      </div>
                    </div>
                  )}
                  {piasPlanes.length > 0 && (
                    <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginBottom: 8 }}>🛡️ PIAS · Ventaja fiscal al rescate</div>
                      {piasPlanes.map(p => {
                        const años = ((Date.now() - new Date(p.fechaInicio).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);
                        const cumpleCondicion = parseFloat(años) >= 5;
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6, fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <span style={{ color: 'var(--text2)' }}>{años} años</span>
                              <span style={{ fontSize: 10, background: cumpleCondicion ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: cumpleCondicion ? 'var(--green)' : 'var(--amber)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                                {cumpleCondicion ? '✅ Exención posible' : `⏳ ${(5 - parseFloat(años)).toFixed(1)} años restantes`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
                        Si el PIAS se mantiene +5 años y se rescata como renta vitalicia, los rendimientos pueden quedar exentos de IRPF.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* IRPF brackets reference */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tramos IRPF base del ahorro 2024</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { tramo: 'Hasta 6.000 €', tipo: '19%', desc: 'Primer tramo' },
                  { tramo: '6.000 – 50.000 €', tipo: '21%', desc: 'Segundo tramo' },
                  { tramo: 'Más de 200.000 €', tipo: '23%', desc: 'Tercer tramo' },
                ].map(t => (
                  <div key={t.tramo} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', marginBottom: 4 }}>{t.tipo}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{t.desc}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{t.tramo}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
