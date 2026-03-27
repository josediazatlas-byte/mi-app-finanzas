import { useState, useRef } from 'react';
import { Plus, Trash2, Pencil, X, FileDown, Eye, Camera } from 'lucide-react';
import { useFacturasStore } from '../stores/useFacturasStore';
import type { Factura, ConceptoFactura, FacturaEstado } from '../stores/useFacturasStore';
import { useClientesStore } from '../stores/useClientesStore';
import type { Cliente } from '../stores/useClientesStore';
import { useTicketsStore } from '../stores/useTicketsStore';
import type { Ticket } from '../stores/useTicketsStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useFinanzasStore, type Gasto } from '../stores/useFinanzasStore';
import toast from 'react-hot-toast';

function fmtEur(n: number) { return `€${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('es-ES') : '—'; }

const ESTADO_COLORS: Record<FacturaEstado, string> = {
  'Borrador': '#6b7280', 'Enviada': '#3b82f6', 'Cobrada': '#22c55e', 'Vencida': '#ef4444', 'Cancelada': '#f59e0b',
};
const ESTADOS: FacturaEstado[] = ['Borrador', 'Enviada', 'Cobrada', 'Vencida', 'Cancelada'];

// ═══════════════════════ CLIENTES ═══════════════════════
function ModalCliente({ cliente, onClose, onSaved }: { cliente?: Cliente | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { addCliente, updateCliente } = useClientesStore();
  const isEdit = !!cliente;
  const [form, setForm] = useState({ nombreRazonSocial: cliente?.nombreRazonSocial ?? '', nifCif: cliente?.nifCif ?? '', direccion: cliente?.direccion ?? '', email: cliente?.email ?? '', telefono: cliente?.telefono ?? '', notas: cliente?.notas ?? '' });
  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = () => {
    if (!form.nombreRazonSocial.trim()) { toast.error('Nombre obligatorio'); return; }
    if (isEdit && cliente) { updateCliente(cliente.id, form); toast.success('Cliente actualizado'); onClose(); }
    else {
      const id = Date.now().toString();
      addCliente(form);
      toast.success('Cliente creado');
      onSaved?.(id);
      onClose();
    }
  };
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{isEdit ? 'Editar' : 'Nuevo'} Cliente</h2>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">Nombre / Razón Social *</label><input className="input" value={form.nombreRazonSocial} onChange={e => upd('nombreRazonSocial', e.target.value)} /></div>
            <div><label className="label">NIF / CIF</label><input className="input" value={form.nifCif} onChange={e => upd('nifCif', e.target.value)} /></div>
          </div>
          <div><label className="label">Dirección</label><input className="input" value={form.direccion} onChange={e => upd('direccion', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => upd('email', e.target.value)} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.telefono} onChange={e => upd('telefono', e.target.value)} /></div>
          </div>
          <div><label className="label">Notas</label><input className="input" value={form.notas} onChange={e => upd('notas', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>{isEdit ? 'Guardar' : 'Crear cliente'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ FACTURAS ═══════════════════════
function ModalFactura({ factura, onClose }: { factura?: Factura | null; onClose: () => void }) {
  const { addFactura, updateFactura } = useFacturasStore();
  const { clientes } = useClientesStore();
  const { autonomo } = useConfigStore();
  const { addIngreso } = useFinanzasStore();
  const isEdit = !!factura;
  const today = new Date().toISOString().slice(0, 10);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [clienteId, setClienteId] = useState(factura?.clienteId ?? clientes[0]?.id ?? '');
  const [fechaEmision, setFechaEmision] = useState(factura?.fechaEmision ?? today);
  const [fechaVencimiento, setFechaVencimiento] = useState(factura?.fechaVencimiento ?? '');
  const [conceptos, setConceptos] = useState<ConceptoFactura[]>(factura?.conceptos ?? [{ descripcion: '', cantidad: 1, precioUnitario: 0, subtotal: 0 }]);
  const [iva, setIva] = useState(factura?.iva ?? autonomo.ivaDefault ?? 21);
  const [retencion, setRetencion] = useState(factura?.retencion ?? autonomo.retencionDefault ?? 15);
  const [estado, setEstado] = useState<FacturaEstado>(factura?.estado ?? 'Borrador');
  const [metodoPago, setMetodoPago] = useState(factura?.metodoPago ?? 'Transferencia');
  const [iban, setIban] = useState(factura?.iban ?? autonomo.iban ?? '');
  const [notas, setNotas] = useState(factura?.notas ?? '');

  const updConcepto = (i: number, k: keyof ConceptoFactura, v: string | number) => {
    setConceptos(cs => cs.map((c, idx) => {
      if (idx !== i) return c;
      const updated = { ...c, [k]: v };
      updated.subtotal = updated.cantidad * updated.precioUnitario;
      return updated;
    }));
  };

  const base = conceptos.reduce((s, c) => s + c.subtotal, 0);
  const ivaImporte = base * (iva / 100);
  const retencionImporte = base * (retencion / 100);
  const total = base + ivaImporte - retencionImporte;

  const handleSave = (nuevoEstado?: FacturaEstado) => {
    if (!clienteId) { toast.error('Selecciona un cliente'); return; }
    const data: Omit<Factura, 'id' | 'numero'> = {
      clienteId, fechaEmision, fechaVencimiento, conceptos,
      baseImponible: base, iva, retencion, total,
      estado: nuevoEstado ?? estado, metodoPago, iban, notas,
    };
    if (isEdit && factura) {
      updateFactura(factura.id, { ...data, numero: factura.numero });
      // If marking as Cobrada, register income
      if (nuevoEstado === 'Cobrada' && factura.estado !== 'Cobrada') {
        const cliente = clientes.find(c => c.id === clienteId);
        addIngreso({ nombre: `Factura ${factura.numero} - ${cliente?.nombreRazonSocial ?? ''}`, categoria: 'Freelance', importe: base, fecha: today, recurrente: false });
        toast.success('Ingreso neto registrado en Finanzas');
      }
      toast.success('Factura actualizada');
    } else {
      addFactura(data);
      toast.success('Factura creada');
    }
    onClose();
  };

  const handleGenerarPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const cliente = clientes.find(c => c.id === clienteId);
      const num = isEdit ? factura!.numero : 'BORRADOR';
      // Background
      pdf.setFillColor(13, 13, 16);
      pdf.rect(0, 0, 210, 297, 'F');
      // Header bar
      pdf.setFillColor(30, 30, 46);
      pdf.rect(0, 0, 210, 45, 'F');
      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22); pdf.setFont('helvetica', 'bold');
      pdf.text('FACTURA', 20, 20);
      pdf.setFontSize(12); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(150, 150, 180);
      pdf.text(`Nº ${num}`, 20, 30);
      pdf.text(`Fecha: ${fmtDate(fechaEmision)}`, 20, 37);
      if (fechaVencimiento) pdf.text(`Vto: ${fmtDate(fechaVencimiento)}`, 80, 37);
      // Emisor
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
      pdf.text(autonomo.nombre || 'Tu nombre', 130, 15);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(150, 150, 180); pdf.setFontSize(9);
      pdf.text(`NIF: ${autonomo.nif || 'N/A'}`, 130, 21);
      pdf.text(autonomo.direccion || '', 130, 27);
      pdf.text(autonomo.email || '', 130, 33);
      // Cliente
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
      pdf.text('FACTURAR A:', 20, 56);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(200, 200, 220);
      pdf.text(cliente?.nombreRazonSocial ?? 'Cliente', 20, 63);
      pdf.text(`NIF: ${cliente?.nifCif ?? ''}`, 20, 69);
      pdf.text(cliente?.direccion ?? '', 20, 75);
      // Table header
      pdf.setFillColor(42, 42, 66);
      pdf.rect(15, 88, 180, 8, 'F');
      pdf.setTextColor(150, 200, 255); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text('DESCRIPCIÓN', 18, 94);
      pdf.text('CANT.', 120, 94);
      pdf.text('P.UNIT.', 140, 94);
      pdf.text('SUBTOTAL', 165, 94);
      // Rows
      let y = 104;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(220, 220, 240);
      conceptos.forEach(c => {
        pdf.text(c.descripcion, 18, y);
        pdf.text(String(c.cantidad), 120, y);
        pdf.text(fmtEur(c.precioUnitario), 138, y);
        pdf.text(fmtEur(c.subtotal), 163, y);
        pdf.setDrawColor(42, 42, 66);
        pdf.line(15, y + 3, 195, y + 3);
        y += 10;
      });
      // Totals
      y += 5;
      pdf.setFillColor(30, 30, 46);
      pdf.rect(120, y, 75, 35, 'F');
      pdf.setFontSize(9); pdf.setTextColor(150, 150, 180);
      pdf.text(`Base imponible:`, 123, y + 8);
      pdf.text(`IVA ${iva}%:`, 123, y + 15);
      pdf.text(`Ret. IRPF ${retencion}%:`, 123, y + 22);
      pdf.setTextColor(220, 220, 240);
      pdf.text(fmtEur(base), 175, y + 8, { align: 'right' });
      pdf.text(fmtEur(ivaImporte), 175, y + 15, { align: 'right' });
      pdf.text(`-${fmtEur(retencionImporte)}`, 175, y + 22, { align: 'right' });
      pdf.setFillColor(59, 130, 246);
      pdf.rect(120, y + 27, 75, 10, 'F');
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
      pdf.text('TOTAL:', 123, y + 34);
      pdf.text(fmtEur(total), 190, y + 34, { align: 'right' });
      // IBAN
      if (iban) {
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(150, 150, 180);
        pdf.text(`Transferencia a: ${iban}`, 15, y + 50);
      }
      pdf.save(`factura-${num}.pdf`);
      toast.success('PDF generado');
    } catch { toast.error('Error al generar PDF'); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{isEdit ? `Factura ${factura!.numero}` : 'Nueva Factura'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }} onClick={handleGenerarPDF}><FileDown size={13} /> PDF</button>
            <button className="btn-icon" onClick={onClose}><X size={15} /></button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Cliente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label className="label">Cliente</label>
              <select className="select" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombreRazonSocial}</option>)}
              </select>
            </div>
            <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => setShowNuevoCliente(true)}>+ Cliente</button>
          </div>
          {/* Dates & estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <div><label className="label">Emisión</label><input className="input" type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} /></div>
            <div><label className="label">Vencimiento</label><input className="input" type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} /></div>
            <div><label className="label">Estado</label>
              <select className="select" value={estado} onChange={e => setEstado(e.target.value as FacturaEstado)}>
                {ESTADOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Método pago</label><input className="input" value={metodoPago} onChange={e => setMetodoPago(e.target.value)} /></div>
          </div>
          {/* Conceptos */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Conceptos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {conceptos.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 80px 110px 110px 32px', gap: 6, alignItems: 'center' }}>
                  <input className="input" placeholder="Descripción" value={c.descripcion} onChange={e => updConcepto(i, 'descripcion', e.target.value)} style={{ fontSize: 12 }} />
                  <input className="input" type="number" value={c.cantidad} onChange={e => updConcepto(i, 'cantidad', parseFloat(e.target.value))} style={{ fontSize: 12 }} />
                  <input className="input" type="number" step="0.01" placeholder="P.Unit." value={c.precioUnitario || ''} onChange={e => updConcepto(i, 'precioUnitario', parseFloat(e.target.value))} style={{ fontSize: 12 }} />
                  <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{fmtEur(c.subtotal)}</div>
                  <button className="btn-icon" onClick={() => setConceptos(cs => cs.filter((_, idx) => idx !== i))} style={{ flexShrink: 0 }}><X size={12} /></button>
                </div>
              ))}
            </div>
            <button className="btn-secondary" style={{ marginTop: 8, fontSize: 12, padding: '5px 12px', display: 'flex', gap: 4, alignItems: 'center' }}
              onClick={() => setConceptos(cs => [...cs, { descripcion: '', cantidad: 1, precioUnitario: 0, subtotal: 0 }])}>
              <Plus size={12} /> Añadir línea
            </button>
          </div>
          {/* IVA / Retención / Totales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label className="label">IVA (%)</label><input className="input" type="number" value={iva} onChange={e => setIva(+e.target.value)} /></div>
            <div><label className="label">Retención IRPF (%)</label><input className="input" type="number" value={retencion} onChange={e => setRetencion(+e.target.value)} /></div>
            <div><label className="label">IBAN cobro</label><input className="input" value={iban} onChange={e => setIban(e.target.value)} /></div>
          </div>
          {/* Totals box */}
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 10 }}>
              {[
                { label: 'Base imponible', val: fmtEur(base) },
                { label: `IVA ${iva}%`, val: fmtEur(ivaImporte) },
                { label: `Ret. ${retencion}%`, val: `-${fmtEur(retencionImporte)}` },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{item.label}</div>
                  <div style={{ fontWeight: 600 }}>{item.val}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>TOTAL A COBRAR</span>
              <span style={{ fontWeight: 800, fontSize: 24, color: 'var(--blue)' }}>{fmtEur(total)}</span>
            </div>
          </div>
          <div><label className="label">Notas</label><input className="input" value={notas} onChange={e => setNotas(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          {isEdit && estado !== 'Cobrada' && (
            <button className="btn-primary" style={{ background: 'var(--green)' }} onClick={() => handleSave('Cobrada')}>Marcar cobrada + registrar ingreso</button>
          )}
          <button className="btn-primary" onClick={() => handleSave()}>Guardar</button>
        </div>
        {showNuevoCliente && <ModalCliente onClose={() => setShowNuevoCliente(false)} onSaved={id => setClienteId(id)} />}
      </div>
    </div>
  );
}

function TabFacturas() {
  const { facturas, removeFactura } = useFacturasStore();
  const { clientes } = useClientesStore();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Factura | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FacturaEstado | 'Todas'>('Todas');
  const [filtroCliente, setFiltroCliente] = useState('');

  const filtradas = facturas.filter(f =>
    (filtroEstado === 'Todas' || f.estado === filtroEstado) &&
    (!filtroCliente || f.clienteId === filtroCliente)
  );

  const totalPendiente = facturas.filter(f => f.estado === 'Enviada').reduce((s, f) => s + f.total, 0);
  const totalCobrado = facturas.filter(f => f.estado === 'Cobrada').reduce((s, f) => s + f.baseImponible, 0);
  const ivaTotal = facturas.filter(f => f.estado === 'Cobrada').reduce((s, f) => s + f.baseImponible * (f.iva / 100), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Pendiente cobro', val: fmtEur(totalPendiente), color: 'var(--amber)' },
          { label: 'Cobrado (base)', val: fmtEur(totalCobrado), color: 'var(--green)' },
          { label: 'IVA repercutido', val: fmtEur(ivaTotal), color: 'var(--blue)' },
          { label: 'Total facturas', val: String(facturas.length), color: 'var(--text)' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>
      {/* Filters + Add */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <select className="select" style={{ width: 130, fontSize: 12 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as FacturaEstado | 'Todas')}>
          <option value="Todas">Todos estados</option>
          {ESTADOS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="select" style={{ width: 160, fontSize: 12 }} value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
          <option value="">Todos clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombreRazonSocial}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setEditItem(null); setShowModal(true); }}>
          <Plus size={14} /> Nueva factura
        </button>
      </div>
      {/* List */}
      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)', fontSize: 14 }}>No hay facturas. Crea la primera con el botón +.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtradas.map(f => {
            const cliente = clientes.find(c => c.id === f.clienteId);
            return (
              <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 90px 90px 90px auto', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue)' }}>{f.numero}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{cliente?.nombreRazonSocial ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtDate(f.fechaEmision)}</div>
                </div>
                <span style={{ fontSize: 12 }}>{fmtEur(f.baseImponible)}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtEur(f.total)}</span>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: `${ESTADO_COLORS[f.estado]}22`, color: ESTADO_COLORS[f.estado], fontWeight: 600, textAlign: 'center' }}>{f.estado}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>{f.metodoPago}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" onClick={() => { setEditItem(f); setShowModal(true); }}><Pencil size={13} /></button>
                  <button className="btn-icon" onClick={() => { if (window.confirm('¿Eliminar?')) removeFactura(f.id); }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showModal && <ModalFactura factura={editItem} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}

// ═══════════════════════ TICKETS / OCR ═══════════════════════
function TabTickets() {
  const { tickets, addTicket, removeTicket } = useTicketsStore();
  const { addGasto } = useFinanzasStore();
  const { anthropicKey } = useConfigStore();
  const [paso, setPaso] = useState<'lista' | 'captura' | 'analisis' | 'confirmacion'>('lista');
  const [imagenBase64, setImagenBase64] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [ticketDraft, setTicketDraft] = useState<Partial<Ticket>>({});
  const [verTicket, setVerTicket] = useState<Ticket | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const ticketsMes = tickets.filter(t => t.fechaEscaneo?.startsWith(mesActual));
  const totalMes = ticketsMes.reduce((s, t) => s + t.total, 0);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImagenBase64(base64);
      setPaso('analisis');
    };
    reader.readAsDataURL(file);
  };

  const handleAnalizar = async () => {
    if (!anthropicKey) {
      setTicketDraft({ imagen: imagenBase64, fecha: new Date().toISOString().slice(0, 10), total: 0, subtotal: 0, iva: 0, conceptos: [], establecimiento: '', categoria: 'Otros', notas: '', estado: 'pendiente', gastoId: '', fechaEscaneo: new Date().toISOString() });
      setPaso('confirmacion');
      return;
    }
    setAnalizando(true);
    try {
      const resp = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          apiKey: anthropicKey,
          payload: {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagenBase64 } },
                { type: 'text', text: 'Analiza este ticket y extrae un JSON con estos campos exactos: {"establecimiento":"","fecha":"DD/MM/YYYY","total":0,"subtotal":0,"iva":0,"conceptos":[{"descripcion":"","importe":0}],"categoria_sugerida":"Alimentación"}. Las categorías válidas son: Alimentación, Transporte, Vivienda, Ocio, Salud, Restaurantes, Gasolina, Suscripciones, Material oficina, Otros. Responde SOLO con el JSON sin texto adicional.' },
              ],
            }],
          },
        }),
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text ?? '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const fechaParts = (parsed.fecha ?? '').split('/');
        const fechaISO = fechaParts.length === 3 ? `${fechaParts[2]}-${fechaParts[1].padStart(2,'0')}-${fechaParts[0].padStart(2,'0')}` : new Date().toISOString().slice(0,10);
        setTicketDraft({ imagen: imagenBase64, establecimiento: parsed.establecimiento ?? '', fecha: fechaISO, total: parsed.total ?? 0, subtotal: parsed.subtotal ?? 0, iva: parsed.iva ?? 0, conceptos: parsed.conceptos ?? [], categoria: parsed.categoria_sugerida ?? 'Otros', notas: '', estado: 'pendiente', gastoId: '', fechaEscaneo: new Date().toISOString() });
      }
      setPaso('confirmacion');
    } catch { toast.error('Error al analizar. Rellena manualmente.'); setTicketDraft({ imagen: imagenBase64, fecha: new Date().toISOString().slice(0, 10), total: 0, subtotal: 0, iva: 0, conceptos: [], establecimiento: '', categoria: 'Otros', notas: '', estado: 'pendiente', gastoId: '', fechaEscaneo: new Date().toISOString() }); setPaso('confirmacion'); }
    finally { setAnalizando(false); }
  };

  const handleConfirmar = () => {
    const gastoId = Date.now().toString();
    addGasto({ nombre: ticketDraft.establecimiento || 'Ticket', categoria: (ticketDraft.categoria || 'Otros') as Gasto['categoria'], importe: ticketDraft.total || 0, fecha: ticketDraft.fecha || new Date().toISOString().slice(0,10), recurrente: false });
    addTicket({ ...(ticketDraft as Omit<Ticket, 'id'>), estado: 'confirmado', gastoId });
    toast.success('Ticket guardado y gasto registrado');
    setPaso('lista');
    setImagenBase64('');
  };

  const upd = (k: string, v: unknown) => setTicketDraft(d => ({ ...d, [k]: v }));

  const CATS = ['Alimentación', 'Transporte', 'Vivienda', 'Ocio', 'Salud', 'Restaurantes', 'Gasolina', 'Suscripciones', 'Material oficina', 'Otros'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {paso === 'lista' && (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Tickets este mes', val: String(ticketsMes.length), color: 'var(--text)' },
              { label: 'Total escaneado', val: fmtEur(totalMes), color: 'var(--amber)' },
              { label: 'Pendientes revisar', val: String(tickets.filter(t => t.estado === 'pendiente').length), color: 'var(--red)' },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>
          {/* Scan button */}
          <div className="card" style={{ padding: 24, textAlign: 'center', border: '2px dashed var(--border)', cursor: 'pointer' }} onClick={() => setPaso('captura')}>
            <Camera size={32} color="var(--blue)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>+ Escanear ticket</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{anthropicKey ? 'Análisis automático con IA' : 'Subir imagen y rellenar manualmente'}</div>
          </div>
          {/* List */}
          {tickets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tickets.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  {t.imagen && (
                    <img src={`data:image/jpeg;base64,${t.imagen}`} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.establecimiento || 'Sin nombre'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{t.categoria} · {fmtDate(t.fecha)}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{fmtEur(t.total)}</div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: t.estado === 'confirmado' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: t.estado === 'confirmado' ? 'var(--green)' : 'var(--amber)' }}>{t.estado}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => setVerTicket(t)}><Eye size={13} /></button>
                    <button className="btn-icon" onClick={() => { if (window.confirm('¿Eliminar?')) removeTicket(t.id); }}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {paso === 'captura' && (
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Capturar ticket</h3>
          <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
            <label style={{ cursor: 'pointer', padding: '16px 24px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--blue)' }}>
              📷 Hacer foto / Subir imagen
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} ref={fileRef} />
            </label>
            <button className="btn-secondary" onClick={() => setPaso('lista')}>Cancelar</button>
          </div>
        </div>
      )}

      {paso === 'analisis' && (
        <div className="card" style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center', padding: 40 }}>
          {imagenBase64 && <img src={`data:image/jpeg;base64,${imagenBase64}`} alt="" style={{ width: '100%', maxHeight: 250, objectFit: 'contain', borderRadius: 8, marginBottom: 16 }} />}
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Imagen cargada</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>{anthropicKey ? 'Haz clic para analizar con IA' : 'Rellena los datos manualmente'}</div>
          {analizando ? (
            <div style={{ color: 'var(--blue)', fontSize: 14 }}>🔍 Analizando ticket...</div>
          ) : (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setPaso('lista')}>Cancelar</button>
              <button className="btn-primary" onClick={handleAnalizar}>{anthropicKey ? '🤖 Analizar con IA' : 'Continuar manualmente'}</button>
            </div>
          )}
        </div>
      )}

      {paso === 'confirmacion' && (
        <div className="card" style={{ maxWidth: 580, margin: '0 auto' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Confirmar datos del ticket</h3>
          <div style={{ display: 'grid', gridTemplateColumns: imagenBase64 ? '180px 1fr' : '1fr', gap: 16 }}>
            {imagenBase64 && <img src={`data:image/jpeg;base64,${imagenBase64}`} alt="" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 220 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="label">Establecimiento</label><input className="input" value={ticketDraft.establecimiento ?? ''} onChange={e => upd('establecimiento', e.target.value)} /></div>
                <div><label className="label">Fecha</label><input className="input" type="date" value={ticketDraft.fecha ?? ''} onChange={e => upd('fecha', e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label className="label">Total (€)</label><input className="input" type="number" step="0.01" value={ticketDraft.total ?? ''} onChange={e => upd('total', parseFloat(e.target.value))} /></div>
                <div><label className="label">Subtotal</label><input className="input" type="number" step="0.01" value={ticketDraft.subtotal ?? ''} onChange={e => upd('subtotal', parseFloat(e.target.value))} /></div>
                <div><label className="label">IVA</label><input className="input" type="number" step="0.01" value={ticketDraft.iva ?? ''} onChange={e => upd('iva', parseFloat(e.target.value))} /></div>
              </div>
              <div><label className="label">Categoría</label>
                <select className="select" value={ticketDraft.categoria ?? 'Otros'} onChange={e => upd('categoria', e.target.value)}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Notas</label><input className="input" value={ticketDraft.notas ?? ''} onChange={e => upd('notas', e.target.value)} /></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => { setPaso('lista'); setImagenBase64(''); }}>Descartar</button>
            <button className="btn-primary" onClick={handleConfirmar}>Confirmar y registrar gasto</button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {verTicket && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700 }}>{verTicket.establecimiento || 'Ticket'}</h3>
              <button className="btn-icon" onClick={() => setVerTicket(null)}><X size={14} /></button>
            </div>
            {verTicket.imagen && <img src={`data:image/jpeg;base64,${verTicket.imagen}`} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 12 }} />}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text2)' }}>Fecha: </span>{fmtDate(verTicket.fecha)}</div>
              <div><span style={{ color: 'var(--text2)' }}>Categoría: </span>{verTicket.categoria}</div>
              <div><span style={{ color: 'var(--text2)' }}>Total: </span><strong>{fmtEur(verTicket.total)}</strong></div>
              <div><span style={{ color: 'var(--text2)' }}>IVA: </span>{fmtEur(verTicket.iva)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ RESUMEN FISCAL ═══════════════════════
function TabResumenFiscal() {
  const { facturas } = useFacturasStore();
  const { tickets } = useTicketsStore();

  const now = new Date();
  const year = now.getFullYear();

  const trimestres = [
    { label: 'Q1 (Ene-Mar)', meses: ['01', '02', '03'] },
    { label: 'Q2 (Abr-Jun)', meses: ['04', '05', '06'] },
    { label: 'Q3 (Jul-Sep)', meses: ['07', '08', '09'] },
    { label: 'Q4 (Oct-Dic)', meses: ['10', '11', '12'] },
  ];

  const trimestreData = trimestres.map(q => {
    const keys = q.meses.map(m => `${year}-${m}`);
    const facturasQ = facturas.filter(f => keys.some(k => f.fechaEmision.startsWith(k)) && f.estado === 'Cobrada');
    const ticketsQ = tickets.filter(t => keys.some(k => t.fecha?.startsWith(k)));
    const base = facturasQ.reduce((s, f) => s + f.baseImponible, 0);
    const ivaRep = facturasQ.reduce((s, f) => s + f.baseImponible * (f.iva / 100), 0);
    const ivaSop = ticketsQ.reduce((s, t) => s + (t.iva ?? 0), 0);
    const retenciones = facturasQ.reduce((s, f) => s + f.baseImponible * (f.retencion / 100), 0);
    return { label: q.label, base, ivaRep, ivaSop, ivaLiquidar: ivaRep - ivaSop, retenciones, numFacturas: facturasQ.length };
  });

  const totales = trimestreData.reduce((acc, t) => ({ base: acc.base + t.base, ivaRep: acc.ivaRep + t.ivaRep, ivaSop: acc.ivaSop + t.ivaSop, ivaLiquidar: acc.ivaLiquidar + t.ivaLiquidar, retenciones: acc.retenciones + t.retenciones }), { base: 0, ivaRep: 0, ivaSop: 0, ivaLiquidar: 0, retenciones: 0 });

  const exportCSV303 = () => {
    const csv = ['Trimestre,Base Imponible,IVA Repercutido,IVA Soportado,IVA a Liquidar',
      ...trimestreData.map(t => `${t.label},${t.base.toFixed(2)},${t.ivaRep.toFixed(2)},${t.ivaSop.toFixed(2)},${t.ivaLiquidar.toFixed(2)}`)
    ].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `modelo303-${year}.csv`; a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Resumen Fiscal {year}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={exportCSV303}><FileDown size={13} /> Modelo 303</button>
        </div>
      </div>
      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {[
          { label: 'Base facturada', val: fmtEur(totales.base), color: 'var(--green)' },
          { label: 'IVA repercutido', val: fmtEur(totales.ivaRep), color: 'var(--blue)' },
          { label: 'IVA soportado', val: fmtEur(totales.ivaSop), color: 'var(--text2)' },
          { label: 'IVA a liquidar', val: fmtEur(totales.ivaLiquidar), color: totales.ivaLiquidar > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Retenciones', val: fmtEur(totales.retenciones), color: 'var(--amber)' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontWeight: 700, color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>
      {/* Per quarter */}
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Desglose trimestral</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Trimestre', 'Facturas', 'Base', 'IVA Rep.', 'IVA Sop.', 'IVA Liq.', 'Retenciones'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trimestreData.map(t => (
              <tr key={t.label} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.label}</td>
                <td style={{ padding: '8px 10px' }}>{t.numFacturas}</td>
                <td style={{ padding: '8px 10px' }}>{fmtEur(t.base)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--blue)' }}>{fmtEur(t.ivaRep)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{fmtEur(t.ivaSop)}</td>
                <td style={{ padding: '8px 10px', color: t.ivaLiquidar > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{fmtEur(t.ivaLiquidar)}</td>
                <td style={{ padding: '8px 10px', color: 'var(--amber)' }}>{fmtEur(t.retenciones)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>⏰ Declaraciones trimestrales</div>
        {[
          { label: 'Q1 → Modelo 303/130', fecha: `${year}-04-20` },
          { label: 'Q2 → Modelo 303/130', fecha: `${year}-07-20` },
          { label: 'Q3 → Modelo 303/130', fecha: `${year}-10-20` },
          { label: 'Q4 → Modelo 303/130', fecha: `${year + 1}-01-30` },
        ].map(item => {
          const d = new Date(item.fecha);
          const dias = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>{item.label}</span>
              <span style={{ color: dias >= 0 && dias <= 10 ? 'var(--red)' : dias < 0 ? 'var(--text2)' : 'var(--amber)' }}>
                {dias < 0 ? 'Pasado' : dias === 0 ? '¡HOY!' : `${dias} días`} · {fmtDate(item.fecha)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════ MAIN ═══════════════════════
export default function Documentos() {
  const [tab, setTab] = useState<'facturas' | 'tickets' | 'fiscal'>('facturas');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Documentos</h1>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>Facturación autónomo · Tickets · Resumen fiscal</div>
      </div>
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
        {([['facturas', '🧾 Facturas emitidas'], ['tickets', '📷 Gastos escaneados'], ['fiscal', '📊 Resumen fiscal']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: tab === t ? 'var(--blue)' : 'none', color: tab === t ? 'white' : 'var(--text2)', transition: 'all .2s' }}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'facturas' && <TabFacturas />}
      {tab === 'tickets' && <TabTickets />}
      {tab === 'fiscal' && <TabResumenFiscal />}
    </div>
  );
}
