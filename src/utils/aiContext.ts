import { useFinanzasStore } from '../stores/useFinanzasStore';
import { useInversionesStore } from '../stores/useInversionesStore';
import { useMercadoStore } from '../stores/useMercadoStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import { useMetasStore } from '../stores/useMetasStore';
import { useSuscripcionesStore, importeMensual } from '../stores/useSuscripcionesStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import { MOCK_TICKERS } from '../services/alphaVantage';
import { toEur } from './format';

export function buildFinancialContext(): string {
  const { cuentas, ingresos, gastos } = useFinanzasStore.getState();
  const { posiciones } = useInversionesStore.getState();
  const precios = useMercadoStore.getState().precios;
  const { deudas } = useDeudaStore.getState();
  const { metas } = useMetasStore.getState();
  const { suscripciones } = useSuscripcionesStore.getState();
  const { inmuebles } = useInmuebleStore.getState();

  const now = new Date();
  const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevKey = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const ingresosMes = ingresos.filter(i => i.fecha.startsWith(mesKey)).reduce((s, i) => s + i.importe, 0);
  const gastosMes = gastos.filter(g => g.fecha.startsWith(mesKey)).reduce((s, g) => s + g.importe, 0);
  const ingresosPrev = ingresos.filter(i => i.fecha.startsWith(prevKey)).reduce((s, i) => s + i.importe, 0);
  const gastosPrev = gastos.filter(g => g.fecha.startsWith(prevKey)).reduce((s, g) => s + g.importe, 0);
  const ahorro = ingresosMes - gastosMes;
  const tasaAhorro = ingresosMes > 0 ? ((ahorro / ingresosMes) * 100).toFixed(1) : '0';

  const saldoCuentas = cuentas.reduce((s, c) => s + toEur(c.saldo, c.divisa), 0);
  const valorCartera = posiciones.reduce((s, p) => {
    const precio = precios[p.simbolo]?.precio ?? MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price ?? p.precioMedio;
    return s + toEur(precio * p.acciones, p.divisa);
  }, 0);
  const totalDeudas = deudas.reduce((s, d) => s + toEur(d.importePendiente, d.divisa), 0);
  const equityInm = inmuebles.reduce((s, inm) => {
    const hip = deudas.find(d => d.id === inm.hipotecaAsociada);
    return s + inm.valorActual - (hip ? toEur(hip.importePendiente, hip.divisa) : 0);
  }, 0);
  const patrimonio = saldoCuentas + valorCartera + equityInm - totalDeudas;

  // Gastos por categoría este mes
  const gastosCat: Record<string, number> = {};
  gastos.filter(g => g.fecha.startsWith(mesKey)).forEach(g => {
    gastosCat[g.categoria] = (gastosCat[g.categoria] ?? 0) + g.importe;
  });
  const gastosCatPrev: Record<string, number> = {};
  gastos.filter(g => g.fecha.startsWith(prevKey)).forEach(g => {
    gastosCatPrev[g.categoria] = (gastosCatPrev[g.categoria] ?? 0) + g.importe;
  });

  const suscActivas = suscripciones.filter(s => s.activa);
  const totalSuscMes = suscActivas.reduce((s, sub) => s + importeMensual(sub), 0);

  const posicionesResumen = posiciones.map(p => {
    const precio = precios[p.simbolo]?.precio ?? MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price ?? p.precioMedio;
    const valor = toEur(precio * p.acciones, p.divisa);
    const pnlPct = ((precio - p.precioMedio) / p.precioMedio * 100).toFixed(1);
    const pct = valorCartera > 0 ? ((valor / valorCartera) * 100).toFixed(1) : '0';
    return { simbolo: p.simbolo, nombre: p.nombre, valor: Math.round(valor), pct, pnlPct };
  });

  const metasResumen = metas.map(m => ({
    nombre: m.nombre, tipo: m.tipo,
    progreso: m.objetivo > 0 ? `${((m.ahorrado / m.objetivo) * 100).toFixed(0)}%` : '0%',
    ahorrado: m.ahorrado, objetivo: m.objetivo,
    mesesNecesarios: m.aportacionMensual > 0 ? Math.ceil((m.objetivo - m.ahorrado) / m.aportacionMensual) : 999,
  }));

  const inmueblesResumen = inmuebles.filter(i => i.generaRenta).map(i => {
    const rentaNeta = (i.rentaMensualBruta - i.gastosIbiMes - i.gastosComunidad - i.gastosSeguro - i.gastosMantenimiento - i.gastosOtros) * 12;
    const yieldNeto = i.valorActual > 0 ? ((rentaNeta / i.valorActual) * 100).toFixed(1) : '0';
    return { nombre: i.nombre, tipo: i.tipo, valor: i.valorActual, yieldNeto };
  });

  return JSON.stringify({
    fecha: now.toISOString().slice(0, 10),
    patrimonio: { total: Math.round(patrimonio), liquidez: Math.round(saldoCuentas), cartera: Math.round(valorCartera), inmobiliario: Math.round(equityInm), deudas: Math.round(totalDeudas) },
    mesMes: {
      ingresos: Math.round(ingresosMes), gastos: Math.round(gastosMes),
      ahorro: Math.round(ahorro), tasaAhorro: `${tasaAhorro}%`,
      ingresosMesAnterior: Math.round(ingresosPrev), gastosMesAnterior: Math.round(gastosPrev),
    },
    gastosPorCategoria: gastosCat,
    gastosPorCategoriaMesAnterior: gastosCatPrev,
    cartera: posicionesResumen,
    metas: metasResumen,
    suscripciones: { activas: suscActivas.length, totalMensual: Math.round(totalSuscMes), lista: suscActivas.map(s => ({ nombre: s.nombre, mensual: Math.round(importeMensual(s)) })) },
    inmuebles: inmueblesResumen,
  }, null, 0);
}

export const SYSTEM_PROMPT = `Eres un asesor financiero personal experto en finanzas personales españolas. Recibes datos financieros reales del usuario y das consejos concretos, prácticos y personalizados en español.

REGLAS:
- Sé conciso: máximo 3 párrafos por respuesta
- Da consejos accionables y específicos basados en los datos reales
- Usa cifras concretas del contexto cuando sea relevante
- Tono profesional pero cercano, como un buen amigo que es experto financiero
- Si algo es preocupante, dilo claramente pero con solución constructiva
- No des consejos genéricos, siempre referencia los datos del usuario`;

export async function callClaudeAPI(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text ?? 'Sin respuesta';
}
