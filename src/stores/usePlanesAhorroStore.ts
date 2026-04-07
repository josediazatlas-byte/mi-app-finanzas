import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TipoPlan =
  | 'Plan de Pensiones'
  | 'PAS'
  | 'PIAS'
  | 'Unit Linked'
  | 'Seguro de Ahorro'
  | 'PPA';

export type EntidadPlan =
  | 'Mapfre'
  | 'AXA'
  | 'Allianz'
  | 'Mutua'
  | 'BBVA'
  | 'CaixaBank'
  | 'Santander'
  | 'Indexa'
  | 'Otro';

export interface PlanAhorro {
  id: string;
  nombre: string;
  tipo: TipoPlan;
  entidad: EntidadPlan;
  numeroPoliza?: string;
  perfilInversion?: string;
  fechaInicio: string;
  aportacionMensual: number;
  aportacionTotal: number;
  valorActual: number;
  valorFecha?: string;
  vencimiento?: string;
  beneficiarios?: string;
  notas?: string;
}

interface PlanesAhorroStore {
  planes: PlanAhorro[];
  addPlan: (p: Omit<PlanAhorro, 'id'>) => string;
  updatePlan: (id: string, p: Partial<Omit<PlanAhorro, 'id'>>) => void;
  removePlan: (id: string) => void;
}

export const usePlanesAhorroStore = create<PlanesAhorroStore>()(
  persist(
    (set) => ({
      planes: [],
      addPlan: (p) => {
        const id = Date.now().toString();
        set((s) => ({ planes: [...s.planes, { ...p, id }] }));
        return id;
      },
      updatePlan: (id, p) =>
        set((s) => ({ planes: s.planes.map((x) => x.id === id ? { ...x, ...p } : x) })),
      removePlan: (id) =>
        set((s) => ({ planes: s.planes.filter((x) => x.id !== id) })),
    }),
    { name: 'planes-ahorro-store' }
  )
);
