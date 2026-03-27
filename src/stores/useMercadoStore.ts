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
  SEK_EUR: number;
  NOK_EUR: number;
  DKK_EUR: number;
  MXN_EUR: number;
  BRL_EUR: number;
  CNY_EUR: number;
  INR_EUR: number;
  KRW_EUR: number;
  updatedAt: number;
  source: 'api' | 'fallback';
}

const DEFAULT_RATES: ExchangeRates = {
  USD_EUR: 0.92,  GBP_EUR: 1.17,  CHF_EUR: 1.05,
  JPY_EUR: 0.0062, CAD_EUR: 0.68,  AUD_EUR: 0.61,
  SEK_EUR: 0.087, NOK_EUR: 0.087, DKK_EUR: 0.134,
  MXN_EUR: 0.053, BRL_EUR: 0.185, CNY_EUR: 0.127,
  INR_EUR: 0.011, KRW_EUR: 0.00068,
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
