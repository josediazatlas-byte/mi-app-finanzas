import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FacturaEstado = 'Borrador' | 'Enviada' | 'Cobrada' | 'Vencida' | 'Cancelada';

export interface ConceptoFactura {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Factura {
  id: string;
  numero: string; // YYYY-NNN
  clienteId: string;
  fechaEmision: string;
  fechaVencimiento: string;
  conceptos: ConceptoFactura[];
  baseImponible: number;
  iva: number; // %
  retencion: number; // %
  total: number;
  estado: FacturaEstado;
  metodoPago: string;
  iban: string;
  notas: string;
}

interface FacturasStore {
  facturas: Factura[];
  nextNum: number; // counter for this year
  addFactura: (f: Omit<Factura, 'id' | 'numero'>) => void;
  updateFactura: (id: string, f: Partial<Omit<Factura, 'id'>>) => void;
  removeFactura: (id: string) => void;
}

function buildNumero(n: number): string {
  const year = new Date().getFullYear();
  return `${year}-${String(n).padStart(3, '0')}`;
}

export const useFacturasStore = create<FacturasStore>()(
  persist(
    (set, get) => ({
      facturas: [],
      nextNum: 1,
      addFactura: (f) => {
        const n = get().nextNum;
        set((s) => ({
          facturas: [...s.facturas, { ...f, id: Date.now().toString(), numero: buildNumero(n) }],
          nextNum: n + 1,
        }));
      },
      updateFactura: (id, f) => set((s) => ({ facturas: s.facturas.map((x) => x.id === id ? { ...x, ...f } : x) })),
      removeFactura: (id) => set((s) => ({ facturas: s.facturas.filter((x) => x.id !== id) })),
    }),
    { name: 'facturas-store' }
  )
);
