import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Search, Target, AlertTriangle, ChevronRight, Pencil, Trash2, X, Bot, RefreshCw, MessageSquare, Eye, EyeOff } from 'lucide-react';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import type { Ingreso, Gasto } from '../stores/useFinanzasStore';
import { useInversionesStore } from '../stores/useInversionesStore';
import { usePatrimonioStore } from '../stores/usePatrimonioStore';
import { useHistoricoStore } from '../stores/useHistoricoStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import { useFacturasStore } from '../stores/useFacturasStore';
import { useMetasStore } from '../stores/useMetasStore';
import type { Meta, MetaTipo } from '../stores/useMetasStore';
import { useConfigStore } from '../stores/useConfigStore';
import { fmtEur, toEur } from '../utils/format';
import { useMercadoStore } from '../stores/useMercadoStore';
import { MOCK_TICKERS } from '../services/alphaVantage';
import { buildFinancialContext, callClaudeAPI, SYSTEM_PROMPT } from '../utils/aiContext';
import { getFearAndGreed } from '../services/financialModelingPrep';
import FondoEmergenciaWidget from '../components/FondoEmergencia';
import ModalIngreso from '../components/ModalIngreso';
import ModalGasto from '../components/ModalGasto';
import ModalAddPosicion from '../components/ModalAddPosicion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const CAT_ICONS: Record<string, string> = {
  Salario: '💼', Freelance: '💻', Dividendo: '📈', Alquiler: '🏠', Otros: '💰',
  Vivienda: '🏠', Alimentación: '🛒', Transporte: '🚌', Ocio: '🎮', Salud: '❤️', Suscripciones: '📺',
};

