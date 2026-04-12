import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, TrendingUp, TrendingDown, Pencil, X, Trash2, Bot, BarChart2 } from 'lucide-react';
import PlanesAhorroTab from '../components/PlanesAhorroTab';
import MetalesTab from '../components/MetalesTab';
import { usePlanesAhorroStore } from '../stores/usePlanesAhorroStore';
import { useMetalesPreciososStore } from '../stores/useMetalesPreciososStore';
import { useInversionesStore } from '../stores/useInversionesStore';
import type { Posicion } from '../stores/useInversionesStore';
import { useDividendosStore } from '../stores/useDividendosStore';
import type { Dividendo } from '../stores/useDividendosStore';
import toast from 'react-hot-toast';
import { useMercadoStore } from '../stores/useMercadoStore';
import { useConfigStore } from '../stores/useConfigStore';
import { getQuote, MOCK_TICKERS } from '../services/alphaVantage';
import { cgGetPrices, symbolToId, isCryptoSymbol } from '../services/coinGecko';
import { callClaudeAPI, buildFinancialContext, SYSTEM_PROMPT } from '../utils/aiContext';
import { fmtEur, toEur, USD_TO_EUR } from '../utils/format';
import { calcScoreCartera } from '../utils/scoreCartera';
import type { ScoreBreakdown } from '../utils/scoreCartera';
import ModalAddPosicion from '../components/ModalAddPosicion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { getRatings, getPriceTarget, getStockNews, getFearAndGreed } from '../services/financialModelingPrep';
import type { NewsItem } from '../services/financialModelingPrep';

const TIPOS = ['Empresa', 'ETF', 'Materia Prima', 'Crypto', 'Fondo Indexado'] as const;
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a78bfa', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

