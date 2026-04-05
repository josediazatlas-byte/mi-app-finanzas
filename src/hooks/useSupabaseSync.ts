import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useFinanzasStore } from '../stores/useFinanzasStore'
import { useInversionesStore } from '../stores/useInversionesStore'
import { useMetasStore } from '../stores/useMetasStore'
import { useSuscripcionesStore } from '../stores/useSuscripcionesStore'
import { useClientesStore } from '../stores/useClientesStore'
import { useFacturasStore } from '../stores/useFacturasStore'
import { useInmuebleStore } from '../stores/useInmuebleStore'
import { useConfigStore } from '../stores/useConfigStore'
import { useDeudaStore } from '../stores/useDeudaStore'
import { usePresupuestoStore } from '../stores/usePresupuestoStore'
import { useDividendosStore } from '../stores/useDividendosStore'
import { useFondoEmergenciaStore } from '../stores/useFondoEmergenciaStore'
import type { Ingreso, Gasto, Cuenta } from '../stores/useFinanzasStore'
import type { Posicion } from '../stores/useInversionesStore'
import type { Meta } from '../stores/useMetasStore'
import type { Suscripcion } from '../stores/useSuscripcionesStore'
import type { Cliente } from '../stores/useClientesStore'
import type { Factura } from '../stores/useFacturasStore'
import type { Inmueble } from '../stores/useInmuebleStore'

// ─── Sync status store ───────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'loading' | 'syncing' | 'synced' | 'error'

interface SyncState {
  status: SyncStatus
  lastSync: string | null
  setStatus: (s: SyncStatus) => void
  setLastSync: (t: string) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSync: null,
  setStatus: (status) => set({ status }),
  setLastSync: (lastSync) => set({ lastSync }),
}))

// Flag to prevent save loop when loading from Supabase
let isSyncing = false

// ─── Mappers: app → Supabase row ─────────────────────────────────────────────

function ingresoToRow(uid: string, i: Ingreso) {
  return {
    user_id: uid, app_id: i.id, tipo: 'ingreso',
    categoria: i.categoria, nombre: i.nombre, importe: i.importe,
    fecha: i.fecha, recurrente: i.recurrente, origen: i.origen ?? null,
  }
}

function gastoToRow(uid: string, g: Gasto) {
  return {
    user_id: uid, app_id: g.id, tipo: 'gasto',
    categoria: g.categoria, nombre: g.nombre, importe: g.importe,
    fecha: g.fecha, recurrente: g.recurrente, origen: g.origen ?? null,
  }
}

function cuentaToRow(uid: string, c: Cuenta) {
  return {
    user_id: uid, app_id: c.id,
    nombre: c.nombre, tipo: c.tipo, saldo: c.saldo, divisa: c.divisa,
  }
}

function posicionToRow(uid: string, p: Posicion) {
  const { id, simbolo, nombre, tipo, acciones, precioMedio, divisa, notas, ...extra } = p
  return {
    user_id: uid, app_id: id, simbolo, nombre, tipo, acciones,
    precio_medio: precioMedio, divisa,
    metadata: { notas, ...extra },
  }
}

function inmuebleToRow(uid: string, i: Inmueble) {
  const { id, nombre, tipo, valorActual, precioCompra, superficie, direccion,
    generaRenta, rentaMensualBruta, notas, ...extra } = i
  return {
    user_id: uid, app_id: id, nombre, tipo,
    valor_actual: valorActual, precio_compra: precioCompra,
    superficie, direccion, genera_renta: generaRenta,
    renta_mensual_bruta: rentaMensualBruta,
    metadata: { notas, ...extra },
  }
}

function facturaToRow(uid: string, f: Factura) {
  const { id, numero, clienteId, fechaEmision, fechaVencimiento, conceptos,
    baseImponible, iva, retencion, total, estado, ...extra } = f
  return {
    user_id: uid, app_id: id, numero, cliente_id: clienteId,
    fecha_emision: fechaEmision, fecha_vencimiento: fechaVencimiento,
    conceptos, base_imponible: baseImponible, iva, retencion, total, estado,
    metadata: extra,
  }
}

function clienteToRow(uid: string, c: Cliente) {
  return {
    user_id: uid, app_id: c.id,
    nombre: c.nombreRazonSocial, nif: c.nifCif,
    email: c.email, telefono: c.telefono,
    direccion: c.direccion, notas: c.notas,
  }
}

