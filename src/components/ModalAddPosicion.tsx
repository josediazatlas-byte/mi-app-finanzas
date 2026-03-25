import { useState } from 'react';
import { X, Search, Loader } from 'lucide-react';
import { useInversionesStore } from '../stores/useInversionesStore';
import type { Posicion } from '../stores/useInversionesStore';
import { searchSymbol } from '../services/alphaVantage';
import { cgSearchCoin, CRYPTO_SYMBOL_TO_ID } from '../services/coinGecko';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function ModalAddPosicion({ onClose }: Props) {
  const { addPosicion } = useInversionesStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Array<{ symbol: string; name: string; type: string; thumb?: string; coinId?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState<Omit<Posicion, 'id'>>({
    simbolo: '',
    nombre: '',
    tipo: 'Empresa',
    acciones: 1,
    precioMedio: 0,
    divisa: 'USD',
    notas: '',
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      if (form.tipo === 'Crypto') {
        // CoinGecko search for crypto
        const coins = await cgSearchCoin(searchTerm);
        setResults(coins.map(c => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          type: 'Crypto',
          thumb: c.thumb,
          coinId: c.id,
        })));
      } else {
        const res = await searchSymbol(searchTerm);
        setResults(res);
      }
    } catch {
      toast.error('Error al buscar. Inténtalo de nuevo.');
    }
    setSearching(false);
  };

  const selectResult = (r: { symbol: string; name: string; type: string; coinId?: string }) => {
    const tipo: Posicion['tipo'] =
      r.type === 'ETF' ? 'ETF' :
      r.type === 'Crypto' ? 'Crypto' :
      r.symbol.match(/^(GLD|SLV|USO|PDBC)$/) ? 'Materia Prima' : 'Empresa';
    // For crypto, store the coinGecko id in notas if not in our known map
    const isMapped = r.symbol.toUpperCase() in CRYPTO_SYMBOL_TO_ID;
    const extraNotas = (tipo === 'Crypto' && r.coinId && !isMapped) ? `coinId:${r.coinId}` : '';
    setForm({ ...form, simbolo: r.symbol.toUpperCase(), nombre: r.name, tipo, notas: extraNotas });
    setResults([]);
    setSearchTerm('');
  };

  const handleSubmit = () => {
    if (!form.simbolo || !form.nombre || form.precioMedio <= 0) { toast.error('Completa todos los campos'); return; }
    addPosicion(form);
    toast.success('Posición añadida');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Añadir Posición</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Tipo</label>
            <select className="select" value={form.tipo} onChange={(e) => { setForm({ ...form, tipo: e.target.value as Posicion['tipo'], simbolo: '', nombre: '' }); setResults([]); }}>
              {['Empresa', 'ETF', 'Materia Prima', 'Crypto'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="label">
              {form.tipo === 'Crypto' ? 'Buscar criptomoneda (CoinGecko)' : 'Buscar ticker / empresa (Alpha Vantage)'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={form.tipo === 'Crypto' ? 'Ej: bitcoin, ethereum, solana...' : 'Ej: MSFT, Apple...'}
              />
              <button className="btn-icon" onClick={handleSearch} style={{ flexShrink: 0 }}>
                {searching ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              </button>
            </div>
            {results.length > 0 && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                {results.map((r) => (
                  <button key={r.symbol + (r.coinId ?? '')} onClick={() => selectResult(r)}
                    style={{ width: '100%', background: 'none', border: 'none', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                    {r.thumb && <img src={r.thumb} alt="" style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0 }} />}
                    <span style={{ fontWeight: 600, marginRight: 4 }}>{r.symbol}</span>
                    <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{r.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {form.simbolo && (
            <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
              Seleccionado: <strong>{form.simbolo}</strong> — {form.nombre}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nº de {form.tipo === 'Crypto' ? 'unidades' : 'acciones'}</label>
              <input className="input" type="number" min="0" step="0.00001" value={form.acciones || ''} onChange={(e) => setForm({ ...form, acciones: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Precio medio</label>
              <input className="input" type="number" min="0" step="0.01" value={form.precioMedio || ''} onChange={(e) => setForm({ ...form, precioMedio: parseFloat(e.target.value) || 0 })} placeholder={form.divisa} />
            </div>
          </div>

          <div>
            <label className="label">Divisa</label>
            <select className="select" value={form.divisa} onChange={(e) => setForm({ ...form, divisa: e.target.value as 'USD' | 'EUR' | 'GBP' })}>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Libra</option>
            </select>
          </div>

          <div>
            <label className="label">Notas (opcional)</label>
            <input className="input" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Notas sobre esta posición..." />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit}>Añadir posición</button>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
