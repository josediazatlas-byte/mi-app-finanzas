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
  switch (divisa) {
    case 'GBP': return amount * (rates?.GBP_EUR ?? 1.17);
    case 'CHF': return amount * (rates?.CHF_EUR ?? 1.05);
    case 'JPY': return amount * (rates?.JPY_EUR ?? 0.0062);
    case 'CAD': return amount * (rates?.CAD_EUR ?? 0.68);
    case 'AUD': return amount * (rates?.AUD_EUR ?? 0.61);
    case 'SEK': return amount * (rates?.SEK_EUR ?? 0.087);
    case 'NOK': return amount * (rates?.NOK_EUR ?? 0.087);
    case 'DKK': return amount * (rates?.DKK_EUR ?? 0.134);
    case 'MXN': return amount * (rates?.MXN_EUR ?? 0.053);
    case 'BRL': return amount * (rates?.BRL_EUR ?? 0.185);
    case 'CNY': return amount * (rates?.CNY_EUR ?? 0.127);
    case 'INR': return amount * (rates?.INR_EUR ?? 0.011);
    case 'KRW': return amount * (rates?.KRW_EUR ?? 0.00068);
    default: return amount * (rates?.USD_EUR ?? USD_TO_EUR);
  }
}
