import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, Loader2, TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

type Tab = 'login' | 'register'

interface FieldErrors {
  nombre?: string
  email?: string
  password?: string
  confirm?: string
}

const RATE_LIMIT_KEY = 'login_attempts'
const MAX_ATTEMPTS = 5
const BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

interface LoginAttempts {
  count: number
  firstAttemptTs: number
  blockedUntil?: number
}

function getLoginAttempts(): LoginAttempts {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY)
    if (!raw) return { count: 0, firstAttemptTs: Date.now() }
    return JSON.parse(raw) as LoginAttempts
  } catch {
    return { count: 0, firstAttemptTs: Date.now() }
  }
}

function recordFailedAttempt(): LoginAttempts {
  const current = getLoginAttempts()
  const now = Date.now()
  // Reset window if more than 15 min since first attempt
  if (now - current.firstAttemptTs > BLOCK_DURATION_MS) {
    const fresh = { count: 1, firstAttemptTs: now }
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(fresh))
    return fresh
  }
  const updated: LoginAttempts = {
    count: current.count + 1,
    firstAttemptTs: current.firstAttemptTs,
  }
  if (updated.count >= MAX_ATTEMPTS) {
    updated.blockedUntil = now + BLOCK_DURATION_MS
  }
  sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(updated))
  return updated
}

function clearLoginAttempts() {
  sessionStorage.removeItem(RATE_LIMIT_KEY)
}

function isRateLimited(): { limited: boolean; minutesLeft?: number } {
  const attempts = getLoginAttempts()
  if (attempts.blockedUntil && Date.now() < attempts.blockedUntil) {
    const minutesLeft = Math.ceil((attempts.blockedUntil - Date.now()) / 60000)
    return { limited: true, minutesLeft }
  }
  return { limited: false }
}

