import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SuscripcionCategoria = 'Entretenimiento' | 'Trabajo' | 'Salud' | 'Hogar' | 'Educación' | 'Otro';
export type SuscripcionFrecuencia = 'mensual' | 'trimestral' | 'anual';

export interface Suscripcion {
  id: string;
  nombre: string;
  categoria: SuscripcionCategoria;
  importe: number;
  frecuencia: SuscripcionFrecuencia;
  fechaProximoCobro: string; // YYYY-MM-DD
  metodoPago: string;
  notas: string;
  activa: boolean;
}

export function importeMensual(s: Suscripcion): number {
  if (s.frecuencia === 'mensual') return s.importe;
  if (s.frecuencia === 'trimestral') return s.importe / 3;
  return s.importe / 12;
}

interface SuscripcionesStore {
  suscripciones: Suscripcion[];
  addSuscripcion: (s: Omit<Suscripcion, 'id'>) => void;
  updateSuscripcion: (id: string, s: Partial<Omit<Suscripcion, 'id'>>) => void;
  removeSuscripcion: (id: string) => void;
}

const defaultSuscripciones: Suscripcion[] = [
  { id: '1', nombre: 'Netflix', categoria: 'Entretenimiento', importe: 17.99, frecuencia: 'mensual', fechaProximoCobro: '2026-04-01', metodoPago: 'Tarjeta Visa', notas: '', activa: true },
  { id: '2', nombre: 'Spotify', categoria: 'Entretenimiento', importe: 10.99, frecuencia: 'mensual', fechaProximoCobro: '2026-04-05', metodoPago: 'Tarjeta Visa', notas: '', activa: true },
  { id: '3', nombre: 'Microsoft 365', categoria: 'Trabajo', importe: 99, frecuencia: 'anual', fechaProximoCobro: '2026-09-15', metodoPago: 'PayPal', notas: '', activa: true },
  { id: '4', nombre: 'Gym', categoria: 'Salud', importe: 45, frecuencia: 'mensual', fechaProximoCobro: '2026-04-01', metodoPago: 'Domiciliación', notas: '', activa: true },
  { id: '5', nombre: 'Amazon Prime', categoria: 'Entretenimiento', importe: 49.90, frecuencia: 'anual', fechaProximoCobro: '2026-06-20', metodoPago: 'Tarjeta Visa', notas: '', activa: true },
];

export const useSuscripcionesStore = create<SuscripcionesStore>()(
  persist(
    (set) => ({
      suscripciones: defaultSuscripciones,
      addSuscripcion: (s) => set((st) => ({ suscripciones: [...st.suscripciones, { ...s, id: Date.now().toString() }] })),
      updateSuscripcion: (id, s) => set((st) => ({ suscripciones: st.suscripciones.map((x) => x.id === id ? { ...x, ...s } : x) })),
      removeSuscripcion: (id) => set((st) => ({ suscripciones: st.suscripciones.filter((x) => x.id !== id) })),
    }),
    { name: 'suscripciones-store' }
  )
);
