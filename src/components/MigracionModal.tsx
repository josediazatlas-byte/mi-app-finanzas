import { useState } from 'react'
import { CloudUpload, Database, Loader2, X } from 'lucide-react'
import { saveAllData } from '../hooks/useSupabaseSync'

interface Props {
  userId: string
  onClose: () => void
}

export default function MigracionModal({ userId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleMigrar = async () => {
    setLoading(true)
    await saveAllData(userId)
    // Store migration flag without exposing the raw UID as a value
    localStorage.setItem(`app-migrated-${userId.slice(-8)}`, 'done')
    setDone(true)
    setLoading(false)
    setTimeout(onClose, 1500)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, background: 'rgba(59,130,246,0.15)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Database size={24} color="var(--blue)" />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}>
            <X size={18} />
          </button>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          Datos locales encontrados
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
          Hemos detectado datos financieros guardados localmente en este dispositivo.
          ¿Quieres importarlos a tu cuenta en la nube para acceder desde cualquier lugar?
        </p>

        <div style={{
          background: 'var(--bg)', borderRadius: 10, padding: '12px 16px',
          marginBottom: 24, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6,
        }}>
          <div>✓ Movimientos, cuentas e inversiones</div>
          <div>✓ Facturas, clientes y suscripciones</div>
          <div>✓ Metas, inmuebles y configuración</div>
        </div>

        {done ? (
          <div style={{
            textAlign: 'center', padding: '16px',
            color: 'var(--green)', fontWeight: 600, fontSize: 15,
          }}>
            ✓ Datos importados correctamente
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '11px', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text)', fontSize: 14, cursor: 'pointer', fontWeight: 500,
              }}
            >
              Ahora no
            </button>
            <button
              onClick={handleMigrar}
              disabled={loading}
              style={{
                flex: 1, padding: '11px', background: 'var(--blue)', border: 'none',
                borderRadius: 10, color: 'white', fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Importando...</>
                : <><CloudUpload size={15} /> Importar a la nube</>
              }
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
