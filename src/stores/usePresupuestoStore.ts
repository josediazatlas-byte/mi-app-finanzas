import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Presupuesto {
  categoria: string;
  limite: number;
}

interface PresupuestoStore {
  presupuestos: Presupuesto[];
  setPresupuesto: (categoria: string, limite: number) => void;
}

const defaultPresupuestos: Presupuesto[] = [
  { categoria: 'Vivienda', limite: 1000 },
  { categoria: 'Alimentación', limite: 400 },
  { categoria: 'Transporte', limite: 100 },
  { categoria: 'Ocio', limite: 150 },
  { categoria: 'Salud', limite: 80 },
  { categoria: 'Suscripciones', limite: 50 },
  { categoria: 'Otros', limite: 200 },
];

export const usePresupuestoStore = create<PresupuestoStore>()(
  persist(
    (set) => ({
      presupuestos: defaultPresupuestos,
      setPresupuesto: (categoria, limite) =>
        set((s) => ({
          presupuestos: s.presupuestos.find(x => x.categoria === categoria)
            ? s.presupuestos.map((x) => x.categoria === categoria ? { ...x, limite } : x)
            : [...s.presupuestos, { categoria, limite }],
        })),
    }),
    { name: 'presupuesto-store' }
  )
);
