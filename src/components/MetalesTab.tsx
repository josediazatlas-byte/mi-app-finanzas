import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Pencil, Trash2, X, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import {
  useMetalesPreciososStore,
  METAL_INFO,
  FALLBACK_PRICES,
  TROY_OZ_PER_GRAM,
  type MetalPrecioso,
  type MetalSimbolo,
  type MetalFormato,
  type MetalUnidad,
  type MetalUbicacion,
} from '../stores/useMetalesPreciososStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useMercadoStore } from '../stores/useMercadoStore';
import { fetchMetalPrices } from '../services/metalsService';
import { fmtEur } from '../utils/format';

const USD_EUR_FALLBACK = 0.92;

const FORMATOS: MetalFormato[] = ['Lingote', 'Moneda', 'ETF físico', 'Certificado'];
const UBICACIONES: MetalUbicacion[] = ['Caja fuerte', 'Banco', 'Bróker', 'Casa', 'Otro'];
const METALS: MetalSimbolo[] = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU'];

function getUsdEur(): number {
  const rates = useMercadoStore.getState().exchangeRates;
  return rates?.USD_EUR ?? USD_EUR_FALLBACK;
}

// Convert display value to troy oz
function toOz(cantidad: number, unidad: MetalUnidad): number {
  return unidad === 'g' ? cantidad * TROY_OZ_PER_GRAM : cantidad;
}

