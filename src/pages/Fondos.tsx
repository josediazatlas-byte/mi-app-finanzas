import { useState, useEffect } from 'react';
import { Search, Clock, TrendingUp, AlertCircle, Loader2, X, Shield, BarChart2, BookOpen, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { useConfigStore } from '../stores/useConfigStore';

// ─── ISINs de ejemplo ────────────────────────────────────────────────────────
const ISINS_EJEMPLO = [
  { isin: 'LU1681041538', nombre: 'Fidelity Index World Fund A-EUR', gestora: 'Fidelity' },
  { isin: 'IE00B3RBWM25', nombre: 'Vanguard FTSE All-World UCITS ETF', gestora: 'Vanguard' },
  { isin: 'LU0996177134', nombre: 'Amundi IS MSCI World', gestora: 'Amundi' },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Rentabilidades {
  '1m': number; '3m': number; '6m': number;
  ytd: number; '1a': number; '3a': number; '5a': number;
}

interface FondoData {
  isin: string;
  nombre: string;
  gestora: string;
  categoria: string;
  divisa: string;
  ter: number;
  patrimonio: string;
  fechaLanzamiento: string;
  descripcion: string;
  politicaDividendos: string;
  benchmark: string;
  estrellasMorningstar: number;
  rentabilidades: Rentabilidades;
  rentabilidadesBenchmark: Rentabilidades;
  riesgo: {
    volatilidad: number;
    sharpe: number;
    alpha: number;
    beta: number;
    maxDrawdown: number;
  };
  historico: Array<{ año: string; vl: number }>;
  alternativas: Array<{ nombre: string; isin: string; ter: number; gestora: string }>;
  advertencia?: string;
}

// ─── Persistencia ─────────────────────────────────────────────────────────────
const HISTORY_KEY = 'fondos-history';
const CACHE_TTL = 86_400_000; // 24h

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(isin: string) {
  const h = getHistory().filter(i => i !== isin);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([isin, ...h].slice(0, 10)));
}
function getCached(isin: string): FondoData | null {
  try {
    const raw = localStorage.getItem(`fondo-${isin}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function setCached(isin: string, data: FondoData) {
  localStorage.setItem(`fondo-${isin}`, JSON.stringify({ data, ts: Date.now() }));
}

// ─── Llamada a Claude ─────────────────────────────────────────────────────────
async function analyzeFondo(isin: string, apiKey: string): Promise<FondoData> {
  const prompt = `Analiza el fondo de inversión con ISIN ${isin}. Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional, sin markdown, solo JSON):

{
  "isin": "${isin}",
  "nombre": "nombre completo del fondo",
  "gestora": "nombre de la gestora",
  "categoria": "categoría Morningstar (ej: Renta Variable Global)",
  "divisa": "EUR o USD",
  "ter": 0.00,
  "patrimonio": "importe con unidad (ej: 2.500M EUR)",
  "fechaLanzamiento": "YYYY-MM-DD o año",
  "descripcion": "descripción breve de la estrategia (1-2 frases)",
  "politicaDividendos": "Acumulación o Distribución",
  "benchmark": "índice de referencia (ej: MSCI World NR EUR)",
  "estrellasMorningstar": 4,
  "rentabilidades": {"1m": 0.0, "3m": 0.0, "6m": 0.0, "ytd": 0.0, "1a": 0.0, "3a": 0.0, "5a": 0.0},
  "rentabilidadesBenchmark": {"1m": 0.0, "3m": 0.0, "6m": 0.0, "ytd": 0.0, "1a": 0.0, "3a": 0.0, "5a": 0.0},
  "riesgo": {"volatilidad": 0.0, "sharpe": 0.0, "alpha": 0.0, "beta": 0.0, "maxDrawdown": 0.0},
  "historico": [{"año": "2020", "vl": 100}, {"año": "2021", "vl": 120}, {"año": "2022", "vl": 105}, {"año": "2023", "vl": 135}, {"año": "2024", "vl": 150}],
  "alternativas": [
    {"nombre": "nombre fondo alternativo", "isin": "ISIN", "ter": 0.00, "gestora": "gestora"}
  ],
  "advertencia": "si no tienes datos precisos, indica aquí que son estimados a fecha de entrenamiento"
}

Usa datos reales si los conoces. Las rentabilidades son en % (ej: 5.2 para 5.2%). El historico es el VL normalizado a base 100 en 2020. Incluye 2-3 alternativas con menor TER.`;

  const resp = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      payload: {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: 'Eres un experto en fondos de inversión europeos. Respondes ÚNICAMENTE con JSON válido, sin texto adicional.',
        messages: [{ role: 'user', content: prompt }],
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `HTTP ${resp.status}`);
  }

  const raw = await resp.json();
  const text: string = raw.content?.[0]?.text ?? '';

  // Extraer JSON de la respuesta
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Respuesta de Claude no contiene JSON válido');
  return JSON.parse(jsonMatch[0]) as FondoData;
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────
function colorPct(v: number) {
  return v > 0 ? 'var(--green, #22c55e)' : v < 0 ? 'var(--red, #ef4444)' : 'var(--text2)';
}
function fmtPct(v: number) {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}
function Estrellas({ n }: { n: number }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: 18, letterSpacing: 2 }}>
      {'★'.repeat(Math.max(0, Math.min(5, n)))}{'☆'.repeat(5 - Math.max(0, Math.min(5, n)))}
    </span>
  );
}

const PERIODOS: Array<{ key: keyof Rentabilidades; label: string }> = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1a', label: '1A' },
  { key: '3a', label: '3A' },
  { key: '5a', label: '5A' },
];

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Fondos() {
  const { anthropicKey } = useConfigStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fondo, setFondo] = useState<FondoData | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => { setHistory(getHistory()); }, []);

  async function analyze(isin: string) {
    const clean = isin.trim().toUpperCase();
    if (!clean) return;
    if (!anthropicKey) { setError('Configura tu API Key de Anthropic en Ajustes para usar esta funcionalidad.'); return; }

    setError('');
    setInput(clean);

    const cached = getCached(clean);
    if (cached) {
      setFondo(cached);
      saveHistory(clean);
      setHistory(getHistory());
      return;
    }

    setLoading(true);
    setFondo(null);
    try {
      const data = await analyzeFondo(clean, anthropicKey);
      setCached(clean, data);
      setFondo(data);
      saveHistory(clean);
      setHistory(getHistory());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  function clearFondo() { setFondo(null); setInput(''); setError(''); }

  const rentChart = fondo ? PERIODOS.map(p => ({
    periodo: p.label,
    Fondo: fondo.rentabilidades[p.key],
    Benchmark: fondo.rentabilidadesBenchmark[p.key],
  })) : [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={24} color="var(--blue, #3b82f6)" />
          Análisis de Fondos
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Introduce un ISIN para obtener ficha completa, rentabilidades y métricas de riesgo
        </p>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          style={{ flex: 1, fontSize: 15, fontFamily: 'monospace', textTransform: 'uppercase' }}
          placeholder="ISIN — ej: LU1681041538"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && analyze(input)}
          disabled={loading}
        />
        <button
          className="btn-primary"
          onClick={() => analyze(input)}
          disabled={loading || !input.trim()}
          style={{ minWidth: 110, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {loading
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analizando…</>
            : <><Search size={15} /> Analizar</>}
        </button>
        {fondo && (
          <button className="btn-secondary" onClick={clearFondo} style={{ padding: '0 12px' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ISINs ejemplo + historial */}
      {!fondo && !loading && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
          {/* Ejemplos */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} /> FONDOS DE EJEMPLO
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ISINS_EJEMPLO.map(f => (
                <button
                  key={f.isin}
                  onClick={() => analyze(f.isin)}
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue, #3b82f6)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--blue, #3b82f6)', marginBottom: 2 }}>{f.isin}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{f.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{f.gestora}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Historial */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> ANALIZADOS RECIENTEMENTE
            </div>
            {history.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: 13, margin: 0 }}>Aún no hay historial.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {history.map(isin => (
                  <button
                    key={isin}
                    onClick={() => analyze(isin)}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue, #3b82f6)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text)' }}>{isin}</span>
                    <RefreshCw size={12} color="var(--text2)" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0', color: 'var(--text2)' }}>
          <Loader2 size={36} color="var(--blue, #3b82f6)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--text)' }}>Analizando fondo…</p>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>Claude está consultando datos del fondo</p>
          </div>
        </div>
      )}

      {/* ── INFORME COMPLETO ── */}
      {fondo && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Advertencia si datos estimados */}
          {fondo.advertencia && (
            <div style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, padding: '10px 14px', color: '#f59e0b', fontSize: 12, display: 'flex', gap: 8 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>Nota:</strong> {fondo.advertencia}</span>
            </div>
          )}

          {/* ── Ficha básica ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4, fontFamily: 'monospace' }}>{fondo.isin}</div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{fondo.nombre}</h2>
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text2)' }}>
                  {fondo.gestora} · {fondo.categoria}
                </div>
                <div style={{ marginTop: 8 }}><Estrellas n={fondo.estrellasMorningstar} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label="TER" value={`${fondo.ter.toFixed(2)}%`} color="#3b82f6" />
                <Chip label="Divisa" value={fondo.divisa} color="#a78bfa" />
                <Chip label={fondo.politicaDividendos} value="" color="#22c55e" />
              </div>
            </div>

            <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{fondo.descripcion}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
              <InfoItem label="Benchmark" value={fondo.benchmark} />
              <InfoItem label="Patrimonio" value={fondo.patrimonio} />
              <InfoItem label="Lanzamiento" value={fondo.fechaLanzamiento} />
            </div>
          </div>

          {/* ── Rentabilidades ── */}
          <div className="card" style={{ padding: 20 }}>
            <SectionTitle icon={<TrendingUp size={15} />} title="Rentabilidades" subtitle="Fondo vs Benchmark" />

            {/* Tabla */}
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text2)', fontWeight: 500 }}>Periodo</th>
                    {PERIODOS.map(p => (
                      <th key={p.key} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text2)', fontWeight: 500 }}>{p.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 600 }}>Fondo</td>
                    {PERIODOS.map(p => (
                      <td key={p.key} style={{ padding: '8px 10px', textAlign: 'right', color: colorPct(fondo.rentabilidades[p.key]), fontWeight: 600 }}>
                        {fmtPct(fondo.rentabilidades[p.key])}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>Benchmark</td>
                    {PERIODOS.map(p => (
                      <td key={p.key} style={{ padding: '8px 10px', textAlign: 'right', color: colorPct(fondo.rentabilidadesBenchmark[p.key]) }}>
                        {fmtPct(fondo.rentabilidadesBenchmark[p.key])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gráfico de barras */}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rentChart} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`]} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Fondo" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Benchmark" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Histórico VL ── */}
          <div className="card" style={{ padding: 20 }}>
            <SectionTitle icon={<BarChart2 size={15} />} title="Evolución histórica" subtitle="Valor liquidativo (base 100)" />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={fondo.historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="año" tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="vl" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Métricas de riesgo ── */}
          <div className="card" style={{ padding: 20 }}>
            <SectionTitle icon={<Shield size={15} />} title="Métricas de riesgo" subtitle="A 3 años" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
              <RiesgoItem label="Volatilidad" value={`${fondo.riesgo.volatilidad.toFixed(1)}%`} />
              <RiesgoItem label="Ratio Sharpe" value={fondo.riesgo.sharpe.toFixed(2)} />
              <RiesgoItem label="Alpha" value={fmtPct(fondo.riesgo.alpha)} color={colorPct(fondo.riesgo.alpha)} />
              <RiesgoItem label="Beta" value={fondo.riesgo.beta.toFixed(2)} />
              <RiesgoItem label="Máx. Drawdown" value={fmtPct(fondo.riesgo.maxDrawdown)} color="#ef4444" />
            </div>
          </div>

          {/* ── Alternativas más baratas ── */}
          {fondo.alternativas?.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <SectionTitle icon={<Search size={15} />} title="Alternativas más baratas" subtitle={`Similar estrategia, menor TER que ${fondo.ter.toFixed(2)}%`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {fondo.alternativas.map((alt, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{alt.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace' }}>{alt.isin} · {alt.gestora}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{alt.ter.toFixed(2)}% TER</div>
                      <div style={{ fontSize: 11, color: '#22c55e' }}>
                        {fondo.ter > alt.ter ? `-${(fondo.ter - alt.ter).toFixed(2)}%` : ''}
                      </div>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => analyze(alt.isin)}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >
                      Analizar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────
function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 20, padding: '4px 10px', fontSize: 12, color, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}>
      {label}{value ? `: ${value}` : ''}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ color: 'var(--blue, #3b82f6)' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function RiesgoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}