function metaToRow(uid: string, m: Meta) {
  const { id, nombre, tipo, objetivo, ahorrado, aportacionMensual,
    fechaObjetivo, prioridad, color, ...extra } = m
  return {
    user_id: uid, app_id: id, nombre, tipo, objetivo, ahorrado,
    aportacion_mensual: aportacionMensual, fecha_objetivo: fechaObjetivo,
    prioridad, color, metadata: extra,
  }
}

function suscripcionToRow(uid: string, s: Suscripcion) {
  const { id, nombre, categoria, importe, frecuencia, fechaProximoCobro, activa, ...extra } = s
  return {
    user_id: uid, app_id: id, nombre, categoria, importe, frecuencia,
    fecha_proximo_cobro: fechaProximoCobro, activa, metadata: extra,
  }
}

// ─── Mappers: Supabase row → app ─────────────────────────────────────────────

type Row = Record<string, unknown>

function rowToIngreso(r: Row): Ingreso {
  return {
    id: r.app_id as string,
    categoria: r.categoria as Ingreso['categoria'],
    nombre: r.nombre as string,
    importe: Number(r.importe),
    fecha: r.fecha as string,
    recurrente: Boolean(r.recurrente),
    origen: (r.origen as Ingreso['origen']) ?? undefined,
  }
}

function rowToGasto(r: Row): Gasto {
  return {
    id: r.app_id as string,
    categoria: r.categoria as Gasto['categoria'],
    nombre: r.nombre as string,
    importe: Number(r.importe),
    fecha: r.fecha as string,
    recurrente: Boolean(r.recurrente),
    origen: (r.origen as Gasto['origen']) ?? undefined,
  }
}

function rowToCuenta(r: Row): Cuenta {
  return {
    id: r.app_id as string,
    nombre: r.nombre as string,
    tipo: r.tipo as Cuenta['tipo'],
    saldo: Number(r.saldo),
    divisa: r.divisa as string,
  }
}

function rowToPosicion(r: Row): Posicion {
  const meta = (r.metadata as Row) ?? {}
  return {
    id: r.app_id as string,
    simbolo: r.simbolo as string,
    nombre: r.nombre as string,
    tipo: r.tipo as Posicion['tipo'],
    acciones: Number(r.acciones),
    precioMedio: Number(r.precio_medio),
    divisa: r.divisa as Posicion['divisa'],
    notas: meta.notas as string | undefined,
    isin: meta.isin as string | undefined,
    gestora: meta.gestora as string | undefined,
    vl: meta.vl != null ? Number(meta.vl) : undefined,
    vlFecha: meta.vlFecha as string | undefined,
    fechaCompra: meta.fechaCompra as string | undefined,
    ter: meta.ter != null ? Number(meta.ter) : undefined,
  }
}

function rowToInmueble(r: Row): Inmueble {
  const meta = (r.metadata as Row) ?? {}
  return {
    id: r.app_id as string,
    nombre: r.nombre as string,
    tipo: r.tipo as Inmueble['tipo'],
    valorActual: Number(r.valor_actual),
    precioCompra: Number(r.precio_compra),
    superficie: Number(r.superficie),
    direccion: r.direccion as string,
    generaRenta: Boolean(r.genera_renta),
    rentaMensualBruta: Number(r.renta_mensual_bruta),
    notas: (meta.notas as string) ?? '',
    añoAdquisicion: (meta.añoAdquisicion as number) ?? new Date().getFullYear(),
    hipotecaAsociada: (meta.hipotecaAsociada as string) ?? '',
    gastosIbiMes: (meta.gastosIbiMes as number) ?? 0,
    gastosComunidad: (meta.gastosComunidad as number) ?? 0,
    gastosSeguro: (meta.gastosSeguro as number) ?? 0,
    gastosMantenimiento: (meta.gastosMantenimiento as number) ?? 0,
    gastosOtros: (meta.gastosOtros as number) ?? 0,
  }
}