// ─── Modal Añadir / Editar ─────────────────────────────────────────────────
interface ModalMetalProps {
  posicion?: MetalPrecioso;
  onClose: () => void;
}
function ModalMetal({ posicion, onClose }: ModalMetalProps) {
  const { addPosicion, updatePosicion } = useMetalesPreciososStore();
  const isEdit = !!posicion;

  const [metal, setMetal] = useState<MetalSimbolo>(posicion?.metal ?? 'XAU');
  const [formato, setFormato] = useState<MetalFormato>(posicion?.formato ?? 'Lingote');
  const [unidad, setUnidad] = useState<MetalUnidad>(posicion?.unidad ?? 'oz');
  const [cantidadDisplay, setCantidadDisplay] = useState(posicion?.cantidadDisplay?.toString() ?? '');
  const [precioCompra, setPrecioCompra] = useState(posicion?.precioCompra?.toString() ?? '');
  const [fechaCompra, setFechaCompra] = useState(posicion?.fechaCompra ?? new Date().toISOString().slice(0, 10));
  const [ubicacion, setUbicacion] = useState<MetalUbicacion>(posicion?.ubicacion ?? 'Caja fuerte');
  const [notas, setNotas] = useState(posicion?.notas ?? '');

  const info = METAL_INFO[metal];
  const cantidadNum = parseFloat(cantidadDisplay) || 0;
  const ozAmount = toOz(cantidadNum, unidad);
  const gramEquiv = (ozAmount / TROY_OZ_PER_GRAM).toFixed(2);
  const ozEquiv = ozAmount.toFixed(4);

  const handleSave = () => {
    if (!cantidadDisplay || parseFloat(cantidadDisplay) <= 0) {
      toast.error('La cantidad debe ser mayor que 0');
      return;
    }
    if (!precioCompra || parseFloat(precioCompra) <= 0) {
      toast.error('El precio de compra es obligatorio');
      return;
    }
    const currentPrices = useMetalesPreciososStore.getState().precios;
    const precioActual = (currentPrices[metal] ?? FALLBACK_PRICES[metal]);

    const data: Omit<MetalPrecioso, 'id'> = {
      metal,
      nombre: info.nombre,
      formato,
      cantidad: ozAmount,
      unidad,
      cantidadDisplay: cantidadNum,
      precioCompra: parseFloat(precioCompra),
      precioActual,
      fechaCompra,
      ubicacion,
      notas,
    };

    if (isEdit && posicion) {
      updatePosicion(posicion.id, data);
      toast.success('Posición actualizada');
    } else {
      addPosicion(data);
      toast.success('Metal añadido');
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Añadir'} Metal Precioso</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Metal selector */}
          <div>
            <label className="label">Metal</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
              {METALS.map(m => {
                const mi = METAL_INFO[m];
                const sel = metal === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMetal(m)}
                    style={{
                      border: `2px solid ${sel ? mi.color : 'var(--border)'}`,
                      borderRadius: 10, padding: '10px 4px',
                      background: sel ? `${mi.color}18` : 'var(--bg3)',
                      cursor: 'pointer', display: 'flex',
                      flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 150ms ease',
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: mi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: m === 'XAU' ? '#7B6000' : m === 'XAG' ? '#555' : '#333' }}>
                      {m.slice(1)}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: sel ? mi.color : 'var(--text2)' }}>{mi.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formato + Ubicación */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Formato</label>
              <select className="select" value={formato} onChange={e => setFormato(e.target.value as MetalFormato)}>
                {FORMATOS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ubicación</label>
              <select className="select" value={ubicacion} onChange={e => setUbicacion(e.target.value as MetalUbicacion)}>
                {UBICACIONES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Cantidad + Unidad */}
          <div>
            <label className="label">Cantidad</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                className="input"
                type="number" min="0" step="0.001"
                value={cantidadDisplay}
                onChange={e => setCantidadDisplay(e.target.value)}
                placeholder="0.00"
                style={{ flex: 1 }}
              />
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                {(['oz', 'g'] as MetalUnidad[]).map(u => (
                  <button key={u} onClick={() => setUnidad(u)} style={{ padding: '0 14px', background: unidad === u ? 'var(--blue)' : 'var(--bg3)', color: unidad === u ? 'white' : 'var(--text2)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 150ms' }}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {cantidadNum > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                ≈ {ozEquiv} oz troy · {gramEquiv} g
              </div>
            )}
          </div>

          {/* Precio compra + Fecha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Precio compra (USD/oz)</label>
              <input className="input" type="number" min="0" step="0.01" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Fecha de compra</label>
              <input className="input" type="date" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)} />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="label">Notas (opcional)</label>
            <input className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: Moneda Krugerrand, Barra 100g..." />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave}>
              {isEdit ? 'Guardar cambios' : 'Añadir metal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de posición ──────────────────────────────────────────────────────
interface PosicionRowProps {
  pos: MetalPrecioso;
  precioActual: number;
  usdEur: number;
  valorTotal: number;
  onEdit: () => void;
  onDelete: () => void;
}
function PosicionRow({ pos, precioActual, usdEur, valorTotal, onEdit, onDelete }: PosicionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Array<{ date: string; close: number }>>([]);
  const [histPeriod, setHistPeriod] = useState<'1mo' | '3mo' | '1y'>('3mo');
  const [loadingHist, setLoadingHist] = useState(false);

  const info = METAL_INFO[pos.metal];
  const valorUsd = precioActual * pos.cantidad;
  const valorEur = valorUsd * usdEur;
  const costeEur = pos.precioCompra * pos.cantidad * usdEur;
  const pnlEur = valorEur - costeEur;
  const pnlPct = costeEur > 0 ? (pnlEur / costeEur) * 100 : 0;
  const peso = valorTotal > 0 ? (valorEur / valorTotal) * 100 : 0;

  const displayCantidad = pos.unidad === 'g'
    ? `${pos.cantidadDisplay.toFixed(2)} g`
    : `${pos.cantidadDisplay.toFixed(4)} oz`;

  const loadHistory = useCallback(async (period: '1mo' | '3mo' | '1y') => {
    setLoadingHist(true);
    try {
      const { fetchMetalHistory } = await import('../services/metalsService');
      const data = await fetchMetalHistory(pos.metal, period);
      setHistory(data);
    } catch { /* ignore */ }
    setLoadingHist(false);
  }, [pos.metal]);

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && history.length === 0) await loadHistory(histPeriod);
  };

  const handlePeriodChange = async (p: '1mo' | '3mo' | '1y') => {
    setHistPeriod(p);
    await loadHistory(p);
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Main row */}
      <div className="pos-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
        {/* Metal icon */}
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${info.color}22`, border: `2px solid ${info.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: info.color, flexShrink: 0 }}>
          {pos.metal.slice(1)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: info.color }}>{info.nombre}</span>
            <span style={{ fontSize: 10, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, padding: '1px 6px', color: 'var(--text2)', fontWeight: 600 }}>{pos.formato}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            {displayCantidad} · {pos.ubicacion} · {pos.fechaCompra}
          </div>
        </div>

        {/* Precio actual */}
        <div className="pos-row-price" style={{ textAlign: 'right', minWidth: 90 }}>
          <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            ${precioActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            compra: ${pos.precioCompra.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Valor total */}
        <div className="pos-row-pnl" style={{ textAlign: 'right', minWidth: 100 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(valorEur)}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{peso.toFixed(1)}%</div>
        </div>

        {/* PnL */}
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div className={`pnl-value ${pnlEur >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: 13 }}>
            {pnlEur >= 0 ? '+' : ''}{fmtEur(pnlEur)}
          </div>
          <div className={`pnl-value ${pnlPct >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: 11 }}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
          </div>
        </div>

        {/* Actions */}
        <div className="pos-row-actions" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn-icon" style={{ padding: 5 }} title="Historial" onClick={handleExpand}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button className="btn-icon" style={{ padding: 5 }} title="Editar" onClick={onEdit}><Pencil size={13} /></button>
          <button className="btn-icon" style={{ padding: 5 }} title="Eliminar" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Expanded: historical chart */}
      {expanded && (
        <div style={{ padding: '0 20px 16px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['1mo', '3mo', '1y'] as const).map(p => (
              <button key={p} onClick={() => handlePeriodChange(p)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: histPeriod === p ? 'var(--blue)' : 'var(--bg3)', color: histPeriod === p ? 'white' : 'var(--text2)', fontSize: 11, cursor: 'pointer', fontWeight: histPeriod === p ? 600 : 400 }}>
                {p === '1mo' ? '1M' : p === '3mo' ? '3M' : '1A'}
              </button>
            ))}
            {loadingHist && <RefreshCw size={12} style={{ marginLeft: 6, animation: 'spin 1s linear infinite', color: 'var(--text2)', alignSelf: 'center' }} />}
          </div>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`grad-${pos.metal}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={info.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={info.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text2)' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text2)' }} width={55} tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}/oz`, info.nombre]}
                  labelFormatter={l => `Fecha: ${l}`}
                />
                <Area type="monotone" dataKey="close" stroke={info.color} strokeWidth={2} fill={`url(#grad-${pos.metal})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : !loadingHist ? (
            <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', padding: '20px 0' }}>
              Sin datos históricos disponibles
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── MetalesTab principal ──────────────────────────────────────────────────
export default function MetalesTab() {
  const { posiciones, precios, setPrecios, removePosicion, updatePosicion } = useMetalesPreciososStore();
  const { metalsApiKey } = useConfigStore();
  const [showModal, setShowModal] = useState(false);
  const [editPos, setEditPos] = useState<MetalPrecioso | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const usdEur = getUsdEur();

  // Get live price for a metal (prefers fetched, falls back to stored, then constant)
  const getPrice = (metal: MetalSimbolo): number =>
    precios[metal] ?? FALLBACK_PRICES[metal];

  // Total values
  const valorTotal = posiciones.reduce((s, p) => s + getPrice(p.metal) * p.cantidad * usdEur, 0);
  const costeTotal = posiciones.reduce((s, p) => s + p.precioCompra * p.cantidad * usdEur, 0);
  const pnlTotal = valorTotal - costeTotal;
  const pnlPct = costeTotal > 0 ? (pnlTotal / costeTotal) * 100 : 0;

  // Best performer
  const bestMetal = posiciones.length > 0
    ? posiciones.reduce((best, p) => {
        const pct = p.precioCompra > 0 ? ((getPrice(p.metal) - p.precioCompra) / p.precioCompra) * 100 : 0;
        const bPct = best.precioCompra > 0 ? ((getPrice(best.metal) - best.precioCompra) / best.precioCompra) * 100 : 0;
        return pct > bPct ? p : best;
      })
    : null;

  const fetchPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      const prices = await fetchMetalPrices(metalsApiKey || undefined);
      setPrecios(prices);
      // Update precioActual on each posicion
      posiciones.forEach(p => {
        const nuevo = prices[p.metal];
        if (nuevo) updatePosicion(p.id, { precioActual: nuevo });
      });
      setLastUpdated(new Date());
    } catch {
      toast.error('Error al actualizar precios');
    }
    setRefreshing(false);
  }, [metalsApiKey, posiciones, setPrecios, updatePosicion]);

  // Auto-fetch on mount if prices are stale (>15 min)
  useEffect(() => {
    const stale = Date.now() - (precios.updatedAt ?? 0) > 15 * 60 * 1000;
    if (stale) fetchPrices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const minutesAgoStr = (d: Date) => {
    const m = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (m < 1) return 'hace un momento';
    if (m === 1) return 'hace 1 minuto';
    return `hace ${m} minutos`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary */}
      {posiciones.length > 0 && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #1a1608 0%, #161618 100%)', border: '1px solid rgba(255,215,0,0.2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            <div>
              <div className="metric-label">Valor total</div>
              <div className="metric-value">{fmtEur(valorTotal)}</div>
            </div>
            <div>
              <div className="metric-label">Total invertido</div>
              <div className="metric-value">{fmtEur(costeTotal)}</div>
            </div>
            <div>
              <div className="metric-label">PnL total</div>
              <div className="metric-value" style={{ color: pnlTotal >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {pnlTotal >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {pnlTotal >= 0 ? '+' : ''}{fmtEur(pnlTotal)}
                <span style={{ fontSize: 13, fontWeight: 500 }}>({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
              </div>
            </div>
            <div>
              <div className="metric-label">Mejor rendimiento</div>
              {bestMetal ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: METAL_INFO[bestMetal.metal].color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: METAL_INFO[bestMetal.metal].color }}>
                      {METAL_INFO[bestMetal.metal].nombre}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--green)' }}>
                      +{bestMetal.precioCompra > 0 ? (((getPrice(bestMetal.metal) - bestMetal.precioCompra) / bestMetal.precioCompra) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              ) : <div style={{ fontSize: 13, color: 'var(--text2)' }}>—</div>}
            </div>
          </div>

          {/* Bar chart distribution */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {METALS.filter(m => posiciones.some(p => p.metal === m)).map(m => {
              const v = posiciones.filter(p => p.metal === m).reduce((s, p) => s + getPrice(p.metal) * p.cantidad * usdEur, 0);
              const pct = valorTotal > 0 ? (v / valorTotal) * 100 : 0;
              return (
                <div key={m} style={{ flex: 1, minWidth: 60 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>
                    <span style={{ color: METAL_INFO[m].color, fontWeight: 700 }}>{METAL_INFO[m].nombre}</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: METAL_INFO[m].color, borderRadius: 2, transition: 'width 600ms ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <button className="btn-icon" onClick={fetchPrices} disabled={refreshing} title="Actualizar precios">
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {lastUpdated && (
            <span style={{ fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{minutesAgoStr(lastUpdated)}</span>
          )}
        </div>
        <button className="btn-primary" style={{ gap: 6 }} onClick={() => { setEditPos(null); setShowModal(true); }}>
          <Plus size={14} /> Añadir metal
        </button>
      </div>

      {/* Precio spot actual */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        {METALS.map(m => {
          const info = METAL_INFO[m];
          const price = getPrice(m);
          return (
            <div key={m} style={{ background: 'var(--bg2)', border: `1px solid ${info.color}30`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: info.color, margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: m === 'XAU' ? '#7B6000' : m === 'XAG' ? '#555' : '#333' }}>
                {m.slice(1)}
              </div>
              <div style={{ fontSize: 10, color: info.color, fontWeight: 700 }}>{info.nombre}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text2)' }}>USD/{m === 'XCU' ? 'lb' : 'oz'}</div>
            </div>
          );
        })}
      </div>

      {/* Positions list */}
      {posiciones.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🥇</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sin posiciones en metales preciosos</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
            Añade oro, plata, platino o paladio a tu cartera.
          </div>
          <button className="btn-primary" style={{ margin: '0 auto', gap: 6 }} onClick={() => setShowModal(true)}>
            <Plus size={14} /> Añadir primer metal
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {posiciones.map(p => (
            <PosicionRow
              key={p.id}
              pos={p}
              precioActual={getPrice(p.metal)}
              usdEur={usdEur}
              valorTotal={valorTotal}
              onEdit={() => { setEditPos(p); setShowModal(true); }}
              onDelete={() => { if (window.confirm(`¿Eliminar ${METAL_INFO[p.metal].nombre}?`)) removePosicion(p.id); }}
            />
          ))}
        </div>
      )}

      {/* No API key notice */}
      {!metalsApiKey && (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Precios via Yahoo Finance.</span>
          Añade tu API Key de metals-api.com en Ajustes → APIs para máxima precisión (50 req/mes gratuitos).
        </div>
      )}

      {showModal && <ModalMetal posicion={editPos ?? undefined} onClose={() => { setShowModal(false); setEditPos(null); }} />}
    </div>
  );
}
