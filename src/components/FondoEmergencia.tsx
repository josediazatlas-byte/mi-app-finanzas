import { useState, useEffect } from 'react';
import { Shield, X, ChevronRight, Settings, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFondoEmergenciaStore } from '../stores/useFondoEmergenciaStore';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import { fmtEur } from '../utils/format';
import { calcObjetivo } from '../utils/fondoEmergencia';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ─── Panel completo ────────────────────────────────────────────────────────────
function FondoEmergenciaPanel({ onClose }: { onClose: () => void }) {
  const {
    objetivoActual, saldoManual, cuentaVinculadaId, extraMensual, mesesACubrir,
    historialObjetivos, setObjetivo, setSaldoManual, setCuentaVinculada,
    setExtraMensual, setMesesACubrir, pushHistorial, setFechaActualizacion,
  } = useFondoEmergenciaStore();
  const { gastos, cuentas } = useFinanzasStore();

  const [tab, setTab] = useState<'resumen' | 'calculo' | 'plan' | 'config'>('resumen');
  const [editSaldo, setEditSaldo] = useState(false);
  const [tmpSaldo, setTmpSaldo] = useState(saldoManual.toString());
  const [aportacionSugerida, setAportacionSugerida] = useState(300);

  // Derived
  const cuentaVinculada = cuentas.find(c => c.id === cuentaVinculadaId);
  const saldoActual = cuentaVinculada ? cuentaVinculada.saldo : saldoManual;
  const { objetivo, promedio, mesesData } = calcObjetivo(gastos, extraMensual, mesesACubrir);
  const falta = Math.max(0, objetivo - saldoActual);
  const sobra = Math.max(0, saldoActual - objetivo);
  const mesesCubiertos = objetivo > 0 ? (saldoActual / (objetivo / mesesACubrir)) : 0;
  const pctCubierto = objetivo > 0 ? Math.min(100, (saldoActual / objetivo) * 100) : 0;
  const estado: 'insuficiente' | 'en_progreso' | 'cubierto' =
    pctCubierto < 40 ? 'insuficiente' : pctCubierto < 100 ? 'en_progreso' : 'cubierto';
  const estadoColor = estado === 'insuficiente' ? 'var(--red)' : estado === 'en_progreso' ? 'var(--amber)' : 'var(--green)';
  const estadoLabel = estado === 'insuficiente' ? 'INSUFICIENTE' : estado === 'en_progreso' ? 'EN PROGRESO' : 'CUBIERTO';

  // Historia para el gráfico
  const chartData = [...historialObjetivos]
    .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
    .map(h => ({
      label: `${String(h.mes).padStart(2, '0')}/${h.anio.toString().slice(-2)}`,
      objetivo: h.objetivo,
      saldo: h.saldo,
    }));

  // Meses para completar el fondo
  const { gastos: allGastos, ingresos } = useFinanzasStore.getState();
  const now = new Date();
  const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ingresosMes = ingresos.filter(i => i.fecha.startsWith(mesKey)).reduce((s, i) => s + i.importe, 0);
  const gastosMes = allGastos.filter(g => g.fecha.startsWith(mesKey)).reduce((s, g) => s + g.importe, 0);
  const ahorro = Math.max(0, ingresosMes - gastosMes);
  const mesesParaCompletar = falta > 0 && ahorro > 0 ? Math.ceil(falta / ahorro) : null;
  const mesesConAportacion = falta > 0 && (ahorro + aportacionSugerida) > 0
    ? Math.ceil(falta / (ahorro + aportacionSugerida))
    : null;

  const forceRecalc = () => {
    const { objetivo: nuevoObj } = calcObjetivo(gastos, extraMensual, mesesACubrir);
    const prevObj = objetivoActual;
    setObjetivo(nuevoObj);
    const today = new Date().toISOString().slice(0, 10);
    setFechaActualizacion(today);
    pushHistorial({ mes: now.getMonth() + 1, anio: now.getFullYear(), objetivo: nuevoObj, saldo: saldoActual });
    const diff = nuevoObj - prevObj;
    if (prevObj > 0 && Math.abs(diff) > 10) {
      if (diff > 0) toast(`Tu fondo necesita ${fmtEur(diff)} más que el mes pasado`, { icon: '📈' });
      else toast(`¡Buenas noticias! Tu fondo necesita ${fmtEur(Math.abs(diff))} menos este mes`, { icon: '✅' });
    } else {
      toast.success('Fondo de emergencia recalculado');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${estadoColor}20`, border: `1px solid ${estadoColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} style={{ color: estadoColor }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Fondo de Emergencia</h2>
              <div style={{ fontSize: 12, color: estadoColor, fontWeight: 600 }}>{estadoLabel}</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14, flexShrink: 0 }}>
          {(['resumen', 'calculo', 'plan', 'config'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: tab === t ? 'var(--blue)' : 'none', color: tab === t ? 'white' : 'var(--text2)', transition: 'all .15s' }}>
              {t === 'resumen' ? 'Resumen' : t === 'calculo' ? 'Cálculo' : t === 'plan' ? 'Plan' : 'Config'}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── RESUMEN ── */}
          {tab === 'resumen' && (
            <>
              {/* Big number */}
              <div style={{ background: 'linear-gradient(135deg, #1e1e2e, #161618)', border: '1px solid #2a2a42', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Objetivo del fondo</div>
                    <div style={{ fontSize: 32, fontWeight: 800 }}>{fmtEur(objetivo)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{mesesACubrir} meses × {fmtEur(promedio + extraMensual)}/mes</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Saldo actual</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: estadoColor }}>{fmtEur(saldoActual)}</div>
                    {cuentaVinculada && <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{cuentaVinculada.nombre}</div>}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${pctCubierto}%`, background: estadoColor, borderRadius: 6, transition: 'width .5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: estadoColor, fontWeight: 600 }}>{pctCubierto.toFixed(1)}% cubierto</span>
                  <span style={{ color: 'var(--text2)' }}>{mesesCubiertos.toFixed(1)} de {mesesACubrir} meses</span>
                </div>
              </div>

              {/* Status cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{falta > 0 ? 'Falta para completar' : 'Exceso sobre objetivo'}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: falta > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {falta > 0 ? `-${fmtEur(falta)}` : `+${fmtEur(sobra)}`}
                  </div>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Meses cubiertos</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: mesesCubiertos >= mesesACubrir ? 'var(--green)' : mesesCubiertos >= mesesACubrir * 0.5 ? 'var(--amber)' : 'var(--red)' }}>
                    {mesesCubiertos.toFixed(1)}
                    <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>/{mesesACubrir}</span>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {falta > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={15} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 13 }}>Tu fondo de emergencia está <strong style={{ color: 'var(--red)' }}>por debajo del objetivo</strong>. Prioriza completarlo antes de nuevas inversiones.</div>
                </div>
              )}
              {sobra > 0 && (
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 13 }}>¡Fondo de emergencia completo! El exceso de <strong style={{ color: 'var(--green)' }}>{fmtEur(sobra)}</strong> podría destinarse a inversión.</div>
                </div>
              )}

              {/* Saldo manual */}
              {!cuentaVinculada && (
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Saldo actual (manual)</span>
                    {!editSaldo && (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 12 }} onClick={() => setEditSaldo(true)}>Editar</button>
                    )}
                  </div>
                  {editSaldo ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input" type="number" min={0} step={0.01} value={tmpSaldo} onChange={e => setTmpSaldo(e.target.value)} style={{ flex: 1 }} autoFocus />
                      <button className="btn-primary" style={{ padding: '6px 14px' }} onClick={() => { setSaldoManual(parseFloat(tmpSaldo) || 0); setEditSaldo(false); }}>OK</button>
                      <button className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setEditSaldo(false)}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(saldoManual)}</div>
                  )}
                </div>
              )}

              {/* Historical chart */}
              {chartData.length > 1 && (
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Evolución del fondo</div>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text2)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                      <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => fmtEur(Number(v))} />
                      <Line type="monotone" dataKey="objetivo" stroke="var(--amber)" strokeWidth={2} dot={false} name="Objetivo" />
                      <Line type="monotone" dataKey="saldo" stroke="var(--green)" strokeWidth={2} dot={false} name="Saldo" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6, fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--amber)', display: 'inline-block', borderRadius: 2 }} /> Objetivo</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--green)', display: 'inline-block', borderRadius: 2 }} /> Saldo</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── CÁLCULO ── */}
          {tab === 'calculo' && (
            <>
              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Gastos de los últimos 6 meses</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 0', color: 'var(--text2)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Mes</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', color: 'var(--text2)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Gastos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mesesData.map((m) => (
                      <tr key={m.key}>
                        <td style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{m.label}</td>
                        <td style={{ padding: '6px 0', textAlign: 'right', borderBottom: '1px solid var(--border)', color: m.total === 0 ? 'var(--text2)' : 'var(--text)' }}>
                          {m.total === 0 ? <span style={{ fontSize: 11, opacity: 0.6 }}>Sin datos</span> : fmtEur(m.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {[
                      { label: 'Promedio mensual', value: fmtEur(promedio), bold: false },
                      { label: `Extra mensual (configurable)`, value: `+ ${fmtEur(extraMensual)}`, bold: false },
                      { label: 'Total/mes a cubrir', value: fmtEur(promedio + extraMensual), bold: true },
                      { label: `OBJETIVO (× ${mesesACubrir} meses)`, value: fmtEur(objetivo), bold: true, highlight: true },
                    ].map(r => (
                      <tr key={r.label} style={{ background: r.highlight ? 'rgba(59,130,246,0.08)' : undefined }}>
                        <td style={{ padding: '6px 0', fontWeight: r.bold ? 700 : 400, borderBottom: '1px solid var(--border)', color: r.highlight ? 'var(--blue)' : undefined }}>{r.label}</td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: r.bold ? 700 : 400, borderBottom: '1px solid var(--border)', color: r.highlight ? 'var(--blue)' : undefined }}>{r.value}</td>
                      </tr>
                    ))}
                  </tfoot>
                </table>
              </div>
              <button className="btn-primary" style={{ justifyContent: 'center', gap: 6 }} onClick={forceRecalc}>
                <TrendingUp size={14} /> Recalcular con datos actuales
              </button>
            </>
          )}

          {/* ── PLAN ── */}
          {tab === 'plan' && (
            <>
              {falta <= 0 ? (
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
                  <CheckCircle size={32} style={{ color: 'var(--green)', marginBottom: 10 }} />
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>¡Fondo de emergencia completo!</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Tienes {fmtEur(sobra)} por encima del objetivo. Considera invertir el exceso.</div>
                </div>
              ) : (
                <>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Situación actual</div>
                    {[
                      { label: 'Te falta', value: fmtEur(falta), color: 'var(--red)' },
                      { label: 'Ahorro mensual estimado', value: ahorro > 0 ? fmtEur(ahorro) : 'Sin datos este mes', color: ahorro > 0 ? 'var(--green)' : 'var(--text2)' },
                      { label: 'Meses para completar (sin cambios)', value: mesesParaCompletar != null ? `${mesesParaCompletar} meses` : 'Aumenta tu ahorro', color: mesesParaCompletar && mesesParaCompletar <= 12 ? 'var(--amber)' : 'var(--red)' },
                    ].map(m => (
                      <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{m.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Simular aportación adicional</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', flexShrink: 0 }}>Aportación extra/mes:</span>
                      <input className="input" type="number" min={0} step={50} value={aportacionSugerida} onChange={e => setAportacionSugerida(parseFloat(e.target.value) || 0)} style={{ width: 100 }} />
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>€</span>
                    </div>
                    {mesesConAportacion != null && mesesConAportacion > 0 && (
                      <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                        💡 Aportando <strong>{fmtEur(aportacionSugerida)}/mes</strong> adicionales completarías el fondo en <strong style={{ color: 'var(--blue)' }}>{mesesConAportacion} {mesesConAportacion === 1 ? 'mes' : 'meses'}</strong>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── CONFIG ── */}
          {tab === 'config' && (
            <>
              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Parámetros del cálculo</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Meses a cubrir</label>
                    <select className="select" value={mesesACubrir} onChange={e => setMesesACubrir(parseInt(e.target.value))}>
                      {[3, 4, 5, 6, 9, 12].map(n => <option key={n} value={n}>{n} meses</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Extra mensual de seguridad (€)</label>
                    <input className="input" type="number" min={0} step={100} value={extraMensual} onChange={e => setExtraMensual(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <button className="btn-primary" style={{ justifyContent: 'center', gap: 6 }} onClick={forceRecalc}>
                  <Settings size={14} /> Guardar y recalcular
                </button>
              </div>

              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cuenta vinculada al fondo</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
                  Vincula una cuenta bancaria para que el saldo se actualice automáticamente.
                </div>
                <select className="select" value={cuentaVinculadaId ?? ''} onChange={e => setCuentaVinculada(e.target.value || null)}>
                  <option value="">Sin vincular (introducir manualmente)</option>
                  {cuentas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} — {fmtEur(c.saldo)}</option>
                  ))}
                </select>
                {cuentaVinculada && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)' }}>
                    ✅ Saldo vinculado: {fmtEur(cuentaVinculada.saldo)} ({cuentaVinculada.nombre})
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Widget para el dashboard ──────────────────────────────────────────────────
export default function FondoEmergenciaWidget() {
  const {
    objetivoActual, saldoManual, cuentaVinculadaId, extraMensual, mesesACubrir,
    setObjetivo, setFechaActualizacion, pushHistorial, fechaUltimaActualizacion,
  } = useFondoEmergenciaStore();
  const { gastos, cuentas } = useFinanzasStore();

  const [showPanel, setShowPanel] = useState(false);

  // Derive saldo actual
  const cuentaVinculada = cuentas.find(c => c.id === cuentaVinculadaId);
  const saldoActual = cuentaVinculada ? cuentaVinculada.saldo : saldoManual;

  // Recalculate on mount and on the 1st of each month
  useEffect(() => {
    const { objetivo: nuevoObj } = calcObjetivo(gastos, extraMensual, mesesACubrir);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const lastUpdate = fechaUltimaActualizacion;
    const isFirstOfMonth = today.getDate() === 1;
    const alreadyUpdatedThisMonth = lastUpdate.startsWith(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    );

    // Always keep objetivo in sync silently
    if (nuevoObj !== objetivoActual) {
      setObjetivo(nuevoObj);
    }

    // On the 1st of month, run the official update with toast
    if (isFirstOfMonth && !alreadyUpdatedThisMonth && nuevoObj > 0) {
      const prev = objetivoActual;
      setObjetivo(nuevoObj);
      setFechaActualizacion(todayStr);
      pushHistorial({ mes: today.getMonth() + 1, anio: today.getFullYear(), objetivo: nuevoObj, saldo: saldoActual });
      const diff = nuevoObj - prev;
      if (prev > 0 && Math.abs(diff) > 10) {
        if (diff > 0) {
          toast(`Tu fondo necesita ${Math.round(diff).toLocaleString('es-ES')}€ más que el mes pasado`, { icon: '📈', duration: 6000 });
        } else {
          toast(`¡Buenas noticias! Tu fondo necesita ${Math.round(Math.abs(diff)).toLocaleString('es-ES')}€ menos este mes`, { icon: '✅', duration: 6000 });
        }
      } else if (nuevoObj > 0) {
        toast('Fondo de emergencia actualizado con tus gastos de los últimos 6 meses', { icon: '🛡️', duration: 5000 });
      }
    }
  }, [gastos, extraMensual, mesesACubrir]);

  const objetivo = objetivoActual > 0 ? objetivoActual : (promedio => (promedio + extraMensual) * mesesACubrir)(calcObjetivo(gastos, extraMensual, mesesACubrir).promedio);
  const { promedio } = calcObjetivo(gastos, extraMensual, mesesACubrir);
  const mensualACubrir = promedio + extraMensual;
  const mesesCubiertos = mensualACubrir > 0 ? saldoActual / mensualACubrir : 0;
  const pct = objetivo > 0 ? Math.min(100, (saldoActual / objetivo) * 100) : 0;
  const estado: 'insuficiente' | 'en_progreso' | 'cubierto' =
    pct < 40 ? 'insuficiente' : pct < 100 ? 'en_progreso' : 'cubierto';
  const estadoColor = estado === 'insuficiente' ? 'var(--red)' : estado === 'en_progreso' ? 'var(--amber)' : 'var(--green)';
  const estadoLabel = estado === 'insuficiente' ? 'INSUFICIENTE' : estado === 'en_progreso' ? 'EN PROGRESO' : 'CUBIERTO';

  return (
    <>
      <div
        className="card card-hover"
        style={{ cursor: 'pointer', border: `1px solid ${estadoColor}30` }}
        onClick={() => setShowPanel(true)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} style={{ color: estadoColor }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Fondo de Emergencia</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: estadoColor, background: `${estadoColor}18`, padding: '2px 7px', borderRadius: 4 }}>{estadoLabel}</span>
            <ChevronRight size={14} color="var(--text2)" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Tienes</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: estadoColor }}>{fmtEur(saldoActual)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Objetivo</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtEur(objetivo)}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: estadoColor, borderRadius: 4 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)' }}>
          <span>{pct.toFixed(1)}% cubierto</span>
          <span>{mesesCubiertos.toFixed(1)} / {mesesACubrir} meses</span>
        </div>
      </div>

      {showPanel && <FondoEmergenciaPanel onClose={() => setShowPanel(false)} />}
    </>
  );
}