function rowToFactura(r: Row): Factura {
  const meta = (r.metadata as Row) ?? {}
  return {
    id: r.app_id as string,
    numero: r.numero as string,
    clienteId: (r.cliente_id as string) ?? '',
    fechaEmision: r.fecha_emision as string,
    fechaVencimiento: r.fecha_vencimiento as string,
    conceptos: (r.conceptos as Factura['conceptos']) ?? [],
    baseImponible: Number(r.base_imponible),
    iva: Number(r.iva),
    retencion: Number(r.retencion),
    total: Number(r.total),
    estado: r.estado as Factura['estado'],
    metodoPago: (meta.metodoPago as string) ?? '',
    iban: (meta.iban as string) ?? '',
    notas: (meta.notas as string) ?? '',
    recurrente: meta.recurrente as boolean | undefined,
    frecuencia: meta.frecuencia as Factura['frecuencia'],
    diaDelMes: meta.diaDelMes as number | undefined,
    fechaFinRecurrencia: meta.fechaFinRecurrencia as string | null | undefined,
    proximaGeneracion: meta.proximaGeneracion as string | null | undefined,
    pausada: meta.pausada as boolean | undefined,
    plantillaId: meta.plantillaId as string | null | undefined,
  }
}

function rowToCliente(r: Row): Cliente {
  return {
    id: r.app_id as string,
    nombreRazonSocial: r.nombre as string,
    nifCif: (r.nif as string) ?? '',
    email: (r.email as string) ?? '',
    telefono: (r.telefono as string) ?? '',
    direccion: (r.direccion as string) ?? '',
    notas: (r.notas as string) ?? '',
  }
}

function rowToMeta(r: Row): Meta {
  const meta = (r.metadata as Row) ?? {}
  return {
    id: r.app_id as string,
    nombre: r.nombre as string,
    tipo: r.tipo as Meta['tipo'],
    objetivo: Number(r.objetivo),
    ahorrado: Number(r.ahorrado),
    aportacionMensual: Number(r.aportacion_mensual),
    fechaObjetivo: r.fecha_objetivo as string,
    prioridad: r.prioridad as 1 | 2 | 3,
    color: (r.color as string) ?? '#3b82f6',
    descripcion: (meta.descripcion as string) ?? '',
  }
}

function rowToSuscripcion(r: Row): Suscripcion {
  const meta = (r.metadata as Row) ?? {}
  return {
    id: r.app_id as string,
    nombre: r.nombre as string,
    categoria: r.categoria as Suscripcion['categoria'],
    importe: Number(r.importe),
    frecuencia: r.frecuencia as Suscripcion['frecuencia'],
    fechaProximoCobro: r.fecha_proximo_cobro as string,
    activa: Boolean(r.activa),
    metodoPago: (meta.metodoPago as string) ?? '',
    notas: (meta.notas as string) ?? '',
  }
}

// ─── Load from Supabase ───────────────────────────────────────────────────────

