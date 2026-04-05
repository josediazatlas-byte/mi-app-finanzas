import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useInversionesStore } from '../stores/useInversionesStore';
import { useMercadoStore } from '../stores/useMercadoStore';
import { useDividendosStore } from '../stores/useDividendosStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import { useConfigStore } from '../stores/useConfigStore';
import { getQuote, MOCK_TICKERS } from '../services/alphaVantage';
import { cgGetPrices, symbolToId, isCryptoSymbol } from '../services/coinGecko';
import { getCompanyProfile, getKeyMetrics, getRatings, getPriceTarget, type CompanyProfile, type KeyMetrics, type Rating, type PriceTarget } from '../services/financialModelingPrep';
import { fmtEur, toEur, USD_TO_EUR } from '../utils/format';
import { calcScoreCartera } from '../utils/scoreCartera';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

const BACKTEST_DATA = [
  { mes: 'Ene', cartera: 100, sp500: 100 },
  { mes: 'Feb', cartera: 103, sp500: 101 },
  { mes: 'Mar', cartera: 101, sp500: 103 },
  { mes: 'Abr', cartera: 107, sp500: 105 },
  { mes: 'May', cartera: 110, sp500: 107 },
  { mes: 'Jun', cartera: 108, sp500: 109 },
  { mes: 'Jul', cartera: 115, sp500: 111 },
  { mes: 'Ago', cartera: 118, sp500: 113 },
  { mes: 'Sep', cartera: 114, sp500: 110 },
  { mes: 'Oct', cartera: 120, sp500: 115 },
  { mes: 'Nov', cartera: 125, sp500: 118 },
  { mes: 'Dic', cartera: 128, sp500: 120 },
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
  const { fmpKey } = useConfigStore();
  const [tab, setTab] = useState<'empresas' | 'macro' | 'backtest' | 'fiscalidad'>('empresas');
  const [refreshing, setRefreshing] = useState(false);
  const [fmpData, setFmpData] = useState<Record<string, FMPData>>({});
  const [expandedFmp, setExpandedFmp] = useState<Record<string, boolean>>({});
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
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4 }}>Señales macroeconómicas</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Indicadores de mercado actualizados para contextualizar tu cartera.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {MACRO_SIGNALS.map((s) => (
              <div key={s.name} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{s.name}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.estado === 'positivo' ? 'var(--green)' : s.estado === 'negativo' ? 'var(--red)' : 'var(--text)' }}>
                      {s.valor}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.desc}</div>
                  </div>
                  <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: s.estado === 'positivo' ? 'rgba(34,197,94,0.15)' : s.estado === 'negativo' ? 'rgba(239,68,68,0.15)' : 'rgba(152,152,168,0.15)', color: s.estado === 'positivo' ? 'var(--green)' : s.estado === 'negativo' ? 'var(--red)' : 'var(--text2)' }}>
                    {s.estado === 'positivo' ? 'Alcista' : s.estado === 'negativo' ? 'Bajista' : 'Neutral'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Análisis de contexto</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { titulo: 'Política monetaria', texto: 'La Fed mantiene tipos altos para controlar la inflación. Favorece bonos pero penaliza valuaciones de crecimiento.', icono: '🏦' },
                { titulo: 'Mercado de renta variable', texto: 'Los índices americanos muestran fortaleza YTD. El Nasdaq lidera gracias al rally de IA y tecnología.', icono: '📈' },
                { titulo: 'Divisas', texto: 'El USD se mantiene fuerte frente al EUR. Tus posiciones en USD tienen exposición cambiaria favorable.', icono: '💱' },
              ].map(item => (
                <div key={item.titulo} style={{ display: 'flex', gap: 14, padding: '14px', background: 'var(--bg3)', borderRadius: 10 }}>
                  <span style={{ fontSize: 24 }}>{item.icono}</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{item.titulo}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{item.texto}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* === BACKTEST === */}
      {tab === 'backtest' && (
        <>
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Retorno cartera (1Y)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>+28.0%</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Retorno S&P500 (1Y)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>+20.0%</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Alpha</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>+8.0%</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Evolución vs S&P500 (base 100)</div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={BACKTEST_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCartera" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }} labelStyle={{ color: 'var(--text)' }} />
                <Area type="monotone" dataKey="cartera" stroke="#3b82f6" strokeWidth={2} fill="url(#colorCartera)" name="Mi Cartera" />
                <Area type="monotone" dataKey="sp500" stroke="#22c55e" strokeWidth={2} fill="url(#colorSP)" name="S&P500" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <div style={{ width: 12, height: 3, background: '#3b82f6', borderRadius: 2 }} />
                Mi Cartera
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <div style={{ width: 12, height: 3, background: '#22c55e', borderRadius: 2 }} />
                S&P500
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Métricas de riesgo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {[
                { label: 'Volatilidad anual', value: '18.4%', desc: 'Desviación estándar retornos' },
                { label: 'Sharpe Ratio', value: '1.52', desc: 'Retorno ajustado por riesgo' },
                { label: 'Max Drawdown', value: '-8.2%', desc: 'Caída máxima desde pico' },
                { label: 'Beta vs S&P', value: '1.08', desc: 'Sensibilidad al mercado' },
                { label: 'Correlación S&P', value: '0.78', desc: 'Diversificación relativa' },
                { label: 'Días positivos', value: '58%', desc: 'Días con retorno positivo' },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
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
