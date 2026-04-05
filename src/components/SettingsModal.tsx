import { useState } from 'react';
import { X, Key, RefreshCw, Download, Upload, Trash2, Check, AlertCircle, Database } from 'lucide-react';
import { useConfigStore } from '../stores/useConfigStore';
import { testConnection } from '../services/alphaVantage';
import { testConnection as testExchangeRate } from '../services/exchangeRate';
import { testFMPConnection, clearFMPCache } from '../services/financialModelingPrep';
import { clearFredCache } from '../services/fred';
import { clearYfCache } from '../services/yfinance';
import { clearCnmvCache } from '../services/cnmv';
import { useMercadoStore } from '../stores/useMercadoStore';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function SettingsModal({ onClose }: Props) {
  const { apiKey, setApiKey, anthropicKey, setAnthropicKey, fmpKey, setFmpKey, exchangeRateKey, setExchangeRateKey, fredKey, setFredKey, autoRefresh, setAutoRefresh, baseCurrency, setBaseCurrency, exportData, importData, clearAllData, autonomo, setAutonomo } = useConfigStore();
  const { exchangeRates } = useMercadoStore();
  const [tmpKey, setTmpKey] = useState(apiKey);
  const [tmpAnthropicKey, setTmpAnthropicKey] = useState(anthropicKey);
  const [tmpFmpKey, setTmpFmpKey] = useState(fmpKey);
  const [tmpExchangeKey, setTmpExchangeKey] = useState(exchangeRateKey);
  const [tmpFredKey, setTmpFredKey] = useState(fredKey);
  const [settingsTab, setSettingsTab] = useState<'general' | 'apis' | 'autonomo'>('general');
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
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', padding: 4, borderRadius: 8, marginBottom: 20 }}>
          {(['general', 'apis', 'autonomo'] as const).map(t => (
            <button key={t} onClick={() => setSettingsTab(t)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: settingsTab === t ? 'var(--blue)' : 'none', color: settingsTab === t ? 'white' : 'var(--text2)' }}>
              {t === 'general' ? '⚙️ General' : t === 'apis' ? '🔑 APIs' : '🧾 Autónomo'}
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

            {/* Estado de fuentes */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Estado de fuentes de datos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { name: 'Alpha Vantage', desc: 'Precios acciones tiempo real', active: !!apiKey, key: apiKey },
                  { name: 'Financial Modeling Prep', desc: 'Fundamentales y análisis', active: !!fmpKey, key: fmpKey },
                  { name: 'ExchangeRate API', desc: 'Tipos de cambio', active: !!exchangeRateKey, key: exchangeRateKey },
                  { name: 'FRED (St. Louis Fed)', desc: 'Indicadores macroeconómicos', active: !!fredKey, key: fredKey },
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
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
