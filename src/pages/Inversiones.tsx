import { useState, useEffect } from 'react';
import { Plus, RefreshCw, TrendingUp, TrendingDown, Pencil, X, Trash2, Bot } from 'lucide-react';
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
import ModalAddPosicion from '../components/ModalAddPosicion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
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

export default function Inversiones() {
  const { posiciones, removePosicion, pesosObjetivo, updatePesoObjetivo } = useInversionesStore();
  const { dividendos, removeDividendo } = useDividendosStore();
  const { precios, setPrice } = useMercadoStore();
  const [tab, setTab] = useState<'cartera' | 'seguimiento' | 'rebalanceo' | 'dividendos'>('cartera');
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

  useEffect(() => {
    const interval = setInterval(() => forceTickUpdate(n => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const getPrice = (p: Posicion): number => {
    if (p.tipo === 'Fondo Indexado') return p.vl ?? p.precioMedio ?? 0;
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

  // Score: avg of individual pnl pcts, capped 0–100
  const scores = posiciones.map(p => {
    const curr = getPrice(p);
    return ((curr - p.precioMedio) / p.precioMedio) * 100;
  });
  const avgScore = posiciones.length > 0
    ? Math.min(100, Math.max(0, 50 + scores.reduce((a, b) => a + b, 0) / scores.length))
    : 0;

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
      const prompt = 'Analiza mi cartera de inversiones en detalle. Evalúa: diversificación, concentración de riesgo, rendimiento de cada posición, y dame 3 recomendaciones concretas de mejora.';
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
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
        {(['cartera', 'seguimiento', 'rebalanceo', 'dividendos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: tab === t ? 'var(--blue)' : 'none', color: tab === t ? 'white' : 'var(--text2)', transition: 'all .2s', textTransform: 'capitalize' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
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
                <div style={{ fontSize: 20, fontWeight: 700, color: pnlEur >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {pnlEur >= 0 ? '+' : ''}{fmtEur(pnlEur)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>P&L %</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {(pnlPct ?? 0) >= 0 ? '+' : ''}{Number(pnlPct ?? 0).toFixed(2)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Invertido</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(costeTotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Score</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: avgScore >= 60 ? 'var(--green)' : avgScore >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                  {Number(avgScore ?? 0).toFixed(0)}/100
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {TIPOS.map(t => (
                <button key={t} onClick={() => setSubTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: subTab === t ? 'var(--blue)' : 'var(--bg2)', color: subTab === t ? 'white' : 'var(--text2)', fontSize: 13, cursor: 'pointer', fontWeight: subTab === t ? 600 : 400 }}>
                  {t} <span style={{ opacity: .7 }}>({byTipo(t).length})</span>
                </button>
              ))}
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
            <button className="btn-secondary" style={{ gap: 6, padding: '6px 12px', fontSize: 13 }} onClick={analyzeWithAI} disabled={aiLoading} title="Analizar cartera con IA">
              <Bot size={14} style={{ color: '#a78bfa' }} /> Analizar con IA
            </button>
            <button className="btn-primary" style={{ gap: 6 }} onClick={() => setShowModal(true)}>
              <Plus size={14} /> Añadir
            </button>
          </div>

          {/* Positions list */}
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
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < byTipo(subTab).length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
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
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontWeight: 600 }}>{fmtEur(valorPos)}</div>
                      <div style={{ fontSize: 12, color: pnlPos >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {pnlPos >= 0 ? '+' : ''}{fmtEur(pnlPos)} ({(pnlPosP ?? 0) >= 0 ? '+' : ''}{Number(pnlPosP ?? 0).toFixed(1)}%)
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 2 }}>
                      {p.tipo === 'Fondo Indexado' && (
                        <button className="btn-icon" style={{ padding: '4px 7px', fontSize: 10, fontWeight: 700, color: 'var(--blue)' }} title="Actualizar VL" onClick={() => setVlModal(p)}>
                          VL
                        </button>
                      )}
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

      {showModal && <ModalAddPosicion onClose={() => setShowModal(false)} />}
      {vlModal && <ModalActualizarVL posicion={vlModal} onClose={() => setVlModal(null)} />}
      {editPosicion && <ModalEditPosicion posicion={editPosicion} onClose={() => setEditPosicion(null)} />}
      {showDivModal && <ModalDividendo posiciones={posiciones} onClose={() => setShowDivModal(false)} />}
      {editDiv && <ModalDividendo dividendo={editDiv} posiciones={posiciones} onClose={() => setEditDiv(null)} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
