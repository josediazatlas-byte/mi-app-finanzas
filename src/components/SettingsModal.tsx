import { useState } from 'react';
import { X, Key, RefreshCw, Download, Upload, Trash2, Check, AlertCircle, Database, Cloud, CloudOff, ExternalLink, History, FileSpreadsheet, LogOut } from 'lucide-react';
import { useConfigStore } from '../stores/useConfigStore';
import { useDriveStore } from '../stores/useDriveStore';
import { testConnection } from '../services/alphaVantage';
import { testConnection as testExchangeRate } from '../services/exchangeRate';
import { testFMPConnection, clearFMPCache } from '../services/financialModelingPrep';
import { clearFredCache } from '../services/fred';
import { clearYfCache } from '../services/yfinance';
import { clearCnmvCache } from '../services/cnmv';
import {
  initGoogleAuth, requestToken, revokeToken, createBackup,
  listBackups, getToken, exportToSheets, type SheetsExportData,
} from '../services/googleDrive';
import { useMercadoStore } from '../stores/useMercadoStore';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import { useInversionesStore } from '../stores/useInversionesStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import { useFacturasStore } from '../stores/useFacturasStore';
import { useClientesStore } from '../stores/useClientesStore';
import { useHistoricoStore } from '../stores/useHistoricoStore';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function SettingsModal({ onClose }: Props) {
  const { apiKey, setApiKey, anthropicKey, setAnthropicKey, fmpKey, setFmpKey, exchangeRateKey, setExchangeRateKey, fredKey, setFredKey, metalsApiKey, setMetalsApiKey, googleClientId, setGoogleClientId, autoRefresh, setAutoRefresh, baseCurrency, setBaseCurrency, exportData, importData, clearAllData, autonomo, setAutonomo } = useConfigStore();
  const { exchangeRates } = useMercadoStore();
  const { connected, lastSync, backupHistory, setConnected, setSyncStatus, setLastSync, setBackupHistory, setSyncError, setLastBackupHash } = useDriveStore();
  const { ingresos, gastos, cuentas } = useFinanzasStore();
  const { posiciones } = useInversionesStore();
  const { inmuebles } = useInmuebleStore();
  const { deudas } = useDeudaStore();
  const { facturas } = useFacturasStore();
  const { clientes } = useClientesStore();
  const { snapshots } = useHistoricoStore();
  const { precios } = useMercadoStore();

  const [tmpKey, setTmpKey] = useState(apiKey);
  const [tmpAnthropicKey, setTmpAnthropicKey] = useState(anthropicKey);
  const [tmpFmpKey, setTmpFmpKey] = useState(fmpKey);
  const [tmpExchangeKey, setTmpExchangeKey] = useState(exchangeRateKey);
  const [tmpFredKey, setTmpFredKey] = useState(fredKey);
  const [tmpMetalsKey, setTmpMetalsKey] = useState(metalsApiKey);
  const [tmpGoogleClientId, setTmpGoogleClientId] = useState(googleClientId);
  const [settingsTab, setSettingsTab] = useState<'general' | 'apis' | 'autonomo' | 'drive'>('general');
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveBacking, setDriveBacking] = useState(false);
  const [sheetsExporting, setSheetsExporting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [testingFmp, setTestingFmp] = useState(false);
  const [fmpResult, setFmpResult] = useState<boolean | null>(null);
  const [testingExchange, setTestingExchange] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<boolean | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection(tmpKey);
    setTestResult(ok);
    setTesting(false);
    if (ok) toast.success('Conexión exitosa con Alpha Vantage');
    else toast.error('Clave incorrecta o sin conexión');
  };

  const handleSaveKey = () => {
    setApiKey(tmpKey);
    localStorage.setItem('av_api_key', tmpKey);
    toast.success('API Key guardada');
  };

  const handleTestFmp = async () => {
    setTestingFmp(true); setFmpResult(null);
    const ok = await testFMPConnection(tmpFmpKey);
    setFmpResult(ok); setTestingFmp(false);
    if (ok) toast.success('Conexión FMP exitosa'); else toast.error('Clave FMP incorrecta');
  };

  const handleSaveFmp = () => {
    setFmpKey(tmpFmpKey);
    toast.success('API Key FMP guardada');
  };

  const handleTestExchange = async () => {
    setTestingExchange(true); setExchangeResult(null);
    const ok = await testExchangeRate(tmpExchangeKey);
    setExchangeResult(ok); setTestingExchange(false);
    if (ok) toast.success('Conexión ExchangeRate exitosa'); else toast.error('Clave ExchangeRate incorrecta');
  };

  const handleSaveExchange = () => {
    setExchangeRateKey(tmpExchangeKey);
    toast.success('API Key ExchangeRate guardada');
  };

  // ── Google Drive handlers ────────────────────────────────────────────
  const handleDriveConnect = async () => {
    if (!tmpGoogleClientId.trim()) { toast.error('Introduce tu Google Client ID primero'); return; }
    setDriveConnecting(true);
    try {
      setGoogleClientId(tmpGoogleClientId.trim());
      await initGoogleAuth(tmpGoogleClientId.trim());
      await requestToken('select_account');
      setConnected(true);
      setSyncError(null);
      // Refresh backup history
      const list = await listBackups();
      setBackupHistory(list);
      toast.success('Google Drive conectado correctamente');
    } catch (e) {
      toast.error(`No se pudo conectar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setDriveConnecting(false);
    }
  };

  const handleDriveDisconnect = async () => {
    await revokeToken();
    setConnected(false);
    setSyncStatus('idle');
    setLastSync(null);
    setBackupHistory([]);
    setLastBackupHash('');
    setSyncError(null);
    toast.success('Google Drive desconectado');
  };

  const handleManualBackup = async () => {
    setDriveBacking(true);
    try {
      if (!getToken()) {
        await initGoogleAuth(googleClientId);
        await requestToken();
      }
      setSyncStatus('syncing');
      const entry = await createBackup();
      const list = await listBackups();
      setBackupHistory(list);
      setLastSync(new Date().toISOString());
      setSyncStatus('synced');
      setLastBackupHash('manual');
      toast.success(`Copia guardada (${(entry.sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : 'error');
      toast.error(`Error al guardar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setDriveBacking(false);
    }
  };

  const handleSheetsExport = async () => {
    setSheetsExporting(true);
    try {
      if (!getToken()) {
        await initGoogleAuth(googleClientId);
        await requestToken();
      }
      const year = new Date().getFullYear();
      const movimientos = [
        ...ingresos.filter(i => i.fecha.startsWith(String(year))).map(i => ({ fecha: i.fecha, tipo: 'Ingreso', categoria: i.categoria ?? '', descripcion: i.nombre ?? '', importe: i.importe })),
        ...gastos.filter(g => g.fecha.startsWith(String(year))).map(g => ({ fecha: g.fecha, tipo: 'Gasto', categoria: g.categoria ?? '', descripcion: g.nombre ?? '', importe: -g.importe })),
      ].sort((a, b) => a.fecha.localeCompare(b.fecha));

      const totalActivos = cuentas.reduce((s, c) => s + c.saldo, 0)
        + posiciones.reduce((s, p) => { const precio = precios[p.simbolo]?.precio ?? p.precioMedio; return s + precio * p.acciones; }, 0)
        + inmuebles.reduce((s, i) => s + i.valorActual, 0);
      const totalPasivos = deudas.reduce((s, d) => s + d.importePendiente, 0);

      const data: SheetsExportData = {
        patrimonio: { activos: totalActivos, pasivos: totalPasivos, neto: totalActivos - totalPasivos },
        cuentas: cuentas.map(c => ({ nombre: c.nombre, tipo: c.tipo, saldo: c.saldo, divisa: c.divisa })),
        inversiones: posiciones.map(p => {
          const precio = precios[p.simbolo]?.precio ?? p.precioMedio;
          return { simbolo: p.simbolo, valor: precio * p.acciones, pnl: (precio - p.precioMedio) * p.acciones };
        }),
        inmuebles: inmuebles.map(i => ({ nombre: i.nombre, valorActual: i.valorActual })),
        deudas: deudas.map(d => ({ nombre: d.nombre, saldo: d.importePendiente })),
        movimientos,
        posiciones: posiciones.map(p => {
          const precio = precios[p.simbolo]?.precio ?? p.precioMedio;
          const valor = precio * p.acciones;
          const pnl = (precio - p.precioMedio) * p.acciones;
          return {
            simbolo: p.simbolo, nombre: p.nombre ?? '', tipo: p.tipo ?? '',
            acciones: p.acciones, precioMedio: p.precioMedio, precioActual: precio,
            valor, pnl, pnlPct: p.precioMedio ? ((precio - p.precioMedio) / p.precioMedio) * 100 : 0,
          };
        }),
        inmueblesFull: inmuebles.map(i => ({
          nombre: i.nombre, tipo: i.tipo ?? '', superficie: i.superficie ?? 0,
          precioCompra: i.precioCompra, valorActual: i.valorActual,
          plusvalia: i.valorActual - i.precioCompra,
          yieldBruto: i.rentaMensualBruta ? (i.rentaMensualBruta * 12 / i.valorActual) * 100 : 0,
        })),
        facturas: facturas.map(f => {
          const cliente = clientes.find(c => c.id === f.clienteId);
          const concepto = f.conceptos?.[0]?.descripcion ?? '';
          return {
            numero: f.numero, fecha: f.fechaEmision, cliente: cliente?.nombreRazonSocial ?? f.clienteId,
            concepto, base: f.baseImponible, ivaPct: f.iva,
            ivaImporte: f.baseImponible * (f.iva / 100), total: f.total, estado: f.estado,
          };
        }),
        historico: snapshots.map(s => ({
          mes: s.fecha.slice(0, 7), activos: s.activos, pasivos: s.pasivos, patrimonio: s.patrimonio,
        })),
      };

      const url = await exportToSheets(data);
      toast.success('Exportado a Google Sheets');
      window.open(url, '_blank');
    } catch (e) {
      toast.error(`Error al exportar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setSheetsExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => importData(e.target?.result as string);
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ajustes</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Sub-tabs */}
        <div className="subtabs-container" style={{ display: 'flex', gap: 4, background: 'var(--bg3)', padding: 4, borderRadius: 8, marginBottom: 20 }}>
          {(['general', 'apis', 'autonomo', 'drive'] as const).map(t => (
            <button key={t} onClick={() => setSettingsTab(t)} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: settingsTab === t ? 'var(--blue)' : 'none', color: settingsTab === t ? 'white' : 'var(--text2)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {t === 'general' ? '⚙️ General' : t === 'apis' ? '🔑 APIs' : t === 'autonomo' ? '🧾 Autónomo' : '☁️ Drive'}
            </button>
          ))}
        </div>

        {settingsTab === 'apis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Financial Modeling Prep */}
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Key size={12} /> Financial Modeling Prep (fundamentales)
              </label>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>250 req/día gratuitas. Obtén tu clave en financialmodelingprep.com</div>
              <input className="input" type="password" value={tmpFmpKey} onChange={e => setTmpFmpKey(e.target.value)} placeholder="API key FMP..." />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleTestFmp} disabled={!tmpFmpKey || testingFmp}>
                  {testingFmp ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                  Probar
                </button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveFmp}><Check size={14} /> Guardar</button>
              </div>
              {fmpResult !== null && (
                <div style={{ marginTop: 6, fontSize: 12, color: fmpResult ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {fmpResult ? <Check size={12} /> : <AlertCircle size={12} />}
                  {fmpResult ? 'Conexión exitosa' : 'Clave inválida'}
                </div>
              )}
              {fmpKey && (
                <button onClick={() => { clearFMPCache(); toast.success('Caché FMP borrada'); }} style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Database size={11} /> Limpiar caché de datos fundamentales
                </button>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* ExchangeRate API */}
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Key size={12} /> ExchangeRate-API (tipos de cambio)
              </label>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>1500 req/mes gratuitas. Obtén tu clave en exchangerate-api.com</div>
              <input className="input" type="password" value={tmpExchangeKey} onChange={e => setTmpExchangeKey(e.target.value)} placeholder="API key ExchangeRate..." />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleTestExchange} disabled={!tmpExchangeKey || testingExchange}>
                  {testingExchange ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                  Probar
                </button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveExchange}><Check size={14} /> Guardar</button>
              </div>
              {exchangeResult !== null && (
                <div style={{ marginTop: 6, fontSize: 12, color: exchangeResult ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {exchangeResult ? <Check size={12} /> : <AlertCircle size={12} />}
                  {exchangeResult ? 'Conexión exitosa' : 'Clave inválida'}
                </div>
              )}
              {exchangeRates.updatedAt > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                  💱 Tipo USD/EUR: {exchangeRates.USD_EUR.toFixed(4)} · GBP/EUR: {exchangeRates.GBP_EUR.toFixed(4)}
                  {exchangeRates.source === 'api'
                    ? ` · Actualizado ${new Date(exchangeRates.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                    : ' · Tipos estimados (sin API key)'}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* FRED API */}
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Key size={12} /> FRED API (macro económica)
              </label>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Gratuita sin límite. Obtén tu clave en fred.stlouisfed.org → My Account → API Keys</div>
              <input className="input" type="password" value={tmpFredKey} onChange={e => setTmpFredKey(e.target.value)} placeholder="API key FRED..." />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setFredKey(tmpFredKey); toast.success('API Key FRED guardada'); }}>
                  <Check size={14} /> Guardar
                </button>
                {fredKey && (
                  <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { clearFredCache(); toast.success('Caché FRED borrada'); }}>
                    <Database size={14} /> Limpiar caché
                  </button>
                )}
              </div>
              {fredKey && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Clave configurada · Datos macro activos en Análisis → Macro</div>}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Metals API */}
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Key size={12} /> Metals-API (metales preciosos)
              </label>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                Plan gratuito: 50 req/mes. Obtén tu clave en <span style={{ color: 'var(--blue)' }}>metals-api.com</span>.
                Sin clave, los precios se obtienen via Yahoo Finance (futuros).
              </div>
              <input className="input" type="password" value={tmpMetalsKey} onChange={e => setTmpMetalsKey(e.target.value)} placeholder="API key Metals-API..." />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMetalsApiKey(tmpMetalsKey); toast.success('API Key Metals guardada'); }}>
                  <Check size={14} /> Guardar
                </button>
                {metalsApiKey && (
                  <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMetalsApiKey(''); setTmpMetalsKey(''); toast.success('Clave eliminada'); }}>
                    <X size={14} /> Eliminar
                  </button>
                )}
              </div>
              {metalsApiKey && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Clave configurada · Precios directos de metals-api.com</div>}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Estado de fuentes */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Estado de fuentes de datos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { name: 'Alpha Vantage', desc: 'Precios acciones tiempo real', active: !!apiKey, key: apiKey },
                  { name: 'Financial Modeling Prep', desc: 'Fundamentales y análisis', active: !!fmpKey, key: fmpKey },
                  { name: 'ExchangeRate API', desc: 'Tipos de cambio', active: !!exchangeRateKey, key: exchangeRateKey },
                  { name: 'FRED (St. Louis Fed)', desc: 'Indicadores macroeconómicos', active: !!fredKey, key: fredKey },
                  { name: 'Metals-API', desc: 'Metales preciosos spot', active: !!metalsApiKey, key: metalsApiKey || 'Yahoo Finance (fallback)' },
                  { name: 'CoinGecko', desc: 'Precios crypto (sin clave)', active: true, key: 'free' },
                  { name: 'OpenInsider', desc: 'Insider trading (sin clave)', active: true, key: 'free' },
                  { name: 'Yahoo Finance', desc: 'Histórico e índices (sin clave)', active: true, key: 'free' },
                  { name: 'CNMV', desc: 'VL fondos indexados (sin clave)', active: true, key: 'free' },
                ].map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.active ? 'var(--green)' : 'var(--text2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text2)' }}>{s.desc}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: s.active ? 'rgba(34,197,94,0.12)' : 'rgba(152,152,168,0.12)', color: s.active ? 'var(--green)' : 'var(--text2)', fontWeight: 600, flexShrink: 0 }}>
                      {s.active ? (s.key === 'free' ? 'Activo' : 'Configurado') : 'Sin configurar'}
                    </span>
                  </div>
                ))}
              </div>
              <button className="btn-secondary" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => {
                clearFredCache(); clearYfCache(); clearCnmvCache();
                toast.success('Caché de todas las fuentes borrada');
              }}>
                <Database size={12} /> Actualizar todos los datos (limpiar caché)
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'autonomo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Datos del autónomo (aparecen en las facturas PDF)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="label">Nombre completo</label><input className="input" value={autonomo.nombre} onChange={e => setAutonomo({ nombre: e.target.value })} /></div>
              <div><label className="label">NIF</label><input className="input" value={autonomo.nif} onChange={e => setAutonomo({ nif: e.target.value })} /></div>
            </div>
            <div><label className="label">Dirección fiscal</label><input className="input" value={autonomo.direccion} onChange={e => setAutonomo({ direccion: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="label">Email</label><input className="input" type="email" value={autonomo.email} onChange={e => setAutonomo({ email: e.target.value })} /></div>
              <div><label className="label">Teléfono</label><input className="input" value={autonomo.telefono} onChange={e => setAutonomo({ telefono: e.target.value })} /></div>
            </div>
            <div><label className="label">IBAN</label><input className="input" value={autonomo.iban} onChange={e => setAutonomo({ iban: e.target.value })} placeholder="ES00 0000 0000 00 0000000000" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label className="label">IVA default (%)</label><input className="input" type="number" value={autonomo.ivaDefault} onChange={e => setAutonomo({ ivaDefault: +e.target.value })} /></div>
              <div><label className="label">Retención default (%)</label><input className="input" type="number" value={autonomo.retencionDefault} onChange={e => setAutonomo({ retencionDefault: +e.target.value })} /></div>
              <div><label className="label">Serie facturación</label><input className="input" value={autonomo.serieFacturacion} onChange={e => setAutonomo({ serieFacturacion: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 4 }}>
              <label className="label">API Key Anthropic (para OCR de tickets)</label>
              <input className="input" type="password" value={tmpAnthropicKey} onChange={e => setTmpAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
              <button className="btn-primary" style={{ marginTop: 8, padding: '6px 16px', fontSize: 12 }} onClick={() => { setAnthropicKey(tmpAnthropicKey); toast.success('API key Anthropic guardada'); }}>
                Guardar clave Anthropic
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* API Key */}
        <div style={{ marginBottom: 20 }}>
          <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={12} /> API Key Alpha Vantage
          </label>
          <input
            className="input"
            type="password"
            value={tmpKey}
            onChange={(e) => setTmpKey(e.target.value)}
            placeholder="Introduce tu API key..."
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleTest} disabled={!tmpKey || testing}>
              {testing ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              {testing ? 'Probando...' : 'Probar conexión'}
            </button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveKey}>
              <Check size={14} /> Guardar
            </button>
          </div>
          {testResult !== null && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: testResult ? 'var(--green)' : 'var(--red)' }}>
              {testResult ? <Check size={14} /> : <AlertCircle size={14} />}
              {testResult ? 'Conexión exitosa' : 'Clave inválida o sin cuota disponible'}
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
            Obtén tu clave gratuita en alphavantage.co (25 peticiones/día en plan gratuito)
          </p>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        {/* Auto refresh */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Actualización automática</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Actualizar precios cada 60 segundos</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Currency */}
        <div style={{ marginBottom: 20 }}>
          <label className="label">Divisa base</label>
          <select className="select" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value as 'EUR' | 'USD' | 'GBP')}>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dólar US</option>
            <option value="GBP">GBP — Libra esterlina</option>
          </select>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        {/* Anthropic / IA */}
        <div style={{ marginBottom: 20 }}>
          <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>🤖</span> API Key Anthropic (IA)
          </label>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>
            Activa el asesor financiero IA, insights automáticos, análisis de cartera y categorización de gastos. Modelo: claude-haiku-4-5-20251001.
            Obtén tu clave en <strong>console.anthropic.com</strong>.
          </div>
          <input
            className="input"
            type="password"
            value={tmpAnthropicKey}
            onChange={e => setTmpAnthropicKey(e.target.value)}
            placeholder="sk-ant-api03-..."
          />
          <button
            className="btn-primary"
            style={{ marginTop: 8, width: '100%', justifyContent: 'center', background: 'rgba(139,92,246,0.85)' }}
            onClick={() => { setAnthropicKey(tmpAnthropicKey); toast.success('API Key Anthropic guardada'); }}
          >
            <Check size={14} /> Guardar clave Anthropic
          </button>
          {anthropicKey && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> IA activa · Insights, asesor y categorización disponibles
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        {/* Data management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-secondary" onClick={exportData} style={{ justifyContent: 'center' }}>
            <Download size={14} /> Exportar datos JSON
          </button>
          <button className="btn-secondary" onClick={handleImport} style={{ justifyContent: 'center' }}>
            <Upload size={14} /> Importar datos JSON
          </button>
          {!confirmClear ? (
            <button
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={14} /> Borrar todos los datos
            </button>
          ) : (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>¿Seguro? Esta acción no se puede deshacer.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmClear(false)}>Cancelar</button>
                <button style={{ flex: 1, background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={clearAllData}>
                  <Trash2 size={14} /> Borrar todo
                </button>
              </div>
            </div>
          )}
        </div>

        </div>
        )}
        {settingsTab === 'drive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Status header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: connected ? 'rgba(34,197,94,0.08)' : 'var(--bg3)', border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(66,133,244,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {connected ? <Cloud size={20} color="#4285f4" /> : <CloudOff size={20} color="var(--text2)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{connected ? 'Google Drive conectado' : 'Google Drive no conectado'}</div>
                {connected && lastSync && <div style={{ fontSize: 12, color: 'var(--text2)' }}>Última copia: {new Date(lastSync).toLocaleString('es-ES')}</div>}
                {!connected && <div style={{ fontSize: 12, color: 'var(--text2)' }}>Backup automático desactivado</div>}
              </div>
              {connected && (
                <button onClick={handleDriveDisconnect} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <LogOut size={12} /> Desconectar
                </button>
              )}
            </div>

            {/* Client ID config */}
            {!connected && (
              <div>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Key size={12} /> Google OAuth2 Client ID
                </label>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>
                  Crea un proyecto en <strong>console.cloud.google.com</strong>, activa Drive API + Sheets API, crea credenciales OAuth2 (Web) y añade tu dominio como origen autorizado.
                </div>
                <input
                  className="input"
                  value={tmpGoogleClientId}
                  onChange={e => setTmpGoogleClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                />
                <button
                  className="btn-primary"
                  style={{ marginTop: 10, width: '100%', justifyContent: 'center', background: '#4285f4' }}
                  onClick={handleDriveConnect}
                  disabled={driveConnecting || !tmpGoogleClientId.trim()}
                >
                  {driveConnecting
                    ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Conectando...</>
                    : <><Cloud size={14} /> Conectar con Google Drive</>
                  }
                </button>
              </div>
            )}

            {/* Connected actions */}
            {connected && (
              <>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={handleManualBackup}
                    disabled={driveBacking}
                  >
                    {driveBacking
                      ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                      : <><Cloud size={14} /> Guardar ahora</>
                    }
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                    onClick={handleSheetsExport}
                    disabled={sheetsExporting}
                  >
                    {sheetsExporting
                      ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Exportando...</>
                      : <><FileSpreadsheet size={14} /> Google Sheets</>
                    }
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={11} />
                  Auto-backup cada 5 min si hay cambios · Se conservan las últimas 10 copias
                </div>

                {/* Backup history */}
                {backupHistory.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <History size={13} color="var(--text2)" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Historial de copias ({backupHistory.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {backupHistory.map((b, i) => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--green)' : 'var(--text2)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: i === 0 ? 600 : 400 }}>
                              {new Date(b.modifiedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {i === 0 && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>ÚLTIMA</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text2)', flexShrink: 0 }}>
                            {b.sizeBytes < 1024 ? `${b.sizeBytes} B` : `${(b.sizeBytes / 1024).toFixed(1)} KB`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sheets info */}
                <div style={{ background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.25)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileSpreadsheet size={14} color="#34a853" /> Google Sheets — 6 pestañas
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                    Resumen patrimonio · Movimientos del año · Cartera inversiones · Inmuebles · Facturas emitidas · Histórico patrimonio mensual
                  </div>
                  <button className="btn-secondary" style={{ marginTop: 10, fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => window.open('https://sheets.google.com', '_blank')}>
                    <ExternalLink size={12} /> Abrir Google Sheets
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