// ——— Panel Ingresos ———
function PanelIngresos({ ingresos, titulo, onClose }: { ingresos: Ingreso[]; titulo: string; onClose: () => void }) {
  const { removeIngreso } = useFinanzasStore();
  const [editItem, setEditItem] = useState<Ingreso | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = (ing: Ingreso) => {
    if (ing.origen) { toast('Para gestionar este ingreso ve a la sección Inmobiliario o Facturas', { icon: '🏠' }); return; }
    if (window.confirm(`¿Eliminar "${ing.nombre}"?`)) removeIngreso(ing.id);
  };
  const handleEdit = (ing: Ingreso) => {
    if (ing.origen === 'inmobiliario') { toast('Para editar este ingreso ve a la sección Inmobiliario', { icon: '🏠' }); return; }
    if (ing.origen === 'factura') { toast('Para editar esta factura ve a la sección Facturas', { icon: '📄' }); return; }
    setEditItem(ing);
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ingresos</h2>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{titulo}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setShowAdd(true)}>
                <Plus size={14} /> Añadir
              </button>
              <button className="btn-icon" onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          {/* Total */}
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total {ingresos.length} ingresos</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
              {fmtEur(ingresos.reduce((s, i) => s + i.importe, 0))}
            </span>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ingresos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)', fontSize: 14 }}>
                No hay ingresos este mes.<br />
                <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> Añadir ingreso
                </button>
              </div>
            ) : (
              ingresos.map((ing) => (
                <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{CAT_ICONS[ing.categoria] ?? '💰'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ing.nombre}
                      {ing.origen === 'inmobiliario' && <span style={{ fontSize: 9, background: 'rgba(59,130,246,0.15)', color: 'var(--blue)', borderRadius: 4, padding: '1px 4px', fontWeight: 600, flexShrink: 0 }}>🏠 Auto</span>}
                      {ing.origen === 'factura' && <span style={{ fontSize: 9, background: 'rgba(168,85,247,0.15)', color: 'var(--purple)', borderRadius: 4, padding: '1px 4px', fontWeight: 600, flexShrink: 0 }}>📄 Auto</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{ing.categoria} · {ing.fecha}{ing.recurrente ? ' · 🔄' : ''}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>+{fmtEur(ing.importe)}</span>
                  <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Editar" onClick={() => handleEdit(ing)}><Pencil size={13} /></button>
                  <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Eliminar" onClick={() => handleDelete(ing)}><Trash2 size={13} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {showAdd && <ModalIngreso onClose={() => setShowAdd(false)} />}
      {editItem && <ModalIngreso ingreso={editItem} onClose={() => setEditItem(null)} />}
    </>
  );
}

// ——— Panel Gastos ———
function PanelGastos({ gastos, titulo, onClose }: { gastos: Gasto[]; titulo: string; onClose: () => void }) {
  const { removeGasto } = useFinanzasStore();
  const [editItem, setEditItem] = useState<Gasto | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = (gas: Gasto) => {
    if (gas.origen) { toast('Para gestionar este gasto ve a la sección Inmobiliario', { icon: '🏠' }); return; }
    if (window.confirm(`¿Eliminar "${gas.nombre}"?`)) removeGasto(gas.id);
  };
  const handleEdit = (gas: Gasto) => {
    if (gas.origen) { toast('Para editar este gasto ve a la sección Inmobiliario', { icon: '🏠' }); return; }
    setEditItem(gas);
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Gastos</h2>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{titulo}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setShowAdd(true)}>
                <Plus size={14} /> Añadir
              </button>
              <button className="btn-icon" onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          {/* Total */}
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total {gastos.length} gastos</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
              {fmtEur(gastos.reduce((s, g) => s + g.importe, 0))}
            </span>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gastos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)', fontSize: 14 }}>
                No hay gastos este mes.<br />
                <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> Añadir gasto
                </button>
              </div>
            ) : (
              gastos.map((gas) => (
                <div key={gas.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{CAT_ICONS[gas.categoria] ?? '💸'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {gas.nombre}
                      {gas.origen === 'inmobiliario' && <span style={{ fontSize: 9, background: 'rgba(59,130,246,0.15)', color: 'var(--blue)', borderRadius: 4, padding: '1px 4px', fontWeight: 600, flexShrink: 0 }}>🏠 Auto</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{gas.categoria} · {gas.fecha}{gas.recurrente ? ' · 🔄' : ''}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>-{fmtEur(gas.importe)}</span>
                  <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Editar" onClick={() => handleEdit(gas)}><Pencil size={13} /></button>
                  <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Eliminar" onClick={() => handleDelete(gas)}><Trash2 size={13} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {showAdd && <ModalGasto onClose={() => setShowAdd(false)} />}
      {editItem && <ModalGasto gasto={editItem} onClose={() => setEditItem(null)} />}
    </>
  );
}

// ——— Panel Ahorro ———
function PanelAhorro({ ingresosTotal, gastosTotal, titulo, onClose }: { ingresosTotal: number; gastosTotal: number; titulo: string; onClose: () => void }) {
  const ahorro = ingresosTotal - gastosTotal;
  const pct = ingresosTotal > 0 ? (ahorro / ingresosTotal) * 100 : 0;

  const nivel = pct >= 30 ? 'excelente' : pct >= 10 ? 'bien' : 'mejorable';
  const mensajes: Record<string, { emoji: string; texto: string; color: string }> = {
    excelente: { emoji: '🚀', color: 'var(--green)', texto: '¡Excelente! Estás ahorrando más del 30% de tus ingresos. Sigue así y alcanzarás tu independencia financiera antes de lo esperado.' },
    bien:      { emoji: '👍', color: 'var(--blue)',  texto: 'Buen ritmo de ahorro. Con disciplina constante podrás aumentar este porcentaje y acelerar tu camino financiero.' },
    mejorable: { emoji: '⚠️', color: 'var(--amber)', texto: 'Tu tasa de ahorro está por debajo del 10%. Revisa tus gastos recurrentes y busca pequeñas optimizaciones.' },
  };
  const msg = mensajes[nivel];

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Resumen de ahorro</h2>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{titulo}</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Desglose */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>Ingresos totales</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>+{fmtEur(ingresosTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>Gastos totales</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>-{fmtEur(gastosTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg3)', border: `1px solid ${msg.color}44`, borderRadius: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Ahorro neto</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: ahorro >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {ahorro >= 0 ? '+' : ''}{fmtEur(ahorro)}
            </span>
          </div>
        </div>

        {/* Tasa de ahorro */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>Tasa de ahorro</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: msg.color }}>{Number(pct ?? 0).toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: msg.color, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text2)' }}>
            <span>0%</span><span style={{ color: 'var(--amber)' }}>10%</span><span style={{ color: 'var(--blue)' }}>30%</span><span>100%</span>
          </div>
        </div>

        {/* Mensaje motivacional */}
        <div style={{ background: `${msg.color}12`, border: `1px solid ${msg.color}33`, borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>{msg.emoji}</span>
          <div>
            <div style={{ fontWeight: 700, color: msg.color, marginBottom: 4, fontSize: 14, textTransform: 'capitalize' }}>{nivel}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{msg.texto}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Donut chart path helper ———
function donutSegPath(cx: number, cy: number, outerR: number, innerR: number, s: number, e: number): string {
  const r = Math.PI / 180;
  const x1 = cx + outerR * Math.cos(s * r), y1 = cy + outerR * Math.sin(s * r);
  const x2 = cx + outerR * Math.cos(e * r), y2 = cy + outerR * Math.sin(e * r);
  const x3 = cx + innerR * Math.cos(e * r), y3 = cy + innerR * Math.sin(e * r);
  const x4 = cx + innerR * Math.cos(s * r), y4 = cy + innerR * Math.sin(s * r);
  const la = e - s > 180 ? 1 : 0;
  return `M${x1} ${y1} A${outerR} ${outerR} 0 ${la} 1 ${x2} ${y2} L${x3} ${y3} A${innerR} ${innerR} 0 ${la} 0 ${x4} ${y4}Z`;
}

// ——— Toggle switch ———
function ToggleSwitch({ checked, onChange, label, color }: { checked: boolean; onChange: (v: boolean) => void; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', flex: 1 }} onClick={() => onChange(!checked)}>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: checked ? color : 'var(--bg)', border: `2px solid ${checked ? color : 'var(--border)'}`, position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 1, left: checked ? 19 : 1, width: 16, height: 16, borderRadius: '50%', background: checked ? 'white' : 'var(--text2)', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
      </div>
      <span style={{ fontSize: 10, color: checked ? 'var(--text)' : 'var(--text2)', textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{label}</span>
    </div>
  );
}

// ——— Panel Patrimonio Neto ———
function PanelPatrimonio({ onClose }: { onClose: () => void }) {
  const { cuentas, ingresos, gastos } = useFinanzasStore();
  const { posiciones } = useInversionesStore();
  const { deudas } = useDeudaStore();
  const { inmuebles } = useInmuebleStore();
  const precios = useMercadoStore((s) => s.precios);

  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ingresosTotal = ingresos.filter(i => i.fecha.startsWith(mesActual)).reduce((s, i) => s + i.importe, 0);
  const gastosTotal = gastos.filter(g => g.fecha.startsWith(mesActual)).reduce((s, g) => s + g.importe, 0);

  const saldoCuentas = cuentas.reduce((sum, c) => sum + toEur(c.saldo, c.divisa), 0);
  const valorInversiones = posiciones.reduce((sum, p) => {
    if (p.tipo === 'Fondo Indexado') return sum + (p.vl || p.precioMedio) * p.acciones;
    const cached = precios[p.simbolo];
    const precio = cached ? cached.precio : (MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price ?? p.precioMedio);
    return sum + toEur(precio * p.acciones, p.divisa);
  }, 0);
  const valorInmueblesTotal = inmuebles.reduce((s, inm) => s + inm.valorActual, 0);
  const hipotecasInmuebles = inmuebles.reduce((s, inm) => {
    const hip = deudas.find(d => d.id === inm.hipotecaAsociada);
    return s + (hip ? toEur(hip.importePendiente, hip.divisa) : 0);
  }, 0);
  const equityInmuebles = valorInmueblesTotal - hipotecasInmuebles;

  const [inclCuentas, setInclCuentas] = useState(true);
  const [inclInversiones, setInclInversiones] = useState(true);
  const [inclInmuebles, setInclInmuebles] = useState(true);
  const [inclIngresos, setInclIngresos] = useState(true);
  const [inclGastos, setInclGastos] = useState(true);

  const patrimonioFiltrado =
    (inclCuentas ? saldoCuentas : 0) +
    (inclInversiones ? valorInversiones : 0) +
    (inclInmuebles ? equityInmuebles : 0) +
    (inclIngresos ? ingresosTotal : 0) -
    (inclGastos ? gastosTotal : 0);

  const applyScenario = (scenario: string) => {
    if      (scenario === 'liquidez')       { setInclCuentas(true);  setInclInversiones(false); setInclInmuebles(false); setInclIngresos(false); setInclGastos(false); }
    else if (scenario === 'inversiones')    { setInclCuentas(false); setInclInversiones(true);  setInclInmuebles(false); setInclIngresos(false); setInclGastos(false); }
    else if (scenario === 'sinInversiones') { setInclCuentas(true);  setInclInversiones(false); setInclInmuebles(true);  setInclIngresos(true);  setInclGastos(true);  }
    else                                    { setInclCuentas(true);  setInclInversiones(true);  setInclInmuebles(true);  setInclIngresos(true);  setInclGastos(true);  }
  };

  const COLORS = { cuentas: '#3b82f6', inversiones: '#22c55e', inmuebles: '#f59e0b', ingresos: '#a78bfa', gastos: '#ef4444' };

  const segs = [
    inclCuentas     && saldoCuentas    > 0 ? { v: saldoCuentas,     c: COLORS.cuentas,     l: 'Cuentas' }     : null,
    inclInversiones && valorInversiones > 0 ? { v: valorInversiones, c: COLORS.inversiones, l: 'Inversiones' } : null,
    inclInmuebles   && equityInmuebles  > 0 ? { v: equityInmuebles,  c: COLORS.inmuebles,   l: 'Inmobiliario' } : null,
    inclIngresos    && ingresosTotal    > 0 ? { v: ingresosTotal,    c: COLORS.ingresos,    l: 'Ingresos' }    : null,
    inclGastos      && gastosTotal      > 0 ? { v: gastosTotal,      c: COLORS.gastos,      l: 'Gastos' }      : null,
  ].filter((x): x is { v: number; c: string; l: string } => x !== null);

  const chartTotal = segs.reduce((s, x) => s + x.v, 0);

  const CX = 80, CY = 80, OUTER = 68, INNER = 40;
  let angle = -90;
  const svgPaths = segs.map((seg) => {
    const sweep = chartTotal > 0 ? (seg.v / chartTotal) * 359.99 : 0;
    const start = angle, end = angle + sweep;
    angle = end;
    return { d: donutSegPath(CX, CY, OUTER, INNER, start, end), c: seg.c };
  });

  const cuentasDetalle = cuentas.map(c => ({ nombre: c.nombre, tipo: c.tipo, valor: toEur(c.saldo, c.divisa) }));
  const posicionesDetalle = posiciones.map(p => {
    const cached = precios[p.simbolo];
    const precio = cached ? cached.precio : (MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price ?? p.precioMedio);
    const valor = toEur(precio * p.acciones, p.divisa);
    return { nombre: p.nombre, simbolo: p.simbolo, valor, pct: valorInversiones > 0 ? (valor / valorInversiones) * 100 : 0 };
  });

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Composición del Patrimonio Neto</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Activa o desactiva componentes para distintas perspectivas</div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0, marginLeft: 8 }}><X size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Big number */}
          <div style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Patrimonio filtrado</div>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1px', color: patrimonioFiltrado >= 0 ? 'var(--text)' : 'var(--red)' }}>
              {fmtEur(patrimonioFiltrado)}
            </div>
          </div>

          {/* Scenario buttons */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Escenarios rápidos</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              {[
                { key: 'completo',       emoji: '🌐', label: 'Patrimonio\ncompleto' },
                { key: 'liquidez',       emoji: '💧', label: 'Solo\nliquidez' },
                { key: 'inversiones',    emoji: '📈', label: 'Solo\ninversiones' },
                { key: 'sinInversiones', emoji: '🏦', label: 'Sin\ninversiones' },
              ].map(({ key, emoji, label }) => (
                <button
                  key={key}
                  className="btn-icon"
                  style={{ padding: '8px 4px', fontSize: 11, lineHeight: 1.35, height: 'auto', borderRadius: 8, textAlign: 'center', whiteSpace: 'pre-line', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                  onClick={() => applyScenario(key)}
                >
                  <span style={{ fontSize: 16 }}>{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Incluir en el cálculo</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ToggleSwitch checked={inclCuentas}     onChange={setInclCuentas}     label={'Cuentas\nbancarias'} color={COLORS.cuentas} />
              <ToggleSwitch checked={inclInversiones} onChange={setInclInversiones} label={'Inversiones'}        color={COLORS.inversiones} />
              <ToggleSwitch checked={inclInmuebles}   onChange={setInclInmuebles}   label={'Inmobiliario'}       color={COLORS.inmuebles} />
              <ToggleSwitch checked={inclIngresos}    onChange={setInclIngresos}    label={'Ingresos\ndel mes'}  color={COLORS.ingresos} />
              <ToggleSwitch checked={inclGastos}      onChange={setInclGastos}      label={'Gastos\ndel mes'}    color={COLORS.gastos} />
            </div>
          </div>

          {/* Donut chart + legend */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ flexShrink: 0 }}>
              {chartTotal > 0 ? (
                <svg width={160} height={160} style={{ display: 'block' }}>
                  {svgPaths.map((p, i) => <path key={i} d={p.d} fill={p.c} opacity={0.9} />)}
                </svg>
              ) : (
                <div style={{ width: 160, height: 160, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Sin datos</span>
                </div>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {segs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>Activa al menos un componente para ver la distribución.</div>
              ) : segs.map((seg) => (
                <div key={seg.l}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.c, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{seg.l}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{chartTotal > 0 ? ((seg.v / chartTotal) * 100).toFixed(1) : '0.0'}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${chartTotal > 0 ? (seg.v / chartTotal) * 100 : 0}%`, background: seg.c, borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'right', marginTop: 2 }}>{fmtEur(seg.v)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Desglose detallado */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Desglose detallado</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {inclCuentas && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.cuentas, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Cuentas bancarias</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.cuentas }}>{fmtEur(saldoCuentas)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cuentasDetalle.map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6, fontSize: 13 }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{c.nombre}</span>
                          <span style={{ color: 'var(--text2)', fontSize: 11, marginLeft: 6 }}>{c.tipo}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{fmtEur(c.valor)}</span>
                          <span style={{ color: 'var(--text2)', fontSize: 11, minWidth: 36, textAlign: 'right' }}>
                            {saldoCuentas > 0 ? ((c.valor / saldoCuentas) * 100).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inclInversiones && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.inversiones, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Cartera de inversiones</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.inversiones }}>{fmtEur(valorInversiones)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {posicionesDetalle.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6, fontSize: 13 }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                          <span style={{ color: 'var(--text2)', fontSize: 11, marginLeft: 6 }}>{p.simbolo}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{fmtEur(p.valor)}</span>
                          <span style={{ color: 'var(--text2)', fontSize: 11, minWidth: 36, textAlign: 'right' }}>{p.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inclInmuebles && equityInmuebles > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.inmuebles, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Inmobiliario (equity)</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.inmuebles }}>{fmtEur(equityInmuebles)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {inmuebles.map((inm) => {
                      const hip = deudas.find(d => d.id === inm.hipotecaAsociada);
                      const eq = inm.valorActual - (hip ? toEur(hip.importePendiente, hip.divisa) : 0);
                      return (
                        <div key={inm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6, fontSize: 13 }}>
                          <div>
                            <span style={{ fontWeight: 500 }}>{inm.nombre}</span>
                            <span style={{ color: 'var(--text2)', fontSize: 11, marginLeft: 6 }}>{inm.tipo}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600 }}>{fmtEur(eq)}</span>
                            <span style={{ color: 'var(--text2)', fontSize: 11, minWidth: 36, textAlign: 'right' }}>
                              {equityInmuebles > 0 ? ((eq / equityInmuebles) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {inclIngresos && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.ingresos, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Ingresos del mes</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.ingresos }}>+{fmtEur(ingresosTotal)}</span>
                </div>
              )}

              {inclGastos && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.gastos, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Gastos del mes</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.gastos }}>-{fmtEur(gastosTotal)}</span>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ METAS FINANCIERAS ═══════════════════════

const META_TIPO_ICONS: Record<string, string> = { 'Fondo emergencia': '🛡️', 'Viaje': '✈️', 'Vivienda': '🏡', 'Vehículo': '🚗', 'Jubilación': '🏖️', 'Educación': '🎓', 'Otro': '🎯' };
const META_TIPOS: MetaTipo[] = ['Fondo emergencia', 'Viaje', 'Vivienda', 'Vehículo', 'Jubilación', 'Educación', 'Otro'];
const META_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const PRIO_LABELS: Record<number, string> = { 1: 'Alta', 2: 'Media', 3: 'Baja' };
const PRIO_COLORS: Record<number, string> = { 1: '#ef4444', 2: '#f59e0b', 3: '#22c55e' };

function ModalMeta({ meta, onClose }: { meta?: Meta | null; onClose: () => void }) {
  const { addMeta, updateMeta } = useMetasStore();
  const isEdit = !!meta;
  const [form, setForm] = useState({
    nombre: meta?.nombre ?? '',
    descripcion: meta?.descripcion ?? '',
    tipo: (meta?.tipo ?? 'Otro') as MetaTipo,
    objetivo: meta?.objetivo.toString() ?? '',
    ahorrado: meta?.ahorrado.toString() ?? '0',
    aportacionMensual: meta?.aportacionMensual.toString() ?? '',
    fechaObjetivo: meta?.fechaObjetivo ?? '',
    prioridad: (meta?.prioridad ?? 2) as 1 | 2 | 3,
    color: meta?.color ?? '#3b82f6',
  });
  const upd = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = () => {
    if (!form.nombre.trim() || !form.objetivo) { toast.error('Nombre y objetivo son obligatorios'); return; }
    const data = { ...form, objetivo: parseFloat(form.objetivo) || 0, ahorrado: parseFloat(form.ahorrado) || 0, aportacionMensual: parseFloat(form.aportacionMensual) || 0, prioridad: form.prioridad as 1 | 2 | 3 };
    if (isEdit && meta) { updateMeta(meta.id, data); toast.success('Meta actualizada'); }
    else { addMeta(data); toast.success('Meta creada'); }
    onClose();
  };
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Nueva'} Meta</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e => upd('nombre', e.target.value)} /></div>
            <div><label className="label">Tipo</label>
              <select className="select" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                {META_TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Descripción</label><input className="input" value={form.descripcion} onChange={e => upd('descripcion', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label className="label">Objetivo (€) *</label><input className="input" type="number" value={form.objetivo} onChange={e => upd('objetivo', e.target.value)} /></div>
            <div><label className="label">Ya ahorrado (€)</label><input className="input" type="number" value={form.ahorrado} onChange={e => upd('ahorrado', e.target.value)} /></div>
            <div><label className="label">Aportación/mes (€)</label><input className="input" type="number" value={form.aportacionMensual} onChange={e => upd('aportacionMensual', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label className="label">Fecha objetivo</label><input className="input" type="date" value={form.fechaObjetivo} onChange={e => upd('fechaObjetivo', e.target.value)} /></div>
            <div><label className="label">Prioridad</label>
              <select className="select" value={form.prioridad} onChange={e => upd('prioridad', parseInt(e.target.value) as 1 | 2 | 3)}>
                <option value={1}>1 — Alta</option><option value={2}>2 — Media</option><option value={3}>3 — Baja</option>
              </select>
            </div>
            <div><label className="label">Color</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {META_COLORS.map(c => <button key={c} onClick={() => upd('color', c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer' }} />)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>{isEdit ? 'Guardar cambios' : 'Crear meta'}</button>
        </div>
      </div>
    </div>
  );
}

function SectionMetas() {
  const { metas, removeMeta, aportarMeta } = useMetasStore();
  const { addGasto } = useFinanzasStore();
  const { privacyMode } = useConfigStore();
  const fmtMeta = (v: number) => privacyMode ? '••••••• €' : fmtEur(v);
  const [showModal, setShowModal] = useState(false);
  const [editMeta, setEditMeta] = useState<Meta | null>(null);
  const [aportarItem, setAportarItem] = useState<Meta | null>(null);
  const [aportarImporte, setAportarImporte] = useState('');

  const now = new Date();

  const metasConCalcs = metas.map(m => {
    const falta = Math.max(0, m.objetivo - m.ahorrado);
    const pct = m.objetivo > 0 ? Math.min((m.ahorrado / m.objetivo) * 100, 100) : 0;
    const fechaObj = new Date(m.fechaObjetivo);
    const mesesHasta = Math.max(0, (fechaObj.getFullYear() - now.getFullYear()) * 12 + (fechaObj.getMonth() - now.getMonth()));
    const mesesNecesarios = m.aportacionMensual > 0 ? Math.ceil(falta / m.aportacionMensual) : (falta > 0 ? 9999 : 0);
    const onTrack = falta === 0 || (m.aportacionMensual > 0 && mesesNecesarios <= mesesHasta);
    return { ...m, falta, pct, mesesHasta, mesesNecesarios, onTrack };
  }).sort((a, b) => a.prioridad - b.prioridad || new Date(a.fechaObjetivo).getTime() - new Date(b.fechaObjetivo).getTime());

  const totalObjetivos = metas.reduce((s, m) => s + m.objetivo, 0);
  const totalAhorrado = metas.reduce((s, m) => s + m.ahorrado, 0);
  const totalAportacion = metas.reduce((s, m) => s + m.aportacionMensual, 0);

  // Timeline: find date range
  const fechas = metas.filter(m => m.fechaObjetivo).map(m => new Date(m.fechaObjetivo).getTime());
  const maxFecha = fechas.length > 0 ? Math.max(...fechas) : now.getTime() + 365 * 24 * 3600 * 1000;
  const rangoMs = Math.max(maxFecha - now.getTime(), 1);

  const confirmarAporte = () => {
    if (!aportarItem) return;
    const cantidad = parseFloat(aportarImporte);
    if (isNaN(cantidad) || cantidad <= 0) { toast.error('Importe inválido'); return; }
    aportarMeta(aportarItem.id, cantidad);
    addGasto({ nombre: `Aportación: ${aportarItem.nombre}`, categoria: 'Otros', importe: cantidad, fecha: new Date().toISOString().slice(0, 10), recurrente: false });
    toast.success(`${fmtEur(cantidad)} aportados a "${aportarItem.nombre}"`);
    setAportarItem(null);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>🎯 Metas Financieras</h3>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{metas.length} metas · {fmtMeta(totalAhorrado)} de {fmtMeta(totalObjetivos)} ahorrados</div>
        </div>
        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setEditMeta(null); setShowModal(true); }}>
          <Plus size={14} /> Nueva meta
        </button>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total objetivos', val: fmtMeta(totalObjetivos), color: 'var(--text)' },
          { label: 'Total ahorrado', val: fmtMeta(totalAhorrado), color: 'var(--green)' },
          { label: 'Aportación/mes', val: fmtMeta(totalAportacion), color: 'var(--blue)' },
        ].map(item => (
          <div key={item.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontWeight: 700, color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>

      {metas.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)', fontSize: 14 }}>
          No hay metas definidas. ¡Crea tu primera meta financiera!
        </div>
      )}

      {/* Metas list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {metasConCalcs.map(m => (
          <div key={m.id} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${m.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{META_TIPO_ICONS[m.tipo]}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.descripcion || m.tipo}</div>
                </div>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: `${PRIO_COLORS[m.prioridad]}22`, color: PRIO_COLORS[m.prioridad], fontWeight: 600 }}>P{m.prioridad} {PRIO_LABELS[m.prioridad]}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { setAportarItem(m); setAportarImporte(''); }}>+ Aportar</button>
                <button className="btn-icon" onClick={() => { setEditMeta(m); setShowModal(true); }}><Pencil size={12} /></button>
                <button className="btn-icon" onClick={() => { if (window.confirm('¿Eliminar meta?')) removeMeta(m.id); }}><Trash2 size={12} /></button>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${m.pct}%`, background: m.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40, color: m.color }}>{m.pct.toFixed(0)}%</span>
            </div>
            {/* Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <div style={{ fontSize: 11 }}><span style={{ color: 'var(--text2)' }}>Ahorrado: </span><span style={{ fontWeight: 600, color: 'var(--green)' }}>{fmtMeta(m.ahorrado)}</span></div>
              <div style={{ fontSize: 11 }}><span style={{ color: 'var(--text2)' }}>Falta: </span><span style={{ fontWeight: 600 }}>{fmtMeta(m.falta)}</span></div>
              <div style={{ fontSize: 11 }}><span style={{ color: 'var(--text2)' }}>Meses necesarios: </span><span style={{ fontWeight: 600 }}>{m.mesesNecesarios === 9999 ? '∞' : m.mesesNecesarios}</span></div>
              <div style={{ fontSize: 11 }}>
                {m.falta === 0
                  ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>✅ Completada</span>
                  : m.onTrack
                    ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>🟢 On track</span>
                    : <span style={{ color: 'var(--red)', fontWeight: 600 }}>🔴 Retrasada</span>
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {metas.length > 1 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>Timeline de metas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {metasConCalcs.filter(m => m.fechaObjetivo).map(m => {
              const barPct = Math.max(2, Math.min(100, ((new Date(m.fechaObjetivo).getTime() - now.getTime()) / rangoMs) * 100));
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 90, fontSize: 11, color: 'var(--text2)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</div>
                  <div style={{ flex: 1, height: 14, background: 'var(--bg2)', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: m.color, borderRadius: 7, opacity: 0.75 }} />
                  </div>
                  <div style={{ width: 70, fontSize: 11, color: 'var(--text2)', flexShrink: 0 }}>{m.fechaObjetivo.slice(0, 7)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 6, textAlign: 'right' }}>← ahora · fecha objetivo →</div>
        </div>
      )}

      {showModal && <ModalMeta meta={editMeta} onClose={() => { setShowModal(false); setEditMeta(null); }} />}

      {aportarItem && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Aportar a "{aportarItem.nombre}"</h3>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
              Progreso actual: {fmtEur(aportarItem.ahorrado)} / {fmtEur(aportarItem.objetivo)} ({aportarItem.objetivo > 0 ? ((aportarItem.ahorrado / aportarItem.objetivo) * 100).toFixed(1) : 0}%)
            </div>
            <label className="label">Importe a aportar (€)</label>
            <input className="input" type="number" step="0.01" value={aportarImporte} onChange={e => setAportarImporte(e.target.value)} placeholder="0.00" autoFocus />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setAportarItem(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarAporte}>Aportar y registrar gasto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ——— Página principal ———
export default function Inicio() {
  const navigate = useNavigate();
  const { cuentas, ingresos, gastos } = useFinanzasStore();
  const { posiciones } = useInversionesStore();
  const { objetivoFinanciero, setObjetivoFinanciero } = usePatrimonioStore();
  const { snapshots, addSnapshot } = useHistoricoStore();
  const { deudas } = useDeudaStore();
  const { inmuebles } = useInmuebleStore();
  const { facturas } = useFacturasStore();
  const precios = useMercadoStore((s) => s.precios);

  const [showModalIngreso, setShowModalIngreso] = useState(false);
  const [showModalGasto, setShowModalGasto] = useState(false);
  const [showModalPosicion, setShowModalPosicion] = useState(false);
  const [editObjetivo, setEditObjetivo] = useState(false);
  const [tmpObjetivo, setTmpObjetivo] = useState(objetivoFinanciero.toString());
  const [panel, setPanel] = useState<'ingresos' | 'gastos' | 'ahorro' | null>(null);
  const [showPatrimonio, setShowPatrimonio] = useState(false);
  const [historicoPeriodo, setHistoricoPeriodo] = useState<6 | 12>(12);
  const { anthropicKey, privacyMode, setPrivacyMode, autonomo } = useConfigStore();
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [fng, setFng] = useState<{ value: number; label: string; color: string } | null>(null);

  useEffect(() => {
    getFearAndGreed().then(data => {
      if (!data) return;
      const v = parseInt(data.value);
      const color = v <= 25 ? '#ef4444' : v <= 45 ? '#f97316' : v <= 55 ? '#f59e0b' : v <= 75 ? '#84cc16' : '#22c55e';
      const label = v <= 25 ? 'Miedo extremo' : v <= 45 ? 'Miedo' : v <= 55 ? 'Neutral' : v <= 75 ? 'Codicia' : 'Codicia extrema';
      setFng({ value: v, label, color });
    }).catch(() => {});
  }, []);

  // Net worth
  const saldoCuentas = cuentas.reduce((sum, c) => sum + toEur(c.saldo, c.divisa), 0);
  const valorInversiones = posiciones.reduce((sum, p) => {
    if (p.tipo === 'Fondo Indexado') return sum + (p.vl || p.precioMedio) * p.acciones;
    const cached = precios[p.simbolo];
    const precioActual = cached ? cached.precio : (MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price || p.precioMedio);
    return sum + toEur(precioActual * p.acciones, p.divisa);
  }, 0);
  const hipotecasInmuebles = inmuebles.reduce((s, inm) => {
    const hip = deudas.find(d => d.id === inm.hipotecaAsociada);
    return s + (hip ? toEur(hip.importePendiente, hip.divisa) : 0);
  }, 0);
  const valorInmueblesTotal = inmuebles.reduce((s, inm) => s + inm.valorActual, 0);
  const equityInmuebles = valorInmueblesTotal - hipotecasInmuebles;
  const otrasDeudas = deudas.reduce((s, d) => s + toEur(d.importePendiente, d.divisa), 0) - hipotecasInmuebles;
  const totalPasivos = deudas.reduce((s, d) => s + toEur(d.importePendiente, d.divisa), 0);
  const patrimonioNeto = saldoCuentas + valorInversiones + equityInmuebles - otrasDeudas;

  const loadAIInsights = async () => {
    if (!anthropicKey) { toast.error('Añade tu API key de Anthropic en Ajustes'); return; }
    setAiLoading(true);
    try {
      const ctx = buildFinancialContext();
      const prompt = 'Dame exactamente 3 insights financieros breves y accionables sobre mi situación actual. Formato: cada insight en una sola frase concisa empezando por un emoji relevante. Sé específico con los números.';
      const response = await callClaudeAPI(
        [{ role: 'user', content: prompt }],
        `${SYSTEM_PROMPT}\n\nCONTEXTO:\n${ctx}`,
        anthropicKey
      );
      // Parse insights: split by numbered lines or newlines
      const lines = response.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      setAiInsights(lines.slice(0, 4));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar insights');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-snapshot (once per session)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const last = snapshots[snapshots.length - 1];
    if (!last || last.fecha.slice(0, 7) !== today.slice(0, 7)) {
      addSnapshot({
        fecha: today,
        patrimonio: Math.round(patrimonioNeto),
        activos: Math.round(saldoCuentas + valorInversiones + valorInmueblesTotal),
        pasivos: Math.round(totalPasivos),
      });
    }
  }, []);

  // Chart data for historico
  const historicoData = snapshots.slice(-historicoPeriodo).map(s => ({
    mes: s.fecha.slice(0, 7),
    patrimonio: s.patrimonio,
    activos: s.activos,
    pasivos: s.pasivos,
  }));

  const variacionDia = posiciones.reduce((sum, p) => {
    const cached = precios[p.simbolo];
    const mock = MOCK_TICKERS.find(t => t.symbol === p.simbolo);
    const pctChange = cached ? cached.variacion : (mock?.change || 0);
    const precioActual = cached ? cached.precio : (mock?.price || p.precioMedio);
    return sum + toEur(precioActual * p.acciones * (pctChange ?? 0) / 100, p.divisa);
  }, 0);

  // Privacy helper
  const fmt = (v: number) => privacyMode ? '••••••• €' : fmtEur(v);

  // Greeting
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'Buenos días';
    if (h >= 12 && h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };
  const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const nombreUsuario = autonomo.nombre ? autonomo.nombre.split(' ')[0] : '';
  const greetingText = `${getGreeting()}${nombreUsuario ? `, ${nombreUsuario}` : ''}`;
  const diaStr = DIAS_ES[new Date().getDay()];
  const fechaCompleta = `${new Date().getDate()} de ${MESES_ES[new Date().getMonth()]} de ${new Date().getFullYear()}`;
  const variacionTexto = variacionDia === 0
    ? 'Tu cartera no ha variado hoy'
    : `Tu cartera ha variado ${variacionDia >= 0 ? '+' : ''}${fmtEur(variacionDia)} hoy`;
  const resumenDia = `Hoy es ${diaStr}. ${privacyMode ? 'Los valores están ocultos.' : variacionTexto}.`;

  const liquidezPct = patrimonioNeto > 0 ? (saldoCuentas / patrimonioNeto) * 100 : 0;
  const progreso = Math.min((patrimonioNeto / objetivoFinanciero) * 100, 100);

  // Mes actual
  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const tituloMes = `${MESES_ES[now.getMonth()]} ${now.getFullYear()}`;
  const ingresosMes = ingresos.filter(i => i.fecha.startsWith(mesActual));
  const gastosMes = gastos.filter(g => g.fecha.startsWith(mesActual));

  // Synthetic ingresos from inmuebles con renta (same logic as Finanzas.tsx)
  const syntheticIngInm: Ingreso[] = inmuebles
    .filter(inm => inm.generaRenta && inm.rentaMensualBruta > 0)
    .map(inm => ({
      id: `inm-${inm.id}`,
      nombre: `Alquiler — ${inm.nombre}`,
      categoria: 'Alquiler' as const,
      importe: inm.rentaMensualBruta,
      fecha: `${mesActual}-01`,
      recurrente: true,
      origen: 'inmobiliario' as const,
      origenId: inm.id,
    }));

  const syntheticIngFac: Ingreso[] = facturas
    .filter(f => f.estado === 'Cobrada' && f.fechaEmision.startsWith(mesActual))
    .map(f => ({
      id: `fac-${f.id}`,
      nombre: `Factura ${f.numero}`,
      categoria: 'Autónomo' as const,
      importe: f.total,
      fecha: f.fechaEmision,
      recurrente: false,
      origen: 'factura' as const,
      origenId: f.id,
    }));

  const syntheticGasInm: Gasto[] = inmuebles
    .filter(inm => inm.generaRenta)
    .map(inm => ({
      id: `inm-gas-${inm.id}`,
      nombre: `Gastos — ${inm.nombre}`,
      categoria: 'Vivienda' as const,
      importe: inm.gastosIbiMes + inm.gastosComunidad + inm.gastosSeguro + inm.gastosMantenimiento + inm.gastosOtros,
      fecha: `${mesActual}-01`,
      recurrente: true,
      origen: 'inmobiliario' as const,
      origenId: inm.id,
    }))
    .filter(g => g.importe > 0);

  const allIngMes = [...ingresosMes, ...syntheticIngInm, ...syntheticIngFac];
  const allGasMes = [...gastosMes, ...syntheticGasInm];
  const ingresosTotal = allIngMes.reduce((s, i) => s + i.importe, 0);
  const gastosTotal = allGasMes.reduce((s, g) => s + g.importe, 0);
  const ahorro = ingresosTotal - gastosTotal;

  const cardClickStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ——— Hero: Saludo + Variación ——— */}
      <div style={{
        background: 'linear-gradient(135deg, #0a0a14 0%, #141428 50%, #0c1022 100%)',
        border: '1px solid #2a2a42',
        borderRadius: 20,
        padding: '28px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 128,
      }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: -80, left: -60, width: 300, height: 300, background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 80, width: 200, height: 200, background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 65%)', borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ zIndex: 1, flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 14, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            {greetingText} 👋
          </div>
          {privacyMode ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 14px', fontSize: 13, color: 'var(--text2)' }}>
              🔒 Pulsa el ojo en el header para mostrar los valores
            </div>
          ) : variacionDia !== 0 ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: variacionDia >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${variacionDia >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 10, padding: '7px 14px' }}>
              <span style={{ fontSize: 16 }}>{variacionDia >= 0 ? '📈' : '📉'}</span>
              <div>
                <div style={{ color: variacionDia >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
                  {variacionDia >= 0 ? '+' : ''}{fmtEur(variacionDia)} hoy
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Variación de cartera</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text2)', opacity: 0.7, fontStyle: 'italic' }}>
              Sin variación de cartera hoy
            </div>
          )}
        </div>

        {fng && (
          <div style={{ flexShrink: 0, marginLeft: 20, zIndex: 1 }}>
            <div style={{ background: `${fng.color}12`, border: `1px solid ${fng.color}35`, borderRadius: 14, padding: '12px 18px', textAlign: 'center', minWidth: 96 }}>
              <div style={{ fontSize: 9, color: 'var(--text2)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>Fear & Greed</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: fng.color, lineHeight: 1 }}>{fng.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: fng.color, marginTop: 4 }}>{fng.label}</div>
            </div>
          </div>
        )}
      </div>

      {/* Alert */}
      {liquidezPct < 10 && patrimonioNeto > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color="var(--amber)" />
          <div>
            <span style={{ color: 'var(--amber)', fontWeight: 600, fontSize: 14 }}>Liquidez baja:</span>
            <span style={{ fontSize: 14, color: 'var(--text2)', marginLeft: 6 }}>
              Tu liquidez ({Number(liquidezPct ?? 0).toFixed(1)}%) está por debajo del 10% del patrimonio.
            </span>
          </div>
        </div>
      )}

      {/* ——— Accesos rápidos ——— */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Añadir ingreso', sub: 'Registrar cobro o entrada', icon: Plus, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.28)', onClick: () => setShowModalIngreso(true) },
          { label: 'Añadir inversión', sub: 'Nueva posición en cartera', icon: TrendingUp, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.28)', onClick: () => setShowModalPosicion(true) },
          { label: 'Registrar gasto', sub: 'Apuntar un pago o compra', icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.28)', onClick: () => setShowModalGasto(true) },
          { label: 'Ver análisis', sub: 'Métricas y análisis profundo', icon: Search, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.28)', onClick: () => navigate('/analisis') },
        ].map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            style={{
              background: a.bg, border: `1px solid ${a.border}`,
              borderRadius: 14, padding: '18px 20px',
              textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ background: a.color, borderRadius: 10, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${a.color}50` }}>
              <a.icon size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: 'var(--text)' }}>{a.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ——— Patrimonio Neto ——— */}
      <div className="card card-hover" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42', cursor: 'pointer' }} onClick={() => setShowPatrimonio(true)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Patrimonio Neto</div>
            <button
              onClick={(e) => { e.stopPropagation(); setPrivacyMode(!privacyMode); }}
              title={privacyMode ? 'Mostrar valores' : 'Ocultar valores'}
              style={{ background: privacyMode ? 'rgba(255,255,255,0.06)' : 'rgba(59,130,246,0.12)', border: `1px solid ${privacyMode ? 'rgba(255,255,255,0.1)' : 'rgba(59,130,246,0.3)'}`, cursor: 'pointer', color: privacyMode ? 'var(--text2)' : 'var(--blue)', display: 'flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, gap: 4, fontSize: 11, fontWeight: 600 }}
            >
              {privacyMode ? <EyeOff size={12} /> : <Eye size={12} />}
              {privacyMode ? 'Mostrar' : 'Ocultar'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', opacity: 0.6 }}>
            <span>desglose</span><ChevronRight size={12} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>{fmt(patrimonioNeto)}</div>
          {!privacyMode && variacionDia !== 0 && (
            <span style={{ color: variacionDia >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600 }}>
              {variacionDia >= 0 ? '+' : ''}{fmtEur(variacionDia)} hoy
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          {[
            { label: 'Liquidez', val: saldoCuentas, sub: privacyMode ? '—' : `${Number(liquidezPct ?? 0).toFixed(1)}%`, subColor: liquidezPct < 10 ? 'var(--amber)' : 'var(--text2)' },
            { label: 'Inversiones', val: valorInversiones, sub: privacyMode ? '—' : `${patrimonioNeto > 0 ? ((valorInversiones / patrimonioNeto) * 100).toFixed(1) : 0}%`, subColor: 'var(--text2)' },
            { label: 'Inmobiliario', val: equityInmuebles, sub: privacyMode ? '—' : `${patrimonioNeto > 0 ? ((equityInmuebles / patrimonioNeto) * 100).toFixed(1) : 0}%`, subColor: 'var(--text2)' },
            { label: 'Deudas', val: -totalPasivos, sub: `${posiciones.length} activos`, subColor: 'var(--text2)' },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.val < 0 ? 'var(--red)' : 'var(--text)' }}>{m.val < 0 ? '-' : ''}{fmt(Math.abs(m.val))}</div>
              <div style={{ fontSize: 11, color: m.subColor, marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
        {/* Objetivo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
              <Target size={14} /> Objetivo financiero
            </div>
            {editObjetivo ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <input className="input" style={{ width: 120, padding: '4px 8px', fontSize: 13 }} value={tmpObjetivo} onChange={(e) => setTmpObjetivo(e.target.value)} />
                <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setObjetivoFinanciero(parseFloat(tmpObjetivo) || objetivoFinanciero); setEditObjetivo(false); }}>OK</button>
              </div>
            ) : (
              <button style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setEditObjetivo(true); }}>
                {privacyMode ? '••••••• €' : fmtEur(objetivoFinanciero)} ✏️
              </button>
            )}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progreso}%`, background: 'var(--blue)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: 'var(--text2)' }}>
            <span>{Number(progreso ?? 0).toFixed(1)}% completado</span>
            <span>Faltan {fmt(Math.max(0, objetivoFinanciero - patrimonioNeto))}</span>
          </div>
        </div>
      </div>

      {/* Month summary — CLICKABLE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="card card-hover" style={cardClickStyle} onClick={() => setPanel('ingresos')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Ingresos del mes</div>
            <ChevronRight size={14} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{fmt(ingresosTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{allIngMes.length} entradas · ver detalle</div>
        </div>
        <div className="card card-hover" style={cardClickStyle} onClick={() => setPanel('gastos')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Gastos del mes</div>
            <ChevronRight size={14} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>{fmt(gastosTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{allGasMes.length} entradas · ver detalle</div>
        </div>
        <div className="card card-hover" style={cardClickStyle} onClick={() => setPanel('ahorro')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Ahorro del mes</div>
            <ChevronRight size={14} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ahorro >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(ahorro)}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
            {!privacyMode && ingresosTotal > 0 ? `${Number((ahorro / ingresosTotal) * 100).toFixed(1)}% tasa ahorro · ` : ''}ver análisis
          </div>
        </div>
      </div>

      {/* Cards finanzas, inversiones e inmobiliario */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => navigate('/inversiones')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>Inversiones</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(valorInversiones)}</div>
            </div>
            <ChevronRight size={18} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{posiciones.length} posiciones activas</div>
        </div>
        <div className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => navigate('/finanzas')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>Finanzas</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(saldoCuentas)}</div>
            </div>
            <ChevronRight size={18} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{cuentas.length} cuentas bancarias</div>
        </div>
        <div className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => navigate('/finanzas')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>🏠 Inmobiliario</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(equityInmuebles)}</div>
            </div>
            <ChevronRight size={18} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{inmuebles.length} inmuebles · valor {fmt(valorInmueblesTotal)}</div>
          {hipotecasInmuebles > 0 && (
            <div style={{ fontSize: 11, color: 'var(--red)' }}>Hipotecas: -{fmt(hipotecasInmuebles)}</div>
          )}
          {(() => {
            const rentaMes = inmuebles.filter(i => i.generaRenta).reduce((s, i) => s + i.rentaMensualBruta, 0);
            return rentaMes > 0 ? <div style={{ fontSize: 11, color: 'var(--green)' }}>Renta bruta: {fmt(rentaMes)}/mes</div> : null;
          })()}
        </div>
      </div>

      {/* Metas Financieras */}
      <SectionMetas />

      {/* Fondo de Emergencia */}
      <FondoEmergenciaWidget />

      {/* IA Insights */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: aiInsights.length > 0 ? 14 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={16} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Análisis IA</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Insights personalizados basados en tus datos</div>
            </div>
          </div>
          <button className="btn-secondary" style={{ gap: 6, fontSize: 13, padding: '6px 12px' }} onClick={loadAIInsights} disabled={aiLoading}>
            {aiLoading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
            {aiInsights.length > 0 ? 'Actualizar' : 'Generar insights'}
          </button>
        </div>
        {aiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', fontSize: 13, padding: '8px 0' }}>
            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analizando tus finanzas...
          </div>
        )}
        {aiInsights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aiInsights.map((insight, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ flex: 1 }}>{insight}</span>
                <button onClick={() => {
                  const cleanInsight = insight.replace(/^[^\w]*/, '');
                  const question = `Cuéntame más sobre esto: ${cleanInsight}`;
                  window.dispatchEvent(new CustomEvent('open-chat', { detail: { question } }));
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 11, flexShrink: 0, padding: '0 4px' }}>
                  <MessageSquare size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {!anthropicKey && aiInsights.length === 0 && !aiLoading && (
          <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 0' }}>
            Añade tu API key de Anthropic en Ajustes → Autónomo para activar los insights IA
          </div>
        )}
      </div>

      {/* Evolución Histórica del Patrimonio */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Evolución del Patrimonio</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {([6, 12] as const).map(p => (
              <button key={p} onClick={() => setHistoricoPeriodo(p)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: historicoPeriodo === p ? 'var(--blue)' : 'var(--bg3)', color: historicoPeriodo === p ? 'white' : 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: historicoPeriodo === p ? 600 : 400 }}>
                {p}M
              </button>
            ))}
          </div>
        </div>
        {historicoData.length > 1 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historicoData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradActivos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [fmtEur(v as number)]} />
                <Area type="monotone" dataKey="activos" stroke="#22c55e" strokeWidth={1.5} fill="url(#gradActivos)" name="Activos" />
                <Area type="monotone" dataKey="patrimonio" stroke="#3b82f6" strokeWidth={2} fill="url(#gradPatrimonio)" name="Patrimonio neto" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
              {[
                { label: 'Inicio periodo', val: historicoData[0]?.patrimonio ?? 0, color: 'var(--text2)' },
                { label: 'Actual', val: historicoData[historicoData.length - 1]?.patrimonio ?? 0, color: 'var(--blue)' },
                { label: 'Variación', val: (historicoData[historicoData.length - 1]?.patrimonio ?? 0) - (historicoData[0]?.patrimonio ?? 0), color: ((historicoData[historicoData.length - 1]?.patrimonio ?? 0) - (historicoData[0]?.patrimonio ?? 0)) >= 0 ? 'var(--green)' : 'var(--red)' },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{privacyMode ? '••••••• €' : `${item.val >= 0 && item.label === 'Variación' ? '+' : ''}${fmtEur(item.val)}`}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)', fontSize: 14 }}>Necesitas al menos 2 meses de datos para mostrar la evolución.</div>
        )}
      </div>

      {/* Modal Patrimonio Neto */}
      {showPatrimonio && <PanelPatrimonio onClose={() => setShowPatrimonio(false)} />}

      {/* Modals quick-action */}
      {showModalIngreso && <ModalIngreso onClose={() => setShowModalIngreso(false)} />}
      {showModalGasto && <ModalGasto onClose={() => setShowModalGasto(false)} />}
      {showModalPosicion && <ModalAddPosicion onClose={() => setShowModalPosicion(false)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Panels */}
      {panel === 'ingresos' && (
        <PanelIngresos ingresos={allIngMes} titulo={tituloMes} onClose={() => setPanel(null)} />
      )}
      {panel === 'gastos' && (
        <PanelGastos gastos={allGasMes} titulo={tituloMes} onClose={() => setPanel(null)} />
      )}
      {panel === 'ahorro' && (
        <PanelAhorro ingresosTotal={ingresosTotal} gastosTotal={gastosTotal} titulo={tituloMes} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}
