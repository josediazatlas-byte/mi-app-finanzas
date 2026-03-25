import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrecioCache {
  precio: number;
  variacion: number;
  timestamp: number;
}

export interface ExchangeRates {
  USD_EUR: number;
  GBP_EUR: number;
  CHF_EUR: number;
  JPY_EUR: number;
  CAD_EUR: number;
  AUD_EUR: number;
  updatedAt: number;
  source: 'api' | 'fallback';
}

const DEFAULT_RATES: ExchangeRates = {
  USD_EUR: 0.92, GBP_EUR: 1.17, CHF_EUR: 1.05,
  JPY_EUR: 0.0062, CAD_EUR: 0.68, AUD_EUR: 0.61,
  updatedAt: 0, source: 'fallback',
};

const TTL = 60_000;

interface MercadoStore {
  precios: Record<string, PrecioCache>;
  exchangeRates: ExchangeRates;
  setPrice: (simbolo: string, precio: number, variacion: number) => void;
  getPrice: (simbolo: string) => PrecioCache | null;
  setExchangeRates: (rates: Partial<ExchangeRates>) => void;
}

export const useMercadoStore = create<MercadoStore>()(
  persist(
    (set, get) => ({
      precios: {},
      exchangeRates: DEFAULT_RATES,
      setPrice: (simbolo, precio, variacion) =>
        set((s) => ({ precios: { ...s.precios, [simbolo]: { precio, variacion, timestamp: Date.now() } } })),
      getPrice: (simbolo) => {
        const p = get().precios[simbolo];
        if (!p) return null;
        if (Date.now() - p.timestamp > TTL) return null;
        return p;
      },
      setExchangeRates: (rates) =>
        set((s) => ({ exchangeRates: { ...s.exchangeRates, ...rates, updatedAt: Date.now() } })),
    }),
    { name: 'mercado-store', partialize: (s) => ({ exchangeRates: s.exchangeRates }) }
  )
);
