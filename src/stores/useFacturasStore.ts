import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FacturaEstado = 'Borrador' | 'Enviada' | 'Cobrada' | 'Vencida' | 'Cancelada';

export interface ConceptoFactura {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export type FrecuenciaRecurrencia = 'mensual' | 'trimestral' | 'anual';

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
  // Recurrencia
  recurrente?: boolean;            // true = esta es la plantilla activa
  frecuencia?: FrecuenciaRecurrencia;
  diaDelMes?: number;             // 1-28
  fechaFinRecurrencia?: string | null;
  proximaGeneracion?: string | null;
  pausada?: boolean;
  plantillaId?: string | null;    // id de la plantilla que generó esta factura
}

interface GeneratedResult { numero: string; clienteNombre: string; }

interface FacturasStore {
  facturas: Factura[];
  nextNum: number;
  addFactura: (f: Omit<Factura, 'id' | 'numero'>) => void;
  updateFactura: (id: string, f: Partial<Omit<Factura, 'id'>>) => void;
  removeFactura: (id: string) => void;
  pausarRecurrencia: (id: string) => void;
  reanudarRecurrencia: (id: string) => void;
  cancelarRecurrencia: (id: string) => void;
  generarRecurrentes: (getClienteName: (id: string) => string) => GeneratedResult[];
}

function buildNumero(n: number): string {
  const year = new Date().getFullYear();
  return `${year}-${String(n).padStart(3, '0')}`;
}

export function calcProximaGeneracion(diaDelMes: number, frecuencia: FrecuenciaRecurrencia, desde?: Date): string {
  const base = desde ?? new Date();
  const intento = new Date(base.getFullYear(), base.getMonth(), diaDelMes);
  if (intento > base) return intento.toISOString().slice(0, 10);
  if (frecuencia === 'mensual') return new Date(base.getFullYear(), base.getMonth() + 1, diaDelMes).toISOString().slice(0, 10);
  if (frecuencia === 'trimestral') return new Date(base.getFullYear(), base.getMonth() + 3, diaDelMes).toISOString().slice(0, 10);
  return new Date(base.getFullYear() + 1, base.getMonth(), diaDelMes).toISOString().slice(0, 10);
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

      updateFactura: (id, f) =>
        set((s) => ({ facturas: s.facturas.map((x) => x.id === id ? { ...x, ...f } : x) })),

      removeFactura: (id) =>
        set((s) => ({ facturas: s.facturas.filter((x) => x.id !== id) })),

      pausarRecurrencia: (id) =>
        set((s) => ({ facturas: s.facturas.map(f => f.id === id ? { ...f, pausada: true } : f) })),

      reanudarRecurrencia: (id) =>
        set((s) => ({ facturas: s.facturas.map(f => f.id === id ? { ...f, pausada: false } : f) })),

      cancelarRecurrencia: (id) =>
        set((s) => ({
          facturas: s.facturas.map(f => f.id === id
            ? { ...f, recurrente: false, pausada: false, proximaGeneracion: null, frecuencia: undefined, diaDelMes: undefined }
            : f
          )
        })),

      generarRecurrentes: (getClienteName) => {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const results: GeneratedResult[] = [];
        const nuevas: Factura[] = [];

        set((s) => {
          let nextNum = s.nextNum;
          const updated = s.facturas.map((f) => {
            if (!f.recurrente || f.pausada || !f.proximaGeneracion || !f.frecuencia || !f.diaDelMes) return f;
            if (f.fechaFinRecurrencia && todayStr > f.fechaFinRecurrencia) return f;
            if (f.proximaGeneracion > todayStr) return f;

            // Generate new invoice
            const numero = buildNumero(nextNum++);
            const vto = new Date(today);
            vto.setDate(vto.getDate() + 30);

            const nueva: Factura = {
              ...f,
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              numero,
              fechaEmision: todayStr,
              fechaVencimiento: vto.toISOString().slice(0, 10),
              estado: 'Borrador',
              recurrente: false,
              pausada: false,
              plantillaId: f.id,
              proximaGeneracion: null,
            };
            nuevas.push(nueva);
            results.push({ numero, clienteNombre: getClienteName(f.clienteId) });

            // Update template's next generation date
            return {
              ...f,
              proximaGeneracion: calcProximaGeneracion(f.diaDelMes, f.frecuencia, today),
            };
          });

          return { facturas: [...updated, ...nuevas], nextNum };
        });

        return results;
      },
    }),
    { name: 'facturas-store' }
  )
);
