import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import { useInversionesStore } from '../stores/useInversionesStore';
import { useMercadoStore } from '../stores/useMercadoStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import { useFondoEmergenciaStore } from '../stores/useFondoEmergenciaStore';
import { toEur } from '../utils/format';
import { MOCK_TICKERS } from '../services/alphaVantage';
import { getAllRates, FALLBACK_RATES } from '../services/exchangeRate';

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtEur(n: number) { return `€${fmt(n)}`; }

// ——— Calculadoras básicas ———
function CalcInteresCompuesto() {
  const [capital, setCapital] = useState(10000);
  const [tasa, setTasa] = useState(8);
  const [años, setAños] = useState(20);
  const [aportacion, setAportacion] = useState(200);
  const resultado = capital * Math.pow(1 + tasa / 100, años) + aportacion * 12 * ((Math.pow(1 + tasa / 100, años) - 1) / (tasa / 100));
  const invertido = capital + aportacion * 12 * años;
  const intereses = resultado - invertido;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><label className="label">Capital inicial (€)</label><input className="input" type="number" value={capital} onChange={e => setCapital(+e.target.value)} /></div>
        <div><label className="label">Aportación mensual (€)</label><input className="input" type="number" value={aportacion} onChange={e => setAportacion(+e.target.value)} /></div>
        <div><label className="label">Rentabilidad anual (%)</label><input className="input" type="number" step="0.1" value={tasa} onChange={e => setTasa(+e.target.value)} /><input type="range" min={1} max={20} step={0.5} value={tasa} onChange={e => setTasa(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
        <div><label className="label">Años</label><input className="input" type="number" value={años} onChange={e => setAños(+e.target.value)} /><input type="range" min={1} max={40} value={años} onChange={e => setAños(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Valor final</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>€{fmt(resultado)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Total invertido</div><div style={{ fontSize: 22, fontWeight: 700 }}>€{fmt(invertido)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Intereses ganados</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>€{fmt(intereses)}</div></div>
      </div>
    </div>
  );
}

function CalcRegla72() {
  const [tasa, setTasa] = useState(7);
  const años = (72 / tasa).toFixed(1);
  return (
    <div>
      <label className="label">Tasa de retorno anual (%)</label>
      <input className="input" type="number" step="0.5" value={tasa} onChange={e => setTasa(+e.target.value)} />
      <input type="range" min={1} max={25} step={0.5} value={tasa} onChange={e => setTasa(+e.target.value)} className="slider" style={{ width: '100%', margin: '8px 0 16px' }} />
      <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Tu dinero se duplica en</div>
        <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--blue)' }}>{años}<span style={{ fontSize: 18, color: 'var(--text2)' }}> años</span></div>
      </div>
    </div>
  );
}

function CalcHipoteca() {
  const [precio, setPrecio] = useState(300000);
  const [entrada, setEntrada] = useState(20);
  const [tasa, setTasa] = useState(3.5);
  const [años, setAños] = useState(30);
  const capital = precio * (1 - entrada / 100);
  const r = tasa / 100 / 12;
  const n = años * 12;
  const cuota = r === 0 ? capital / n : capital * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPagado = cuota * n;
  const totalIntereses = totalPagado - capital;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><label className="label">Precio vivienda (€)</label><input className="input" type="number" step={5000} value={precio} onChange={e => setPrecio(+e.target.value)} /></div>
        <div><label className="label">Entrada ({entrada}%)</label><input className="input" type="number" value={entrada} onChange={e => setEntrada(+e.target.value)} /><input type="range" min={5} max={50} value={entrada} onChange={e => setEntrada(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
        <div><label className="label">Tipo de interés anual (%)</label><input className="input" type="number" step="0.1" value={tasa} onChange={e => setTasa(+e.target.value)} /><input type="range" min={1} max={8} step={0.1} value={tasa} onChange={e => setTasa(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
        <div><label className="label">Plazo (años)</label><input className="input" type="number" value={años} onChange={e => setAños(+e.target.value)} /><input type="range" min={5} max={40} value={años} onChange={e => setAños(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Cuota mensual</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>€{fmt(cuota)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Total intereses</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>€{fmt(totalIntereses)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Total pagado</div><div style={{ fontSize: 22, fontWeight: 700 }}>€{fmt(totalPagado)}</div></div>
      </div>
    </div>
  );
}

const DIVISAS_CONVERTER = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'MXN', 'BRL', 'CNY', 'INR', 'KRW'];
const HOUR_MS = 3_600_000;

// Build EUR-based rates (1 EUR = X currency) from FALLBACK_RATES (1 X = Y EUR)
function buildFallbackEurRates(): Record<string, number> {
  const rates: Record<string, number> = { EUR: 1 };
  for (const [key, rate] of Object.entries(FALLBACK_RATES)) {
    const currency = key.split('_')[0];
    if (currency && rate > 0) rates[currency] = 1 / rate;
  }
  return rates;
}

function CalcDivisas() {
  const { exchangeRates, setExchangeRates } = useMercadoStore();
  const [cantidad, setCantidad] = useState(1000);
  const [de, setDe] = useState('USD');
  const [a, setA] = useState('EUR');
  // EUR-based rates: { EUR: 1, USD: 1.087, GBP: 0.854, ... } — "1 EUR = X currency"
  const [eurRates, setEurRates] = useState<Record<string, number>>(buildFallbackEurRates);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    // Use store if rates are fresh (< 1h) and came from real API
    if (exchangeRates.source === 'api' && exchangeRates.updatedAt > 0 && Date.now() - exchangeRates.updatedAt < HOUR_MS) {
      const rates: Record<string, number> = { EUR: 1 };
      for (const cur of DIVISAS_CONVERTER) {
        const key = `${cur}_EUR` as keyof typeof exchangeRates;
        const storeRate = exchangeRates[key] as number | undefined;
        if (storeRate && storeRate > 0) rates[cur] = 1 / storeRate;
      }
      setEurRates(rates);
      setUsingFallback(false);
      setUpdatedAt(new Date(exchangeRates.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      return;
    }

    // Fetch fresh rates via proxy
    getAllRates('EUR').then(data => {
      const rates = data.conversion_rates;
      setEurRates(rates);
      setUsingFallback(false);
      setUpdatedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      // Save to store for app-wide use
      const toXeur = (code: string) => (rates[code] ? 1 / rates[code] : undefined);
      setExchangeRates({
        USD_EUR: toXeur('USD') ?? 0.92,
        GBP_EUR: toXeur('GBP') ?? 1.17,
        CHF_EUR: toXeur('CHF') ?? 1.05,
        JPY_EUR: toXeur('JPY') ?? 0.0062,
        CAD_EUR: toXeur('CAD') ?? 0.68,
        AUD_EUR: toXeur('AUD') ?? 0.61,
        SEK_EUR: toXeur('SEK') ?? 0.087,
        NOK_EUR: toXeur('NOK') ?? 0.087,
        DKK_EUR: toXeur('DKK') ?? 0.134,
        MXN_EUR: toXeur('MXN') ?? 0.053,
        BRL_EUR: toXeur('BRL') ?? 0.185,
        CNY_EUR: toXeur('CNY') ?? 0.127,
        INR_EUR: toXeur('INR') ?? 0.011,
        KRW_EUR: toXeur('KRW') ?? 0.00068,
        source: 'api',
      });
    }).catch(() => {
      setUsingFallback(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert using EUR as intermediary: amount_from * (to_rate / from_rate)
  const convert = (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    const fromRate = eurRates[from] ?? 1; // 1 EUR = fromRate FROM
    const toRate = eurRates[to] ?? 1;     // 1 EUR = toRate TO
    return amount * toRate / fromRate;
  };

  const resultado = convert(cantidad, de, a);
  const rate = convert(1, de, a);
  const rateInv = convert(1, a, de);

  return (
    <div>
      {usingFallback && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--amber)' }}>
          Usando tipos estimados — configura ExchangeRate-API en Ajustes para tipos reales
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 140px' }}>
          <label className="label">Cantidad</label>
          <input className="input" type="number" min="0" value={cantidad} onChange={e => setCantidad(+e.target.value)} />
        </div>
        <div style={{ flex: '1 1 90px' }}>
          <label className="label">De</label>
          <select className="select" value={de} onChange={e => setDe(e.target.value)}>
            {DIVISAS_CONVERTER.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn-icon" onClick={() => { setDe(a); setA(de); }} title="Invertir divisas" style={{ padding: 10, fontSize: 16, marginBottom: 2 }}>⇄</button>
        <div style={{ flex: '1 1 90px' }}>
          <label className="label">A</label>
          <select className="select" value={a} onChange={e => setA(e.target.value)}>
            {DIVISAS_CONVERTER.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{cantidad.toLocaleString('es-ES', { maximumFractionDigits: 2 })} {de}</span>
          <span style={{ color: 'var(--text2)', margin: '0 12px' }}>=</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>
            {resultado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {a}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12, color: 'var(--text2)' }}>
          <span>1 {de} = {rate.toFixed(4)} {a}</span>
          <span>·</span>
          <span>1 {a} = {rateInv.toFixed(4)} {de}</span>
        </div>
        {updatedAt && !usingFallback && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
            Tipos actualizados hoy a las {updatedAt}
          </div>
        )}
      </div>
    </div>
  );
}

function CalcAhorro() {
  const [objetivo, setObjetivo] = useState(10000);
  const [ahorro, setAhorro] = useState(300);
  const [tasa, setTasa] = useState(4);
  const r = tasa / 100 / 12;
  const meses = r > 0 ? Math.log(1 + (objetivo * r) / ahorro) / Math.log(1 + r) : objetivo / ahorro;
  const total = ahorro * Math.ceil(meses);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><label className="label">Objetivo (€)</label><input className="input" type="number" value={objetivo} onChange={e => setObjetivo(+e.target.value)} /></div>
        <div><label className="label">Ahorro mensual (€)</label><input className="input" type="number" value={ahorro} onChange={e => setAhorro(+e.target.value)} /></div>
        <div><label className="label">Interés anual (%)</label><input className="input" type="number" step="0.5" value={tasa} onChange={e => setTasa(+e.target.value)} /><input type="range" min={0} max={10} step={0.25} value={tasa} onChange={e => setTasa(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Meses necesarios</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>{Math.ceil(meses)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Total aportado</div><div style={{ fontSize: 22, fontWeight: 700 }}>€{fmt(total)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Intereses ganados</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>€{fmt(Math.max(0, objetivo - total))}</div></div>
      </div>
    </div>
  );
}

function CalcInflacion() {
  const [cantidad, setCantidad] = useState(1000);
  const [tasa, setTasa] = useState(3);
  const [años, setAños] = useState(10);
  const futuro = cantidad * Math.pow(1 + tasa / 100, años);
  const poderAdq = (cantidad / futuro) * 100;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><label className="label">Cantidad actual (€)</label><input className="input" type="number" value={cantidad} onChange={e => setCantidad(+e.target.value)} /></div>
        <div><label className="label">Inflación anual (%)</label><input className="input" type="number" step="0.1" value={tasa} onChange={e => setTasa(+e.target.value)} /><input type="range" min={0.5} max={10} step={0.5} value={tasa} onChange={e => setTasa(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
        <div><label className="label">Años</label><input className="input" type="number" value={años} onChange={e => setAños(+e.target.value)} /><input type="range" min={1} max={30} value={años} onChange={e => setAños(+e.target.value)} className="slider" style={{ width: '100%', marginTop: 6 }} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Equivalente en {años} años</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>€{fmt(futuro)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Poder adquisitivo</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--amber)' }}>{poderAdq.toFixed(1)}%</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Pérdida de valor</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>€{fmt(futuro - cantidad)}</div></div>
      </div>
    </div>
  );
}

function CalcROI() {
  const [inversion, setInversion] = useState(5000);
  const [retorno, setRetorno] = useState(7500);
  const ganancia = retorno - inversion;
  const roi = ((retorno - inversion) / inversion) * 100;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><label className="label">Inversión inicial (€)</label><input className="input" type="number" value={inversion} onChange={e => setInversion(+e.target.value)} /></div>
        <div><label className="label">Retorno total (€)</label><input className="input" type="number" value={retorno} onChange={e => setRetorno(+e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Ganancia neta</div><div style={{ fontSize: 22, fontWeight: 700, color: ganancia >= 0 ? 'var(--green)' : 'var(--red)' }}>€{fmt(ganancia)}</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>ROI</div><div style={{ fontSize: 22, fontWeight: 700, color: roi >= 0 ? 'var(--green)' : 'var(--red)' }}>{roi.toFixed(2)}%</div></div>
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 11, color: 'var(--text2)' }}>Multiplicador</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>{inversion > 0 ? (retorno / inversion).toFixed(2) : '0.00'}x</div></div>
      </div>
    </div>
  );
}

// ═══════════════════════ FIRE AVANZADO ═══════════════════════
function SimuladorFIRE() {
  const { cuentas } = useFinanzasStore();
  const { posiciones } = useInversionesStore();
  const precios = useMercadoStore(s => s.precios);
  const { inmuebles } = useInmuebleStore();
  const { deudas } = useDeudaStore();
  const { saldoManual: fondoSaldoManual, cuentaVinculadaId: fondoCuentaId, objetivoActual: fondoObjetivo } = useFondoEmergenciaStore();

  const saldoCuentas = cuentas.reduce((s, c) => s + toEur(c.saldo, c.divisa), 0);
  const valorInversiones = posiciones.reduce((sum, p) => {
    const precio = precios[p.simbolo]?.precio ?? MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price ?? p.precioMedio;
    return sum + toEur(precio * p.acciones, p.divisa);
  }, 0);
  const equityInmuebles = inmuebles.reduce((s, inm) => {
    const hip = deudas.find(d => d.id === inm.hipotecaAsociada);
    return s + inm.valorActual - (hip ? toEur(hip.importePendiente, hip.divisa) : 0);
  }, 0);
  const rentasMensuales = inmuebles.filter(i => i.generaRenta).reduce((s, i) => {
    const gastos = (i.gastosIbiMes + i.gastosComunidad + i.gastosSeguro + i.gastosMantenimiento + i.gastosOtros);
    return s + i.rentaMensualBruta - gastos;
  }, 0);
  const cuentaFondo = fondoCuentaId ? cuentas.find(c => c.id === fondoCuentaId) : null;
  const saldoFondo = cuentaFondo ? toEur(cuentaFondo.saldo, cuentaFondo.divisa) : fondoSaldoManual;
  const capitalActual = saldoCuentas + valorInversiones + equityInmuebles;
  const capitalInvertible = Math.max(0, capitalActual - saldoFondo);

  const [edadActual, setEdadActual] = useState(35);
  const [edadObjetivo, setEdadObjetivo] = useState(50);

  const [gastosMesJubilacion, setGastosMesJubilacion] = useState(2000);
  const [inflacion, setInflacion] = useState(3);
  const [rentabilidad, setRentabilidad] = useState(7);
  const [aportacionMes, setAportacionMes] = useState(800);
  const [pensionSS, setPensionSS] = useState(600);
  const [capitalManual, setCapitalManual] = useState(capitalInvertible);

  const rentasAnuales = rentasMensuales * 12;

  const gastosAnuales = gastosMesJubilacion * 12;

  // Capital necesario con regla 4%
  const ingresosPasivosAnuales = rentasAnuales;
  const gastosNetosAnuales = Math.max(0, gastosAnuales - ingresosPasivosAnuales);
  const capitalNecesario = gastosAnuales / 0.04;
  const capitalNecesarioConRentas = gastosNetosAnuales / 0.04;

  // Growth projection
  function proyectarCapital(tasaAnual: number, años: number, capInicial: number, aportMes: number): number {
    const r = tasaAnual / 100;
    if (r === 0) return capInicial + aportMes * 12 * años;
    return capInicial * Math.pow(1 + r, años) + aportMes * 12 * ((Math.pow(1 + r, años) - 1) / r);
  }

  const añosHastaObjetivo = edadObjetivo - edadActual;
  const añosHastaObjetivoBase = añosHastaObjetivo > 0 ? añosHastaObjetivo : 1;

  // Find year of FIRE (when capital >= capitalNecesarioConRentas)
  function findFIREYear(tasa: number): number {
    for (let y = 0; y <= 60; y++) {
      if (proyectarCapital(tasa, y, capitalManual, aportacionMes) >= capitalNecesarioConRentas) return y;
    }
    return 99;
  }
  const fireYearBase = findFIREYear(rentabilidad);
  const fireYearConservador = findFIREYear(5);
  const fireYearOptimista = findFIREYear(10);

  // Chart data: 0..max(fireYearBase+5, añosHastaObjetivoBase+5)
  const chartYears = Math.min(Math.max(fireYearBase + 5, añosHastaObjetivoBase + 2, 20), 60);
  const chartData = Array.from({ length: chartYears + 1 }, (_, y) => ({
    año: edadActual + y,
    base: Math.round(proyectarCapital(rentabilidad, y, capitalManual, aportacionMes)),
    conservador: Math.round(proyectarCapital(5, y, capitalManual, aportacionMes)),
    optimista: Math.round(proyectarCapital(10, y, capitalManual, aportacionMes)),
    objetivo: Math.round(capitalNecesarioConRentas),
  }));

  const progresoActual = capitalNecesarioConRentas > 0 ? Math.min((capitalManual / capitalNecesarioConRentas) * 100, 100) : 0;
  const retiradaMensualSostenible = capitalManual * 0.04 / 12;

  // Sensitivity table: extra ahorro -> years saved
  const sensibilidad = [200, 500, 1000].map(extra => ({
    extra,
    años: findFIREYear(rentabilidad) - findFIREYear(rentabilidad) === 0 ? 0 :
      Math.max(0, findFIREYear(rentabilidad) - findFIREYear(rentabilidad)),
    fireYear: findFIREYear(rentabilidad) - (() => {
      let y = 0;
      for (; y <= 60; y++) if (proyectarCapital(rentabilidad, y, capitalManual, aportacionMes + extra) >= capitalNecesarioConRentas) break;
      return y;
    })(),
    yearsWith: (() => {
      for (let y = 0; y <= 60; y++) if (proyectarCapital(rentabilidad, y, capitalManual, aportacionMes + extra) >= capitalNecesarioConRentas) return y;
      return 99;
    })(),
  }));

  // Post-FIRE 30-year simulation
  const postFIREData = Array.from({ length: 31 }, (_, y) => {
    let cap = capitalNecesarioConRentas;
    for (let i = 0; i < y; i++) {
      cap = cap * (1 + rentabilidad / 100) - gastosNetosAnuales;
    }
    return { año: edadObjetivo + y, capital: Math.max(0, Math.round(cap)) };
  });

  const Slider = ({ label, value, min, max, step, onChange, unit = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</label>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{value.toLocaleString('es-ES')}{unit}</span>
      </div>
      <input type="range" className="slider" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} style={{ width: '100%' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e1e2e 0%, #161618 100%)', border: '1px solid #2a2a42' }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Datos autocargados de tus cuentas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'Liquidez', val: fmtEur(saldoCuentas) },
            { label: 'Cartera inversiones', val: fmtEur(valorInversiones) },
            { label: 'Equity inmobiliario', val: fmtEur(equityInmuebles) },
            { label: 'Renta pasiva neta', val: `${fmtEur(rentasMensuales)}/mes` },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{item.val}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>🛡️ Fondo emergencia</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: saldoFondo >= fondoObjetivo && fondoObjetivo > 0 ? 'var(--green)' : 'var(--amber)' }}>{fmtEur(saldoFondo)}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)' }}>objetivo {fmtEur(fondoObjetivo)} · descontado</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--blue)' }}>Parámetros personales</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Slider label="Edad actual" value={edadActual} min={18} max={65} step={1} onChange={setEdadActual} unit=" años" />
              <Slider label="Edad objetivo FIRE" value={edadObjetivo} min={edadActual + 1} max={80} step={1} onChange={setEdadObjetivo} unit=" años" />
              <Slider label="Gastos mes en jubilación" value={gastosMesJubilacion} min={500} max={10000} step={100} onChange={setGastosMesJubilacion} unit=" €" />
              <Slider label="Pensión SS estimada" value={pensionSS} min={0} max={3000} step={50} onChange={setPensionSS} unit=" €/mes" />
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--blue)' }}>Inversión y rendimiento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label" style={{ fontSize: 11 }}>Capital actual (€)</label>
                <input className="input" type="number" value={Math.round(capitalManual)} onChange={e => setCapitalManual(+e.target.value)} style={{ fontSize: 13 }} />
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>Total: {fmtEur(capitalActual)} − fondo {fmtEur(saldoFondo)} = {fmtEur(capitalInvertible)} · editable</div>
              </div>
              <Slider label="Aportación mensual" value={aportacionMes} min={0} max={5000} step={50} onChange={setAportacionMes} unit=" €" />
              <Slider label="Rentabilidad esperada" value={rentabilidad} min={1} max={15} step={0.5} onChange={setRentabilidad} unit="%" />
              <Slider label="Inflación anual" value={inflacion} min={0} max={8} step={0.5} onChange={setInflacion} unit="%" />
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="card" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Capital necesario (R4%)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>{fmtEur(capitalNecesario)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>bruto sin rentas pasivas</div>
            </div>
            <div className="card" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Capital con rentas</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{fmtEur(capitalNecesarioConRentas)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>descontando {fmtEur(rentasAnuales)}/año</div>
            </div>
            <div className="card" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Retiro sostenible/mes</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>{fmtEur(retiradaMensualSostenible)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>4% del capital actual</div>
            </div>
          </div>

          {/* Progress */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Progreso hacia FIRE</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: progresoActual >= 100 ? 'var(--green)' : 'var(--blue)' }}>{progresoActual.toFixed(1)}%</span>
            </div>
            <div style={{ height: 12, background: 'var(--bg3)', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${progresoActual}%`, background: progresoActual >= 100 ? 'var(--green)' : 'var(--blue)', borderRadius: 6, transition: 'width 0.5s' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: '🔵 Base (7%)', años: fireYearBase, color: '#3b82f6' },
                { label: '🟡 Conservador (5%)', años: fireYearConservador, color: '#f59e0b' },
                { label: '🟢 Optimista (10%)', años: fireYearOptimista, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontWeight: 700, color: s.color }}>{s.años >= 99 ? '∞' : `${s.años} años`}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{s.años < 99 ? `Edad ${edadActual + s.años}` : 'No alcanzable'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Evolución del patrimonio hasta FIRE</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="año" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [fmtEur(v as number)]} />
                <ReferenceLine y={capitalNecesarioConRentas} stroke="#22c55e" strokeDasharray="6 3" label={{ value: 'FIRE', fill: '#22c55e', fontSize: 11 }} />
                <Line type="monotone" dataKey="conservador" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Conservador 5%" />
                <Line type="monotone" dataKey="base" stroke="#3b82f6" strokeWidth={2} dot={false} name="Base 7%" />
                <Line type="monotone" dataKey="optimista" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Optimista 10%" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sensitivity table */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>📊 Tabla de sensibilidad — Si ahorro X€ más por mes...</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Aportación base', 'Aportación extra', 'Total mensual', 'Años hasta FIRE', 'Edad FIRE', 'Años ganados'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, ...sensibilidad.map(s => s.extra)].map(extra => {
                const totalMes = aportacionMes + extra;
                const fireYr = extra === 0 ? fireYearBase : sensibilidad.find(s => s.extra === extra)!.yearsWith;
                const añosGanados = fireYearBase - fireYr;
                return (
                  <tr key={extra} style={{ borderBottom: '1px solid var(--border)', background: extra === 0 ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px' }}>{fmtEur(aportacionMes)}</td>
                    <td style={{ padding: '8px 12px', color: extra > 0 ? 'var(--green)' : 'var(--text2)' }}>{extra > 0 ? `+${fmtEur(extra)}` : '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{fmtEur(totalMes)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--blue)', fontWeight: 700 }}>{fireYr >= 99 ? '∞' : fireYr}</td>
                    <td style={{ padding: '8px 12px' }}>{fireYr < 99 ? edadActual + fireYr : '—'}</td>
                    <td style={{ padding: '8px 12px', color: añosGanados > 0 ? 'var(--green)' : 'var(--text2)', fontWeight: añosGanados > 0 ? 700 : 400 }}>
                      {añosGanados > 0 ? `−${añosGanados} años` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post-FIRE simulation */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Simulación post-FIRE (30 años con retiradas {((gastosNetosAnuales / capitalNecesarioConRentas) * 100 || 4).toFixed(1)}%)</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>Evolución del capital partiendo de {fmtEur(capitalNecesarioConRentas)} con retiros de {fmtEur(gastosNetosAnuales)}/año</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={postFIREData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="año" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [fmtEur(v as number)]} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="capital" stroke="#a78bfa" strokeWidth={2} dot={false} name="Capital restante" />
          </LineChart>
        </ResponsiveContainer>
        {postFIREData[postFIREData.length - 1].capital > 0
          ? <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 8, textAlign: 'center' }}>✅ El capital aguanta 30 años con herencia estimada de {fmtEur(postFIREData[postFIREData.length - 1].capital)}</div>
          : <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, textAlign: 'center' }}>⚠️ El capital se agota antes de los 30 años. Considera reducir gastos o aumentar el capital FIRE.</div>
        }
      </div>
    </div>
  );
}

// ═══════════════════════ MAIN ═══════════════════════
const TOOLS = [
  { id: 'compuesto', titulo: 'Interés Compuesto', desc: 'El octavo milagro del mundo', componente: <CalcInteresCompuesto /> },
  { id: 'regla72', titulo: 'Regla del 72', desc: '¿Cuándo se duplica tu dinero?', componente: <CalcRegla72 /> },
  { id: 'hipoteca', titulo: 'Calculadora de Hipoteca', desc: 'Cuota y coste total del préstamo', componente: <CalcHipoteca /> },
  { id: 'divisas', titulo: 'Conversor de Divisas', desc: 'USD, EUR, GBP, JPY, CHF, CAD', componente: <CalcDivisas /> },
  { id: 'ahorro', titulo: 'Calculadora de Ahorro', desc: '¿Cuánto tiempo para tu objetivo?', componente: <CalcAhorro /> },
  { id: 'inflacion', titulo: 'Impacto de la Inflación', desc: 'Poder adquisitivo en el tiempo', componente: <CalcInflacion /> },
  { id: 'roi', titulo: 'Calculadora ROI', desc: 'Retorno sobre inversión', componente: <CalcROI /> },
];

export default function Herramientas() {
  const [tab, setTab] = useState<'calculadoras' | 'fire'>('calculadoras');
  const [activa, setActiva] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
        {([['calculadoras', '🔢 Calculadoras'], ['fire', '🔥 Simulador FIRE']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: tab === t ? 'var(--blue)' : 'none', color: tab === t ? 'white' : 'var(--text2)', transition: 'all .2s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'calculadoras' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{TOOLS.length} calculadoras financieras interactivas. Haz clic para expandir.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {TOOLS.map((tool) => (
              <div key={tool.id} className="card" style={{ cursor: 'pointer', border: activa === tool.id ? '1px solid var(--blue)' : undefined, transition: 'border .2s' }}
                onClick={() => setActiva(activa === tool.id ? null : tool.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: activa === tool.id ? 20 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{tool.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tool.desc}</div>
                  </div>
                  <div style={{ color: activa === tool.id ? 'var(--blue)' : 'var(--text2)', fontSize: 18, transition: 'transform .2s', transform: activa === tool.id ? 'rotate(45deg)' : 'none' }}>+</div>
                </div>
                {activa === tool.id && <div onClick={e => e.stopPropagation()}>{tool.componente}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'fire' && <SimuladorFIRE />}
    </div>
  );
}
