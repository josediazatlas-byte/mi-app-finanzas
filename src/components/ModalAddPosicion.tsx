import { useState, useEffect } from 'react';
import { X, Search, Loader } from 'lucide-react';
import { useInversionesStore } from '../stores/useInversionesStore';
import type { Posicion } from '../stores/useInversionesStore';
import { searchSymbol, getQuote } from '../services/alphaVantage';
import { cgSearchCoin, cgGetPrices, CRYPTO_SYMBOL_TO_ID, symbolToId } from '../services/coinGecko';
import { fmtEur, toEur } from '../utils/format';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function ModalAddPosicion({ onClose }: Props) {
  const { addPosicion } = useInversionesStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Array<{ symbol: string; name: string; type: string; thumb?: string; coinId?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState<Omit<Posicion, 'id'>>({
    simbolo: '', nombre: '', tipo: 'Empresa', acciones: 1, precioMedio: 0, divisa: 'USD', notas: '',
  });
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketPriceEur, setMarketPriceEur] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceTimestamp, setPriceTimestamp] = useState<Date | null>(null);
  const [, forceTickUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTickUpdate(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const minutesAgoStr = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (mins < 1) return 'ahora mismo';
    if (mins === 1) return 'hace 1 min';
    return `hace ${mins} min`;
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      if (form.tipo === 'Crypto') {
        const coins = await cgSearchCoin(searchTerm);
        setResults(coins.map(c => ({ symbol: c.symbol.toUpperCase(), name: c.name, type: 'Crypto', thumb: c.thumb, coinId: c.id })));
      } else {
        const res = await searchSymbol(searchTerm);
        setResults(res);
      }
    } catch {
      toast.error('Error al buscar. Inténtalo de nuevo.');
    }
    setSearching(false);
  };

  const fetchMarketPrice = async (symbol: string, tipo: Posicion['tipo'], coinId?: string) => {
    setPriceLoading(true);
    try {
      if (tipo === 'Crypto') {
        const id = coinId ?? symbolToId(symbol);
        const prices = await cgGetPrices([id]);
        const data = prices[id];
        if (data) {
          const priceUsd = data.usd ?? data.eur / 0.92;
          setMarketPrice(priceUsd);
          setMarketPriceEur(data.eur);
          setForm(f => ({ ...f, precioMedio: priceUsd }));
          setPriceTimestamp(new Date());
        }
      } else {
        const q = await getQuote(symbol);
        if (q && q.price > 0) {
          setMarketPrice(q.price);
          setMarketPriceEur(toEur(q.price, 'USD'));
          setForm(f => ({ ...f, precioMedio: q.price }));
          setPriceTimestamp(new Date());
        }
      }
    } catch { /* keep form empty */ }
    setPriceLoading(false);
  };

  const selectResult = async (r: { symbol: string; name: string; type: string; coinId?: string }) => {
    const tipo: Posicion['tipo'] =
      r.type === 'ETF' ? 'ETF' :
      r.type === 'Crypto' ? 'Crypto' :
      r.symbol.match(/^(GLD|SLV|USO|PDBC)$/) ? 'Materia Prima' : 'Empresa';
    const isMapped = r.symbol.toUpperCase() in CRYPTO_SYMBOL_TO_ID;
    const extraNotas = (tipo === 'Crypto' && r.coinId && !isMapped) ? `coinId:${r.coinId}` : '';
    setForm(f => ({ ...f, simbolo: r.symbol.toUpperCase(), nombre: r.name, tipo, notas: extraNotas }));
    setResults([]);
    setSearchTerm('');
    setMarketPrice(null);
    setMarketPriceEur(null);
    setPriceTimestamp(null);
    await fetchMarketPrice(r.symbol.toUpperCase(), tipo, r.coinId);
  };

  const handleSubmit = () => {
    if (!form.simbolo || !form.nombre || form.precioMedio <= 0) { toast.error('Completa todos los campos'); return; }
    addPosicion(form);
    toast.success('Posición añadida');
    onClose();
  };

  // PnL summary calculations
  const totalInvertidoEur = form.acciones > 0 && form.precioMedio > 0
    ? toEur(form.acciones * form.precioMedio, form.divisa) : null;
  const valorActualEur = form.acciones > 0 && marketPrice !== null
    ? toEur(form.acciones * marketPrice, form.divisa) : null;
  const pnlEur = totalInvertidoEur !== null && valorActualEur !== null
    ? valorActualEur - totalInvertidoEur : null;
  const pnlPct = pnlEur !== null && totalInvertidoEur !== null && totalInvertidoEur > 0
    ? (pnlEur / totalInvertidoEur) * 100 : null;

  const marketPriceDisplay = marketPrice !== null
    ? `$${marketPrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

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
            <select className="select" value={form.tipo} onChange={(e) => {
              setForm({ ...form, tipo: e.target.value as Posicion['tipo'], simbolo: '', nombre: '' });
              setResults([]);
              setMarketPrice(null);
              setMarketPriceEur(null);
              setPriceTimestamp(null);
            }}>
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
              <label className="label">Precio de compra por unidad</label>
              <div style={{ position: 'relative' }}>
                {priceLoading && (
                  <Loader size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite', color: 'var(--text2)' }} />
                )}
                <input
                  className="input"
                  type="number" min="0" step="0.01"
                  value={form.precioMedio || ''}
                  onChange={(e) => setForm({ ...form, precioMedio: parseFloat(e.target.value) || 0 })}
                  placeholder={form.divisa}
                  style={{ paddingRight: priceLoading ? 30 : undefined }}
                />
              </div>
              {/* Market price info */}
              {marketPriceDisplay && priceTimestamp && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span>
                    Precio de mercado: <strong style={{ color: 'var(--text)' }}>{marketPriceDisplay}</strong>
                    {form.tipo === 'Crypto' && marketPriceEur !== null && (
                      <span style={{ color: 'var(--text2)' }}> / {fmtEur(marketPriceEur)}</span>
                    )}
                    {' '}· {minutesAgoStr(priceTimestamp)}
                  </span>
                  <button
                    style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
                    onClick={() => setForm(f => ({ ...f, precioMedio: marketPrice! }))}>
                    Usar precio actual
                  </button>
                </div>
              )}
              {/* Helper text */}
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>
                Introduce el precio al que compraste. Si compraste en varias ocasiones, introduce el precio medio de compra.
              </div>
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

          {/* PnL summary */}
          {totalInvertidoEur !== null && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Total invertido</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtEur(totalInvertidoEur)}</div>
              </div>
              {valorActualEur !== null && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Valor actual</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtEur(valorActualEur)}</div>
                </div>
              )}
              {pnlEur !== null && pnlPct !== null && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>P&L</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: pnlEur >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {pnlEur >= 0 ? '+' : ''}{fmtEur(pnlEur)}
                    <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>
                      ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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
