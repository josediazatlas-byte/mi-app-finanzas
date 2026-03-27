import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Ingreso {
  id: string;
  categoria: 'Salario' | 'Freelance' | 'Autónomo' | 'Dividendo' | 'Alquiler' | 'Otros';
  nombre: string;
  importe: number;
  fecha: string;
  recurrente: boolean;
  origen?: 'inmobiliario' | 'factura' | 'manual';
  origenId?: string;
}

export interface Gasto {
  id: string;
  categoria: 'Vivienda' | 'Alimentación' | 'Transporte' | 'Ocio' | 'Salud' | 'Suscripciones' | 'Otros';
  nombre: string;
  importe: number;
  fecha: string;
  recurrente: boolean;
  origen?: 'inmobiliario' | 'factura' | 'manual';
  origenId?: string;
}

export interface Cuenta {
  id: string;
  tipo: 'Corriente' | 'Ahorro' | 'Inversión' | 'Efectivo' | 'Otro';
  nombre: string;
  saldo: number;
  divisa: string;
}

interface FinanzasStore {
  ingresos: Ingreso[];
  gastos: Gasto[];
  cuentas: Cuenta[];
  planInversion: number;
  addIngreso: (i: Omit<Ingreso, 'id'>) => void;
  updateIngreso: (id: string, i: Partial<Omit<Ingreso, 'id'>>) => void;
  removeIngreso: (id: string) => void;
  addGasto: (g: Omit<Gasto, 'id'>) => void;
  updateGasto: (id: string, g: Partial<Omit<Gasto, 'id'>>) => void;
  removeGasto: (id: string) => void;
  addCuenta: (c: Omit<Cuenta, 'id'>) => void;
  updateCuenta: (id: string, c: Partial<Cuenta>) => void;
  removeCuenta: (id: string) => void;
  setPlanInversion: (v: number) => void;
}

const defaultCuentas: Cuenta[] = [
  { id: '1', tipo: 'Corriente', nombre: 'Cuenta Principal', saldo: 3200, divisa: 'EUR' },
  { id: '2', tipo: 'Ahorro', nombre: 'Fondo Emergencias', saldo: 8500, divisa: 'EUR' },
  { id: '3', tipo: 'Inversión', nombre: 'Broker', saldo: 1200, divisa: 'EUR' },
];

const defaultIngresos: Ingreso[] = [
  { id: '1', categoria: 'Salario', nombre: 'Sueldo empresa', importe: 2800, fecha: '2026-03-01', recurrente: true },
  { id: '2', categoria: 'Freelance', nombre: 'Proyecto web', importe: 650, fecha: '2026-03-15', recurrente: false },
];

const defaultGastos: Gasto[] = [
  { id: '1', categoria: 'Vivienda', nombre: 'Alquiler', importe: 950, fecha: '2026-03-01', recurrente: true },
  { id: '2', categoria: 'Alimentación', nombre: 'Supermercado', importe: 280, fecha: '2026-03-05', recurrente: false },
  { id: '3', categoria: 'Suscripciones', nombre: 'Netflix, Spotify', importe: 25, fecha: '2026-03-01', recurrente: true },
  { id: '4', categoria: 'Transporte', nombre: 'Abono transporte', importe: 55, fecha: '2026-03-01', recurrente: true },
];

export const useFinanzasStore = create<FinanzasStore>()(
  persist(
    (set) => ({
      ingresos: defaultIngresos,
      gastos: defaultGastos,
      cuentas: defaultCuentas,
      planInversion: 20,
      addIngreso: (i) => set((s) => ({ ingresos: [...s.ingresos, { ...i, id: Date.now().toString() }] })),
      updateIngreso: (id, i) => set((s) => ({ ingresos: s.ingresos.map((x) => x.id === id ? { ...x, ...i } : x) })),
      removeIngreso: (id) => set((s) => ({ ingresos: s.ingresos.filter((x) => x.id !== id) })),
      addGasto: (g) => set((s) => ({ gastos: [...s.gastos, { ...g, id: Date.now().toString() }] })),
      updateGasto: (id, g) => set((s) => ({ gastos: s.gastos.map((x) => x.id === id ? { ...x, ...g } : x) })),
      removeGasto: (id) => set((s) => ({ gastos: s.gastos.filter((x) => x.id !== id) })),
      addCuenta: (c) => set((s) => ({ cuentas: [...s.cuentas, { ...c, id: Date.now().toString() }] })),
      updateCuenta: (id, c) => set((s) => ({ cuentas: s.cuentas.map((x) => x.id === id ? { ...x, ...c } : x) })),
      removeCuenta: (id) => set((s) => ({ cuentas: s.cuentas.filter((x) => x.id !== id) })),
      setPlanInversion: (planInversion) => set({ planInversion }),
    }),
    { name: 'finanzas-store' }
  )
);
