import type { Gasto } from '../stores/useFinanzasStore';

export interface MesGasto {
  key: string;   // 'YYYY-MM'
  label: string; // 'Marzo 2026'
  total: number;
}

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function calcUltimos6Meses(gastos: Gasto[]): MesGasto[] {
  const now = new Date();
  const result: MesGasto[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = gastos
      .filter(g => g.fecha.startsWith(key) && g.origen !== 'inmobiliario')
      .reduce((s, g) => s + g.importe, 0);
    result.push({
      key,
      label: `${MESES_ES[d.getMonth()].charAt(0).toUpperCase() + MESES_ES[d.getMonth()].slice(1)} ${d.getFullYear()}`,
      total,
    });
  }
  return result;
}

export function calcObjetivo(
  gastos: Gasto[],
  extraMensual: number,
  mesesACubrir: number
): { objetivo: number; promedio: number; mesesData: MesGasto[] } {
  const mesesData = calcUltimos6Meses(gastos);
  const suma = mesesData.reduce((s, m) => s + m.total, 0);
  const promedio = mesesData.length > 0 ? suma / mesesData.length : 0;
  const objetivo = (promedio + extraMensual) * mesesACubrir;
  return { objetivo, promedio, mesesData };
}
