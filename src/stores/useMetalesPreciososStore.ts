import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MetalSimbolo = 'XAU' | 'XAG' | 'XPT' | 'XPD' | 'XCU';
export type MetalFormato = 'Lingote' | 'Moneda' | 'ETF físico' | 'Certificado';
export type MetalUnidad = 'oz' | 'g';
export type MetalUbicacion = 'Caja fuerte' | 'Banco' | 'Bróker' | 'Casa' | 'Otro';

export interface MetalPrecioso {
  id: string;
  metal: MetalSimbolo;
  nombre: string;
  formato: MetalFormato;
  cantidad: number;       // in oz (stored always in oz)
  unidad: MetalUnidad;    // unit the user entered
  cantidadDisplay: number; // display value (in unidad)
  precioCompra: number;   // USD/oz at purchase
  precioActual: number;   // USD/oz current (updated dynamically)
  fechaCompra: string;
  ubicacion: MetalUbicacion;
  notas: string;
}

export interface PreciosMetales {
  XAU?: number;
  XAG?: number;
  XPT?: number;
  XPD?: number;
  XCU?: number;
  updatedAt: number;
}

interface MetalesPreciososStore {
  posiciones: MetalPrecioso[];
  precios: PreciosMetales;
  addPosicion: (p: Omit<MetalPrecioso, 'id'>) => void;
  updatePosicion: (id: string, p: Partial<Omit<MetalPrecioso, 'id'>>) => void;
  removePosicion: (id: string) => void;
  setPrecios: (p: Partial<PreciosMetales>) => void;
}

export const TROY_OZ_PER_GRAM = 1 / 31.1035;

export const METAL_INFO: Record<MetalSimbolo, { nombre: string; color: string; ySymbol: string; unit: string }> = {
  XAU: { nombre: 'Oro',     color: '#FFD700', ySymbol: 'GC=F',  unit: 'oz' },
  XAG: { nombre: 'Plata',   color: '#C0C0C0', ySymbol: 'SI=F',  unit: 'oz' },
  XPT: { nombre: 'Platino', color: '#9BBDC7', ySymbol: 'PL=F',  unit: 'oz' },
  XPD: { nombre: 'Paladio', color: '#9BC4B2', ySymbol: 'PA=F',  unit: 'oz' },
  XCU: { nombre: 'Cobre',   color: '#B87333', ySymbol: 'HG=F',  unit: 'lb' },
};

// Fallback spot prices USD/oz (approximate, last known)
export const FALLBACK_PRICES: Record<MetalSimbolo, number> = {
  XAU: 3200,
  XAG: 32,
  XPT: 1000,
  XPD: 1000,
  XCU: 4.5, // USD/lb
};

export const useMetalesPreciososStore = create<MetalesPreciososStore>()(
  persist(
    (set) => ({
      posiciones: [],
      precios: { updatedAt: 0 },
      addPosicion: (p) => set((s) => ({
        posiciones: [...s.posiciones, { ...p, id: Date.now().toString() }],
      })),
      updatePosicion: (id, p) => set((s) => ({
        posiciones: s.posiciones.map((x) => x.id === id ? { ...x, ...p } : x),
      })),
      removePosicion: (id) => set((s) => ({
        posiciones: s.posiciones.filter((x) => x.id !== id),
      })),
      setPrecios: (p) => set((s) => ({
        precios: { ...s.precios, ...p, updatedAt: Date.now() },
      })),
    }),
    { name: 'metales-preciosos-store' }
  )
);
