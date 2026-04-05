import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import type { Ingreso, Gasto, Cuenta } from '../stores/useFinanzasStore';
import { useInversionesStore } from '../stores/useInversionesStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import type { Deuda } from '../stores/useDeudaStore';
import { usePresupuestoStore } from '../stores/usePresupuestoStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import type { Inmueble, InmuebleTipo } from '../stores/useInmuebleStore';
import { useSuscripcionesStore, importeMensual } from '../stores/useSuscripcionesStore';
import type { Suscripcion, SuscripcionCategoria, SuscripcionFrecuencia } from '../stores/useSuscripcionesStore';
import { useFacturasStore } from '../stores/useFacturasStore';
import { fmtEur, fmt, toEur } from '../utils/format';
import ModalIngreso from '../components/ModalIngreso';
import ModalGasto from '../components/ModalGasto';
import toast from 'react-hot-toast';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const CAT_ICONS: Record<string, string> = {
  Salario: '💼', Freelance: '💻', Autónomo: '📋', Dividendo: '📈', Alquiler: '🏠', Otros: '💰',
  Vivienda: '🏠', Alimentación: '🛒', Transporte: '🚌', Ocio: '🎮', Salud: '❤️', Suscripciones: '📺',
};

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function buildLast6Months(ingresos: Ingreso[], gastos: Gasto[], inmuebles: Inmueble[] = []) {
  const now = new Date();
  const rentalMensual = inmuebles
    .filter(inm => inm.generaRenta && inm.rentaMensualBruta > 0)
    .reduce((s, inm) => s + inm.rentaMensualBruta, 0);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = getMonthKey(d.getFullYear(), d.getMonth());
    const ing = ingresos.filter(x => x.fecha.startsWith(key)).reduce((s, x) => s + x.importe, 0);
    const gas = gastos.filter(x => x.fecha.startsWith(key)).reduce((s, x) => s + x.importe, 0);
    return { mes: MESES[d.getMonth()].slice(0, 3), ingresos: ing + rentalMensual, gastos: gas };
  });
}

