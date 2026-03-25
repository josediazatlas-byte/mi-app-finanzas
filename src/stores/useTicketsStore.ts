import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TicketEstado = 'pendiente' | 'confirmado';

export interface TicketConcepto {
  descripcion: string;
  importe: number;
}

export interface Ticket {
  id: string;
  imagen: string; // base64
  establecimiento: string;
  fecha: string; // YYYY-MM-DD
  total: number;
  subtotal: number;
  iva: number;
  conceptos: TicketConcepto[];
  categoria: string;
  notas: string;
  estado: TicketEstado;
  gastoId: string; // linked gasto id, '' if none
  fechaEscaneo: string;
}

interface TicketsStore {
  tickets: Ticket[];
  addTicket: (t: Omit<Ticket, 'id'>) => void;
  updateTicket: (id: string, t: Partial<Omit<Ticket, 'id'>>) => void;
  removeTicket: (id: string) => void;
}

export const useTicketsStore = create<TicketsStore>()(
  persist(
    (set) => ({
      tickets: [],
      addTicket: (t) => set((s) => ({ tickets: [...s.tickets, { ...t, id: Date.now().toString() }] })),
      updateTicket: (id, t) => set((s) => ({ tickets: s.tickets.map((x) => x.id === id ? { ...x, ...t } : x) })),
      removeTicket: (id) => set((s) => ({ tickets: s.tickets.filter((x) => x.id !== id) })),
    }),
    { name: 'tickets-store' }
  )
);
