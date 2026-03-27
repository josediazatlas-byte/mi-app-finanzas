import { toEur } from './format';
import type { Posicion } from '../stores/useInversionesStore';

export interface ScoreBreakdown {
  total: number;
  diversificacionSector: number;  // 30 pts
  diversificacionTipo: number;    // 25 pts
  concentracionMaxima: number;    // 20 pts
  calidadFundamental: number;     // 15 pts
  liquidez: number;               // 10 pts
}

export function calcScoreCartera(
  posiciones: Posicion[],
  getPriceOf: (p: Posicion) => number,
  valorTotal: number
): ScoreBreakdown {
  if (posiciones.length === 0) {
    return { total: 0, diversificacionSector: 0, diversificacionTipo: 0, concentracionMaxima: 0, calidadFundamental: 0, liquidez: 0 };
  }
  const n = posiciones.length;
  const diversificacionSector = n === 1 ? 5 : n === 2 ? 10 : n <= 4 ? 18 : n <= 7 ? 25 : 30;
  const tipos = new Set(posiciones.map(p => p.tipo)).size;
  const diversificacionTipo = tipos === 1 ? 5 : tipos === 2 ? 12 : tipos === 3 ? 18 : tipos === 4 ? 22 : 25;
  const maxPeso = Math.max(
    ...posiciones.map(p => valorTotal > 0 ? (toEur(getPriceOf(p) * p.acciones, p.divisa) / valorTotal) * 100 : 0),
    0
  );
  const concentracionMaxima = maxPeso > 60 ? 2 : maxPeso > 40 ? 8 : maxPeso > 25 ? 14 : maxPeso > 15 ? 18 : 20;
  const avgPnl = posiciones.reduce((s, p) => {
    return s + (p.precioMedio > 0 ? ((getPriceOf(p) - p.precioMedio) / p.precioMedio) * 100 : 0);
  }, 0) / posiciones.length;
  const calidadFundamental = avgPnl < -15 ? 3 : avgPnl < -5 ? 7 : avgPnl < 5 ? 11 : 15;
  const hasETFOrFondo = posiciones.some(p => p.tipo === 'ETF' || p.tipo === 'Fondo Indexado');
  const hasEmpresa = posiciones.some(p => p.tipo === 'Empresa');
  const cryptoPct = valorTotal > 0
    ? posiciones.filter(p => p.tipo === 'Crypto').reduce((s, p) => s + toEur(getPriceOf(p) * p.acciones, p.divisa), 0) / valorTotal * 100
    : 0;
  const liquidez = Math.min(10, (hasETFOrFondo ? 4 : 0) + (hasEmpresa ? 3 : 0) + (cryptoPct < 30 ? 3 : 0));
  return {
    total: Math.round(diversificacionSector + diversificacionTipo + concentracionMaxima + calidadFundamental + liquidez),
    diversificacionSector,
    diversificacionTipo,
    concentracionMaxima,
    calidadFundamental,
    liquidez,
  };
}