// ——— Panel Ingresos ———
function PanelIngresos({ ingresos, titulo, onClose }: { ingresos: Ingreso[]; titulo: string; onClose: () => void }) {
  const { removeIngreso } = useFinanzasStore();
  const [editItem, setEditItem] = useState<Ingreso | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = (ing: Ingreso) => {
    if (window.confirm(`¿Eliminar "${ing.nombre}"?`)) { removeIngreso(ing.id); toast.success('Ingreso eliminado'); }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total · {ingresos.length} entradas</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{fmtEur(ingresos.reduce((s, i) => s + i.importe, 0))}</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ingresos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)', fontSize: 14 }}>
                No hay ingresos este mes.<br />
                <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}><Plus size={14} /> Añadir ingreso</button>
              </div>
            ) : ingresos.map((ing) => (
              <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{CAT_ICONS[ing.categoria] ?? '💰'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{ing.categoria} · {ing.fecha}{ing.recurrente ? ' · 🔄' : ''}</div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>+{fmtEur(ing.importe)}</span>
                <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Editar" onClick={() => setEditItem(ing)}><Pencil size={13} /></button>
                <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Eliminar" onClick={() => handleDelete(ing)}><Trash2 size={13} /></button>
              </div>
            ))}
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
    if (window.confirm(`¿Eliminar "${gas.nombre}"?`)) { removeGasto(gas.id); toast.success('Gasto eliminado'); }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total · {gastos.length} entradas</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(gastos.reduce((s, g) => s + g.importe, 0))}</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gastos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)', fontSize: 14 }}>
                No hay gastos este mes.<br />
                <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}><Plus size={14} /> Añadir gasto</button>
              </div>
            ) : gastos.map((gas) => (
              <div key={gas.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{CAT_ICONS[gas.categoria] ?? '💸'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gas.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{gas.categoria} · {gas.fecha}{gas.recurrente ? ' · 🔄' : ''}</div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>-{fmtEur(gas.importe)}</span>
                <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Editar" onClick={() => setEditItem(gas)}><Pencil size={13} /></button>
                <button className="btn-icon" style={{ padding: 5, flexShrink: 0 }} title="Eliminar" onClick={() => handleDelete(gas)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showAdd && <ModalGasto onClose={() => setShowAdd(false)} />}
      {editItem && <ModalGasto gasto={editItem} onClose={() => setEditItem(null)} />}
    </>
  );
}

// ——— Panel Ahorro ———
function PanelAhorro({ ingresosTotal, gastosTotal, prevIngresosTotal, prevGastosTotal, titulo, onClose }: {
  ingresosTotal: number; gastosTotal: number;
  prevIngresosTotal: number; prevGastosTotal: number;
  titulo: string; onClose: () => void;
}) {
  const ahorro = ingresosTotal - gastosTotal;
  const pct = ingresosTotal > 0 ? (ahorro / ingresosTotal) * 100 : 0;
  const prevAhorro = prevIngresosTotal - prevGastosTotal;
  const hasPrevData = prevIngresosTotal > 0 || prevGastosTotal > 0;
  const proyeccionAnual = ahorro * 12;

  const nivel = pct >= 30 ? 'excelente' : pct >= 10 ? 'bien' : 'mejorable';
  const mensajes: Record<string, { emoji: string; color: string; texto: string }> = {
    excelente: { emoji: '🚀', color: 'var(--green)', texto: '¡Excelente! Estás ahorrando más del 30% de tus ingresos. Sigue así y alcanzarás tu independencia financiera antes de lo esperado.' },
    bien:      { emoji: '👍', color: 'var(--blue)',  texto: 'Buen ritmo de ahorro. Con disciplina constante podrás aumentar este porcentaje y acelerar tu camino financiero.' },
    mejorable: { emoji: '⚠️', color: 'var(--amber)', texto: 'Tu tasa de ahorro está por debajo del 10%. Revisa tus gastos recurrentes y busca pequeñas optimizaciones.' },
  };
  const msg = mensajes[nivel];

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
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
            <span style={{ fontSize: 16, fontWeight: 700, color: msg.color }}>{pct.toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: msg.color, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text2)' }}>
            <span>0%</span><span style={{ color: 'var(--amber)' }}>10%</span><span style={{ color: 'var(--blue)' }}>30%</span><span>100%</span>
          </div>
        </div>

        {/* Mensaje motivacional */}
        <div style={{ background: `${msg.color}12`, border: `1px solid ${msg.color}33`, borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>{msg.emoji}</span>
          <div>
            <div style={{ fontWeight: 700, color: msg.color, marginBottom: 4, fontSize: 14, textTransform: 'capitalize' }}>{nivel}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{msg.texto}</div>
          </div>
        </div>

        {/* Comparativa mes anterior */}
        {hasPrevData && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text2)' }}>Comparativa con el mes anterior</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Ingresos', curr: ingresosTotal, prev: prevIngresosTotal, color: 'var(--green)', betterWhenHigher: true },
                { label: 'Gastos',   curr: gastosTotal,   prev: prevGastosTotal,   color: 'var(--red)',   betterWhenHigher: false },
                { label: 'Ahorro',   curr: ahorro,        prev: prevAhorro,        color: ahorro >= 0 ? 'var(--green)' : 'var(--red)', betterWhenHigher: true },
              ].map(({ label, curr, prev, color, betterWhenHigher }) => {
                const diff = curr - prev;
                const isGood = betterWhenHigher ? diff >= 0 : diff <= 0;
                return (
                  <div key={label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color }}>{fmtEur(curr)}</div>
                    {prev > 0 && (
                      <div style={{ fontSize: 11, color: isGood ? 'var(--green)' : 'var(--red)', marginTop: 3 }}>
                        {diff >= 0 ? '▲' : '▼'} {fmtEur(Math.abs(diff))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Proyección anual */}
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--blue)' }}>📅 Proyección anual</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>Si mantienes este ritmo durante 12 meses:</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Ahorro proyectado</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: proyeccionAnual >= 0 ? 'var(--blue)' : 'var(--red)' }}>{fmtEur(proyeccionAnual)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Modal A Invertir ———
function ModalInvertir({ eurInvertir, planInversion, totalIng, onClose }: {
  eurInvertir: number; planInversion: number; totalIng: number; onClose: () => void;
}) {
  const { cuentas, addGasto, updateCuenta } = useFinanzasStore();
  const { posiciones } = useInversionesStore();

  const [importeReal, setImporteReal] = useState(Math.round(eurInvertir));
  const [accion, setAccion] = useState<'gasto' | 'cuenta' | 'dividir' | null>(null);
  const [cuentaId, setCuentaId] = useState('');
  const [divisiones, setDivisiones] = useState<Record<string, number>>({});

  const totalDividido = Object.values(divisiones).reduce((s, v) => s + v, 0);
  const restante = importeReal - totalDividido;
  const pctAjustado = totalIng > 0 ? (importeReal / totalIng) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);

  const handleRegistrarGasto = () => {
    addGasto({ categoria: 'Otros', nombre: 'Inversión', importe: importeReal, fecha: today, recurrente: false });
    toast.success(`Inversión registrada: ${fmtEur(importeReal)}`);
    onClose();
  };

  const handleTransferirCuenta = () => {
    const c = cuentas.find(x => x.id === cuentaId);
    if (!c) { toast.error('Selecciona una cuenta'); return; }
    updateCuenta(c.id, { saldo: c.saldo + importeReal });
    addGasto({ categoria: 'Otros', nombre: `Inversión → ${c.nombre}`, importe: importeReal, fecha: today, recurrente: false });
    toast.success(`${fmtEur(importeReal)} transferido a ${c.nombre}`);
    onClose();
  };

  const handleDividirInversiones = () => {
    let registrados = 0;
    posiciones.forEach(pos => {
      const imp = divisiones[pos.id];
      if (imp && imp > 0) {
        addGasto({ categoria: 'Otros', nombre: `Inversión → ${pos.simbolo}`, importe: imp, fecha: today, recurrente: false });
        registrados++;
      }
    });
    if (registrados === 0) { toast.error('Asigna importes a al menos una posición'); return; }
    toast.success(`${registrados} gastos de inversión registrados`);
    onClose();
  };

  const accionCard = (key: 'gasto' | 'cuenta' | 'dividir', emoji: string, titulo: string, desc: string, borderColor: string, bgColor: string, children: React.ReactNode) => (
    <div style={{ border: `1px solid ${accion === key ? borderColor : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', background: accion === key ? bgColor : 'var(--bg3)' }}
        onClick={() => setAccion(accion === key ? null : key)}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{desc}</div>
        </div>
        <div style={{ transform: accion === key ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          <ChevronRight size={16} color="var(--text2)" />
        </div>
      </div>
      {accion === key && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>{children}</div>
      )}
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>A Invertir</h2>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{planInversion}% de los ingresos del mes</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Importe ajustable */}
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1 }}>Importe a invertir</div>
                <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--blue)', letterSpacing: '-1px' }}>{fmtEur(importeReal)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>Calculado ({planInversion}%)</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: importeReal === Math.round(eurInvertir) ? 'var(--text2)' : 'var(--amber)' }}>{fmtEur(eurInvertir)}</div>
                {importeReal !== Math.round(eurInvertir) && (
                  <div style={{ fontSize: 11, color: 'var(--amber)' }}>Ajustado: {pctAjustado.toFixed(1)}%</div>
                )}
              </div>
            </div>
            <input type="range" min={0} max={Math.ceil(totalIng)} step={10} value={importeReal}
              onChange={(e) => setImporteReal(parseInt(e.target.value))} className="slider" style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>
              <span>0€</span><span>{fmtEur(totalIng / 2)}</span><span>{fmtEur(totalIng)}</span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Elige cómo registrar</div>

          {accionCard('gasto', '💼', 'Registrar como inversión', `Crea un gasto de ${fmtEur(importeReal)} en tu historial`,
            'rgba(59,130,246,0.5)', 'rgba(59,130,246,0.06)',
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Se creará un gasto de <strong>{fmtEur(importeReal)}</strong> con nombre "Inversión" en categoría Otros.</div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }} onClick={handleRegistrarGasto}>✓ Confirmar registro</button>
            </div>
          )}

          {accionCard('cuenta', '🏦', 'Transferir a cuenta de inversión', 'Añade el importe al saldo de una cuenta',
            'rgba(34,197,94,0.5)', 'rgba(34,197,94,0.06)',
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cuentas.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: cuentaId === c.id ? 'rgba(34,197,94,0.1)' : 'var(--bg)', border: `1px solid ${cuentaId === c.id ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}
                  onClick={() => setCuentaId(c.id)}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{c.tipo} · {c.divisa}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(c.saldo)} {c.divisa}</div>
                    {cuentaId === c.id && <div style={{ fontSize: 11, color: 'var(--green)' }}>→ {fmt(c.saldo + importeReal)} {c.divisa}</div>}
                  </div>
                </div>
              ))}
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }} disabled={!cuentaId} onClick={handleTransferirCuenta}>
                ✓ Transferir {fmtEur(importeReal)} a cuenta seleccionada
              </button>
            </div>
          )}

          {accionCard('dividir', '📊', 'Dividir entre posiciones', 'Distribuye el importe entre tu cartera',
            'rgba(167,139,250,0.5)', 'rgba(167,139,250,0.06)',
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text2)' }}>Total a distribuir: {fmtEur(importeReal)}</span>
                <span style={{ fontWeight: 600, color: restante < 0 ? 'var(--red)' : restante === 0 ? 'var(--green)' : 'var(--text2)' }}>Restante: {fmtEur(restante)}</span>
              </div>
              {posiciones.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text2)' }}>No tienes posiciones en cartera.</div>
                : posiciones.map(pos => (
                  <div key={pos.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{pos.simbolo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{pos.nombre}</div>
                    </div>
                    <input type="number" min={0} step={10} value={divisiones[pos.id] ?? ''} placeholder="0"
                      onChange={(e) => setDivisiones({ ...divisiones, [pos.id]: parseFloat(e.target.value) || 0 })}
                      className="input" style={{ width: 90, padding: '4px 8px', fontSize: 13, textAlign: 'right' }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>€</span>
                  </div>
                ))
              }
              <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(importeReal > 0 ? (totalDividido / importeReal) * 100 : 0, 100)}%`, background: totalDividido > importeReal ? 'var(--red)' : 'var(--purple)', borderRadius: 2, transition: 'width 0.2s' }} />
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }} disabled={totalDividido === 0} onClick={handleDividirInversiones}>
                ✓ Registrar {Object.values(divisiones).filter(v => v > 0).length} gastos de inversión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ——— Modal Gastos por Categoría ———
const CAT_COLORS_PIE: Record<string, string> = {
  Vivienda: '#3b82f6', Alimentación: '#22c55e', Transporte: '#f59e0b',
  Ocio: '#a78bfa', Salud: '#ec4899', Suscripciones: '#06b6d4', Otros: '#6b7280',
};

function ModalGastosDesglose({ gastos, prevGastos, totalGas, titulo, onClose }: {
  gastos: Gasto[]; prevGastos: Gasto[]; totalGas: number; titulo: string; onClose: () => void;
}) {
  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const byCategory = gastos.reduce<Record<string, number>>((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.importe;
    return acc;
  }, {});
  const prevByCategory = prevGastos.reduce<Record<string, number>>((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.importe;
    return acc;
  }, {});
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const pieData = sorted.map(([cat, value]) => ({ name: cat, value, color: CAT_COLORS_PIE[cat] ?? '#6b7280' }));

  return (
    <>
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Gastos por categoría</h2>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{titulo}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowAdd(true)}>
                <Plus size={14} /> Añadir
              </button>
              <button className="btn-icon" onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          {/* Total */}
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total · {gastos.length} gastos</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(totalGas)}</span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Detail view de categoría activa */}
            {catActiva ? (
              <div>
                <button className="btn-icon" style={{ fontSize: 13, marginBottom: 12, padding: '5px 10px' }} onClick={() => setCatActiva(null)}>
                  ← Volver al resumen
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: CAT_COLORS_PIE[catActiva] ?? '#6b7280', flexShrink: 0 }} />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{CAT_ICONS[catActiva] ?? '💸'} {catActiva}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(byCategory[catActiva])}</span>
                </div>
                {prevByCategory[catActiva] != null && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                    Mes anterior: {fmtEur(prevByCategory[catActiva])} &nbsp;
                    {byCategory[catActiva] > prevByCategory[catActiva]
                      ? <span style={{ color: 'var(--red)' }}>↑ +{fmtEur(byCategory[catActiva] - prevByCategory[catActiva])}</span>
                      : <span style={{ color: 'var(--green)' }}>↓ -{fmtEur(prevByCategory[catActiva] - byCategory[catActiva])}</span>
                    }
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {gastos.filter(g => g.categoria === catActiva).map(g => (
                    <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{g.nombre}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{g.fecha}{g.recurrente ? ' · 🔄' : ''}</div>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 14 }}>-{fmtEur(g.importe)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Donut chart interactivo */}
                {pieData.length > 0 && (
                  <div>
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
                          paddingAngle={2} dataKey="value" cursor="pointer"
                          onClick={(entry) => setCatActiva(entry.name ?? null)}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.9} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                          formatter={(v: unknown) => [fmtEur(v as number)]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center', marginTop: -4, marginBottom: 8 }}>
                      Haz click en una porción para ver el detalle
                    </div>
                  </div>
                )}

                {/* Lista expandible por categoría */}
                {sorted.length === 0
                  ? <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)', fontSize: 14 }}>No hay gastos este mes</div>
                  : sorted.map(([cat, total]) => {
                    const pct = totalGas > 0 ? (total / totalGas) * 100 : 0;
                    const esMayor = (prevByCategory[cat] ?? 0) > 0 && total > (prevByCategory[cat] ?? 0);
                    const color = CAT_COLORS_PIE[cat] ?? '#6b7280';
                    return (
                      <div key={cat} className="card-hover" style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, cursor: 'pointer' }}
                        onClick={() => setCatActiva(cat)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{CAT_ICONS[cat] ?? '💸'} {cat}</span>
                            {esMayor && <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700 }} title={`Mes anterior: ${fmtEur(prevByCategory[cat])}`}>↑</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtEur(total)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 36, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                            <ChevronRight size={13} color="var(--text2)" />
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })
                }
              </>
            )}
          </div>

          {/* Footer */}
          {!catActiva && (
            <div style={{ flexShrink: 0, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
                Ver lista completa de gastos
              </button>
            </div>
          )}
        </div>
      </div>
      {showAdd && <ModalGasto onClose={() => setShowAdd(false)} />}
    </>
  );
}

// ——— Modal Dinero Libre ———
function ModalLibre({ eurLibre, totalIng, totalGas, planInversion, onClose }: {
  eurLibre: number; totalIng: number; totalGas: number; planInversion: number; onClose: () => void;
}) {
  const { cuentas, addIngreso, updateCuenta, setPlanInversion } = useFinanzasStore();
  const [accion, setAccion] = useState<'inversion' | 'emergencia' | 'ahorro' | 'simular' | null>(null);
  const [newPct, setNewPct] = useState(planInversion);
  const [cuentaEmId, setCuentaEmId] = useState('');
  const [importeEm, setImporteEm] = useState(Math.round(eurLibre));
  const [simPct, setSimPct] = useState(planInversion);

  const newInvertir = totalIng * newPct / 100;
  const newLibre = totalIng - totalGas - newInvertir;
  const simInvertir = totalIng * simPct / 100;
  const simLibre = totalIng - totalGas - simInvertir;
  const today = new Date().toISOString().slice(0, 10);

  const handleAumentarInversion = () => {
    setPlanInversion(newPct);
    toast.success(`Plan actualizado al ${newPct}% de inversión 📈`);
    onClose();
  };

  const handleFondoEmergencia = () => {
    const c = cuentas.find(x => x.id === cuentaEmId);
    if (!c) { toast.error('Selecciona una cuenta destino'); return; }
    if (importeEm <= 0) { toast.error('Introduce un importe mayor que 0'); return; }
    updateCuenta(c.id, { saldo: c.saldo + importeEm });
    toast.success(`${fmtEur(importeEm)} añadidos al fondo de emergencias en "${c.nombre}"`);
    onClose();
  };

  const handleAhorroExtra = () => {
    addIngreso({ categoria: 'Otros', nombre: 'Ahorro extra', importe: eurLibre, fecha: today, recurrente: false });
    toast.success(`Ahorro extra registrado: ${fmtEur(eurLibre)} 💰`);
    onClose();
  };

  const expandable = (key: typeof accion, emoji: string, label: string, desc: string, borderClr: string, bgClr: string, children: React.ReactNode) => (
    <div style={{ border: `1px solid ${accion === key ? borderClr : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', background: accion === key ? bgClr : 'var(--bg3)' }}
        onClick={() => setAccion(accion === key ? null : key)}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{desc}</div>
        </div>
        <div style={{ transform: accion === key ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          <ChevronRight size={16} color="var(--text2)" />
        </div>
      </div>
      {accion === key && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>{children}</div>
      )}
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Dinero libre</h2>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Disponible tras inversión y gastos</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Importe */}
          <div style={{ textAlign: 'center', padding: '14px 0 12px', background: eurLibre >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${eurLibre >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: eurLibre >= 0 ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Dinero disponible</div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: eurLibre >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(eurLibre)}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{fmtEur(totalIng)} − {fmtEur(totalIng * planInversion / 100)} − {fmtEur(totalGas)}</div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>¿Qué hago con este dinero?</div>

          {/* 1. Aumentar inversión */}
          {expandable('inversion', '📈', 'Aumentar inversión', 'Sube el % del plan y aplícalo ahora',
            'rgba(59,130,246,0.5)', 'rgba(59,130,246,0.06)',
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Nuevo % de inversión</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>{newPct}%</span>
              </div>
              <input type="range" min={0} max={80} value={newPct} onChange={(e) => setNewPct(parseInt(e.target.value))} className="slider" style={{ width: '100%' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>A invertir</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue)' }}>{fmtEur(newInvertir)}</div>
                  {newPct !== planInversion && <div style={{ fontSize: 10, color: newPct > planInversion ? 'var(--blue)' : 'var(--text2)' }}>{newPct > planInversion ? '+' : ''}{fmtEur(newInvertir - totalIng * planInversion / 100)}</div>}
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>Quedaría libre</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: newLibre >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(newLibre)}</div>
                  {newPct !== planInversion && <div style={{ fontSize: 10, color: newLibre < eurLibre ? 'var(--red)' : 'var(--green)' }}>{newLibre > eurLibre ? '+' : ''}{fmtEur(newLibre - eurLibre)}</div>}
                </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }} onClick={handleAumentarInversion}>
                ✓ Aplicar {newPct}% al plan de inversión
              </button>
            </div>
          )}

          {/* 2. Fondo de emergencias */}
          {expandable('emergencia', '🛡️', 'Añadir a fondo de emergencias', 'Transfiere a una cuenta de ahorro',
            'rgba(34,197,94,0.5)', 'rgba(34,197,94,0.06)',
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Importe a transferir</label>
                <input type="number" min={0} step={10} value={importeEm || ''} placeholder="0"
                  onChange={(e) => setImporteEm(parseFloat(e.target.value) || 0)}
                  className="input" style={{ width: '100%', fontSize: 16, fontWeight: 700 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Cuenta destino</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cuentas.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: cuentaEmId === c.id ? 'rgba(34,197,94,0.1)' : 'var(--bg)', border: `1px solid ${cuentaEmId === c.id ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => setCuentaEmId(c.id)}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{c.tipo}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(c.saldo)} {c.divisa}</div>
                        {cuentaEmId === c.id && importeEm > 0 && <div style={{ fontSize: 11, color: 'var(--green)' }}>→ {fmt(c.saldo + importeEm)} {c.divisa}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }} disabled={!cuentaEmId || importeEm <= 0} onClick={handleFondoEmergencia}>
                ✓ Transferir {fmtEur(importeEm)} al fondo
              </button>
            </div>
          )}

          {/* 3. Registrar ahorro extra */}
          {expandable('ahorro', '💰', 'Registrar como ahorro extra', 'Crea un ingreso de ahorro en tu historial',
            'rgba(245,158,11,0.5)', 'rgba(245,158,11,0.06)',
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                Se registrará un ingreso de <strong>{fmtEur(eurLibre)}</strong> con nombre "Ahorro extra" en categoría Otros.
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }} onClick={handleAhorroExtra}>
                ✓ Registrar {fmtEur(eurLibre)} como ahorro extra
              </button>
            </div>
          )}

          {/* 4. Simulador */}
          {expandable('simular', '🔮', 'Simular escenarios', 'Explora distintas distribuciones del dinero libre',
            'rgba(167,139,250,0.5)', 'rgba(167,139,250,0.06)',
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>% de inversión</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--purple)' }}>{simPct}%</span>
              </div>
              <input type="range" min={0} max={80} value={simPct} onChange={(e) => setSimPct(parseInt(e.target.value))} className="slider" style={{ width: '100%' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Ingresos', val: totalIng, color: 'var(--green)' },
                  { label: 'Invertido', val: simInvertir, color: 'var(--blue)' },
                  { label: 'Libre', val: simLibre, color: simLibre >= 0 ? 'var(--green)' : 'var(--red)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>{fmtEur(val)}</div>
                  </div>
                ))}
              </div>
              {simPct !== planInversion && (
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                  vs actual: {simLibre > eurLibre ? '+' : ''}{fmtEur(simLibre - eurLibre)} dinero libre
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ——— Modal Deuda ———
function ModalDeuda({ deuda, onClose }: { deuda?: Deuda; onClose: () => void }) {
  const { addDeuda, updateDeuda } = useDeudaStore();
  const isEdit = !!deuda;
  const [form, setForm] = useState({
    tipo: (deuda?.tipo ?? 'Préstamo Personal') as Deuda['tipo'],
    nombre: deuda?.nombre ?? '',
    importeTotal: deuda?.importeTotal ?? 0,
    importePendiente: deuda?.importePendiente ?? 0,
    cuotaMensual: deuda?.cuotaMensual ?? 0,
    interes: deuda?.interes ?? 0,
    fechaVencimiento: deuda?.fechaVencimiento ?? '',
    divisa: (deuda?.divisa ?? 'EUR') as Deuda['divisa'],
  });
  const handleSubmit = () => {
    if (!form.nombre) { toast.error('Introduce el nombre'); return; }
    if (isEdit) { updateDeuda(deuda!.id, form); toast.success('Deuda actualizada'); }
    else { addDeuda(form); toast.success('Deuda añadida'); }
    onClose();
  };
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Nueva'} deuda</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Hipoteca banco" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Tipo</label>
              <select className="select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Deuda['tipo'] })}>
                {['Hipoteca','Préstamo Personal','Tarjeta','Coche','Estudiante','Otro'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Divisa</label>
              <select className="select" value={form.divisa} onChange={(e) => setForm({ ...form, divisa: e.target.value as Deuda['divisa'] })}>
                <option>EUR</option><option>USD</option><option>GBP</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Importe total</label>
              <input className="input" type="number" min={0} value={form.importeTotal || ''} onChange={(e) => setForm({ ...form, importeTotal: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Pendiente</label>
              <input className="input" type="number" min={0} value={form.importePendiente || ''} onChange={(e) => setForm({ ...form, importePendiente: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Cuota mensual</label>
              <input className="input" type="number" min={0} value={form.cuotaMensual || ''} onChange={(e) => setForm({ ...form, cuotaMensual: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Interés anual (%)</label>
              <input className="input" type="number" min={0} step={0.1} value={form.interes || ''} onChange={(e) => setForm({ ...form, interes: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="label">Fecha de vencimiento</label>
            <input className="input" type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>{isEdit ? 'Actualizar' : 'Añadir'} deuda</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Tab Deudas ———
function TabDeudas() {
  const { deudas, removeDeuda } = useDeudaStore();
  const [showModal, setShowModal] = useState(false);
  const [editDeuda, setEditDeuda] = useState<Deuda | null>(null);
  const TIPO_ICONS: Record<string, string> = { 'Hipoteca': '🏠', 'Préstamo Personal': '💳', 'Tarjeta': '💳', 'Coche': '🚗', 'Estudiante': '📚', 'Otro': '📄' };
  const totalPendiente = deudas.reduce((s, d) => s + d.importePendiente, 0);
  const totalCuotas = deudas.reduce((s, d) => s + d.cuotaMensual, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Total pendiente</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(totalPendiente)}</div></div>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Cuotas / mes</div><div style={{ fontSize: 22, fontWeight: 700 }}>{fmtEur(totalCuotas)}</div></div>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Nº deudas</div><div style={{ fontSize: 22, fontWeight: 700 }}>{deudas.length}</div></div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Mis deudas y pasivos</h3>
          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowModal(true)}><Plus size={14} /> Añadir</button>
        </div>
        {deudas.length === 0 ? (
          <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: 20 }}>Sin deudas registradas 🎉</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deudas.map((d) => {
              const pct = d.importeTotal > 0 ? ((d.importeTotal - d.importePendiente) / d.importeTotal) * 100 : 0;
              return (
                <div key={d.id} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{TIPO_ICONS[d.tipo] ?? '📄'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{d.nombre}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{d.tipo} · {d.interes}% anual · vence {d.fechaVencimiento}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" style={{ padding: 5 }} onClick={() => setEditDeuda(d)}><Pencil size={12} /></button>
                      <button className="btn-icon" style={{ padding: 5 }} onClick={() => { if (window.confirm(`¿Eliminar "${d.nombre}"?`)) removeDeuda(d.id); }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Pendiente</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(d.importePendiente)}</div></div>
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Cuota/mes</div><div style={{ fontSize: 14, fontWeight: 700 }}>{fmtEur(d.cuotaMensual)}</div></div>
                    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Total original</div><div style={{ fontSize: 14, fontWeight: 700 }}>{fmtEur(d.importeTotal)}</div></div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>Amortizado {pct.toFixed(0)}%</span>
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtEur(d.importeTotal - d.importePendiente)} / {fmtEur(d.importeTotal)}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--green)' }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showModal && <ModalDeuda onClose={() => setShowModal(false)} />}
      {editDeuda && <ModalDeuda deuda={editDeuda} onClose={() => setEditDeuda(null)} />}
    </div>
  );
}

// ——— Tab Presupuestos ———
const CAT_ICONS_BUDGET: Record<string, string> = {
  Vivienda: '🏠', Alimentación: '🛒', Transporte: '🚌', Ocio: '🎮', Salud: '❤️', Suscripciones: '📺', Otros: '💰',
};

function TabPresupuestos({ gastos, tituloMes }: { gastos: Gasto[]; tituloMes: string }) {
  const { presupuestos, setPresupuesto } = usePresupuestoStore();
  const byCategory = gastos.reduce<Record<string, number>>((acc, g) => { acc[g.categoria] = (acc[g.categoria] || 0) + g.importe; return acc; }, {});
  const totalLimite = presupuestos.reduce((s, p) => s + p.limite, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.importe, 0);
  const alertas = presupuestos.filter(p => p.limite > 0 && (byCategory[p.categoria] ?? 0) / p.limite >= 0.9);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Total presupuesto</div><div style={{ fontSize: 22, fontWeight: 700 }}>{fmtEur(totalLimite)}</div></div>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Gastado {tituloMes}</div><div style={{ fontSize: 22, fontWeight: 700, color: totalGastos > totalLimite && totalLimite > 0 ? 'var(--red)' : 'var(--text)' }}>{fmtEur(totalGastos)}</div></div>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Alertas activas</div><div style={{ fontSize: 22, fontWeight: 700, color: alertas.length > 0 ? 'var(--amber)' : 'var(--green)' }}>{alertas.length}</div></div>
      </div>
      {alertas.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 6 }}>⚠️ Presupuestos al límite ({tituloMes})</div>
          {alertas.map(p => (
            <div key={p.categoria} style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              · {CAT_ICONS_BUDGET[p.categoria]} {p.categoria}: {fmtEur(byCategory[p.categoria] ?? 0)} / {fmtEur(p.limite)} ({(((byCategory[p.categoria] ?? 0) / p.limite) * 100).toFixed(0)}%)
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Límites por categoría</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {presupuestos.map(p => {
            const gastado = byCategory[p.categoria] ?? 0;
            const pct = p.limite > 0 ? Math.min((gastado / p.limite) * 100, 100) : 0;
            const color = pct >= 100 ? 'var(--red)' : pct >= 90 ? 'var(--amber)' : 'var(--green)';
            return (
              <div key={p.categoria}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{CAT_ICONS_BUDGET[p.categoria] ?? '💸'}</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{p.categoria}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>{fmtEur(gastado)} /</span>
                    <input type="number" min={0} step={50} value={p.limite || ''} placeholder="Sin límite"
                      onChange={(e) => setPresupuesto(p.categoria, parseFloat(e.target.value) || 0)}
                      className="input" style={{ width: 90, padding: '3px 8px', fontSize: 13, fontWeight: 700, textAlign: 'right' }} />
                    <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 24 }}>€/mes</span>
                  </div>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: color, transition: 'width 0.3s' }} /></div>
                {p.limite > 0 && (
                  <div style={{ fontSize: 11, color: pct >= 90 ? color : 'var(--text2)', marginTop: 3 }}>
                    {pct >= 100 ? `¡Superado en ${fmtEur(gastado - p.limite)}!` : pct >= 90 ? `Solo quedan ${fmtEur(p.limite - gastado)}` : `Disponible: ${fmtEur(p.limite - gastado)}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ——— Tab Proyección ———
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function TabProyeccion({ ingresos, gastos }: { ingresos: Ingreso[]; gastos: Gasto[] }) {
  const now = new Date();
  const recIngreso = ingresos.filter(i => i.recurrente).reduce((s, i) => s + i.importe, 0);
  const recGasto = gastos.filter(g => g.recurrente).reduce((s, g) => s + g.importe, 0);
  const [extraOrdMes, setExtraOrdMes] = useState<Record<number, number>>({});

  const proyeccion = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ing = recIngreso + (extraOrdMes[i] ?? 0);
    const gas = recGasto;
    return { mes: MESES_CORTOS[d.getMonth()], ing, gas, flujo: ing - gas, idx: i };
  });

  let ac = 0;
  const proyAc = proyeccion.map(p => { ac += p.flujo; return { ...p, acumulado: ac }; });
  const mesesNeg = proyeccion.filter(p => p.flujo < 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Ingreso recurrente/mes</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{fmtEur(recIngreso)}</div></div>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Gasto recurrente/mes</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(recGasto)}</div></div>
        <div className="card"><div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Flujo base/mes</div><div style={{ fontSize: 20, fontWeight: 700, color: recIngreso - recGasto >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(recIngreso - recGasto)}</div></div>
      </div>
      {mesesNeg > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>⚠️ {mesesNeg} mes{mesesNeg > 1 ? 'es' : ''} con flujo negativo proyectado</div>
        </div>
      )}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Proyección flujo de caja 12 meses</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={proyAc} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [fmtEur(v as number)]} />
            <Bar dataKey="ing" name="Ingresos" fill="var(--green)" radius={[4,4,0,0]} />
            <Bar dataKey="gas" name="Gastos" fill="var(--red)" radius={[4,4,0,0]} />
            <Bar dataKey="flujo" name="Flujo neto" fill="var(--blue)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Eventos extraordinarios</h3>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Balance anual acumulado: <strong style={{ color: ac >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(ac)}</strong></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {proyAc.slice(0, 4).map((p, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{p.mes} extra</div>
              <input type="number" min={-9999} step={50} value={extraOrdMes[i] || ''} placeholder="0"
                onChange={(e) => setExtraOrdMes({ ...extraOrdMes, [i]: parseFloat(e.target.value) || 0 })}
                className="input" style={{ padding: '4px 6px', fontSize: 12, width: '100%' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {proyAc.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr', gap: 8, padding: '7px 0', borderBottom: i < 11 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{p.mes}</span>
              <span style={{ fontSize: 12, color: 'var(--green)' }}>{fmtEur(p.ing)}</span>
              <span style={{ fontSize: 12, color: 'var(--red)' }}>-{fmtEur(p.gas)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: p.flujo >= 0 ? 'var(--green)' : 'var(--red)' }}>{p.flujo >= 0 ? '+' : ''}{fmtEur(p.flujo)}</span>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>Ac: {fmtEur(p.acumulado)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ——— Inmueble helpers ———
const INMUEBLE_TIPO_ICONS: Record<string, string> = {
  'Residencia habitual': '🏡', 'Piso alquiler': '🏢', 'Local alquiler': '🏪',
  'Garaje': '🚗', 'Solar': '🌿', 'Otro': '🏗️',
};
const INMUEBLE_TIPOS: InmuebleTipo[] = ['Residencia habitual','Piso alquiler','Local alquiler','Garaje','Solar','Otro'];

function gastosTotalMes(inm: Inmueble): number {
  return inm.gastosIbiMes + inm.gastosComunidad + inm.gastosSeguro + inm.gastosMantenimiento + inm.gastosOtros;
}

// ——— Modal Inmueble (Add/Edit) ———
function ModalInmueble({ inmueble, onClose }: { inmueble?: Inmueble; onClose: () => void }) {
  const { addInmueble, updateInmueble } = useInmuebleStore();
  const { deudas } = useDeudaStore();
  const isEdit = !!inmueble;
  const emptyForm = {
    nombre: '', tipo: 'Piso alquiler' as InmuebleTipo, valorActual: 0, precioCompra: 0,
    añoAdquisicion: new Date().getFullYear(), superficie: 0, direccion: '',
    hipotecaAsociada: '', generaRenta: false, rentaMensualBruta: 0,
    gastosIbiMes: 0, gastosComunidad: 0, gastosSeguro: 0, gastosMantenimiento: 0, gastosOtros: 0, notas: '',
  };
  const [form, setForm] = useState<Omit<Inmueble,'id'>>(inmueble ? { ...inmueble } : emptyForm);
  const f = (k: keyof typeof form, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.nombre) { toast.error('Introduce el nombre del inmueble'); return; }
    if (form.valorActual <= 0) { toast.error('El valor actual debe ser mayor que 0'); return; }
    if (isEdit) { updateInmueble(inmueble!.id, form); toast.success('Inmueble actualizado'); }
    else { addInmueble(form); toast.success('Inmueble añadido 🏠'); }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Nuevo'} inmueble</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Nombre</label>
              <input className="input" value={form.nombre} onChange={(e) => f('nombre', e.target.value)} placeholder="Ej: Piso centro Madrid" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="select" value={form.tipo} onChange={(e) => f('tipo', e.target.value)}>
                {INMUEBLE_TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Año de adquisición</label>
              <input className="input" type="number" min={1900} max={2100} value={form.añoAdquisicion || ''} onChange={(e) => f('añoAdquisicion', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Valor actual (€)</label>
              <input className="input" type="number" min={0} value={form.valorActual || ''} onChange={(e) => f('valorActual', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Precio de compra (€)</label>
              <input className="input" type="number" min={0} value={form.precioCompra || ''} onChange={(e) => f('precioCompra', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Superficie (m²)</label>
              <input className="input" type="number" min={0} value={form.superficie || ''} onChange={(e) => f('superficie', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Hipoteca asociada</label>
              <select className="select" value={form.hipotecaAsociada} onChange={(e) => f('hipotecaAsociada', e.target.value)}>
                <option value="">Sin hipoteca</option>
                {deudas.map(d => <option key={d.id} value={d.id}>{d.nombre} ({fmtEur(d.importePendiente)})</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Dirección</label>
              <input className="input" value={form.direccion} onChange={(e) => f('direccion', e.target.value)} placeholder="Calle, número, ciudad" />
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => f('generaRenta', !form.generaRenta)}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>💰 Genera renta de alquiler</span>
            <div style={{ width: 40, height: 22, borderRadius: 11, background: form.generaRenta ? 'var(--green)' : 'var(--bg)', border: `2px solid ${form.generaRenta ? 'var(--green)' : 'var(--border)'}`, position: 'relative', transition: 'all 0.2s' }}>
              <div style={{ position: 'absolute', top: 1, left: form.generaRenta ? 19 : 1, width: 16, height: 16, borderRadius: '50%', background: form.generaRenta ? 'white' : 'var(--text2)', transition: 'left 0.2s' }} />
            </div>
          </div>

          {form.generaRenta && (
            <div>
              <label className="label">Renta mensual bruta (€)</label>
              <input className="input" type="number" min={0} value={form.rentaMensualBruta || ''} onChange={(e) => f('rentaMensualBruta', parseFloat(e.target.value) || 0)} />
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text2)' }}>Gastos mensuales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                ['gastosIbiMes', 'IBI mensual (anual/12)'],
                ['gastosComunidad', 'Comunidad'],
                ['gastosSeguro', 'Seguro hogar'],
                ['gastosMantenimiento', 'Mantenimiento'],
                ['gastosOtros', 'Otros gastos'],
              ] as [keyof typeof form, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="label">{label} (€/mes)</label>
                  <input className="input" type="number" min={0} step={5} value={(form[key] as number) || ''} onChange={(e) => f(key, parseFloat(e.target.value) || 0)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <input className="input" value={form.notas} onChange={(e) => f('notas', e.target.value)} placeholder="Notas adicionales..." />
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>{isEdit ? 'Actualizar' : 'Añadir'} inmueble</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Panel Detalle Inmueble ———
function PanelDetalleInmueble({ inmueble, onClose, onEdit }: { inmueble: Inmueble; onClose: () => void; onEdit: () => void }) {
  const { deudas } = useDeudaStore();
  const hipoteca = deudas.find(d => d.id === inmueble.hipotecaAsociada);

  const plusvalia = inmueble.valorActual - inmueble.precioCompra;
  const plusvaliaPct = inmueble.precioCompra > 0 ? (plusvalia / inmueble.precioCompra) * 100 : 0;
  const gastosAnuales = gastosTotalMes(inmueble) * 12;
  const rentaBrutaAnual = inmueble.rentaMensualBruta * 12;
  const rentaNetaMensual = inmueble.rentaMensualBruta - gastosTotalMes(inmueble);
  const rentaNetaAnual = rentaNetaMensual * 12;
  const yieldBruto = inmueble.valorActual > 0 ? (rentaBrutaAnual / inmueble.valorActual) * 100 : 0;
  const yieldNeto = inmueble.valorActual > 0 ? (rentaNetaAnual / inmueble.valorActual) * 100 : 0;
  const roi = inmueble.precioCompra > 0 ? (rentaNetaAnual / inmueble.precioCompra) * 100 : 0;
  const equity = inmueble.valorActual - (hipoteca?.importePendiente ?? 0);
  const añosEnPropiedad = new Date().getFullYear() - inmueble.añoAdquisicion;

  // Bar chart data: 12 months (same data, for visualization)
  const MESES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const barData = MESES_C.map(mes => ({ mes, ingresos: inmueble.rentaMensualBruta, gastos: gastosTotalMes(inmueble) }));

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>{INMUEBLE_TIPO_ICONS[inmueble.tipo] ?? '🏠'}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{inmueble.nombre}</h2>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{inmueble.tipo} · {inmueble.superficie}m² · {inmueble.direccion}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
            <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={onEdit}>Editar</button>
            <button className="btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Valoración */}
          <div style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>Valoración · {añosEnPropiedad} años en propiedad</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Valor actual</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtEur(inmueble.valorActual)}</div>
                {inmueble.superficie > 0 && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtEur(inmueble.valorActual / inmueble.superficie)}/m²</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Precio compra</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtEur(inmueble.precioCompra)}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>año {inmueble.añoAdquisicion}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Plusvalía latente</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: plusvalia >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {plusvalia >= 0 ? '+' : ''}{fmtEur(plusvalia)}
                </div>
                <div style={{ fontSize: 11, color: plusvalia >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {plusvaliaPct >= 0 ? '+' : ''}{plusvaliaPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Hipoteca */}
          {hipoteca && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🏦 Hipoteca: {hipoteca.nombre}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Capital pendiente</div>
                  <div style={{ fontWeight: 700, color: 'var(--red)' }}>{fmtEur(hipoteca.importePendiente)}</div>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Cuota mensual</div>
                  <div style={{ fontWeight: 700 }}>{fmtEur(hipoteca.cuotaMensual)}</div>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Equity actual</div>
                  <div style={{ fontWeight: 700, color: 'var(--green)' }}>{fmtEur(equity)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Rentabilidad */}
          {inmueble.generaRenta && (
            <>
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>💰 Análisis de rentabilidad</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)' }}>Renta bruta/año</div>
                    <div style={{ fontWeight: 700, color: 'var(--green)' }}>{fmtEur(rentaBrutaAnual)}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)' }}>Gastos/año</div>
                    <div style={{ fontWeight: 700, color: 'var(--red)' }}>{fmtEur(gastosAnuales)}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)' }}>Renta neta/año</div>
                    <div style={{ fontWeight: 700, color: rentaNetaAnual >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(rentaNetaAnual)}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>Yield bruto</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: yieldBruto >= 5 ? 'var(--green)' : yieldBruto >= 3 ? 'var(--amber)' : 'var(--red)' }}>{yieldBruto.toFixed(2)}%</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>Yield neto</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: yieldNeto >= 3 ? 'var(--green)' : yieldNeto >= 2 ? 'var(--amber)' : 'var(--red)' }}>{yieldNeto.toFixed(2)}%</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>ROI s/ compra</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: roi >= 4 ? 'var(--green)' : roi >= 2 ? 'var(--amber)' : 'var(--red)' }}>{roi.toFixed(2)}%</div>
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Flujo mensual (ingresos vs gastos)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text2)', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [fmtEur(v as number)]} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="var(--green)" radius={[3,3,0,0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="var(--red)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Flujo neto mensual</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: rentaNetaMensual >= 0 ? 'var(--green)' : 'var(--red)' }}>{rentaNetaMensual >= 0 ? '+' : ''}{fmtEur(rentaNetaMensual)}</span>
                </div>
              </div>
            </>
          )}

          {/* Gastos sin renta */}
          {!inmueble.generaRenta && gastosTotalMes(inmueble) > 0 && (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📋 Gastos del inmueble</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  ['IBI mensual', inmueble.gastosIbiMes],
                  ['Comunidad', inmueble.gastosComunidad],
                  ['Seguro', inmueble.gastosSeguro],
                  ['Mantenimiento', inmueble.gastosMantenimiento],
                  ['Otros', inmueble.gastosOtros],
                ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label as string}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)' }}>{fmtEur(val as number)}/mes</span>
                  </div>
                ))}
                <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Total gastos</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(gastosTotalMes(inmueble))}/mes</span>
                </div>
              </div>
            </div>
          )}

          {inmueble.notas && (
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>
              📝 {inmueble.notas}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ——— Tab Inmuebles ———
function TabInmuebles() {
  const { inmuebles, removeInmueble } = useInmuebleStore();
  const { deudas } = useDeudaStore();
  const [showModal, setShowModal] = useState(false);
  const [editInm, setEditInm] = useState<Inmueble | null>(null);
  const [detalleInm, setDetalleInm] = useState<Inmueble | null>(null);

  const valorTotal = inmuebles.reduce((s, i) => s + i.valorActual, 0);
  const equityTotal = inmuebles.reduce((s, i) => {
    const hip = deudas.find(d => d.id === i.hipotecaAsociada);
    return s + i.valorActual - (hip?.importePendiente ?? 0);
  }, 0);
  const rentaBrutaTotal = inmuebles.filter(i => i.generaRenta).reduce((s, i) => s + i.rentaMensualBruta, 0);
  const rentaNetaTotal = inmuebles.filter(i => i.generaRenta).reduce((s, i) => s + i.rentaMensualBruta - gastosTotalMes(i), 0);
  const yieldMedio = valorTotal > 0 ? (inmuebles.filter(i => i.generaRenta).reduce((s, i) => s + i.rentaMensualBruta * 12, 0) / valorTotal) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Valor total', val: fmtEur(valorTotal), color: 'var(--text)' },
          { label: 'Equity total', val: fmtEur(equityTotal), color: 'var(--green)' },
          { label: 'Renta bruta/mes', val: fmtEur(rentaBrutaTotal), color: 'var(--blue)' },
          { label: 'Renta neta/mes', val: fmtEur(rentaNetaTotal), color: rentaNetaTotal >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'Yield medio', val: `${yieldMedio.toFixed(2)}%`, color: yieldMedio >= 4 ? 'var(--green)' : yieldMedio >= 2 ? 'var(--amber)' : 'var(--text2)' },
        ].map(item => (
          <div key={item.label} className="card">
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Mis propiedades</h3>
          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowModal(true)}><Plus size={14} /> Añadir</button>
        </div>
        {inmuebles.length === 0 ? (
          <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: 24 }}>Sin propiedades registradas. Añade tu primer inmueble.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inmuebles.map((inm) => {
              const hip = deudas.find(d => d.id === inm.hipotecaAsociada);
              const equity = inm.valorActual - (hip?.importePendiente ?? 0);
              const plusvalia = inm.valorActual - inm.precioCompra;
              const plusvaliaPct = inm.precioCompra > 0 ? (plusvalia / inm.precioCompra) * 100 : 0;
              const yldBruto = inm.valorActual > 0 && inm.generaRenta ? (inm.rentaMensualBruta * 12 / inm.valorActual) * 100 : 0;
              return (
                <div key={inm.id} className="card-hover" style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => setDetalleInm(inm)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{INMUEBLE_TIPO_ICONS[inm.tipo] ?? '🏠'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{inm.nombre}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{inm.tipo} · {inm.superficie}m²{inm.direccion ? ` · ${inm.direccion}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" style={{ padding: 5 }} onClick={(e) => { e.stopPropagation(); setEditInm(inm); }}><Pencil size={12} /></button>
                          <button className="btn-icon" style={{ padding: 5 }} onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Eliminar "${inm.nombre}"?`)) removeInmueble(inm.id); }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text2)' }}>Valor</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtEur(inm.valorActual)}</div>
                        </div>
                        <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text2)' }}>Equity</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{fmtEur(equity)}</div>
                        </div>
                        <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text2)' }}>Plusvalía</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: plusvalia >= 0 ? 'var(--green)' : 'var(--red)' }}>{plusvalia >= 0 ? '+' : ''}{plusvaliaPct.toFixed(1)}%</div>
                        </div>
                        <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text2)' }}>{inm.generaRenta ? 'Yield bruto' : 'Gastos/mes'}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: inm.generaRenta ? (yldBruto >= 4 ? 'var(--green)' : 'var(--amber)') : 'var(--red)' }}>
                            {inm.generaRenta ? `${yldBruto.toFixed(1)}%` : fmtEur(gastosTotalMes(inm))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && <ModalInmueble onClose={() => setShowModal(false)} />}
      {editInm && <ModalInmueble inmueble={editInm} onClose={() => setEditInm(null)} />}
      {detalleInm && (
        <PanelDetalleInmueble
          inmueble={detalleInm}
          onClose={() => setDetalleInm(null)}
          onEdit={() => { setEditInm(detalleInm); setDetalleInm(null); }}
        />
      )}
    </div>
  );
}

interface ModalCuentaProps { onClose: () => void; cuenta?: Cuenta; }
function ModalCuenta({ onClose, cuenta }: ModalCuentaProps) {
  const { addCuenta, updateCuenta } = useFinanzasStore();
  const isEdit = !!cuenta;
  const [form, setForm] = useState<Omit<Cuenta, 'id'>>({
    tipo: cuenta?.tipo ?? 'Corriente',
    nombre: cuenta?.nombre ?? '',
    saldo: cuenta?.saldo ?? 0,
    divisa: cuenta?.divisa ?? 'EUR',
  });
  const saldoRef = useRef<HTMLInputElement>(null);
  useEffect(() => { saldoRef.current?.select(); }, []);

  const handleSubmit = () => {
    if (!form.nombre) { toast.error('Introduce el nombre'); return; }
    if (isEdit) {
      updateCuenta(cuenta.id, form);
      toast.success('Cuenta actualizada');
    } else {
      addCuenta(form);
      toast.success('Cuenta añadida');
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Saldo primero para facilitar actualización rápida */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Saldo actual</label>
              <input
                ref={saldoRef}
                className="input"
                type="number"
                step="0.01"
                value={form.saldo || ''}
                onChange={(e) => setForm({ ...form, saldo: parseFloat(e.target.value) || 0 })}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                style={{ fontSize: 18, fontWeight: 700 }}
              />
            </div>
            <div>
              <label className="label">Divisa</label>
              <select className="select" value={form.divisa} onChange={(e) => setForm({ ...form, divisa: e.target.value })}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: BBVA Principal" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Cuenta['tipo'] })}>
              {['Corriente','Ahorro','Inversión','Efectivo','Otro'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>
              {isEdit ? 'Actualizar cuenta' : 'Añadir cuenta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ SUSCRIPCIONES ═══════════════════════

const SUSC_CAT_ICONS: Record<string, string> = { 'Entretenimiento': '🎬', 'Trabajo': '💼', 'Salud': '❤️', 'Hogar': '🏠', 'Educación': '📚', 'Otro': '📦' };
const SUSC_CAT_COLORS: Record<string, string> = { 'Entretenimiento': '#3b82f6', 'Trabajo': '#8b5cf6', 'Salud': '#ef4444', 'Hogar': '#f59e0b', 'Educación': '#22c55e', 'Otro': '#6b7280' };
const SUSC_CATEGORIAS: SuscripcionCategoria[] = ['Entretenimiento', 'Trabajo', 'Salud', 'Hogar', 'Educación', 'Otro'];
const SUSC_FRECUENCIAS: SuscripcionFrecuencia[] = ['mensual', 'trimestral', 'anual'];

function ModalSuscripcion({ suscripcion, onClose }: { suscripcion?: Suscripcion | null; onClose: () => void }) {
  const { addSuscripcion, updateSuscripcion } = useSuscripcionesStore();
  const isEdit = !!suscripcion;
  const [form, setForm] = useState({
    nombre: suscripcion?.nombre ?? '',
    categoria: (suscripcion?.categoria ?? 'Entretenimiento') as SuscripcionCategoria,
    importe: suscripcion?.importe.toString() ?? '',
    frecuencia: (suscripcion?.frecuencia ?? 'mensual') as SuscripcionFrecuencia,
    fechaProximoCobro: suscripcion?.fechaProximoCobro ?? new Date().toISOString().slice(0, 10),
    metodoPago: suscripcion?.metodoPago ?? '',
    notas: suscripcion?.notas ?? '',
    activa: suscripcion?.activa ?? true,
  });
  const upd = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = () => {
    if (!form.nombre.trim() || !form.importe) { toast.error('Nombre e importe son obligatorios'); return; }
    const data = { ...form, importe: parseFloat(form.importe) };
    if (isEdit && suscripcion) { updateSuscripcion(suscripcion.id, data); toast.success('Suscripción actualizada'); }
    else { addSuscripcion(data); toast.success('Suscripción añadida'); }
    onClose();
  };
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Nueva'} Suscripción</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="Netflix, Spotify..." /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Categoría</label>
              <select className="select" value={form.categoria} onChange={e => upd('categoria', e.target.value)}>
                {SUSC_CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Frecuencia</label>
              <select className="select" value={form.frecuencia} onChange={e => upd('frecuencia', e.target.value)}>
                {SUSC_FRECUENCIAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="label">Importe (€) *</label><input className="input" type="number" step="0.01" value={form.importe} onChange={e => upd('importe', e.target.value)} /></div>
            <div><label className="label">Próximo cobro</label><input className="input" type="date" value={form.fechaProximoCobro} onChange={e => upd('fechaProximoCobro', e.target.value)} /></div>
          </div>
          <div><label className="label">Método de pago</label><input className="input" value={form.metodoPago} onChange={e => upd('metodoPago', e.target.value)} placeholder="Tarjeta Visa, PayPal..." /></div>
          <div><label className="label">Notas</label><input className="input" value={form.notas} onChange={e => upd('notas', e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13, color: 'var(--text2)' }}>Activa</label>
            <button onClick={() => upd('activa', !form.activa)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.activa ? 'var(--green)' : 'var(--bg3)', transition: 'all .2s', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 2, left: form.activa ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .2s' }} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>{isEdit ? 'Guardar cambios' : 'Añadir suscripción'}</button>
        </div>
      </div>
    </div>
  );
}

function TabSuscripciones() {
  const { suscripciones, removeSuscripcion, updateSuscripcion } = useSuscripcionesStore();
  const { addGasto } = useFinanzasStore();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Suscripcion | null>(null);

  const activas = suscripciones.filter(s => s.activa);
  const totalMensual = activas.reduce((sum, s) => sum + importeMensual(s), 0);
  const totalAnual = totalMensual * 12;

  const now = new Date();
  const porCategoria = SUSC_CATEGORIAS.map(cat => ({
    name: cat, value: Math.round(activas.filter(s => s.categoria === cat).reduce((sum, s) => sum + importeMensual(s), 0) * 100) / 100,
  })).filter(x => x.value > 0);

  const ranking = [...activas].sort((a, b) => importeMensual(b) - importeMensual(a));

  const diasHastaCobro = (fecha: string) => Math.round((new Date(fecha).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const handleRegistrarCobro = (s: Suscripcion) => {
    addGasto({ nombre: s.nombre, categoria: 'Suscripciones', importe: s.importe, fecha: new Date().toISOString().slice(0, 10), recurrente: true });
    toast.success(`Cobro de ${s.nombre} registrado`);
  };

  const handleDelete = (s: Suscripcion) => {
    if (window.confirm(`¿Eliminar "${s.nombre}"?`)) { removeSuscripcion(s.id); toast.success('Suscripción eliminada'); }
  };

  const totalChart = porCategoria.reduce((s, x) => s + x.value, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Total mensual', val: fmtEur(totalMensual), color: 'var(--red)', sub: `${activas.length} activas` },
          { label: 'Total anual', val: fmtEur(totalAnual), color: 'var(--amber)', sub: 'proyección' },
          { label: 'Pausadas', val: String(suscripciones.length - activas.length), color: 'var(--text2)', sub: `de ${suscripciones.length} totales` },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Próximos cobros */}
      {(() => {
        const proximos = activas.filter(s => { const d = diasHastaCobro(s.fechaProximoCobro); return d >= 0 && d <= 7; });
        return proximos.length > 0 ? (
          <div className="card" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 10 }}>⚡ Cobros en los próximos 7 días</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {proximos.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13 }}>{SUSC_CAT_ICONS[s.categoria]} {s.nombre}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--amber)' }}>en {diasHastaCobro(s.fechaProximoCobro)} días</span>
                    <span style={{ fontWeight: 700 }}>{fmtEur(s.importe)}</span>
                    <button onClick={() => handleRegistrarCobro(s)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Registrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Chart + Ranking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Donut chart */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Distribución por categoría</div>
          {porCategoria.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={porCategoria} cx={60} cy={60} innerRadius={38} outerRadius={58} dataKey="value" strokeWidth={0}>
                    {porCategoria.map((entry, i) => <Cell key={i} fill={SUSC_CAT_COLORS[entry.name] ?? '#6b7280'} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {porCategoria.map(cat => (
                  <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: SUSC_CAT_COLORS[cat.name] }} />
                      <span style={{ color: 'var(--text2)' }}>{cat.name}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>{totalChart > 0 ? ((cat.value / totalChart) * 100).toFixed(0) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div style={{ color: 'var(--text2)', fontSize: 13 }}>Sin suscripciones activas</div>}
        </div>

        {/* Ranking */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ranking — más caras</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranking.slice(0, 5).map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, width: 20, textAlign: 'center', color: i === 0 ? 'var(--amber)' : 'var(--text2)' }}>{i === 0 ? '🏆' : `${i + 1}.`}</span>
                <span style={{ fontSize: 16 }}>{SUSC_CAT_ICONS[s.categoria]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{s.frecuencia}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtEur(importeMensual(s))}/mes</div>
                  {i === 0 && <div style={{ fontSize: 10, color: 'var(--amber)' }}>¿La usas?</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Todas las suscripciones</div>
          <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setEditItem(null); setShowModal(true); }}>
            <Plus size={14} /> Nueva
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suscripciones.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: 24 }}>No hay suscripciones. Añade la primera.</div>}
          {suscripciones.map(s => {
            const dias = diasHastaCobro(s.fechaProximoCobro);
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 10, opacity: s.activa ? 1 : 0.5 }}>
                <span style={{ fontSize: 22 }}>{SUSC_CAT_ICONS[s.categoria]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{s.nombre}</span>
                    {!s.activa && <span style={{ fontSize: 10, background: 'var(--bg2)', color: 'var(--text2)', padding: '2px 6px', borderRadius: 4 }}>PAUSADA</span>}
                    {s.activa && dias >= 0 && dias <= 3 && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.2)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 4 }}>¡{dias}d!</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{s.categoria} · {s.metodoPago || '-'} · próx. {s.fechaProximoCobro}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtEur(importeMensual(s))}<span style={{ fontSize: 11, color: 'var(--text2)' }}>/mes</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtEur(s.importe)}/{s.frecuencia.slice(0, 3)}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" onClick={() => updateSuscripcion(s.id, { activa: !s.activa })} title={s.activa ? 'Pausar' : 'Activar'} style={{ fontSize: 13 }}>{s.activa ? '⏸' : '▶'}</button>
                  <button className="btn-icon" onClick={() => { setEditItem(s); setShowModal(true); }}><Pencil size={13} /></button>
                  <button className="btn-icon" onClick={() => handleDelete(s)}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && <ModalSuscripcion suscripcion={editItem} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}

export default function Finanzas() {
  const { ingresos, gastos, cuentas, planInversion, setPlanInversion, removeIngreso, removeGasto, removeCuenta } = useFinanzasStore();
  const { inmuebles } = useInmuebleStore();
  const { facturas } = useFacturasStore();
  const now = new Date();
  const [mainTab, setMainTab] = useState<'resumen' | 'deudas' | 'presupuestos' | 'proyeccion' | 'inmuebles' | 'suscripciones'>('resumen');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showModalIngreso, setShowModalIngreso] = useState(false);
  const [showModalGasto, setShowModalGasto] = useState(false);
  const [showModalCuenta, setShowModalCuenta] = useState(false);
  const [editIngreso, setEditIngreso] = useState<Ingreso | null>(null);
  const [editGasto, setEditGasto] = useState<Gasto | null>(null);
  const [editCuenta, setEditCuenta] = useState<Cuenta | null>(null);
  const [panel, setPanel] = useState<'ingresos' | 'gastos' | 'ahorro' | null>(null);
  const [planModal, setPlanModal] = useState<'invertir' | 'gastos' | 'libre' | null>(null);

  const handleDeleteIngreso = (ing: Ingreso) => {
    if (ing.origen) {
      toast('Para gestionar este ingreso ve a la sección Inmobiliario o Facturas', { icon: '🏠' });
      return;
    }
    if (window.confirm(`¿Eliminar "${ing.nombre}"?`)) {
      removeIngreso(ing.id);
      toast.success('Ingreso eliminado');
    }
  };
  const handleDeleteGasto = (gas: Gasto) => {
    if (gas.origen) {
      toast('Para gestionar este gasto ve a la sección Inmobiliario', { icon: '🏠' });
      return;
    }
    if (window.confirm(`¿Eliminar "${gas.nombre}"?`)) {
      removeGasto(gas.id);
      toast.success('Gasto eliminado');
    }
  };
  const handleEditIngreso = (ing: Ingreso) => {
    if (ing.origen === 'inmobiliario') {
      toast('Para editar este ingreso ve a la sección Inmobiliario', { icon: '🏠' });
      return;
    }
    if (ing.origen === 'factura') {
      toast('Para editar esta factura ve a la sección Facturas', { icon: '📄' });
      return;
    }
    setEditIngreso(ing);
  };
  const handleEditGasto = (gas: Gasto) => {
    if (gas.origen) {
      toast('Para editar este gasto ve a la sección Inmobiliario', { icon: '🏠' });
      return;
    }
    setEditGasto(gas);
  };
  const handleDeleteCuenta = (c: Cuenta) => {
    if (window.confirm(`¿Eliminar la cuenta "${c.nombre}"? Esta acción no se puede deshacer.`)) {
      removeCuenta(c.id);
      toast.success('Cuenta eliminada');
    }
  };

  const navMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  const key = getMonthKey(year, month);
  const ingMes = ingresos.filter(i => i.fecha.startsWith(key));
  const gasMes = gastos.filter(g => g.fecha.startsWith(key));

  // Synthetic ingresos from inmuebles con renta
  const syntheticIngInm: Ingreso[] = inmuebles
    .filter(inm => inm.generaRenta && inm.rentaMensualBruta > 0)
    .map(inm => ({
      id: `inm-${inm.id}`,
      nombre: `Alquiler — ${inm.nombre}`,
      categoria: 'Alquiler' as const,
      importe: inm.rentaMensualBruta,
      fecha: `${key}-01`,
      recurrente: true,
      origen: 'inmobiliario' as const,
      origenId: inm.id,
    }));

  // Synthetic ingresos from facturas cobradas este mes
  const syntheticIngFac: Ingreso[] = facturas
    .filter(f => f.estado === 'Cobrada' && f.fechaEmision.startsWith(key))
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

  // Synthetic gastos from inmuebles con renta
  const syntheticGasInm: Gasto[] = inmuebles
    .filter(inm => inm.generaRenta)
    .map(inm => ({
      id: `inm-gas-${inm.id}`,
      nombre: `Gastos — ${inm.nombre}`,
      categoria: 'Vivienda' as const,
      importe: inm.gastosIbiMes + inm.gastosComunidad + inm.gastosSeguro + inm.gastosMantenimiento + inm.gastosOtros,
      fecha: `${key}-01`,
      recurrente: true,
      origen: 'inmobiliario' as const,
      origenId: inm.id,
    }))
    .filter(g => g.importe > 0);

  const allIngMes = [...ingMes, ...syntheticIngInm, ...syntheticIngFac];
  const allGasMes = [...gasMes, ...syntheticGasInm];

  const totalIng = allIngMes.reduce((s, i) => s + i.importe, 0);
  const totalGas = allGasMes.reduce((s, g) => s + g.importe, 0);
  const ahorro = totalIng - totalGas;
  const chartData = buildLast6Months(ingresos, gastos, inmuebles);
  const tituloMes = `${MESES_ES[month]} ${year}`;

  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const prevKey = getMonthKey(prevY, prevM);
  const prevIngTotal = ingresos.filter(i => i.fecha.startsWith(prevKey)).reduce((s, i) => s + i.importe, 0);
  const prevGasTotal = gastos.filter(g => g.fecha.startsWith(prevKey)).reduce((s, g) => s + g.importe, 0);
  const prevGasMes = gastos.filter(g => g.fecha.startsWith(prevKey));

  // Plan de inversión
  const totalSaldo = cuentas.reduce((s, c) => s + toEur(c.saldo, c.divisa), 0);
  const eurInvertir = totalIng * planInversion / 100;
  const eurGastos = totalGas;
  const eurLibre = totalIng - eurInvertir - eurGastos;

  const TIPO_COLORS: Record<string, string> = {
    Corriente: 'var(--blue)', Ahorro: 'var(--green)', Inversión: 'var(--purple)',
    Efectivo: 'var(--amber)', Otro: 'var(--text2)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Main tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
        {(['resumen', 'deudas', 'presupuestos', 'proyeccion', 'inmuebles', 'suscripciones'] as const).map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: mainTab === t ? 'var(--blue)' : 'none', color: mainTab === t ? 'white' : 'var(--text2)', transition: 'all .2s' }}>
            {t === 'resumen' ? 'Resumen' : t === 'deudas' ? 'Deudas' : t === 'presupuestos' ? 'Presupuestos' : t === 'proyeccion' ? 'Proyección' : t === 'inmuebles' ? '🏠 Inmuebles' : '🔄 Suscripciones'}
          </button>
        ))}
      </div>

      {mainTab === 'deudas' && <TabDeudas />}
      {mainTab === 'presupuestos' && <TabPresupuestos gastos={allGasMes} tituloMes={tituloMes} />}
      {mainTab === 'proyeccion' && <TabProyeccion ingresos={ingresos} gastos={gastos} />}
      {mainTab === 'inmuebles' && <TabInmuebles />}
      {mainTab === 'suscripciones' && <TabSuscripciones />}

      {mainTab === 'resumen' && <>
      {/* Month nav */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className="btn-icon" onClick={() => navMonth(-1)}><ChevronLeft size={16} /></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{MESES[month]} {year}</div>
          </div>
          <button className="btn-icon" onClick={() => navMonth(1)}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => setPanel('ingresos')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Ingresos</div>
            <ChevronRight size={14} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{fmtEur(totalIng)}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{allIngMes.length} entradas · ver detalle</div>
        </div>
        <div className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => setPanel('gastos')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Gastos</div>
            <ChevronRight size={14} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{fmtEur(totalGas)}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{allGasMes.length} entradas · ver detalle</div>
        </div>
        <div className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => setPanel('ahorro')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Ahorro</div>
            <ChevronRight size={14} color="var(--text2)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: ahorro >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtEur(ahorro)}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {totalIng > 0 ? ((ahorro / totalIng) * 100).toFixed(1) : 0}% tasa · ver análisis
          </div>
        </div>
      </div>

      {/* Ingresos list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Ingresos</h3>
            {(syntheticIngInm.length + syntheticIngFac.length) > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                {syntheticIngInm.length + syntheticIngFac.length} automáticos · {ingMes.length} manuales
              </div>
            )}
          </div>
          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowModalIngreso(true)}>
            <Plus size={14} /> Añadir
          </button>
        </div>
        {allIngMes.length === 0 ? (
          <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: 20 }}>No hay ingresos este mes</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allIngMes.map((ing) => (
              <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, background: 'var(--green)', borderRadius: '50%', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ing.nombre}
                      {ing.origen === 'inmobiliario' && <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.15)', color: 'var(--blue)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>🏠 Auto</span>}
                      {ing.origen === 'factura' && <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.15)', color: 'var(--purple)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>📄 Auto</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{ing.categoria} · {ing.fecha} {ing.recurrente && '· 🔄'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 600, marginRight: 4 }}>+{fmtEur(ing.importe)}</span>
                  <button className="btn-icon" style={{ padding: 6 }} title="Editar" onClick={() => handleEditIngreso(ing)}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn-icon" style={{ padding: 6 }} title="Eliminar" onClick={() => handleDeleteIngreso(ing)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gastos list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Gastos</h3>
            {syntheticGasInm.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                {syntheticGasInm.length} automáticos · {gasMes.length} manuales
              </div>
            )}
          </div>
          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowModalGasto(true)}>
            <Plus size={14} /> Añadir
          </button>
        </div>
        {allGasMes.length === 0 ? (
          <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: 20 }}>No hay gastos este mes</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allGasMes.map((gas) => (
              <div key={gas.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {gas.nombre}
                      {gas.origen === 'inmobiliario' && <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.15)', color: 'var(--blue)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>🏠 Auto</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{gas.categoria} · {gas.fecha} {gas.recurrente && '· 🔄'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--red)', fontWeight: 600, marginRight: 4 }}>-{fmtEur(gas.importe)}</span>
                  <button className="btn-icon" style={{ padding: 6 }} title="Editar" onClick={() => handleEditGasto(gas)}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn-icon" style={{ padding: 6 }} title="Eliminar" onClick={() => handleDeleteGasto(gas)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cuentas */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Cuentas Bancarias</h3>
          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowModalCuenta(true)}>
            <Plus size={14} /> Añadir
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {cuentas.map((c) => (
            <div key={c.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, border: `1px solid ${TIPO_COLORS[c.tipo]}33`, cursor: 'pointer' }}
              onClick={() => setEditCuenta(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: TIPO_COLORS[c.tipo], fontWeight: 600, marginBottom: 4 }}>{c.tipo}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.nombre}</div>
                </div>
                <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn-icon" style={{ padding: 4 }} title="Editar" onClick={() => setEditCuenta(c)}>
                    <Pencil size={12} />
                  </button>
                  <button className="btn-icon" style={{ padding: 4 }} title="Eliminar" onClick={() => handleDeleteCuenta(c)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{fmt(c.saldo)} {c.divisa}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text2)', fontSize: 14 }}>Total liquidez</span>
          <span style={{ fontWeight: 700 }}>{fmtEur(totalSaldo)}</span>
        </div>
      </div>

      {/* Plan inversión */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Plan de Inversión</h3>
          <button className="btn-primary" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => toast.success(`Plan guardado: ${planInversion}% de inversión 💾`)}>
            Guardar plan
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>Define qué % de tus ingresos destinar a inversión</p>

        {/* Slider + porcentaje */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Porcentaje de inversión</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>{planInversion}%</span>
        </div>
        <input type="range" className="slider" min={0} max={80} value={planInversion} onChange={(e) => setPlanInversion(parseInt(e.target.value))} style={{ width: '100%', marginBottom: 4 }} />

        {/* Tick marks */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          {[0,10,20,30,40,50,60,70,80].map(v => (
            <div key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={() => setPlanInversion(v)}>
              <div style={{ width: 1, height: 5, background: planInversion === v ? 'var(--blue)' : 'var(--border)', transition: 'background 0.2s' }} />
              <span style={{ fontSize: 9, color: planInversion === v ? 'var(--blue)' : 'var(--text2)', fontWeight: planInversion === v ? 700 : 400, transition: 'color 0.2s' }}>{v}%</span>
            </div>
          ))}
        </div>

        {/* 3 mini-cards clickables */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="card-hover" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer' }} onClick={() => setPlanModal('invertir')}>
            <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600, marginBottom: 4 }}>A INVERTIR</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtEur(eurInvertir)}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>ver detalle ›</div>
          </div>
          <div className="card-hover" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer' }} onClick={() => setPlanModal('gastos')}>
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>GASTOS</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtEur(eurGastos)}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>ver desglose ›</div>
          </div>
          <div className="card-hover" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer' }} onClick={() => setPlanModal('libre')}>
            <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>LIBRE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: eurLibre >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtEur(eurLibre)}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>ver sugerencias ›</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Últimos 6 meses</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="mes" tick={{ fill: 'var(--text2)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
              formatter={(v: unknown) => [fmtEur(v as number)]}
            />
            <Bar dataKey="ingresos" name="Ingresos" fill="var(--green)" radius={[4,4,0,0]} />
            <Bar dataKey="gastos" name="Gastos" fill="var(--red)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Plan modals */}
      {planModal === 'invertir' && (
        <ModalInvertir eurInvertir={eurInvertir} planInversion={planInversion} totalIng={totalIng} onClose={() => setPlanModal(null)} />
      )}
      {planModal === 'gastos' && (
        <ModalGastosDesglose gastos={gasMes} prevGastos={prevGasMes} totalGas={totalGas} titulo={`${MESES[month]} ${year}`} onClose={() => setPlanModal(null)} />
      )}
      {planModal === 'libre' && (
        <ModalLibre eurLibre={eurLibre} totalIng={totalIng} totalGas={totalGas} planInversion={planInversion} onClose={() => setPlanModal(null)} />
      )}

      {/* Summary panels */}
      {panel === 'ingresos' && (
        <PanelIngresos ingresos={ingMes} titulo={`${MESES[month]} ${year}`} onClose={() => setPanel(null)} />
      )}
      {panel === 'gastos' && (
        <PanelGastos gastos={gasMes} titulo={`${MESES[month]} ${year}`} onClose={() => setPanel(null)} />
      )}
      {panel === 'ahorro' && (
        <PanelAhorro
          ingresosTotal={totalIng} gastosTotal={totalGas}
          prevIngresosTotal={prevIngTotal} prevGastosTotal={prevGasTotal}
          titulo={`${MESES[month]} ${year}`} onClose={() => setPanel(null)}
        />
      )}

      {showModalIngreso && <ModalIngreso onClose={() => setShowModalIngreso(false)} />}
      {editIngreso && <ModalIngreso ingreso={editIngreso} onClose={() => setEditIngreso(null)} />}
      {showModalGasto && <ModalGasto onClose={() => setShowModalGasto(false)} />}
      {editGasto && <ModalGasto gasto={editGasto} onClose={() => setEditGasto(null)} />}
      {showModalCuenta && <ModalCuenta onClose={() => setShowModalCuenta(false)} />}
      {editCuenta && <ModalCuenta cuenta={editCuenta} onClose={() => setEditCuenta(null)} />}
      </>}
    </div>
  );
}
