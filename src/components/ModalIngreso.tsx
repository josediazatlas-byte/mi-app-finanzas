import { useState } from 'react';
import { X } from 'lucide-react';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import type { Ingreso } from '../stores/useFinanzasStore';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; ingreso?: Ingreso; }

export default function ModalIngreso({ onClose, ingreso }: Props) {
  const { addIngreso, updateIngreso } = useFinanzasStore();
  const isEdit = !!ingreso;
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<Omit<Ingreso, 'id'>>({
    categoria: ingreso?.categoria ?? 'Salario',
    nombre: ingreso?.nombre ?? '',
    importe: ingreso?.importe ?? 0,
    fecha: ingreso?.fecha ?? today,
    recurrente: ingreso?.recurrente ?? false,
  });

  const handleSubmit = () => {
    if (!form.nombre || form.importe <= 0) { toast.error('Completa todos los campos'); return; }
    if (isEdit) {
      updateIngreso(ingreso.id, form);
      toast.success('Ingreso actualizado');
    } else {
      addIngreso(form);
      toast.success('Ingreso añadido');
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Editar Ingreso' : 'Añadir Ingreso'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Categoría</label>
            <select className="select" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as Ingreso['categoria'] })}>
              {['Salario', 'Freelance', 'Dividendo', 'Alquiler', 'Otros'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Sueldo mensual" />
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
              {isEdit ? 'Actualizar ingreso' : 'Añadir ingreso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