export default function Auth() {
  const { signIn, signUp, resetPassword, resendConfirmation } = useAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

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

  function clearMessages() {
    setError('')
    setSuccess('')
    setFieldErrors({})
    setEmailNotConfirmed(false)
    setResendDone(false)
  }

  function validateRegister(): boolean {
    const errors: FieldErrors = {}

    if (!nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio.'
    }

    if (!regEmail.trim()) {
      errors.email = 'El email es obligatorio.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      errors.email = 'Introduce un email con formato válido.'
    }

    if (!regPassword) {
      errors.password = 'La contraseña es obligatoria.'
    } else if (regPassword.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres.'
    }

    if (!regConfirm) {
      errors.confirm = 'Debes confirmar la contraseña.'
    } else if (regPassword !== regConfirm) {
      errors.confirm = 'Las contraseñas no coinciden.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()

    // Check rate limit before attempting login
    const rateCheck = isRateLimited()
    if (rateCheck.limited) {
      setError(`Demasiados intentos fallidos. Espera ${rateCheck.minutesLeft} minuto${rateCheck.minutesLeft !== 1 ? 's' : ''} antes de intentarlo de nuevo.`)
      return
    }

    setLoading(true)
    const { error: err } = await signIn(loginEmail, loginPassword)
    if (err) {
      if (err.message.includes('Invalid login credentials')) {
        const attempts = recordFailedAttempt()
        const remaining = MAX_ATTEMPTS - attempts.count
        if (attempts.blockedUntil) {
          setError(`Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.`)
        } else {
          setError(`Email o contraseña incorrectos.${remaining > 0 ? ` Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.` : ''}`)
        }
      } else if (err.message.includes('Email not confirmed') || err.message.includes('email not confirmed')) {
        setEmailNotConfirmed(true)
        setError('Tu email aún no está confirmado. Revisa tu bandeja de entrada (y la carpeta de spam).')
      } else {
        setError('Error al iniciar sesión. Inténtalo de nuevo.')
      }
    } else {
      clearLoginAttempts()
    }
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    if (!validateRegister()) return
    setLoading(true)
    const { error: err } = await signUp(regEmail, regPassword, nombre)
    if (err) {
      if (err.message.includes('already registered') || err.message.includes('User already registered')) {
        setFieldErrors({ email: 'Este email ya está registrado.' })
      } else if (err.message.includes('invalid') && err.message.toLowerCase().includes('email')) {
        setFieldErrors({ email: 'El formato del email no es válido.' })
      } else {
        setError('Error al crear la cuenta. Inténtalo de nuevo.')
      }
    } else {
      setSuccess('¡Cuenta creada! Te hemos enviado un email de confirmación. Revisa tu bandeja de entrada antes de iniciar sesión.')
    }
    setLoading(false)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    const { error: err } = await resetPassword(resetEmail)
    if (err) {
      setError('No se pudo enviar el email de recuperación. Comprueba la dirección e inténtalo de nuevo.')
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
  const inputErrorStyle: React.CSSProperties = {
    ...inputStyle,
    border: '1px solid var(--red)',
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
  const fieldErrorStyle: React.CSSProperties = {
    color: 'var(--red)', fontSize: 12, marginTop: 4, display: 'block',
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
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px' }}>In-Control</h1>
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
                  {error && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, lineHeight: 1.5 }}>
                        {error}
                      </div>
                      {emailNotConfirmed && (
                        <div style={{ marginTop: 8 }}>
                          {resendDone ? (
                            <div style={{ fontSize: 12, color: 'var(--green)', padding: '6px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>
                              ✓ Email de confirmación reenviado. Revisa tu bandeja.
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={resendLoading}
                              onClick={async () => {
                                setResendLoading(true);
                                await resendConfirmation(loginEmail);
                                setResendLoading(false);
                                setResendDone(true);
                              }}
                              style={{ fontSize: 12, color: 'var(--blue)', background: 'none', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '6px 12px', cursor: resendLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: resendLoading ? 0.6 : 1 }}
                            >
                              {resendLoading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                              Reenviar email de confirmación
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <button type="submit" style={btnPrimary} disabled={loading}>
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {loading ? 'Entrando...' : 'Entrar'}
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
                <form onSubmit={handleRegister} noValidate>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Nombre</label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={iconStyle} />
                      <input
                        type="text" placeholder="Tu nombre"
                        value={nombre} onChange={e => { setNombre(e.target.value); setFieldErrors(fe => ({ ...fe, nombre: undefined })) }}
                        style={fieldErrors.nombre ? inputErrorStyle : inputStyle}
                      />
                    </div>
                    {fieldErrors.nombre && <span style={fieldErrorStyle}>{fieldErrors.nombre}</span>}
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={iconStyle} />
                      <input
                        type="email" placeholder="tu@email.com"
                        value={regEmail} onChange={e => { setRegEmail(e.target.value); setFieldErrors(fe => ({ ...fe, email: undefined })) }}
                        style={fieldErrors.email ? inputErrorStyle : inputStyle}
                      />
                    </div>
                    {fieldErrors.email && <span style={fieldErrorStyle}>{fieldErrors.email}</span>}
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={iconStyle} />
                      <input
                        type={showPwd ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                        value={regPassword} onChange={e => {
                          const v = e.target.value;
                          setRegPassword(v);
                          setFieldErrors(fe => ({
                            ...fe,
                            password: v && v.length < 8 ? 'La contraseña debe tener al menos 8 caracteres.' : undefined,
                            confirm: regConfirm && v !== regConfirm ? 'Las contraseñas no coinciden.' : undefined,
                          }));
                        }}
                        style={{ ...(fieldErrors.password ? inputErrorStyle : inputStyle), paddingRight: 42 }}
                      />
                      <button
                        type="button" onClick={() => setShowPwd(!showPwd)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.password && <span style={fieldErrorStyle}>{fieldErrors.password}</span>}
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Confirmar contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={iconStyle} />
                      <input
                        type={showPwd2 ? 'text' : 'password'} placeholder="Repite la contraseña"
                        value={regConfirm} onChange={e => {
                          const v = e.target.value;
                          setRegConfirm(v);
                          setFieldErrors(fe => ({
                            ...fe,
                            confirm: v && regPassword !== v ? 'Las contraseñas no coinciden.' : undefined,
                          }));
                        }}
                        style={{ ...(fieldErrors.confirm ? inputErrorStyle : inputStyle), paddingRight: 42 }}
                      />
                      <button
                        type="button" onClick={() => setShowPwd2(!showPwd2)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}
                      >
                        {showPwd2 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.confirm && <span style={fieldErrorStyle}>{fieldErrors.confirm}</span>}
                  </div>
                  {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}
                  {success && <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 8 }}>{success}</div>}
                  <button type="submit" style={btnPrimary} disabled={loading}>
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {loading ? 'Creando cuenta...' : 'Crear cuenta'}
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
