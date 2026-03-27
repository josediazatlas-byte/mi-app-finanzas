import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Posicion {
  id: string;
  simbolo: string;
  nombre: string;
  tipo: 'Empresa' | 'ETF' | 'Materia Prima' | 'Crypto' | 'Fondo Indexado';
  acciones: number;
  precioMedio: number;
  divisa: 'USD' | 'EUR' | 'GBP';
  notas?: string;
  // Fondos Indexados
  isin?: string;
  gestora?: string;
  vl?: number;
  vlFecha?: string;
  fechaCompra?: string;
  ter?: number;
}

export interface PesoObjetivo {
  simbolo: string;
  pesoObjetivo: number;
}

interface InversionesStore {
  posiciones: Posicion[];
  pesosObjetivo: PesoObjetivo[];
  addPosicion: (p: Omit<Posicion, 'id'>) => void;
  updatePosicion: (id: string, p: Partial<Omit<Posicion, 'id'>>) => void;
  removePosicion: (id: string) => void;
  updatePesoObjetivo: (simbolo: string, peso: number) => void;
}

const defaultPosiciones: Posicion[] = [
  { id: '1', simbolo: 'MSFT', nombre: 'Microsoft Corp', tipo: 'Empresa', acciones: 5, precioMedio: 349.50, divisa: 'USD' },
  { id: '2', simbolo: 'V', nombre: 'Visa Inc', tipo: 'Empresa', acciones: 2, precioMedio: 275.00, divisa: 'USD' },
  { id: '3', simbolo: 'GOOG', nombre: 'Alphabet Inc', tipo: 'Empresa', acciones: 1, precioMedio: 165.00, divisa: 'USD' },
  { id: '4', simbolo: 'META', nombre: 'Meta Platforms', tipo: 'Empresa', acciones: 3, precioMedio: 520.00, divisa: 'USD' },
  { id: '5', simbolo: 'AAPL', nombre: 'Apple Inc', tipo: 'Empresa', acciones: 4, precioMedio: 210.00, divisa: 'USD' },
];

export const useInversionesStore = create<InversionesStore>()(
  persist(
    (set) => ({
      posiciones: defaultPosiciones,
      pesosObjetivo: defaultPosiciones.map((p) => ({ simbolo: p.simbolo, pesoObjetivo: 20 })),
      addPosicion: (p) => set((s) => {
        const pos = { ...p, id: Date.now().toString() };
        const hasPeso = s.pesosObjetivo.find(x => x.simbolo === p.simbolo);
        return {
          posiciones: [...s.posiciones, pos],
          pesosObjetivo: hasPeso ? s.pesosObjetivo : [...s.pesosObjetivo, { simbolo: p.simbolo, pesoObjetivo: 10 }],
        };
      }),
      updatePosicion: (id, p) => set((s) => ({ posiciones: s.posiciones.map((x) => x.id === id ? { ...x, ...p } : x) })),
      removePosicion: (id) => set((s) => ({ posiciones: s.posiciones.filter((x) => x.id !== id) })),
      updatePesoObjetivo: (simbolo, pesoObjetivo) =>
        set((s) => ({
          pesosObjetivo: s.pesosObjetivo.map((x) => x.simbolo === simbolo ? { ...x, pesoObjetivo } : x),
        })),
    }),
    { name: 'inversiones-store' }
  )
);
