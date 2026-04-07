import { useState } from 'react';
import { Plus, Pencil, Trash2, X, AlertTriangle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlanesAhorroStore } from '../stores/usePlanesAhorroStore';
import type { PlanAhorro, TipoPlan, EntidadPlan } from '../stores/usePlanesAhorroStore';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import { fmtEur } from '../utils/format';

const PLAN_TIPOS: TipoPlan[] = [
  'Plan de Pensiones', 'PAS', 'PIAS', 'Unit Linked', 'Seguro de Ahorro', 'PPA',
];

const PLAN_ENTIDADES: EntidadPlan[] = [
  'Mapfre', 'AXA', 'Allianz', 'Mutua', 'BBVA', 'CaixaBank', 'Santander', 'Indexa', 'Otro',
];

// ——— Catálogo de planes por entidad ———
interface PlanCatalogo {
  nombre: string;
  codigo: string;
  tipo: TipoPlan;
  perfil: string;
}

const CATALOGO: Partial<Record<EntidadPlan, PlanCatalogo[]>> = {
  CaixaBank: [
    { nombre: 'CABK Destino 2025',        codigo: 'N4830', tipo: 'Plan de Pensiones', perfil: 'Renta Fija' },
    { nombre: 'CABK Destino 2030',        codigo: 'N5087', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'CABK Destino 2035',        codigo: 'N5088', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'CABK Destino 2040',        codigo: 'N5085', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'CABK Destino 2050',        codigo: 'N5086', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'CABK Destino (sin fecha)', codigo: 'N5089', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'CABK RV Internacional',    codigo: 'N1767', tipo: 'Plan de Pensiones', perfil: 'Renta Variable' },
    { nombre: 'CABK Equilibrio',          codigo: 'N0072', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'CABK Crecimiento',         codigo: 'N0042', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'CABK Monetario',           codigo: 'N5303', tipo: 'Plan de Pensiones', perfil: 'Monetario' },
  ],
  Santander: [
    { nombre: 'Santander Futuro 2030',    codigo: 'N4XXX', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'Santander Renta Fija',     codigo: 'N3XXX', tipo: 'Plan de Pensiones', perfil: 'Renta Fija' },
    { nombre: 'Santander Bolsa',          codigo: 'N3XXX', tipo: 'Plan de Pensiones', perfil: 'Renta Variable' },
    { nombre: 'Santander Mixto',          codigo: 'N3XXX', tipo: 'Plan de Pensiones', perfil: 'Renta Mixta' },
    { nombre: 'Santander PPA Garantizado', codigo: 'N3XXX', tipo: 'PPA',             perfil: 'Garantizado' },
  ],
};

const PERFILES_INVERSION = ['Renta Fija', 'Renta Mixta', 'Renta Variable', 'Monetario', 'Garantizado', 'Otro'];

const PERFIL_COLOR: Record<string, string> = {
  'Renta Fija':     '#22c55e',
  'Renta Mixta':    '#f59e0b',
  'Renta Variable': '#3b82f6',
  'Monetario':      '#06b6d4',
  'Garantizado':    '#a78bfa',
  'Otro':           '#6b7280',
};

export const PLAN_TIPO_COLOR: Record<TipoPlan, string> = {
  'Plan de Pensiones': '#1e40af',
  'PAS': '#16a34a',
  'PIAS': '#7c3aed',
  'Unit Linked': '#ea580c',
  'Seguro de Ahorro': '#0d9488',
  'PPA': '#ca8a04',
};

export const PLAN_TIPO_ICON: Record<TipoPlan, string> = {
  'Plan de Pensiones': '🏦',
  'PAS': '💰',
  'PIAS': '🛡️',
  'Unit Linked': '📊',
  'Seguro de Ahorro': '🔒',
  'PPA': '🏛️',
};

