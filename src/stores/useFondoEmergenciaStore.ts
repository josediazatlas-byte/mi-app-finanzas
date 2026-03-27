import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistorialEntry {
  mes: number;
  anio: number;
  objetivo: number;
  saldo: number;
}

interface FondoEmergenciaStore {
  objetivoActual: number;
  saldoManual: number;
  cuentaVinculadaId: string | null;
  extraMensual: number;
  mesesACubrir: number;
  historialObjetivos: HistorialEntry[];
  fechaUltimaActualizacion: string;

  setObjetivo: (v: number) => void;
  setSaldoManual: (v: number) => void;
  setCuentaVinculada: (id: string | null) => void;
  setExtraMensual: (v: number) => void;
  setMesesACubrir: (v: number) => void;
  pushHistorial: (entry: HistorialEntry) => void;
  setFechaActualizacion: (d: string) => void;
}

export const useFondoEmergenciaStore = create<FondoEmergenciaStore>()(
  persist(
    (set) => ({
      objetivoActual: 0,
      saldoManual: 0,
      cuentaVinculadaId: null,
      extraMensual: 1000,
      mesesACubrir: 6,
      historialObjetivos: [],
      fechaUltimaActualizacion: '',

      setObjetivo: (v) => set({ objetivoActual: v }),
      setSaldoManual: (v) => set({ saldoManual: v }),
      setCuentaVinculada: (id) => set({ cuentaVinculadaId: id }),
      setExtraMensual: (v) => set({ extraMensual: v }),
      setMesesACubrir: (v) => set({ mesesACubrir: v }),
      pushHistorial: (entry) =>
        set((s) => {
          const filtered = s.historialObjetivos.filter(
            (h) => !(h.mes === entry.mes && h.anio === entry.anio)
          );
          return { historialObjetivos: [...filtered, entry].slice(-24) }; // keep 24 months
        }),
      setFechaActualizacion: (d) => set({ fechaUltimaActualizacion: d }),
    }),
    { name: 'fondo-emergencia-store' }
  )
);