function ModalEditPosicion({ posicion, onClose }: { posicion: Posicion; onClose: () => void }) {
  const { updatePosicion } = useInversionesStore();
  const [acciones, setAcciones] = useState(posicion.acciones);
  const [precioMedio, setPrecioMedio] = useState(posicion.precioMedio);
  const [notas, setNotas] = useState(posicion.notas ?? '');

  const handleSubmit = () => {
    if (acciones <= 0 || precioMedio <= 0) { toast.error('Acciones y precio deben ser mayores que 0'); return; }
    updatePosicion(posicion.id, { acciones, precioMedio, notas });
    toast.success('Posición actualizada');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Editar {posicion.simbolo}</h2>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{posicion.nombre}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nº de acciones</label>
              <input className="input" type="number" min="0" step="0.001" value={acciones || ''} onChange={(e) => setAcciones(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Precio medio ({posicion.divisa})</label>
              <input className="input" type="number" min="0" step="0.01" value={precioMedio || ''} onChange={(e) => setPrecioMedio(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas sobre esta posición..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>Actualizar posición</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Modal Dividendo ———
function ModalDividendo({ dividendo, posiciones, onClose }: { dividendo?: Dividendo; posiciones: Posicion[]; onClose: () => void }) {
  const { addDividendo, updateDividendo } = useDividendosStore();
  const isEdit = !!dividendo;
  const [form, setForm] = useState({
    simbolo: dividendo?.simbolo ?? (posiciones[0]?.simbolo ?? ''),
    fecha: dividendo?.fecha ?? new Date().toISOString().slice(0, 10),
    importeBruto: dividendo?.importeBruto ?? 0,
    retencion: dividendo?.retencion ?? 15,
    divisa: (dividendo?.divisa ?? 'USD') as Dividendo['divisa'],
  });
  const neto = form.importeBruto * (1 - form.retencion / 100);
  const handleSubmit = () => {
    if (!form.simbolo || form.importeBruto <= 0) { toast.error('Completa todos los campos'); return; }
    if (isEdit) { updateDividendo(dividendo!.id, form); toast.success('Dividendo actualizado'); }
    else { addDividendo(form); toast.success('Dividendo registrado 💰'); }
    onClose();
  };
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Registrar'} dividendo</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Empresa / Ticker</label>
            <select className="select" value={form.simbolo} onChange={(e) => setForm({ ...form, simbolo: e.target.value })}>
              {posiciones.map(p => <option key={p.id} value={p.simbolo}>{p.simbolo} — {p.nombre}</option>)}
              <option value="">Otro</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Fecha cobro</label>
              <input className="input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div>
              <label className="label">Divisa</label>
              <select className="select" value={form.divisa} onChange={(e) => setForm({ ...form, divisa: e.target.value as Dividendo['divisa'] })}>
                <option>USD</option><option>EUR</option><option>GBP</option>
              </select>
            </div>
            <div>
              <label className="label">Importe bruto ({form.divisa})</label>
              <input className="input" type="number" min={0} step={0.01} value={form.importeBruto || ''} onChange={(e) => setForm({ ...form, importeBruto: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Retención en origen (%)</label>
              <input className="input" type="number" min={0} max={100} step={1} value={form.retencion || ''} onChange={(e) => setForm({ ...form, retencion: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Neto estimado</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{neto.toFixed(2)} {form.divisa}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>{isEdit ? 'Actualizar' : 'Registrar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalActualizarVL({ posicion, onClose }: { posicion: Posicion; onClose: () => void }) {
  const { updatePosicion } = useInversionesStore();
  const [vl, setVl] = useState(posicion.vl ?? posicion.precioMedio);
  const [vlFecha, setVlFecha] = useState(posicion.vlFecha ?? new Date().toISOString().slice(0, 10));

  const handleSubmit = () => {
    if (vl <= 0) { toast.error('El VL debe ser mayor que 0'); return; }
    updatePosicion(posicion.id, { vl, vlFecha });
    toast.success('Valor liquidativo actualizado');
    onClose();
  };

  const pnlPct = posicion.precioMedio > 0 ? ((vl - posicion.precioMedio) / posicion.precioMedio) * 100 : 0;
  const totalInvertido = posicion.acciones * posicion.precioMedio;
  const valorActual = posicion.acciones * vl;
  const pnlEur = valorActual - totalInvertido;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Actualizar VL</h2>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{posicion.nombre}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Valor liquidativo (€)</label>
              <input className="input" type="number" min="0" step="0.0001" value={vl || ''} onChange={(e) => setVl(parseFloat(e.target.value) || 0)} autoFocus />
            </div>
            <div>
              <label className="label">Fecha del VL</label>
              <input className="input" type="date" value={vlFecha} onChange={(e) => setVlFecha(e.target.value)} />
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>Invertido</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtEur(totalInvertido)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>Valor actual</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtEur(valorActual)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>P&L</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: pnlEur >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pnlEur >= 0 ? '+' : ''}{fmtEur(pnlEur)}<br />
                <span style={{ fontSize: 11, fontWeight: 400 }}>({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>Guardar VL</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Score helpers ────────────────────────────────────────────────────────────
// calcScoreCartera and ScoreBreakdown imported from ../utils/scoreCartera

function getRecomendacion(pnlPct: number, peso: number): 'COMPRAR' | 'MANTENER' | 'VENDER' {
  if (pnlPct > 25 || peso > 33) return 'VENDER';
  if (pnlPct < -5 && peso < 20) return 'COMPRAR';
  return 'MANTENER';
}

// ——— Modal Score General ———
const AI_CACHE_KEY = 'score_ai_analysis';
const AI_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

function getFngColor(val: number): string {
  if (val <= 25) return '#ef4444';
  if (val <= 45) return '#f97316';
  if (val <= 55) return '#f59e0b';
  if (val <= 75) return '#84cc16';
  return '#22c55e';
}

function getFngLabel(val: number): string {
  if (val <= 25) return 'Miedo extremo';
  if (val <= 45) return 'Miedo';
  if (val <= 55) return 'Neutral';
  if (val <= 75) return 'Codicia';
  return 'Codicia extrema';
}

function ModalScoreGeneral({ scoreData, posiciones, getPrice, valorTotal, onClose, onIAClick }: {
  scoreData: ScoreBreakdown;
  posiciones: Posicion[];
  getPrice: (p: Posicion) => number;
  valorTotal: number;
  onClose: () => void;
  onIAClick: () => void;
}) {
  const { anthropicKey, fmpKey } = useConfigStore();
  const score = scoreData.total;

  // Fear & Greed
  const [fng, setFng] = useState<{ value: number; classification: string } | null>(null);

  // Analyst data per symbol
  interface AnalystData { rating: string; rec: string; targetConsensus: number; targetHigh: number; targetLow: number; }
  const [analysts, setAnalysts] = useState<Record<string, AnalystData>>({});

  // News per symbol
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(false);

  // AI
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCacheTs, setAiCacheTs] = useState(0);

  useEffect(() => {
    // Load cached AI
    try {
      const cached = sessionStorage.getItem(AI_CACHE_KEY);
      if (cached) {
        const { text, ts } = JSON.parse(cached);
        if (Date.now() - ts < AI_CACHE_TTL) { setAiText(text); setAiCacheTs(ts); }
      }
    } catch { /* ignore */ }

    // Fetch market data
    const fetchMarket = async () => {
      setLoadingMarket(true);
      try {
        // Fear & Greed
        const fngData = await getFearAndGreed();
        if (fngData) setFng({ value: parseInt(fngData.value), classification: fngData.value_classification });

        // Analyst data for non-crypto, non-fund positions
        if (fmpKey) {
          const tradeable = posiciones.filter(p => p.tipo !== 'Fondo Indexado' && p.tipo !== 'Crypto');
          const analystMap: Record<string, AnalystData> = {};
          await Promise.all(tradeable.map(async (p) => {
            const [rat, pt] = await Promise.all([getRatings(p.simbolo), getPriceTarget(p.simbolo)]);
            if (rat || pt) {
              analystMap[p.simbolo] = {
                rating: rat?.rating ?? '-',
                rec: rat?.ratingRecommendation ?? '-',
                targetConsensus: pt?.targetConsensus ?? 0,
                targetHigh: pt?.targetHigh ?? 0,
                targetLow: pt?.targetLow ?? 0,
              };
            }
          }));
          setAnalysts(analystMap);

          // News (all tickers in one call)
          if (tradeable.length > 0) {
            const symbols = tradeable.map(p => p.simbolo);
            const newsItems = await getStockNews(symbols);
            setNews(newsItems);
          }
        }
      } catch { /* ignore */ } finally { setLoadingMarket(false); }
    };
    fetchMarket();
  }, []);

  const rangeInfo = score <= 30 ? { label: 'Cartera de alto riesgo', sub: 'Concentración elevada', color: 'var(--red)' }
    : score <= 50 ? { label: 'Cartera mejorable', sub: 'Diversificación limitada', color: 'var(--amber)' }
    : score <= 70 ? { label: 'Cartera sólida', sub: 'Buena base con margen de mejora', color: 'var(--blue)' }
    : score <= 85 ? { label: 'Cartera muy buena', sub: 'Bien diversificada', color: 'var(--green)' }
    : { label: 'Cartera excelente', sub: 'Diversificación óptima', color: 'var(--green)' };

  const factors = [
    { label: 'Diversificación sector', obtenido: scoreData.diversificacionSector, maximo: 30, mejora: 'Añade posiciones en más sectores' },
    { label: 'Tipos de activo', obtenido: scoreData.diversificacionTipo, maximo: 25, mejora: 'Combina Empresas, ETFs y Fondos' },
    { label: 'Concentración máxima', obtenido: scoreData.concentracionMaxima, maximo: 20, mejora: 'Ninguna posición > 15% cartera' },
    { label: 'Calidad fundamental', obtenido: scoreData.calidadFundamental, maximo: 15, mejora: 'Revisa posiciones con pérdidas' },
    { label: 'Liquidez', obtenido: scoreData.liquidez, maximo: 10, mejora: 'Incluye ETFs o Fondos Indexados' },
  ];

  // Radar data (normalized 0-100)
  const radarData = factors.map(f => ({
    factor: f.label.split(' ')[0],
    value: Math.round((f.obtenido / f.maximo) * 100),
    fullMark: 100,
  }));

  const buildAIPrompt = () => {
    const posResumen = posiciones.map(p => {
      const precio = getPrice(p);
      const valor = toEur(precio * p.acciones, p.divisa);
      const peso = valorTotal > 0 ? (valor / valorTotal * 100).toFixed(1) : '0';
      const pnl = p.precioMedio > 0 ? ((precio - p.precioMedio) / p.precioMedio * 100).toFixed(1) : '0';
      const analyst = analysts[p.simbolo];
      const analystInfo = analyst ? ` | Analistas: ${analyst.rec} | Objetivo: $${analyst.targetConsensus}` : '';
      return `- ${p.simbolo} (${p.tipo}): ${peso}% cartera, PnL ${pnl}%${analystInfo}`;
    }).join('\n');

    const newsResumen = news.slice(0, 6).map(n => `- [${n.symbol}] ${n.title} (${n.publishedDate?.slice(0, 10)})`).join('\n');

    const fngInfo = fng ? `Fear & Greed Index: ${fng.value}/100 (${fng.classification})` : 'Fear & Greed: no disponible';

    return `Eres un analista financiero experto. Analiza esta cartera y proporciona recomendaciones específicas y accionables:

CARTERA ACTUAL (${posiciones.length} posiciones):
${posResumen}

SCORE ACTUAL: ${score}/100 (${rangeInfo.label})
Desglose: Diversificación sector ${scoreData.diversificacionSector}/30, Tipos ${scoreData.diversificacionTipo}/25, Concentración ${scoreData.concentracionMaxima}/20, Calidad ${scoreData.calidadFundamental}/15, Liquidez ${scoreData.liquidez}/10

DATOS DE MERCADO HOY:
${fngInfo}

NOTICIAS RECIENTES:
${newsResumen || 'Sin noticias disponibles'}

Por favor proporciona (en español, de forma directa y sin rodeos):
1. Los 3 factores que más penalizan el score actual con datos concretos
2. Top 3 acciones concretas para mejorar el score esta semana
3. Si hay alertas basadas en noticias recientes, menciónalas
4. Una posición que consideras sobreponderada y por qué
5. Un tipo de activo o sector no representado que complementaría la cartera`;
  };

  const askAI = async (force = false) => {
    if (!anthropicKey) return;
    if (!force && aiText) return;
    setAiLoading(true);
    try {
      const prompt = buildAIPrompt();
      const res = await callClaudeAPI([{ role: 'user', content: prompt }], SYSTEM_PROMPT, anthropicKey);
      setAiText(res);
      const ts = Date.now();
      setAiCacheTs(ts);
      try { sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify({ text: res, ts })); } catch { /* ignore */ }
    } catch { /* ignore */ } finally { setAiLoading(false); }
  };

  const fngVal = fng?.value ?? 0;
  const fngColor = fng ? getFngColor(fngVal) : 'var(--text2)';
  const fngLbl = fng ? getFngLabel(fngVal) : '';

  const analystSymbols = Object.keys(analysts);
  const cacheAge = aiCacheTs > 0 ? Math.floor((Date.now() - aiCacheTs) / 60_000) : 0;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Score de cartera: {score}/100</h2>
            <div style={{ fontSize: 13, color: rangeInfo.color, fontWeight: 600, marginTop: 2 }}>{rangeInfo.label}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Score + Radar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Left: score bar */}
            <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: rangeInfo.color, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>de 100 puntos</div>
              <div style={{ background: 'var(--bg2)', borderRadius: 6, height: 6, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${score}%`, background: rangeInfo.color, borderRadius: 6 }} />
              </div>
              {factors.map(f => {
                const pct = f.obtenido / f.maximo;
                const col = pct >= 0.8 ? 'var(--green)' : pct >= 0.5 ? 'var(--amber)' : 'var(--red)';
                return (
                  <div key={f.label} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: 'var(--text2)' }}>{f.label}</span>
                      <span style={{ color: col, fontWeight: 600 }}>{f.obtenido}/{f.maximo}</span>
                    </div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 3, height: 3 }}>
                      <div style={{ height: '100%', width: `${pct * 100}%`, background: col, borderRadius: 3 }} />
                    </div>
                    {f.obtenido < f.maximo && <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>💡 {f.mejora}</div>}
                  </div>
                );
              })}
            </div>
            {/* Right: Radar */}
            <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textAlign: 'center' }}>Perfil de la cartera</div>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart data={radarData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="factor" tick={{ fill: 'var(--text2)', fontSize: 10 }} />
                  <Radar name="Score" dataKey="value" stroke={rangeInfo.color} fill={rangeInfo.color} fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fear & Greed */}
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Sentimiento del mercado
            </div>
            {loadingMarket && !fng ? (
              <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Cargando...
              </div>
            ) : fng ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: fngColor, lineHeight: 1 }}>{fngVal}</div>
                  <div style={{ fontSize: 12, color: fngColor, fontWeight: 600 }}>{fngLbl}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
                    {[['#ef4444', 25], ['#f97316', 20], ['#f59e0b', 10], ['#84cc16', 20], ['#22c55e', 25]].map(([c, w], i) => (
                      <div key={i} style={{ flex: w as number, background: c as string, opacity: 0.7 }} />
                    ))}
                  </div>
                  <div style={{ position: 'relative', height: 6 }}>
                    <div style={{ position: 'absolute', left: `${fngVal}%`, transform: 'translateX(-50%)', width: 2, height: 6, background: fngColor, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text2)', marginTop: 4 }}>
                    <span>Miedo extremo</span><span>Neutral</span><span>Codicia extrema</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
                    {fngVal <= 30 ? '📌 Históricamente, miedo extremo = oportunidad de compra' :
                     fngVal >= 75 ? '📌 Codicia extrema — precaución, mercado puede estar sobrecomprado' :
                     '📌 Sentimiento neutro — mercado sin señales extremas'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>No disponible</div>
            )}
          </div>

          {/* Analyst consensus */}
          {analystSymbols.length > 0 && (
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Consenso de analistas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analystSymbols.map(sym => {
                  const a = analysts[sym];
                  const recColor = a.rec.toLowerCase().includes('buy') || a.rec.toLowerCase().includes('strong') ? 'var(--green)' :
                    a.rec.toLowerCase().includes('sell') ? 'var(--red)' : 'var(--amber)';
                  return (
                    <div key={sym} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', gap: 8, alignItems: 'center', fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{sym}</span>
                      <span style={{ color: recColor, fontWeight: 600 }}>{a.rec || '-'}</span>
                      <span style={{ color: 'var(--text2)' }}>Obj. ${a.targetConsensus > 0 ? a.targetConsensus.toFixed(0) : '-'}</span>
                      <span style={{ color: 'var(--text2)', fontSize: 10 }}>${a.targetLow > 0 ? a.targetLow.toFixed(0) : '-'} – ${a.targetHigh > 0 ? a.targetHigh.toFixed(0) : '-'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* News alerts */}
          {news.length > 0 && (
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Alertas de mercado recientes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {news.slice(0, 5).map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.2)', color: 'var(--blue)', padding: '1px 5px', borderRadius: 3, fontWeight: 700, flexShrink: 0, height: 'fit-content' }}>{n.symbol}</span>
                    <div>
                      <div style={{ lineHeight: 1.4 }}>{n.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>{n.site} · {n.publishedDate?.slice(0, 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {anthropicKey && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '12px 14px' }}>
              {aiText ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <Bot size={14} style={{ color: '#a78bfa' }} /> Análisis IA completo
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {cacheAge > 0 && <span style={{ fontSize: 10, color: 'var(--text2)' }}>hace {cacheAge < 60 ? `${cacheAge}min` : `${Math.floor(cacheAge/60)}h`}</span>}
                      <button className="btn-icon" style={{ padding: '3px 7px', fontSize: 11 }} onClick={() => askAI(true)} disabled={aiLoading} title="Regenerar análisis">
                        <RefreshCw size={11} style={{ animation: aiLoading ? 'spin 1s linear infinite' : 'none' }} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{aiText}</div>
                </>
              ) : (
                <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }} onClick={() => askAI()} disabled={aiLoading}>
                  {aiLoading
                    ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generando análisis completo...</>
                    : <><Bot size={13} style={{ color: '#a78bfa' }} /> Análisis IA con datos reales de mercado</>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexShrink: 0 }}>
          <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cerrar</button>
          <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { onClose(); onIAClick(); }}>
            <Bot size={14} /> Mejorar score con IA
          </button>
        </div>
      </div>
    </div>
  );
}

// ——— Modal Score Posición ———
function ModalScorePosicion({ posicion, peso, pnlPct, onClose }: { posicion: Posicion; peso: number; pnlPct: number; onClose: () => void }) {
  const posScore = Math.min(100, Math.max(0, 50 + pnlPct * 0.5));
  const scoreColor = posScore >= 60 ? 'var(--green)' : posScore >= 40 ? 'var(--amber)' : 'var(--red)';
  const metrics = [
    { label: 'Rentabilidad desde compra', value: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`, color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Peso en cartera', value: `${peso.toFixed(1)}%`, color: peso > 33 ? 'var(--amber)' : 'var(--text)' },
    { label: 'Precio medio de compra', value: `${posicion.divisa === 'EUR' ? '€' : '$'}${posicion.precioMedio.toFixed(2)}`, color: 'var(--text)' },
    { label: 'Tipo de activo', value: posicion.tipo, color: 'var(--text)' },
  ];
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Score de {posicion.tipo === 'Fondo Indexado' ? posicion.nombre.slice(0, 22) : posicion.simbolo}</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{posicion.nombre}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ textAlign: 'center', padding: '18px 0', background: 'var(--bg3)', borderRadius: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 46, fontWeight: 800, color: scoreColor }}>{Math.round(posScore)}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>de 100 puntos</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{m.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>¿Qué afecta a este score?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text2)', lineHeight: 1.5 }}>
            <div>{pnlPct >= 0 ? '✅' : '⚠️'} Rentabilidad: {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}% desde el precio medio de compra</div>
            <div>{peso <= 20 ? '✅' : '⚠️'} Peso en cartera: {peso.toFixed(1)}%{peso > 33 ? ' — concentración alta, considerar reducir' : ''}</div>
            <div>{posicion.tipo === 'ETF' || posicion.tipo === 'Fondo Indexado' ? '✅' : '➡️'} {posicion.tipo}{posicion.tipo === 'ETF' || posicion.tipo === 'Fondo Indexado' ? ' — diversificación intrínseca alta' : ' — posición individual'}</div>
          </div>
        </div>
        <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

// ——— Modal Recomendación ———
function ModalRecomendacion({ posicion, peso, pnlPct, onClose }: { posicion: Posicion; peso: number; pnlPct: number; onClose: () => void }) {
  const rec = getRecomendacion(pnlPct, peso);
  const recColors: Record<string, string> = { COMPRAR: 'var(--green)', MANTENER: 'var(--blue)', VENDER: 'var(--amber)' };
  const color = recColors[rec];
  const razones: Record<string, string[]> = {
    COMPRAR: [
      `${posicion.tipo === 'Fondo Indexado' ? posicion.nombre : posicion.simbolo} cotiza ${Math.abs(pnlPct).toFixed(1)}% por debajo de tu precio medio de compra.`,
      'Si mantienes convicción en el activo, puede ser buen momento para promediar a la baja.',
      'Asegúrate de que el peso total no supere el 25-30% de tu cartera.',
    ],
    MANTENER: [
      `Rendimiento de ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% y peso equilibrado del ${peso.toFixed(1)}%.`,
      'No hay señales urgentes de acción. La posición está en rangos saludables.',
      'Revisa periódicamente si el tesis de inversión sigue siendo válido.',
    ],
    VENDER: [
      pnlPct > 25 ? `La posición acumula +${pnlPct.toFixed(1)}% de rentabilidad — beneficios significativos.` : `Representa el ${peso.toFixed(1)}% de la cartera — concentración elevada.`,
      pnlPct > 25 ? 'Considera tomar beneficios parciales y reequilibrar.' : 'Reducir esta posición mejoraría la diversificación.',
      'Una reducción parcial (25-50%) suele ser más prudente que vender toda la posición.',
    ],
  };
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Recomendación</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{posicion.tipo === 'Fondo Indexado' ? posicion.nombre : `${posicion.simbolo} · ${posicion.nombre}`}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ textAlign: 'center', padding: '16px', background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color }}>{rec}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>Basado en rentabilidad y peso en cartera</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {razones[rec].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{i === 0 ? '📊' : i === 1 ? '💡' : '⚠️'}</span>
              <span style={{ fontSize: 13, lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '7px 12px', marginBottom: 12, fontSize: 11, color: 'var(--text2)' }}>
          ⚠️ Esto no es asesoramiento financiero profesional. Consulta con un experto antes de actuar.
        </div>
        <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Entendido</button>
      </div>
    </div>
  );
}

export default function Inversiones() {
  const navigate = useNavigate();
  const { posiciones, removePosicion, pesosObjetivo, updatePesoObjetivo } = useInversionesStore();
  const { planes } = usePlanesAhorroStore();
  const { posiciones: metales } = useMetalesPreciososStore();
  const { dividendos, removeDividendo } = useDividendosStore();
  const { precios, setPrice } = useMercadoStore();
  const [tab, setTab] = useState<'cartera' | 'seguimiento' | 'rebalanceo' | 'dividendos' | 'analisis'>('cartera');
  const [subTab, setSubTab] = useState<string>('Empresa');
  const { anthropicKey } = useConfigStore();
  const [showModal, setShowModal] = useState(false);
  const [editPosicion, setEditPosicion] = useState<Posicion | null>(null);
  const [showDivModal, setShowDivModal] = useState(false);
  const [editDiv, setEditDiv] = useState<Dividendo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [vlModal, setVlModal] = useState<Posicion | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, forceTickUpdate] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showScoreGeneral, setShowScoreGeneral] = useState(false);
  const [scorePosicionModal, setScorePosicionModal] = useState<{ posicion: Posicion; peso: number; pnlPct: number } | null>(null);
  const [recModal, setRecModal] = useState<{ posicion: Posicion; peso: number; pnlPct: number } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => forceTickUpdate(n => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const getPrice = (p: Posicion): number => {
    if (p.tipo === 'Fondo Indexado') return p.vl || p.precioMedio || 0;
    const cached = precios[p.simbolo];
    const mock = MOCK_TICKERS.find(t => t.symbol === p.simbolo);
    return cached?.precio ?? mock?.price ?? p.precioMedio ?? 0;
  };
  const getChange = (p: Posicion): number => {
    if (p.tipo === 'Fondo Indexado') return 0;
    const cached = precios[p.simbolo];
    const mock = MOCK_TICKERS.find(t => t.symbol === p.simbolo);
    return cached?.variacion ?? mock?.change ?? 0;
  };

  const valorTotal = posiciones.reduce((s, p) => s + toEur(getPrice(p) * p.acciones, p.divisa), 0);
  const costeTotal = posiciones.reduce((s, p) => s + toEur(p.precioMedio * p.acciones, p.divisa), 0);
  const pnlEur = valorTotal - costeTotal;
  const pnlPct = costeTotal > 0 ? (pnlEur / costeTotal) * 100 : 0;

  const scoreCartera = calcScoreCartera(posiciones, getPrice, valorTotal);
  const avgScore = scoreCartera.total;

  const minutesAgoStr = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (mins < 1) return 'hace un momento';
    if (mins === 1) return 'hace 1 minuto';
    return `hace ${mins} minutos`;
  };

  const refresh = async () => {
    setRefreshing(true);
    let anyRateLimited = false;

    // Separate crypto and non-crypto positions
    const cryptoPos = posiciones.filter(p => p.tipo === 'Crypto' || isCryptoSymbol(p.simbolo));
    const stockPos = posiciones.filter(p => p.tipo !== 'Crypto' && !isCryptoSymbol(p.simbolo) && p.tipo !== 'Fondo Indexado');

    // Refresh stocks via Alpha Vantage
    await Promise.all(stockPos.map(async (p) => {
      const q = await getQuote(p.simbolo);
      if (q) {
        setPrice(p.simbolo, q.price, q.change);
        if (q.rateLimited) anyRateLimited = true;
      }
    }));

    // Refresh crypto via CoinGecko
    if (cryptoPos.length > 0) {
      try {
        const coinIds = cryptoPos.map(p => symbolToId(p.simbolo));
        const prices = await cgGetPrices(coinIds);
        cryptoPos.forEach(p => {
          const coinId = symbolToId(p.simbolo);
          const data = prices[coinId];
          if (data) {
            // CoinGecko returns EUR price; convert to position's divisa
            const priceInDivisa = p.divisa === 'EUR' ? data.eur : data.usd ?? data.eur / 0.92;
            setPrice(p.simbolo, priceInDivisa, data.eur_24h_change ?? 0);
          }
        });
      } catch { /* keep cached prices */ }
    }

    const now = new Date();
    setLastUpdated(now);
    setRefreshing(false);

    if (anyRateLimited) {
      const timestamps = stockPos.map(p => precios[p.simbolo]?.timestamp ?? 0).filter(t => t > 0);
      const oldest = timestamps.length > 0 ? Math.min(...timestamps) : 0;
      const hoursAgo = oldest > 0 ? Math.round((Date.now() - oldest) / 3_600_000) : 0;
      toast('Límite diario de Alpha Vantage alcanzado' + (hoursAgo > 0 ? ` — precios de hace ${hoursAgo}h` : ' — usando precios de demostración'), {
        icon: '⚠️',
        style: { background: '#f59e0b', color: '#1a1a1a' },
        duration: 5000,
      });
    } else {
      toast.success('Precios actualizados');
    }
  };

  const analyzeWithAI = async () => {
    if (!anthropicKey) { toast.error('Añade tu API key de Anthropic en Ajustes'); return; }
    setAiLoading(true);
    try {
      const ctx = buildFinancialContext();
      const prompt = `Analiza mi cartera de inversiones en profundidad. Estructura tu respuesta así:

**📊 Diversificación**
Evalúa la distribución por activo, sector y geografía. Identifica concentraciones de riesgo.

**⚖️ Comparativa por perfil de riesgo**
Compara mi cartera actual con:
- Perfil conservador (60% renta fija, 40% renta variable)
- Perfil moderado (40% RF, 60% RV diversificada)
- Perfil agresivo (100% RV, exposición a crecimiento)
¿A cuál se parece más? ¿Es coherente con mi patrimonio total?

**🔄 Rebalanceo recomendado**
¿Qué posiciones están sobrreponderadas? ¿Qué activos o sectores faltan?

**🎯 3 acciones concretas**
Pasos específicos que debería tomar esta semana/mes.`;
      const response = await callClaudeAPI(
        [{ role: 'user', content: prompt }],
        `${SYSTEM_PROMPT}\n\nCONTEXTO FINANCIERO:\n${ctx}`,
        anthropicKey
      );
      setAiAnalysis(response);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al analizar');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const byTipo = (tipo: string) => posiciones.filter(p => p.tipo === tipo);

  // Rebalanceo
  const defaultPeso = posiciones.length > 0 ? 100 / posiciones.length : 0;
  const rebalData = posiciones.map(p => ({
    name: p.simbolo,
    actual: Number(valorTotal > 0 ? (toEur(getPrice(p) * p.acciones, p.divisa) / valorTotal) * 100 : 0),
    objetivo: Number(pesosObjetivo.find(x => x.simbolo === p.simbolo)?.pesoObjetivo ?? defaultPeso),
  }));

  // Pie data
  const pieData = posiciones.map(p => ({
    name: p.simbolo,
    value: toEur(getPrice(p) * p.acciones, p.divisa),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
        {(['cartera', 'seguimiento', 'rebalanceo', 'dividendos', 'analisis'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: tab === t ? 'var(--blue)' : 'none', color: tab === t ? 'white' : 'var(--text2)', transition: 'all .2s' }}>
            {t === 'analisis' ? 'Análisis' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* AI Analysis panel */}
      {(aiAnalysis || aiLoading) && (
        <div className="card" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              <Bot size={16} style={{ color: '#a78bfa' }} /> Análisis IA de tu cartera
            </div>
            <button className="btn-icon" onClick={() => { setAiAnalysis(''); }}><X size={14} /></button>
          </div>
          {aiLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', fontSize: 13 }}>
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analizando tu cartera...
            </div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{aiAnalysis}</div>
          )}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* === CARTERA === */}
      {tab === 'cartera' && (
        <>
          {/* Summary */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Valor Total</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(valorTotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>P&L</div>
                <div className={`pnl-value ${pnlEur >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: 20 }}>
                  {pnlEur >= 0 ? '+' : ''}{fmtEur(pnlEur)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>P&L %</div>
                <div className={`pnl-value ${(pnlPct ?? 0) >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: 20 }}>
                  {(pnlPct ?? 0) >= 0 ? '+' : ''}{Number(pnlPct ?? 0).toFixed(2)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Invertido</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(costeTotal)}</div>
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => setShowScoreGeneral(true)} title="Ver desglose del score">
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Score ↗</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: avgScore >= 60 ? 'var(--green)' : avgScore >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                  {Number(avgScore ?? 0).toFixed(0)}/100
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="subtabs-container" style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
              {TIPOS.map(t => (
                <button key={t} onClick={() => setSubTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: subTab === t ? 'var(--blue)' : 'var(--bg2)', color: subTab === t ? 'white' : 'var(--text2)', fontSize: 13, cursor: 'pointer', fontWeight: subTab === t ? 600 : 400, flexShrink: 0 }}>
                  {t} <span style={{ opacity: .7 }}>({byTipo(t).length})</span>
                </button>
              ))}
              <button onClick={() => setSubTab('Planes de Ahorro')} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${subTab === 'Planes de Ahorro' ? '#1e40af' : 'var(--border)'}`, background: subTab === 'Planes de Ahorro' ? '#1e40af' : 'var(--bg2)', color: subTab === 'Planes de Ahorro' ? 'white' : 'var(--text2)', fontSize: 13, cursor: 'pointer', fontWeight: subTab === 'Planes de Ahorro' ? 600 : 400, flexShrink: 0 }}>
                Planes de Ahorro <span style={{ opacity: .7 }}>({planes.length})</span>
              </button>
              <button onClick={() => setSubTab('Metales')} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${subTab === 'Metales' ? '#FFD700' : 'var(--border)'}`, background: subTab === 'Metales' ? 'rgba(255,215,0,0.15)' : 'var(--bg2)', color: subTab === 'Metales' ? '#FFD700' : 'var(--text2)', fontSize: 13, cursor: 'pointer', fontWeight: subTab === 'Metales' ? 600 : 400, flexShrink: 0 }}>
                Metales <span style={{ opacity: .7 }}>({metales.length})</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <button className="btn-icon" onClick={refresh} disabled={refreshing} title="Actualizar precios">
                <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </button>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                  {minutesAgoStr(lastUpdated)}
                </span>
              )}
            </div>
            {subTab !== 'Planes de Ahorro' && subTab !== 'Metales' && (
              <>
                <button className="btn-secondary" style={{ gap: 6, padding: '6px 12px', fontSize: 13 }} onClick={analyzeWithAI} disabled={aiLoading} title="Analizar cartera con IA">
                  <Bot size={14} style={{ color: '#a78bfa' }} /> Analizar con IA
                </button>
                <button className="btn-primary" style={{ gap: 6 }} onClick={() => setShowModal(true)}>
                  <Plus size={14} /> Añadir
                </button>
              </>
            )}
          </div>

          {/* Planes de Ahorro tab */}
          {subTab === 'Planes de Ahorro' && <PlanesAhorroTab />}

          {/* Metales tab */}
          {subTab === 'Metales' && <MetalesTab />}

          {/* Positions list */}
          {subTab !== 'Planes de Ahorro' && subTab !== 'Metales' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {byTipo(subTab).length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>
                No tienes posiciones de tipo {subTab}. Añade una con el botón de arriba.
              </div>
            ) : (
              byTipo(subTab).map((p, i) => {
                const precio = getPrice(p) || 0;
                const cambio = getChange(p) || 0;
                const valorPos = toEur(precio * (p.acciones || 0), p.divisa) || 0;
                const pnlPos = toEur((precio - (p.precioMedio || 0)) * (p.acciones || 0), p.divisa) || 0;
                const pnlPosP = p.precioMedio ? ((precio - p.precioMedio) / p.precioMedio) * 100 : 0;
                const peso = valorTotal > 0 ? (valorPos / valorTotal) * 100 : 0;
                return (
                  <div key={p.id} className="pos-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < byTipo(subTab).length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${COLORS[i % COLORS.length]}22`, border: `1px solid ${COLORS[i % COLORS.length]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: COLORS[i % COLORS.length], flexShrink: 0 }}>
                      {p.tipo === 'Fondo Indexado' ? p.nombre.slice(0, 2).toUpperCase() : p.simbolo.slice(0, 2)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                          {p.tipo === 'Fondo Indexado' ? p.nombre.slice(0, 28) : p.simbolo}
                        </span>
                        {p.tipo === 'Fondo Indexado' ? (
                          <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 4, padding: '1px 5px', fontWeight: 600, flexShrink: 0 }}>Fondo</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                        {p.tipo === 'Fondo Indexado'
                          ? `${p.acciones} participaciones${p.isin ? ' · ' + p.isin : ''}${p.gestora ? ' · ' + p.gestora : ''} · ${Number(peso ?? 0).toFixed(1)}% cartera`
                          : `${p.acciones} acciones · ${Number(peso ?? 0).toFixed(1)}% cartera`
                        }
                      </div>
                    </div>
                    {/* Price */}
                    <div className="pos-row-price" style={{ textAlign: 'right', minWidth: 90 }}>
                      {p.tipo === 'Fondo Indexado' ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{fmtEur(precio)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)' }}>VL {p.vlFecha ?? 'sin actualizar'}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>${Number(precio ?? 0).toFixed(2)}</div>
                          <div style={{ fontSize: 12, color: (cambio ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                            {(cambio ?? 0) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {(cambio ?? 0) >= 0 ? '+' : ''}{Number(cambio ?? 0).toFixed(2)}%
                          </div>
                        </>
                      )}
                    </div>
                    {/* PnL */}
                    <div className="pos-row-pnl" style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontWeight: 600 }}>{fmtEur(valorPos)}</div>
                      <div style={{ fontSize: 12, color: pnlPos >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {pnlPos >= 0 ? '+' : ''}{fmtEur(pnlPos)} ({(pnlPosP ?? 0) >= 0 ? '+' : ''}{Number(pnlPosP ?? 0).toFixed(1)}%)
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="pos-row-actions" style={{ display: 'flex', gap: 2 }}>
                      {p.tipo === 'Fondo Indexado' && (
                        <button className="btn-icon" style={{ padding: '4px 7px', fontSize: 10, fontWeight: 700, color: 'var(--blue)' }} title="Actualizar VL" onClick={() => setVlModal(p)}>
                          VL
                        </button>
                      )}
                      <button className="btn-icon" style={{ padding: '4px 7px', fontSize: 10, fontWeight: 700, color: pnlPosP >= 0 ? 'var(--green)' : 'var(--red)' }} title="Ver score de esta posición" onClick={() => setScorePosicionModal({ posicion: p, peso, pnlPct: pnlPosP })}>
                        Score
                      </button>
                      <button className="btn-icon" style={{ padding: '4px 7px', fontSize: 10, fontWeight: 700, color: 'var(--blue)' }} title="Ver recomendación" onClick={() => setRecModal({ posicion: p, peso, pnlPct: pnlPosP })}>
                        Rec
                      </button>
                      <button className="btn-icon" style={{ padding: 6 }} title="Ver análisis detallado" onClick={() => navigate(`/analisis?symbol=${encodeURIComponent(p.simbolo)}`)}>
                        <BarChart2 size={13} />
                      </button>
                      <button className="btn-icon" style={{ padding: 6 }} title="Editar" onClick={() => setEditPosicion(p)}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn-icon" style={{ padding: 6 }} title="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar ${p.simbolo}?`)) removePosicion(p.id); }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          )}
        </>
      )}

      {/* === SEGUIMIENTO === */}
      {tab === 'seguimiento' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Seguimiento de precios</h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <button className="btn-icon" onClick={refresh} disabled={refreshing} title="Actualizar precios">
                <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </button>
              {lastUpdated && (
                <span style={{ fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                  {minutesAgoStr(lastUpdated)}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {posiciones.filter(p => p.tipo !== 'Fondo Indexado').map((p, i) => {
              const precio = getPrice(p) || 0;
              const cambio = getChange(p) || 0;
              const pnlP = p.precioMedio ? ((precio - p.precioMedio) / p.precioMedio) * 100 : 0;
              return (
                <div key={p.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${COLORS[i % COLORS.length]}22`, border: `1px solid ${COLORS[i % COLORS.length]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: COLORS[i % COLORS.length] }}>
                        {p.simbolo.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.simbolo}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{p.tipo}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>${Number(precio ?? 0).toFixed(2)}</div>
                      <div style={{ fontSize: 12, color: (cambio ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {(cambio ?? 0) >= 0 ? '+' : ''}{Number(cambio ?? 0).toFixed(2)}% hoy
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>Compra media</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>${Number(p.precioMedio ?? 0).toFixed(2)}</div>
                    </div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>Acciones</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.acciones}</div>
                    </div>
                    <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>P&L total</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: pnlP >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {(pnlP ?? 0) >= 0 ? '+' : ''}{Number(pnlP ?? 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {p.notas && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>{p.notas}</div>}
                </div>
              );
            })}
          </div>
          {posiciones.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>No tienes posiciones. Ve a Cartera para añadir.</div>
          )}
        </>
      )}

      {/* === REBALANCEO === */}
      {tab === 'rebalanceo' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Donut */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Distribución actual</div>
              {posiciones.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                        {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => fmtEur(v as number)} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {pieData.map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                        <span>{d.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>Sin posiciones</div>
              )}
            </div>

            {/* Objetivos */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Pesos objetivo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rebalData.map((d, i) => (
                  <div key={d.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                      <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)' }}>Actual: {Number(d.actual ?? 0).toFixed(1)}%</span>
                        <span style={{ color: COLORS[i % COLORS.length] }}>Obj: {Number(d.objetivo ?? 0).toFixed(1)}%</span>
                      </div>
                    </div>
                    <input
                      type="range" min={0} max={100} step={1}
                      value={d.objetivo}
                      onChange={(e) => updatePesoObjetivo(posiciones[i].simbolo, parseFloat(e.target.value))}
                      className="slider"
                      style={{ width: '100%', accentColor: COLORS[i % COLORS.length] }}
                    />
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <div style={{ height: 4, borderRadius: 2, background: COLORS[i % COLORS.length], width: `${d.actual}%`, maxWidth: '100%', transition: 'width .3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Delta table */}
          {posiciones.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Acciones de rebalanceo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {rebalData.map((d, i) => {
                  const delta = d.objetivo - d.actual;
                  const action = Math.abs(delta) < 1 ? 'OK' : delta > 0 ? 'Comprar' : 'Vender';
                  const color = action === 'OK' ? 'var(--text2)' : action === 'Comprar' ? 'var(--green)' : 'var(--red)';
                  return (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: i < rebalData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${COLORS[i % COLORS.length]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: COLORS[i % COLORS.length] }}>{d.name.slice(0, 2)}</div>
                      <span style={{ fontWeight: 600, flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{Number(d.actual ?? 0).toFixed(1)}% → {Number(d.objetivo ?? 0).toFixed(1)}%</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 60, textAlign: 'right' }}>{action}</span>
                      <span style={{ fontSize: 13, color, minWidth: 60, textAlign: 'right' }}>
                        {delta >= 0 ? '+' : ''}{Number(delta ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* === DIVIDENDOS === */}
      {tab === 'dividendos' && (() => {
        const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const totalBruto = dividendos.reduce((s, d) => s + (d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR), 0);
        const totalNeto = dividendos.reduce((s, d) => {
          const brutoEur = d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR;
          return s + brutoEur * (1 - d.retencion / 100);
        }, 0);
        const totalRetencion = totalBruto - totalNeto;

        // Por mes (bar chart)
        const porMes = Array.from({ length: 12 }, (_, i) => {
          const mes = MESES_CORTOS[i];
          const divs = dividendos.filter(d => parseInt(d.fecha.slice(5, 7)) - 1 === i);
          const neto = divs.reduce((s, d) => {
            const brutoEur = d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR;
            return s + brutoEur * (1 - d.retencion / 100);
          }, 0);
          return { mes, neto };
        });

        // Por símbolo
        const porSimb: Record<string, number> = {};
        dividendos.forEach(d => {
          const neto = (d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR) * (1 - d.retencion / 100);
          porSimb[d.simbolo] = (porSimb[d.simbolo] || 0) + neto;
        });

        // Yield estimado
        const yieldData = posiciones.map(p => {
          const precioActual = (precios[p.simbolo]?.precio ?? MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price ?? p.precioMedio) || 0;
          const valorPos = toEur(precioActual * p.acciones, p.divisa);
          const dividendosPos = dividendos.filter(d => d.simbolo === p.simbolo);
          const netoAnual = dividendosPos.reduce((s, d) => {
            const brutoEur = d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR;
            return s + brutoEur * (1 - d.retencion / 100);
          }, 0);
          const yld = valorPos > 0 ? (netoAnual / valorPos) * 100 : 0;
          return { simbolo: p.simbolo, yld, netoAnual, valorPos };
        }).filter(x => x.netoAnual > 0);

        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Bruto recibido</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{fmtEur(totalBruto)}</div></div>
              <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Neto tras retención</div><div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(totalNeto)}</div></div>
              <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Retención total</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(totalRetencion)}</div></div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Dividendos por mes (neto €)</div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [fmtEur(v as number)]} />
                  <Bar dataKey="neto" name="Neto" fill="var(--green)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {yieldData.length > 0 && (
              <div className="card">
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Yield por posición</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {yieldData.map(y => (
                    <div key={y.simbolo} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--green)' }}>{y.simbolo.slice(0,2)}</div>
                      <span style={{ fontWeight: 600, flex: 1 }}>{y.simbolo}</span>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{fmtEur(y.netoAnual)}/año</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{y.yld.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Historial de dividendos</div>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowDivModal(true)}><Plus size={14} /> Registrar</button>
              </div>
              {dividendos.length === 0 ? (
                <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: 20 }}>No hay dividendos registrados</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[...dividendos].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((d, i) => {
                    const brutoEur = d.divisa === 'EUR' ? d.importeBruto : d.importeBruto * USD_TO_EUR;
                    const netoEur = brutoEur * (1 - d.retencion / 100);
                    return (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < dividendos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--green)' }}>{d.simbolo.slice(0,2)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{d.simbolo}</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{d.fecha} · Retención {d.retencion}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, color: 'var(--green)' }}>{fmtEur(netoEur)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)' }}>bruto: {d.importeBruto.toFixed(2)} {d.divisa}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button className="btn-icon" style={{ padding: 5 }} onClick={() => setEditDiv(d)}><Pencil size={12} /></button>
                          <button className="btn-icon" style={{ padding: 5 }} onClick={() => { if (window.confirm('¿Eliminar?')) removeDividendo(d.id); }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* === ANÁLISIS RÁPIDO === */}
      {tab === 'analisis' && (
        <>
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>Score de Cartera</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: avgScore >= 60 ? 'var(--green)' : avgScore >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                  {avgScore}<span style={{ fontSize: 18, color: 'var(--text2)' }}>/100</span>
                </div>
              </div>
              <button className="btn-secondary" style={{ gap: 6 }} onClick={() => navigate('/analisis')}>
                <BarChart2 size={14} /> Análisis completo
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posiciones.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>No hay posiciones</div>
            ) : posiciones.map((p, i) => {
              const precio = getPrice(p) || 0;
              const valorPos = toEur(precio * p.acciones, p.divisa);
              const pnlPosP = p.precioMedio > 0 ? ((precio - p.precioMedio) / p.precioMedio) * 100 : 0;
              const peso = valorTotal > 0 ? (valorPos / valorTotal) * 100 : 0;
              const rec = getRecomendacion(pnlPosP, peso);
              const recColor = rec === 'COMPRAR' ? 'var(--green)' : rec === 'VENDER' ? 'var(--amber)' : 'var(--blue)';
              return (
                <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${COLORS[i % COLORS.length]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: COLORS[i % COLORS.length], flexShrink: 0 }}>
                    {p.tipo === 'Fondo Indexado' ? p.nombre.slice(0, 2).toUpperCase() : p.simbolo.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.tipo === 'Fondo Indexado' ? p.nombre.slice(0, 30) : p.simbolo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{p.tipo} · {peso.toFixed(1)}% cartera</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: pnlPosP >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 14 }}>
                      {pnlPosP >= 0 ? '+' : ''}{pnlPosP.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtEur(valorPos)}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: recColor, minWidth: 70, textAlign: 'center', background: `${recColor}18`, border: `1px solid ${recColor}44`, borderRadius: 6, padding: '3px 8px' }}>
                    {rec}
                  </div>
                  <button className="btn-icon" style={{ padding: 6 }} title="Análisis detallado" onClick={() => navigate(`/analisis?symbol=${encodeURIComponent(p.simbolo)}`)}>
                    <BarChart2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showModal && <ModalAddPosicion onClose={() => setShowModal(false)} />}
      {vlModal && <ModalActualizarVL posicion={vlModal} onClose={() => setVlModal(null)} />}
      {editPosicion && <ModalEditPosicion posicion={editPosicion} onClose={() => setEditPosicion(null)} />}
      {showDivModal && <ModalDividendo posiciones={posiciones} onClose={() => setShowDivModal(false)} />}
      {editDiv && <ModalDividendo dividendo={editDiv} posiciones={posiciones} onClose={() => setEditDiv(null)} />}
      {showScoreGeneral && <ModalScoreGeneral scoreData={scoreCartera} posiciones={posiciones} getPrice={getPrice} valorTotal={valorTotal} onClose={() => setShowScoreGeneral(false)} onIAClick={analyzeWithAI} />}
      {scorePosicionModal && <ModalScorePosicion posicion={scorePosicionModal.posicion} peso={scorePosicionModal.peso} pnlPct={scorePosicionModal.pnlPct} onClose={() => setScorePosicionModal(null)} />}
      {recModal && <ModalRecomendacion posicion={recModal.posicion} peso={recModal.peso} pnlPct={recModal.pnlPct} onClose={() => setRecModal(null)} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
