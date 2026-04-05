import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, Loader2, TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

type Tab = 'login' | 'register'

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showReset, setShowReset] = useState(false)

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register
  const [nombre, setNombre] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  // Reset
  const [resetEmail, setResetEmail] = useState('')

  function clearMessages() { setError(''); setSuccess('') }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    const { error } = await signIn(loginEmail, loginPassword)
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Email o contraseña incorrectos.')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Confirma tu email antes de iniciar sesión.')
      } else {
        setError(error.message)
      }
    }
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    if (regPassword !== regConfirm) { setError('Las contraseñas no coinciden.'); return }
    if (regPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setLoading(true)
    const { error } = await signUp(regEmail, regPassword, nombre)
    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este email ya está registrado.')
      } else {
        setError(error.message)
      }
    } else {
      setSuccess('¡Cuenta creada! Revisa tu email para confirmar tu cuenta antes de iniciar sesión.')
    }
    setLoading(false)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    const { error } = await resetPassword(resetEmail)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Email de recuperación enviado. Revisa tu bandeja de entrada.')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '11px 14px 11px 42px', color: 'var(--text)',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const iconStyle: React.CSSProperties = {
    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text2)', pointerEvents: 'none',
  }
  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '12px', background: 'var(--blue)', color: 'white',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated gradient blobs */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
          animation: 'blobDrift1 14s ease-in-out infinite alternate',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-10%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)',
          animation: 'blobDrift2 18s ease-in-out infinite alternate',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '15%',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(34,197,94,0.09) 0%, transparent 70%)',
          animation: 'blobDrift1 22s ease-in-out infinite alternate-reverse',
          borderRadius: '50%',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72,
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 0 0 8px rgba(99,102,241,0.12), 0 12px 40px rgba(59,130,246,0.45)',
          }}>
            <TrendingUp size={34} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px' }}>Mi App Financiera</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Gestiona tu patrimonio de forma inteligente</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 30,
          boxShadow: '0 8px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}>
          {showReset ? (
            /* ── Reset password ── */
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Recuperar contraseña</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
                Te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleReset}>
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <Mail size={16} style={iconStyle} />
                  <input
                    type="email" placeholder="tu@email.com" required value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)} style={inputStyle}
                  />
                </div>
                {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}
                {success && <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>{success}</div>}
                <button type="submit" style={btnPrimary} disabled={loading}>
                  {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  Enviar enlace
                </button>
              </form>
              <button
                onClick={() => { setShowReset(false); clearMessages() }}
                style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'center' }}
              >
                ← Volver al inicio de sesión
              </button>
            </>
          ) : (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 3, marginBottom: 24 }}>
                {(['login', 'register'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); clearMessages() }}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                      background: tab === t ? 'var(--blue)' : 'transparent',
                      color: tab === t ? 'white' : 'var(--text2)',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
                  </button>
                ))}
              </div>

              {/* Login form */}
              {tab === 'login' && (
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={iconStyle} />
                      <input
                        type="email" placeholder="tu@email.com" required
                        value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={iconStyle} />
                      <input
                        type={showPwd ? 'text' : 'password'} placeholder="••••••••" required
                        value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                        style={{ ...inputStyle, paddingRight: 42 }}
                      />
                      <button
                        type="button" onClick={() => setShowPwd(!showPwd)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}
                  <button type="submit" style={btnPrimary} disabled={loading}>
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReset(true); clearMessages() }}
                    style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'center' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </form>
              )}

              {/* Register form */}
              {tab === 'register' && (
                <form onSubmit={handleRegister}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Nombre</label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={iconStyle} />
                      <input
                        type="text" placeholder="Tu nombre" required
                        value={nombre} onChange={e => setNombre(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={iconStyle} />
                      <input
                        type="email" placeholder="tu@email.com" required
                        value={regEmail} onChange={e => setRegEmail(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={iconStyle} />
                      <input
                        type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" required
                        value={regPassword} onChange={e => setRegPassword(e.target.value)}
                        style={{ ...inputStyle, paddingRight: 42 }}
                      />
                      <button
                        type="button" onClick={() => setShowPwd(!showPwd)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Confirmar contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={iconStyle} />
                      <input
                        type={showPwd2 ? 'text' : 'password'} placeholder="Repite la contraseña" required
                        value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                        style={{ ...inputStyle, paddingRight: 42 }}
                      />
                      <button
                        type="button" onClick={() => setShowPwd2(!showPwd2)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}
                      >
                        {showPwd2 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}
                  {success && <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>{success}</div>}
                  <button type="submit" style={btnPrimary} disabled={loading}>
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    Crear cuenta
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Demo mode link */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a
            href="/"
            style={{
              fontSize: 13, color: 'var(--text2)',
              textDecoration: 'none', cursor: 'pointer',
              borderBottom: '1px dashed rgba(255,255,255,0.2)',
              paddingBottom: 1,
            }}
          >
            Continuar sin cuenta →
          </a>
        </div>

        {/* Feature highlights */}
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '📊', label: 'Finanzas & presupuestos' },
            { icon: '📈', label: 'Inversiones en tiempo real' },
            { icon: '🏠', label: 'Inmuebles & patrimonio' },
            { icon: '🤖', label: 'Asesor IA integrado' },
          ].map(f => (
            <div key={f.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '9px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.3 }}>{f.label}</span>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
          Tus datos están protegidos con encriptación de extremo a extremo.
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blobDrift1 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(60px, 40px) scale(1.1); }
        }
        @keyframes blobDrift2 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(-50px, -30px) scale(1.08); }
        }
      `}</style>
    </div>
  )
}
