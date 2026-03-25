import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import type { Gasto } from '../stores/useFinanzasStore';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; gasto?: Gasto; }

// Simple keyword-based auto-categorization
function suggestCategory(nombre: string): Gasto['categoria'] {
  const n = nombre.toLowerCase();
  if (/mercadona|lidl|aldi|carrefour|alcampo|supermercado|frutería|panadería|fruteria|panaderia|alimenta|comida|super|hipercor/.test(n)) return 'Alimentación';
  if (/netflix|spotify|amazon prime|hbo|disney|twitch|youtube premium|suscripci|prime video/.test(n)) return 'Suscripciones';
  if (/uber|cabify|renfe|metro|bus|gasolinera|gasolina|tren|avión|avion|parking|taxi|coche|autobus/.test(n)) return 'Transporte';
  if (/alquiler|hipoteca|agua|luz|gas|internet|comunidad|seguro hogar|electricidad/.test(n)) return 'Vivienda';
  if (/farmacia|médico|medico|clínica|clinica|dentista|hospital|fisio|seguro salud|sanitas|adeslas/.test(n)) return 'Salud';
  if (/restaurante|bar|cine|teatro|concierto|ocio|hobby|gym|gimnasio|deporte|viaje|hotel|airbnb/.test(n)) return 'Ocio';
  return 'Otros';
}

export default function ModalGasto({ onClose, gasto }: Props) {
  const { addGasto, updateGasto } = useFinanzasStore();
  const isEdit = !!gasto;
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<Omit<Gasto, 'id'>>({
    categoria: gasto?.categoria ?? 'Alimentación',
    nombre: gasto?.nombre ?? '',
    importe: gasto?.importe ?? 0,
    fecha: gasto?.fecha ?? today,
    recurrente: gasto?.recurrente ?? false,
  });
  const [autoSuggested, setAutoSuggested] = useState(false);

  const handleNombreChange = (nombre: string) => {
    const suggested = suggestCategory(nombre);
    const newForm = { ...form, nombre };
    if (nombre.length >= 3 && !isEdit) {
      newForm.categoria = suggested;
      setAutoSuggested(true);
    } else {
      setAutoSuggested(false);
    }
    setForm(newForm);
  };

  const handleSubmit = () => {
    if (!form.nombre || form.importe <= 0) { toast.error('Completa todos los campos'); return; }
    if (isEdit) {
      updateGasto(gasto.id, form);
      toast.success('Gasto actualizado');
    } else {
      addGasto(form);
      toast.success('Gasto añadido');
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar Gasto' : 'Añadir Gasto'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => handleNombreChange(e.target.value)} placeholder="Ej: Supermercado Mercadona" autoFocus />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <label className="label" style={{ margin: 0 }}>Categoría</label>
              {autoSuggested && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--blue)', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                  <Sparkles size={10} /> Auto
                </span>
              )}
            </div>
            <select className="select" value={form.categoria} onChange={(e) => { setForm({ ...form, categoria: e.target.value as Gasto['categoria'] }); setAutoSuggested(false); }}>
              {['Vivienda', 'Alimentación', 'Transporte', 'Ocio', 'Salud', 'Suscripciones', 'Otros'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Importe (€)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.importe || ''} onChange={(e) => setForm({ ...form, importe: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input className="input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Recurrente</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Se repite mensualmente</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.recurrente} onChange={(e) => setForm({ ...form, recurrente: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>
              {isEdit ? 'Actualizar gasto' : 'Añadir gasto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
