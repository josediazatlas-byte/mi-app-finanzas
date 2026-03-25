import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InmuebleTipo = 'Residencia habitual' | 'Piso alquiler' | 'Local alquiler' | 'Garaje' | 'Solar' | 'Otro';

export interface Inmueble {
  id: string;
  nombre: string;
  tipo: InmuebleTipo;
  valorActual: number;
  precioCompra: number;
  añoAdquisicion: number;
  superficie: number;       // m²
  direccion: string;
  hipotecaAsociada: string; // Deuda id, '' if none
  generaRenta: boolean;
  rentaMensualBruta: number;
  gastosIbiMes: number;        // IBI prorrateado /12
  gastosComunidad: number;     // monthly
  gastosSeguro: number;        // monthly
  gastosMantenimiento: number; // monthly
  gastosOtros: number;         // monthly
  notas: string;
}

interface InmuebleStore {
  inmuebles: Inmueble[];
  addInmueble: (i: Omit<Inmueble, 'id'>) => void;
  updateInmueble: (id: string, i: Partial<Omit<Inmueble, 'id'>>) => void;
  removeInmueble: (id: string) => void;
}

const defaultInmuebles: Inmueble[] = [
  {
    id: '1',
    nombre: 'Piso centro ciudad',
    tipo: 'Piso alquiler',
    valorActual: 185000,
    precioCompra: 145000,
    añoAdquisicion: 2018,
    superficie: 72,
    direccion: 'Calle Gran Vía, 42, Madrid',
    hipotecaAsociada: '',
    generaRenta: true,
    rentaMensualBruta: 900,
    gastosIbiMes: 50,
    gastosComunidad: 75,
    gastosSeguro: 35,
    gastosMantenimiento: 40,
    gastosOtros: 0,
    notas: 'Inquilino estable desde 2021',
  },
  {
    id: '2',
    nombre: 'Residencia habitual',
    tipo: 'Residencia habitual',
    valorActual: 320000,
    precioCompra: 280000,
    añoAdquisicion: 2015,
    superficie: 105,
    direccion: 'Avenida de la Paz, 8, Madrid',
    hipotecaAsociada: '',
    generaRenta: false,
    rentaMensualBruta: 0,
    gastosIbiMes: 70,
    gastosComunidad: 120,
    gastosSeguro: 50,
    gastosMantenimiento: 100,
    gastosOtros: 0,
    notas: '',
  },
];

export const useInmuebleStore = create<InmuebleStore>()(
  persist(
    (set) => ({
      inmuebles: defaultInmuebles,
      addInmueble: (i) => set((s) => ({ inmuebles: [...s.inmuebles, { ...i, id: Date.now().toString() }] })),
      updateInmueble: (id, i) => set((s) => ({ inmuebles: s.inmuebles.map((x) => x.id === id ? { ...x, ...i } : x) })),
      removeInmueble: (id) => set((s) => ({ inmuebles: s.inmuebles.filter((x) => x.id !== id) })),
    }),
    { name: 'inmueble-store' }
  )
);
