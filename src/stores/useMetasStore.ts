import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MetaTipo = 'Fondo emergencia' | 'Viaje' | 'Vivienda' | 'Vehículo' | 'Jubilación' | 'Educación' | 'Otro';

export interface Meta {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: MetaTipo;
  objetivo: number;
  ahorrado: number;
  aportacionMensual: number;
  fechaObjetivo: string; // YYYY-MM-DD
  prioridad: 1 | 2 | 3;
  color: string;
}

interface MetasStore {
  metas: Meta[];
  addMeta: (m: Omit<Meta, 'id'>) => void;
  updateMeta: (id: string, m: Partial<Omit<Meta, 'id'>>) => void;
  removeMeta: (id: string) => void;
  aportarMeta: (id: string, cantidad: number) => void;
}

const defaultMetas: Meta[] = [
  { id: '1', nombre: 'Fondo de Emergencia', descripcion: '6 meses de gastos cubiertos', tipo: 'Fondo emergencia', objetivo: 15000, ahorrado: 8500, aportacionMensual: 500, fechaObjetivo: '2026-12-31', prioridad: 1, color: '#3b82f6' },
  { id: '2', nombre: 'Viaje a Japón', descripcion: 'Viaje de 3 semanas', tipo: 'Viaje', objetivo: 4000, ahorrado: 1200, aportacionMensual: 200, fechaObjetivo: '2026-10-01', prioridad: 2, color: '#f59e0b' },
  { id: '3', nombre: 'Entrada piso', descripcion: '20% de entrada para nueva vivienda', tipo: 'Vivienda', objetivo: 60000, ahorrado: 12000, aportacionMensual: 800, fechaObjetivo: '2030-06-01', prioridad: 1, color: '#22c55e' },
];

export const useMetasStore = create<MetasStore>()(
  persist(
    (set) => ({
      metas: defaultMetas,
      addMeta: (m) => set((s) => ({ metas: [...s.metas, { ...m, id: Date.now().toString() }] })),
      updateMeta: (id, m) => set((s) => ({ metas: s.metas.map((x) => x.id === id ? { ...x, ...m } : x) })),
      removeMeta: (id) => set((s) => ({ metas: s.metas.filter((x) => x.id !== id) })),
      aportarMeta: (id, cantidad) => set((s) => ({ metas: s.metas.map((x) => x.id === id ? { ...x, ahorrado: x.ahorrado + cantidad } : x) })),
    }),
    { name: 'metas-store' }
  )
);