export async function loadUserData(userId: string): Promise<boolean> {
  const { setStatus, setLastSync } = useSyncStore.getState()
  setStatus('loading')
  isSyncing = true

  try {
    const [movRes, cuentasRes, posRes, inmRes, facRes, cliRes, metasRes, susRes, cfgRes] =
      await Promise.all([
        supabase.from('movimientos').select('*').eq('user_id', userId),
        supabase.from('cuentas').select('*').eq('user_id', userId),
        supabase.from('posiciones').select('*').eq('user_id', userId),
        supabase.from('inmuebles').select('*').eq('user_id', userId),
        supabase.from('facturas').select('*').eq('user_id', userId),
        supabase.from('clientes').select('*').eq('user_id', userId),
        supabase.from('metas').select('*').eq('user_id', userId),
        supabase.from('suscripciones').select('*').eq('user_id', userId),
        supabase.from('configuracion').select('*').eq('user_id', userId).maybeSingle(),
      ])

    const hasData =
      (movRes.data?.length ?? 0) > 0 ||
      (cuentasRes.data?.length ?? 0) > 0 ||
      (posRes.data?.length ?? 0) > 0

    if (!hasData) {
      setStatus('idle')
      isSyncing = false
      return false
    }

    if (movRes.data) {
      useFinanzasStore.setState({
        ingresos: movRes.data.filter(r => r.tipo === 'ingreso').map(rowToIngreso),
        gastos: movRes.data.filter(r => r.tipo === 'gasto').map(rowToGasto),
      })
    }
    if (cuentasRes.data && cuentasRes.data.length > 0) {
      useFinanzasStore.setState({ cuentas: cuentasRes.data.map(rowToCuenta) })
    }
    if (posRes.data && posRes.data.length > 0) {
      useInversionesStore.setState({ posiciones: posRes.data.map(rowToPosicion) })
    }
    if (inmRes.data && inmRes.data.length > 0) {
      useInmuebleStore.setState({ inmuebles: inmRes.data.map(rowToInmueble) })
    }
    if (facRes.data && facRes.data.length > 0) {
      useFacturasStore.setState({ facturas: facRes.data.map(rowToFactura) })
    }
    if (cliRes.data && cliRes.data.length > 0) {
      useClientesStore.setState({ clientes: cliRes.data.map(rowToCliente) })
    }
    if (metasRes.data && metasRes.data.length > 0) {
      useMetasStore.setState({ metas: metasRes.data.map(rowToMeta) })
    }
    if (susRes.data && susRes.data.length > 0) {
      useSuscripcionesStore.setState({ suscripciones: susRes.data.map(rowToSuscripcion) })
    }
    if (cfgRes.data) {
      const cfg = cfgRes.data as Row
      if (cfg.datos_autonomo) {
        const da = cfg.datos_autonomo as Row
        if (da.perfil !== undefined) {
          // New format: datos_autonomo contains nested stores
          useConfigStore.setState({ autonomo: da.perfil as never })
          if (Array.isArray(da.deudas) && da.deudas.length > 0) {
            useDeudaStore.setState({ deudas: da.deudas as never })
          }
          if (Array.isArray(da.presupuestos) && da.presupuestos.length > 0) {
            usePresupuestoStore.setState({ presupuestos: da.presupuestos as never })
          }
          if (Array.isArray(da.dividendos) && da.dividendos.length > 0) {
            useDividendosStore.setState({ dividendos: da.dividendos as never })
          }
          if (da.fondo_emergencia) {
            useFondoEmergenciaStore.setState(da.fondo_emergencia as never)
          }
        } else {
          // Old format: datos_autonomo was the AutonomoProfile directly
          useConfigStore.setState({ autonomo: cfg.datos_autonomo as never })
        }
      }
      if (cfg.api_keys) {
        const keys = cfg.api_keys as Row
        useConfigStore.setState({
          apiKey: (keys.apiKey as string) ?? '',
          anthropicKey: (keys.anthropicKey as string) ?? '',
          fmpKey: (keys.fmpKey as string) ?? '',
          exchangeRateKey: (keys.exchangeRateKey as string) ?? '',
        })
      }
    }

    setStatus('synced')
    setLastSync(new Date().toISOString())
    return true
  } catch (err) {
    console.error('Error loading from Supabase:', err)
    setStatus('error')
    return false
  } finally {
    setTimeout(() => { isSyncing = false }, 500)
  }
}

// ─── Save to Supabase ─────────────────────────────────────────────────────────

