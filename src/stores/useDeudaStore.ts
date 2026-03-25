import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Deuda {
  id: string;
  tipo: 'Hipoteca' | 'Préstamo Personal' | 'Tarjeta' | 'Coche' | 'Estudiante' | 'Otro';
  nombre: string;
  importeTotal: number;
  importePendiente: number;
  cuotaMensual: number;
  interes: number;
  fechaVencimiento: string;
  divisa: 'EUR' | 'USD' | 'GBP';
}

interface DeudaStore {
  deudas: Deuda[];
  addDeuda: (d: Omit<Deuda, 'id'>) => void;
  updateDeuda: (id: string, d: Partial<Omit<Deuda, 'id'>>) => void;
  removeDeuda: (id: string) => void;
}

const defaultDeudas: Deuda[] = [
  { id: '1', tipo: 'Préstamo Personal', nombre: 'Préstamo coche', importeTotal: 12000, importePendiente: 7500, cuotaMensual: 280, interes: 4.5, fechaVencimiento: '2027-06-01', divisa: 'EUR' },
  { id: '2', tipo: 'Tarjeta', nombre: 'Tarjeta de crédito', importeTotal: 1500, importePendiente: 850, cuotaMensual: 150, interes: 18.9, fechaVencimiento: '2025-12-01', divisa: 'EUR' },
];

export const useDeudaStore = create<DeudaStore>()(
  persist(
    (set) => ({
      deudas: defaultDeudas,
      addDeuda: (d) => set((s) => ({ deudas: [...s.deudas, { ...d, id: Date.now().toString() }] })),
      updateDeuda: (id, d) => set((s) => ({ deudas: s.deudas.map((x) => x.id === id ? { ...x, ...d } : x) })),
      removeDeuda: (id) => set((s) => ({ deudas: s.deudas.filter((x) => x.id !== id) })),
    }),
    { name: 'deuda-store' }
  )
);
