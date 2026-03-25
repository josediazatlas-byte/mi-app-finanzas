import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Trash2, RefreshCw } from 'lucide-react';
import { useChatStore } from '../stores/useChatStore';
import { useConfigStore } from '../stores/useConfigStore';
import { buildFinancialContext, SYSTEM_PROMPT, callClaudeAPI } from '../utils/aiContext';

const QUICK_QUESTIONS = [
  '¿Cómo está mi situación financiera este mes?',
  '¿En qué categorías debería reducir gastos?',
  '¿Está bien diversificada mi cartera?',
  '¿Cuándo podré alcanzar mis metas financieras?',
  '¿Cuál es mi tasa de ahorro y es suficiente?',
  '¿Qué riesgos veo en mi cartera actual?',
];

interface Props { onClose: () => void; }

export default function ChatIA({ onClose }: Props) {
  const { messages, addMessage, clearHistory } = useChatStore();
  const { anthropicKey } = useConfigStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!anthropicKey) {
      addMessage({ role: 'assistant', content: '⚠️ Para usar el asistente IA, añade tu API key de Anthropic en Ajustes → pestaña Autónomo.', timestamp: new Date().toISOString() });
      return;
    }

    const userMsg = { role: 'user' as const, content: trimmed, timestamp: new Date().toISOString() };
    addMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const ctx = buildFinancialContext();
      const systemWithCtx = `${SYSTEM_PROMPT}\n\nCONTEXTO FINANCIERO DEL USUARIO (datos en tiempo real):\n${ctx}`;
      const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await callClaudeAPI(apiMessages, systemWithCtx, anthropicKey);
      addMessage({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      addMessage({ role: 'assistant', content: `❌ Error al contactar con la IA: ${msg}`, timestamp: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
      background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 200,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={17} style={{ color: '#a78bfa' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Asesor Financiero IA</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Powered by Claude · Datos en tiempo real</div>
        </div>
        <button className="btn-icon" title="Borrar historial" onClick={() => { if (confirm('¿Borrar todo el historial?')) clearHistory(); }}>
          <Trash2 size={14} />
        </button>
        <button className="btn-icon" onClick={onClose}><X size={16} /></button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={28} style={{ color: '#a78bfa' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Tu asesor financiero personal</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 300 }}>
                Tengo acceso completo a tus datos financieros actualizados y puedo darte consejos personalizados.
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2, fontWeight: 600 }}>PREGUNTAS FRECUENTES</div>
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontSize: 13, lineHeight: 1.4, transition: 'border-color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Bot size={13} style={{ color: '#a78bfa' }} />
              </div>
            )}
            <div style={{
              maxWidth: '82%',
              background: m.role === 'user' ? 'var(--blue)' : 'var(--bg3)',
              color: m.role === 'user' ? 'white' : 'var(--text)',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.content}
              <div style={{ fontSize: 10, opacity: .5, marginTop: 4 }}>
                {new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={13} style={{ color: '#a78bfa' }} />
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text2)' }} />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Analizando tus finanzas...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {!anthropicKey && (
          <div style={{ fontSize: 12, color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, lineHeight: 1.4 }}>
            ⚠️ Añade tu API key de Anthropic en Ajustes → Autónomo para activar el asistente
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Pregunta sobre tus finanzas..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            disabled={loading}
          />
          <button
            className="btn-primary"
            style={{ flexShrink: 0, padding: '0 14px', minWidth: 42 }}
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
