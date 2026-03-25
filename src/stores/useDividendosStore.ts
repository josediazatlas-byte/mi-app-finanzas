import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Dividendo {
  id: string;
  simbolo: string;
  fecha: string;
  importeBruto: number;
  retencion: number; // percentage, e.g. 15
  divisa: 'USD' | 'EUR' | 'GBP';
}

interface DividendosStore {
  dividendos: Dividendo[];
  addDividendo: (d: Omit<Dividendo, 'id'>) => void;
  updateDividendo: (id: string, d: Partial<Omit<Dividendo, 'id'>>) => void;
  removeDividendo: (id: string) => void;
}

const defaultDividendos: Dividendo[] = [
  { id: '1', simbolo: 'MSFT', fecha: '2026-03-15', importeBruto: 25.20, retencion: 15, divisa: 'USD' },
  { id: '2', simbolo: 'AAPL', fecha: '2026-02-20', importeBruto: 12.50, retencion: 15, divisa: 'USD' },
  { id: '3', simbolo: 'V', fecha: '2026-01-10', importeBruto: 18.00, retencion: 15, divisa: 'USD' },
  { id: '4', simbolo: 'META', fecha: '2026-03-01', importeBruto: 30.00, retencion: 15, divisa: 'USD' },
];

export const useDividendosStore = create<DividendosStore>()(
  persist(
    (set) => ({
      dividendos: defaultDividendos,
      addDividendo: (d) => set((s) => ({ dividendos: [...s.dividendos, { ...d, id: Date.now().toString() }] })),
      updateDividendo: (id, d) => set((s) => ({ dividendos: s.dividendos.map((x) => x.id === id ? { ...x, ...d } : x) })),
      removeDividendo: (id) => set((s) => ({ dividendos: s.dividendos.filter((x) => x.id !== id) })),
    }),
    { name: 'dividendos-store' }
  )
);
