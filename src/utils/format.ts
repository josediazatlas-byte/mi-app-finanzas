import { useMercadoStore } from '../stores/useMercadoStore';

export function fmt(n: number, decimals = 2): string {
  return (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtEur(n: number): string {
  return (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'currency', currency: 'EUR' });
}

export function fmtUsd(n: number): string {
  return (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, style: 'currency', currency: 'USD' });
}

// Hardcoded fallback values (used if store not yet initialized)
export const USD_TO_EUR = 0.92;
export const USD_TO_GBP = 0.79;

export function toEur(amount: number, divisa: string): number {
  if (divisa === 'EUR') return amount;
  const rates = useMercadoStore.getState().exchangeRates;
  if (divisa === 'GBP') return amount * (rates?.GBP_EUR ?? 1.17);
  if (divisa === 'CHF') return amount * (rates?.CHF_EUR ?? 1.05);
  if (divisa === 'JPY') return amount * (rates?.JPY_EUR ?? 0.0062);
  if (divisa === 'CAD') return amount * (rates?.CAD_EUR ?? 0.68);
  if (divisa === 'AUD') return amount * (rates?.AUD_EUR ?? 0.61);
  // Default: USD
  return amount * (rates?.USD_EUR ?? USD_TO_EUR);
}