// ——— Modal Añadir/Editar Plan ———
function ModalPlanAhorro({ plan, onClose }: { plan?: PlanAhorro; onClose: () => void }) {
  const { addPlan, updatePlan } = usePlanesAhorroStore();
  const { addGasto, updateGasto, removeGasto, gastos } = useFinanzasStore();
  const isEdit = !!plan;

  const [form, setForm] = useState({
    nombre: plan?.nombre ?? '',
    tipo: (plan?.tipo ?? 'Plan de Pensiones') as TipoPlan,
    entidad: (plan?.entidad ?? 'Otro') as EntidadPlan,
    numeroPoliza: plan?.numeroPoliza ?? '',
    perfilInversion: plan?.perfilInversion ?? '',
    fechaInicio: plan?.fechaInicio ?? new Date().toISOString().slice(0, 10),
    aportacionMensual: plan?.aportacionMensual ?? 0,
    aportacionTotal: plan?.aportacionTotal ?? 0,
    valorActual: plan?.valorActual ?? 0,
    valorFecha: plan?.valorFecha ?? new Date().toISOString().slice(0, 10),
    vencimiento: plan?.vencimiento ?? '',
    beneficiarios: plan?.beneficiarios ?? '',
    notas: plan?.notas ?? '',
  });

  // Estado de selección de catálogo
  const [autoDetected, setAutoDetected] = useState(false);
  const [modoManual, setModoManual] = useState(
    // Si es edición y hay datos previos, empezar en manual
    isEdit ? true : false
  );

  const upd = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const catalogoEntidad = CATALOGO[form.entidad];
  const usaCatalogo = !!catalogoEntidad && !modoManual;

  // Al cambiar entidad: resetear modo manual y auto-detección
  const handleEntidadChange = (nueva: EntidadPlan) => {
    setForm(f => ({ ...f, entidad: nueva }));
    setAutoDetected(false);
    setModoManual(false);
  };

  // Al seleccionar un plan del catálogo
  const handleSelectCatalogo = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'MANUAL') {
      setModoManual(true);
      setAutoDetected(false);
      return;
    }
    const idx = parseInt(val);
    if (isNaN(idx)) return;
    const entry = catalogoEntidad![idx];
    setForm(f => ({
      ...f,
      nombre: entry.nombre,
      tipo: entry.tipo,
      numeroPoliza: entry.codigo,
      perfilInversion: entry.perfil,
    }));
    setAutoDetected(true);
  };

  const rentabilidad =
    form.aportacionTotal > 0
      ? ((form.valorActual - form.aportacionTotal) / form.aportacionTotal) * 100
      : 0;
  const pnl = form.valorActual - form.aportacionTotal;

  const proyeccion = (() => {
    if (!form.vencimiento || form.valorActual <= 0) return null;
    const ahora = Date.now();
    const venc = new Date(form.vencimiento).getTime();
    if (venc <= ahora) return null;
    const inicio = new Date(form.fechaInicio).getTime();
    const mesesTranscurridos = Math.max(1, (ahora - inicio) / (1000 * 60 * 60 * 24 * 30));
    const mesesRestantes = (venc - ahora) / (1000 * 60 * 60 * 24 * 30);
    const tasaMensual = rentabilidad > 0
      ? Math.pow(1 + rentabilidad / 100, 1 / mesesTranscurridos) - 1
      : 0.003;
    return (
      form.valorActual * Math.pow(1 + tasaMensual, mesesRestantes) +
      form.aportacionMensual * ((Math.pow(1 + tasaMensual, mesesRestantes) - 1) / Math.max(tasaMensual, 0.0001))
    );
  })();

  const añosVenc = form.vencimiento
    ? ((new Date(form.vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1)
    : null;

  const handleSubmit = () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.fechaInicio) { toast.error('La fecha de inicio es obligatoria'); return; }

    const data: Omit<PlanAhorro, 'id'> = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      entidad: form.entidad,
      numeroPoliza: form.numeroPoliza || undefined,
      perfilInversion: form.perfilInversion || undefined,
      fechaInicio: form.fechaInicio,
      aportacionMensual: Number(form.aportacionMensual) || 0,
      aportacionTotal: Number(form.aportacionTotal) || 0,
      valorActual: Number(form.valorActual) || 0,
      valorFecha: form.valorFecha || undefined,
      vencimiento: form.vencimiento || undefined,
      beneficiarios: form.beneficiarios || undefined,
      notas: form.notas || undefined,
    };

    const existingGasto = isEdit
      ? gastos.find(g => g.origen === 'plan-ahorro' && g.origenId === plan!.id)
      : undefined;

    if (isEdit) {
      updatePlan(plan!.id, data);
      if (data.aportacionMensual > 0) {
        if (existingGasto) {
          updateGasto(existingGasto.id, { nombre: `Aportación - ${data.nombre}`, importe: data.aportacionMensual });
        } else {
          addGasto({ categoria: 'Otros', nombre: `Aportación - ${data.nombre}`, importe: data.aportacionMensual, fecha: new Date().toISOString().slice(0, 10), recurrente: true, origen: 'plan-ahorro', origenId: plan!.id });
        }
      } else if (existingGasto) {
        removeGasto(existingGasto.id);
      }
      toast.success('Plan actualizado');
    } else {
      const newId = addPlan(data);
      if (data.aportacionMensual > 0) {
        addGasto({ categoria: 'Otros', nombre: `Aportación - ${data.nombre}`, importe: data.aportacionMensual, fecha: new Date().toISOString().slice(0, 10), recurrente: true, origen: 'plan-ahorro', origenId: newId });
      }
      toast.success('Plan añadido');
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Nuevo'} Plan de Ahorro</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Entidad gestora ── */}
          <div>
            <label className="label">Entidad gestora</label>
            <select
              className="select"
              value={form.entidad}
              onChange={e => handleEntidadChange(e.target.value as EntidadPlan)}
            >
              {PLAN_ENTIDADES.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>

          {/* ── Selector de catálogo (CaixaBank / Santander) ── */}
          {usaCatalogo && (
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Selecciona tu plan
                <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                  Catálogo {form.entidad}
                </span>
              </label>
              <select
                className="select"
                defaultValue=""
                onChange={handleSelectCatalogo}
              >
                <option value="" disabled>— Elige un plan —</option>
                {catalogoEntidad!.map((p, i) => (
                  <option key={i} value={i}>
                    {p.nombre} · {p.perfil} [{p.codigo}]
                  </option>
                ))}
                <option value="MANUAL">✏️ Mi plan no aparece en la lista</option>
              </select>
              {/* Opción "mi plan no aparece" */}
              {/* Detectamos si se eligió MANUAL en el onChange */}
            </div>
          )}

          {/* Enlace "mi plan no aparece" para entidades con catálogo */}
          {catalogoEntidad && !modoManual && (
            <button
              style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0, textDecoration: 'underline' }}
              onClick={() => { setModoManual(true); setAutoDetected(false); }}
            >
              ✏️ Mi plan no aparece en la lista → introducir manualmente
            </button>
          )}

          {/* Badge de detección automática */}
          {autoDetected && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#3b82f6' }}>
              <Sparkles size={13} />
              <span>Tipo de plan, código y perfil detectados automáticamente del catálogo.</span>
            </div>
          )}

          {/* ── Tipo de plan ── */}
          <div>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Tipo de plan *
              {autoDetected && (
                <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                  Auto-detectado
                </span>
              )}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {PLAN_TIPOS.map(t => {
                const col = PLAN_TIPO_COLOR[t];
                const selected = form.tipo === t;
                return (
                  <button
                    key={t}
                    onClick={() => { upd('tipo', t); setAutoDetected(false); }}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 8,
                      border: `1px solid ${selected ? col : 'var(--border)'}`,
                      background: selected ? `${col}22` : 'var(--bg3)',
                      color: selected ? col : 'var(--text2)',
                      fontSize: 11,
                      fontWeight: selected ? 700 : 400,
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: selected && autoDetected ? `0 0 0 2px ${col}55` : 'none',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{PLAN_TIPO_ICON[t]}</div>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Perfil de inversión ── */}
          <div>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Perfil de inversión
              {autoDetected && form.perfilInversion && (
                <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                  Auto-detectado
                </span>
              )}
            </label>
            {autoDetected && form.perfilInversion ? (
              // Mostrar como chip resaltado si fue auto-detectado
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  background: `${PERFIL_COLOR[form.perfilInversion] ?? '#6b7280'}18`,
                  border: `1px solid ${PERFIL_COLOR[form.perfilInversion] ?? '#6b7280'}44`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  color: PERFIL_COLOR[form.perfilInversion] ?? '#6b7280',
                  fontWeight: 700,
                  fontSize: 13,
                  flex: 1,
                }}>
                  {form.perfilInversion}
                </div>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', padding: '0 4px', textDecoration: 'underline' }}
                  onClick={() => setAutoDetected(false)}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PERFILES_INVERSION.map(p => {
                  const col = PERFIL_COLOR[p] ?? '#6b7280';
                  const selected = form.perfilInversion === p;
                  return (
                    <button
                      key={p}
                      onClick={() => upd('perfilInversion', selected ? '' : p)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 20,
                        border: `1px solid ${selected ? col : 'var(--border)'}`,
                        background: selected ? `${col}18` : 'var(--bg3)',
                        color: selected ? col : 'var(--text2)',
                        fontSize: 11,
                        fontWeight: selected ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Nombre + Código/póliza ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nombre del plan *</label>
              <input
                className="input"
                value={form.nombre}
                onChange={e => upd('nombre', e.target.value)}
                placeholder="Mi plan de pensiones"
                style={autoDetected ? { borderColor: 'rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.04)' } : {}}
              />
            </div>
            <div>
              <label className="label">Código DGS / Nº póliza</label>
              <input
                className="input"
                value={form.numeroPoliza}
                onChange={e => upd('numeroPoliza', e.target.value)}
                placeholder="N4830 / P-12345"
                style={autoDetected ? { borderColor: 'rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.04)' } : {}}
              />
            </div>
          </div>

          {/* Fecha inicio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Fecha de inicio *</label>
              <input className="input" type="date" value={form.fechaInicio} onChange={e => upd('fechaInicio', e.target.value)} />
            </div>
            <div>{/* espacio */}</div>
          </div>

          {/* ── Aportaciones ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Aportación mensual (€)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.aportacionMensual || ''} onChange={e => upd('aportacionMensual', parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Total aportado hasta hoy (€)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.aportacionTotal || ''} onChange={e => upd('aportacionTotal', parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
          </div>

          {/* ── Valor actual + fecha ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Valor actual (€)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.valorActual || ''} onChange={e => upd('valorActual', parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Fecha del último valor</label>
              <input className="input" type="date" value={form.valorFecha} onChange={e => upd('valorFecha', e.target.value)} />
            </div>
          </div>

          {/* P&L calculado */}
          {form.aportacionTotal > 0 && form.valorActual > 0 && (
            <div style={{ background: pnl >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${pnl >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>P&L calculado</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {pnl >= 0 ? '+' : ''}{fmtEur(pnl)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>Rentabilidad acumulada</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: rentabilidad >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {rentabilidad >= 0 ? '+' : ''}{rentabilidad.toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {/* ── Vencimiento ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Fecha de vencimiento (opcional)</label>
              <input className="input" type="date" value={form.vencimiento} onChange={e => upd('vencimiento', e.target.value)} />
            </div>
            {añosVenc !== null && parseFloat(añosVenc) > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '8px 12px', width: '100%' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Años hasta vencimiento</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue)' }}>{añosVenc} años</div>
                </div>
              </div>
            )}
          </div>

          {/* Proyección */}
          {proyeccion !== null && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Proyección a vencimiento (rentabilidad histórica)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)' }}>{fmtEur(proyeccion)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Basada en la rentabilidad acumulada actual · estimación orientativa</div>
            </div>
          )}

          {/* Beneficiarios + Notas */}
          <div>
            <label className="label">Beneficiarios (opcional)</label>
            <input className="input" value={form.beneficiarios} onChange={e => upd('beneficiarios', e.target.value)} placeholder="Nombre del beneficiario designado..." />
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              className="input"
              value={form.notas}
              onChange={e => upd('notas', e.target.value)}
              placeholder="Notas sobre este plan..."
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          {form.aportacionMensual > 0 && (
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text2)' }}>
              💡 Se registrará un gasto recurrente de <strong>{fmtEur(form.aportacionMensual)}/mes</strong> en la sección Finanzas.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>
              {isEdit ? 'Actualizar plan' : 'Guardar plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Tab principal Planes de Ahorro ———
export default function PlanesAhorroTab() {
  const { planes, removePlan } = usePlanesAhorroStore();
  const { removeGasto, gastos } = useFinanzasStore();
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState<PlanAhorro | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();

  // Summary calculations
  const totalValor = planes.reduce((s, p) => s + p.valorActual, 0);
  const totalAportado = planes.reduce((s, p) => s + p.aportacionTotal, 0);
  const totalPnl = totalValor - totalAportado;
  const totalPnlPct = totalAportado > 0 ? (totalPnl / totalAportado) * 100 : 0;
  const totalMensual = planes.reduce((s, p) => s + p.aportacionMensual, 0);

  const handleDelete = (plan: PlanAhorro) => {
    if (!window.confirm(`¿Eliminar "${plan.nombre}"?`)) return;
    const gasto = gastos.find(g => g.origen === 'plan-ahorro' && g.origenId === plan.id);
    if (gasto) removeGasto(gasto.id);
    removePlan(plan.id);
    toast.success('Plan eliminado');
  };

  // ——— Alertas ———
  const alerts: { msg: string; color: string }[] = [];

  // PP/PPA: aportaciones este año y deducción disponible
  const ppPlanes = planes.filter(p => p.tipo === 'Plan de Pensiones' || p.tipo === 'PPA');
  if (ppPlanes.length > 0) {
    const ppAportadoEstimado = ppPlanes.reduce((s, p) => {
      const startYear = parseInt(p.fechaInicio.slice(0, 4));
      const startMonth = startYear === currentYear ? parseInt(p.fechaInicio.slice(5, 7)) - 1 : 0;
      const months = now.getMonth() - startMonth + 1;
      return s + p.aportacionMensual * Math.max(0, months);
    }, 0);
    const maxDeduccion = 1500;
    const restante = Math.max(0, maxDeduccion - ppAportadoEstimado);
    alerts.push({
      msg: `Has aportado aprox. ${fmtEur(ppAportadoEstimado)} a planes de pensiones/PPA este año. Te quedan ${fmtEur(restante)} de deducción fiscal disponible (máx. ${fmtEur(maxDeduccion)}/año desde 2023).`,
      color: 'var(--blue)',
    });
  }

  // Vencimiento próximo (≤ 6 meses)
  planes.forEach(p => {
    if (!p.vencimiento) return;
    const diffMs = new Date(p.vencimiento).getTime() - now.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);
    if (diffMonths > 0 && diffMonths <= 6) {
      alerts.push({
        msg: `Tu plan "${p.nombre}" vence en ${Math.round(diffMonths)} mes${Math.round(diffMonths) !== 1 ? 'es' : ''}.`,
        color: 'var(--amber)',
      });
    }
  });

  // Valor no actualizado en 6+ meses
  planes.forEach(p => {
    if (!p.valorFecha) return;
    const diffMs = now.getTime() - new Date(p.valorFecha).getTime();
    const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
    if (diffMonths >= 6) {
      alerts.push({
        msg: `Llevas ${diffMonths} meses sin actualizar el valor de "${p.nombre}".`,
        color: 'var(--amber)',
      });
    }
  });

  // PP projection to 65
  if (ppPlanes.length > 0) {
    const totalPPMensual = ppPlanes.reduce((s, p) => s + p.aportacionMensual, 0);
    const totalPPActual = ppPlanes.reduce((s, p) => s + p.valorActual, 0);
    if (totalPPMensual > 0 && totalPPActual >= 0) {
      // Very rough estimate: 5% annual return, 25 years
      const tasaMensual = Math.pow(1.05, 1 / 12) - 1;
      const meses = 25 * 12;
      const proyeccionPP = totalPPActual * Math.pow(1 + tasaMensual, meses) +
        totalPPMensual * ((Math.pow(1 + tasaMensual, meses) - 1) / tasaMensual);
      alerts.push({
        msg: `Con tu aportación actual de ${fmtEur(totalPPMensual)}/mes alcanzarías aprox. ${fmtEur(proyeccionPP)} en tus planes de pensiones a los 65 años (asumiendo 5% de rentabilidad).`,
        color: 'var(--green)',
      });
    }
  }

  return (
    <>
      {/* Alertas */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                background: `${a.color}12`,
                border: `1px solid ${a.color}33`,
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertTriangle size={14} style={{ color: a.color, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Resumen */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Valor total</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(totalValor)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Total aportado</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(totalAportado)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>P&L total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalPnl >= 0 ? '+' : ''}{fmtEur(totalPnl)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Rentabilidad</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: totalPnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Aportación/mes</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(totalMensual)}</div>
          </div>
        </div>
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>
          {planes.length} plan{planes.length !== 1 ? 'es' : ''} activo{planes.length !== 1 ? 's' : ''}
        </div>
        <button className="btn-primary" onClick={() => { setEditPlan(null); setShowModal(true); }}>
          <Plus size={14} /> Añadir plan
        </button>
      </div>

      {/* Lista de planes */}
      {planes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)', fontSize: 14 }}>
          No tienes planes de ahorro registrados.
          <br />
          <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => { setEditPlan(null); setShowModal(true); }}>
            <Plus size={14} /> Añadir mi primer plan
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {planes.map((plan, i) => {
            const pnl = plan.valorActual - plan.aportacionTotal;
            const pnlPct = plan.aportacionTotal > 0 ? (pnl / plan.aportacionTotal) * 100 : 0;
            const col = PLAN_TIPO_COLOR[plan.tipo];
            const icon = PLAN_TIPO_ICON[plan.tipo];

            const diasSinActualizar = plan.valorFecha
              ? Math.floor((now.getTime() - new Date(plan.valorFecha).getTime()) / (1000 * 60 * 60 * 24))
              : null;

            const añosVenc = plan.vencimiento
              ? ((new Date(plan.vencimiento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1)
              : null;

            return (
              <div
                key={plan.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  borderBottom: i < planes.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Icono */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${col}18`,
                  border: `1px solid ${col}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}>
                  {icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{plan.nombre}</span>
                    <span style={{ fontSize: 10, background: `${col}18`, color: col, border: `1px solid ${col}44`, borderRadius: 4, padding: '1px 5px', fontWeight: 600, flexShrink: 0 }}>
                      {plan.tipo}
                    </span>
                    {plan.perfilInversion && (
                      <span style={{ fontSize: 10, background: `${PERFIL_COLOR[plan.perfilInversion] ?? '#6b7280'}18`, color: PERFIL_COLOR[plan.perfilInversion] ?? '#6b7280', border: `1px solid ${PERFIL_COLOR[plan.perfilInversion] ?? '#6b7280'}44`, borderRadius: 4, padding: '1px 5px', fontWeight: 600, flexShrink: 0 }}>
                        {plan.perfilInversion}
                      </span>
                    )}
                    {diasSinActualizar !== null && diasSinActualizar >= 180 && (
                      <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', borderRadius: 4, padding: '1px 4px', fontWeight: 600 }}>
                        ⚠️ Sin actualizar
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {plan.entidad}{plan.numeroPoliza ? ` · ${plan.numeroPoliza}` : ''} · desde {plan.fechaInicio.slice(0, 7)}
                    {añosVenc !== null && parseFloat(añosVenc) > 0 && ` · vence en ${añosVenc} años`}
                    {plan.beneficiarios ? ` · Benef.: ${plan.beneficiarios}` : ''}
                  </div>
                  {plan.notas && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {plan.notas}
                    </div>
                  )}
                </div>

                {/* Valor */}
                <div style={{ textAlign: 'right', minWidth: 100, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700 }}>{fmtEur(plan.valorActual)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtEur(plan.aportacionMensual)}/mes</div>
                </div>

                {/* P&L */}
                <div style={{ textAlign: 'right', minWidth: 100, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {pnl >= 0 ? '+' : ''}{fmtEur(pnl)}
                  </div>
                  <div style={{ fontSize: 12, color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button className="btn-icon" style={{ padding: 6 }} title="Editar" onClick={() => { setEditPlan(plan); setShowModal(true); }}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn-icon" style={{ padding: 6 }} title="Eliminar" onClick={() => handleDelete(plan)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info fiscal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: 'rgba(30,64,175,0.08)', border: '1px solid rgba(30,64,175,0.2)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>🏦 Plan Pensiones / PPA</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            Aportaciones deducibles en IRPF hasta 1.500€/año. Se tributan en el rescate como rendimientos del trabajo.
          </div>
        </div>
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>🛡️ PIAS</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            Mantenido +5 años y rescatado como renta vitalicia, los rendimientos pueden quedar exentos de IRPF.
          </div>
        </div>
        <div style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', marginBottom: 6 }}>🔒 Seguro Ahorro / Unit Linked</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            Tributan como rendimientos del capital mobiliario. Ventaja: diferimiento fiscal hasta el rescate.
          </div>
        </div>
      </div>

      {showModal && (
        <ModalPlanAhorro
          plan={editPlan ?? undefined}
          onClose={() => { setShowModal(false); setEditPlan(null); }}
        />
      )}
    </>
  );
}
