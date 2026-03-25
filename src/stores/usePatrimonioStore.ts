import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HistorialMes {
  mes: string;
  patrimonio: number;
  ingresos: number;
  gastos: number;
}

interface PatrimonioStore {
  objetivoFinanciero: number;
  historialMensual: HistorialMes[];
  setObjetivoFinanciero: (v: number) => void;
  addHistorial: (h: HistorialMes) => void;
}

export const usePatrimonioStore = create<PatrimonioStore>()(
  persist(
    (set) => ({
      objetivoFinanciero: 100000,
      historialMensual: [],
      setObjetivoFinanciero: (objetivoFinanciero) => set({ objetivoFinanciero }),
      addHistorial: (h) => set((s) => ({ historialMensual: [...s.historialMensual, h] })),
    }),
    { name: 'patrimonio-store' }
  )
);
