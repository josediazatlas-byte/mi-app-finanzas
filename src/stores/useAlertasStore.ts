import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Alerta {
  id: string;
  tipo: 'info' | 'warning' | 'danger';
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
}

interface AlertasStore {
  alertas: Alerta[];
  addAlerta: (a: Omit<Alerta, 'id' | 'leida' | 'fecha'>) => void;
  marcarLeida: (id: string) => void;
  marcarTodasLeidas: () => void;
  removeAlerta: (id: string) => void;
}

export const useAlertasStore = create<AlertasStore>()(
  persist(
    (set) => ({
      alertas: [],
      addAlerta: (a) => set((s) => ({
        alertas: [{ ...a, id: Date.now().toString(), leida: false, fecha: new Date().toISOString().slice(0, 10) }, ...s.alertas].slice(0, 50),
      })),
      marcarLeida: (id) => set((s) => ({ alertas: s.alertas.map((x) => x.id === id ? { ...x, leida: true } : x) })),
      marcarTodasLeidas: () => set((s) => ({ alertas: s.alertas.map((x) => ({ ...x, leida: true })) })),
      removeAlerta: (id) => set((s) => ({ alertas: s.alertas.filter((x) => x.id !== id) })),
    }),
    { name: 'alertas-store' }
  )
);