export async function saveAllData(userId: string): Promise<void> {
  const { setStatus, setLastSync } = useSyncStore.getState()
  setStatus('syncing')

  try {
    const { ingresos, gastos, cuentas } = useFinanzasStore.getState()
    const { posiciones } = useInversionesStore.getState()
    const { inmuebles } = useInmuebleStore.getState()
    const { facturas } = useFacturasStore.getState()
    const { clientes } = useClientesStore.getState()
    const { metas } = useMetasStore.getState()
    const { suscripciones } = useSuscripcionesStore.getState()
    const { deudas } = useDeudaStore.getState()
    const { presupuestos } = usePresupuestoStore.getState()
    const { dividendos } = useDividendosStore.getState()
    const fondo = useFondoEmergenciaStore.getState()
    const config = useConfigStore.getState()

    const movimientos = [
      ...ingresos.map(i => ingresoToRow(userId, i)),
      ...gastos.map(g => gastoToRow(userId, g)),
    ]

    await supabase.from('movimientos').delete().eq('user_id', userId)
    if (movimientos.length > 0) await supabase.from('movimientos').insert(movimientos)

    await supabase.from('cuentas').delete().eq('user_id', userId)
    if (cuentas.length > 0) await supabase.from('cuentas').insert(cuentas.map(c => cuentaToRow(userId, c)))

    await supabase.from('posiciones').delete().eq('user_id', userId)
    if (posiciones.length > 0) await supabase.from('posiciones').insert(posiciones.map(p => posicionToRow(userId, p)))

    await supabase.from('inmuebles').delete().eq('user_id', userId)
    if (inmuebles.length > 0) await supabase.from('inmuebles').insert(inmuebles.map(i => inmuebleToRow(userId, i)))

    await supabase.from('facturas').delete().eq('user_id', userId)
    if (facturas.length > 0) await supabase.from('facturas').insert(facturas.map(f => facturaToRow(userId, f)))

    await supabase.from('clientes').delete().eq('user_id', userId)
    if (clientes.length > 0) await supabase.from('clientes').insert(clientes.map(c => clienteToRow(userId, c)))

    await supabase.from('metas').delete().eq('user_id', userId)
    if (metas.length > 0) await supabase.from('metas').insert(metas.map(m => metaToRow(userId, m)))

    await supabase.from('suscripciones').delete().eq('user_id', userId)
    if (suscripciones.length > 0) await supabase.from('suscripciones').insert(suscripciones.map(s => suscripcionToRow(userId, s)))

    await supabase.from('configuracion').upsert({
      user_id: userId,
      datos_autonomo: {
        perfil: config.autonomo,
        deudas,
        presupuestos,
        dividendos,
        fondo_emergencia: {
          objetivoActual: fondo.objetivoActual,
          saldoManual: fondo.saldoManual,
          cuentaVinculadaId: fondo.cuentaVinculadaId,
          extraMensual: fondo.extraMensual,
          mesesACubrir: fondo.mesesACubrir,
          historialObjetivos: fondo.historialObjetivos,
          fechaUltimaActualizacion: fondo.fechaUltimaActualizacion,
        },
      },
      api_keys: {
        apiKey: config.apiKey,
        anthropicKey: config.anthropicKey,
        fmpKey: config.fmpKey,
        exchangeRateKey: config.exchangeRateKey,
      },
    }, { onConflict: 'user_id' })

    setStatus('synced')
    setLastSync(new Date().toISOString())
  } catch (err) {
    console.error('Error saving to Supabase:', err)
    setStatus('error')
  }
}

// ─── Debounced save ───────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(userId: string, delay = 4000) {
  if (isSyncing) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveAllData(userId), delay)
}

// ─── Setup subscriptions ──────────────────────────────────────────────────────

export function setupSyncSubscriptions(userId: string): () => void {
  const sub = () => { if (!isSyncing) debouncedSave(userId) }
  const u1 = useFinanzasStore.subscribe(sub)
  const u2 = useInversionesStore.subscribe(sub)
  const u3 = useMetasStore.subscribe(sub)
  const u4 = useSuscripcionesStore.subscribe(sub)
  const u5 = useClientesStore.subscribe(sub)
  const u6 = useFacturasStore.subscribe(sub)
  const u7 = useInmuebleStore.subscribe(sub)
  const u8 = useConfigStore.subscribe(sub)
  const u9 = useDeudaStore.subscribe(sub)
  const u10 = usePresupuestoStore.subscribe(sub)
  const u11 = useDividendosStore.subscribe(sub)
  const u12 = useFondoEmergenciaStore.subscribe(sub)

  return () => {
    u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8()
    u9(); u10(); u11(); u12()
    if (saveTimer) clearTimeout(saveTimer)
  }
}

// ─── Check if local storage has user data ────────────────────────────────────

export function hasLocalStorageData(): boolean {
  const keys = [
    'finanzas-store', 'inversiones-store', 'metas-store',
    'suscripciones-store', 'facturas-store', 'clientes-store', 'inmueble-store',
    'deuda-store', 'dividendos-store',
  ]
  return keys.some(key => {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw)
      const s = parsed?.state
      if (!s) return false
      return (
        (Array.isArray(s.ingresos) && s.ingresos.length > 2) ||
        (Array.isArray(s.gastos) && s.gastos.length > 4) ||
        (Array.isArray(s.posiciones) && s.posiciones.length > 0) ||
        (Array.isArray(s.facturas) && s.facturas.length > 0) ||
        (Array.isArray(s.metas) && s.metas.length > 3)
      )
    } catch {
      return false
    }
  })
}
