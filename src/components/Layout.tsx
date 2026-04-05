import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Home, TrendingUp, Wrench, Settings, X, Bell, FileDown, FileText, MessageSquare, LogOut, Cloud, CloudOff, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import InstallBanner from './InstallBanner';
import OfflineBanner from './OfflineBanner';
import DriveRestoreModal from './DriveRestoreModal';
import {
  requestNotificationPermission,
  initNotifications,
  checkSuscripcionesAlert,
  checkPortfolioDropAlert,
} from '../services/notifications';
import {
  initGoogleAuth, createBackup, listBackups,
  computeLocalHash, isLocalDataEmpty, getToken,
  type BackupEntry,
} from '../services/googleDrive';
import { useDriveStore } from '../stores/useDriveStore';
import { useAuth } from '../hooks/useAuth';
import { useSyncStore } from '../hooks/useSupabaseSync';
import { useConfigStore } from '../stores/useConfigStore';
import { useAlertasStore } from '../stores/useAlertasStore';
import { useFinanzasStore } from '../stores/useFinanzasStore';
import { useDeudaStore } from '../stores/useDeudaStore';
import { usePresupuestoStore } from '../stores/usePresupuestoStore';
import { useInversionesStore } from '../stores/useInversionesStore';
import { useMercadoStore } from '../stores/useMercadoStore';
import { useInmuebleStore } from '../stores/useInmuebleStore';
import { useSuscripcionesStore } from '../stores/useSuscripcionesStore';
import { MOCK_TICKERS } from '../services/alphaVantage';
import { getAllRates } from '../services/exchangeRate';
import { toEur } from '../utils/format';
import SettingsModal from './SettingsModal';
import TickerBar from './TickerBar';
import ChatIA from './ChatIA';

const nav = [
  { to: '/', label: 'Inicio', icon: Home, exact: true },
  { to: '/finanzas', label: 'Finanzas', icon: BarChart3 },
  { to: '/inversiones', label: 'Inversiones', icon: TrendingUp },
  { to: '/analisis', label: 'Análisis', icon: BarChart3 },
  { to: '/herramientas', label: 'Herramientas', icon: Wrench },
  { to: '/documentos', label: 'Documentos', icon: FileText },
];

export default function Layout() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAlertas, setShowAlertas] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInitQuestion, setChatInitQuestion] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [driveRestoreBackups, setDriveRestoreBackups] = useState<BackupEntry[] | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const alertasPanelRef = useRef<HTMLDivElement>(null);
  const { apiKey, exchangeRateKey, privacyMode, setPrivacyMode, googleClientId } = useConfigStore();
  const {
    connected: driveConnected, syncStatus: driveSyncStatus,
    setLastSync: setDriveLastSync, setSyncStatus: setDriveSyncStatus,
    setBackupHistory, lastBackupHash, setLastBackupHash, setSyncError,
  } = useDriveStore();
  const { setExchangeRates } = useMercadoStore();
  const isDemo = !apiKey;
  const { user, signOut } = useAuth();
  const { status: syncStatus, lastSync } = useSyncStore();
  const { alertas, addAlerta, marcarLeida, marcarTodasLeidas, removeAlerta } = useAlertasStore();
  const { ingresos, gastos, cuentas } = useFinanzasStore();
  const { deudas } = useDeudaStore();
  const { presupuestos } = usePresupuestoStore();
  const { posiciones } = useInversionesStore();
  const { precios } = useMercadoStore();
  const { inmuebles } = useInmuebleStore();
  const { suscripciones } = useSuscripcionesStore();
  const noLeidas = alertas.filter(a => !a.leida).length;

  // Load exchange rates once on mount (or when key changes)
  useEffect(() => {
    if (!exchangeRateKey) return;
    getAllRates('EUR').then(data => {
      if (!data?.conversion_rates) return;
      const r = data.conversion_rates;
      const toEurRate = (code: string) => r[code] ? 1 / r[code] : undefined;
      setExchangeRates({
        USD_EUR: toEurRate('USD') ?? 0.92,
        GBP_EUR: toEurRate('GBP') ?? 1.17,
        CHF_EUR: toEurRate('CHF') ?? 1.05,
        JPY_EUR: toEurRate('JPY') ?? 0.0062,
        CAD_EUR: toEurRate('CAD') ?? 0.68,
        AUD_EUR: toEurRate('AUD') ?? 0.61,
        SEK_EUR: toEurRate('SEK') ?? 0.087,
        NOK_EUR: toEurRate('NOK') ?? 0.087,
        DKK_EUR: toEurRate('DKK') ?? 0.134,
        MXN_EUR: toEurRate('MXN') ?? 0.053,
        BRL_EUR: toEurRate('BRL') ?? 0.185,
        CNY_EUR: toEurRate('CNY') ?? 0.127,
        INR_EUR: toEurRate('INR') ?? 0.011,
        KRW_EUR: toEurRate('KRW') ?? 0.00068,
        source: 'api',
      });
    }).catch(() => { /* keep fallback rates */ });
  }, [exchangeRateKey]);

  // Init notifications once on mount
  useEffect(() => {
    requestNotificationPermission().then(perm => {
      if (perm === 'granted') {
        initNotifications();
        checkSuscripcionesAlert(suscripciones);
        checkPortfolioDropAlert(posiciones, precios);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // open-chat event (fired by insights "Preguntarle más" buttons)
  useEffect(() => {
    const handler = (e: Event) => {
      const question = (e as CustomEvent<{ question: string }>).detail?.question;
      setShowChat(true);
      if (question) setChatInitQuestion(question);
    };
    window.addEventListener('open-chat', handler);
    return () => window.removeEventListener('open-chat', handler);
  }, []);

  // Google Drive: auto-sync every 5 min + check restore on mount
  useEffect(() => {
    if (!driveConnected || !googleClientId) return;

    const trySync = async () => {
      const hash = computeLocalHash();
      if (hash === lastBackupHash) return; // no changes
      const token = getToken();
      if (!token) return; // wait for user to reconnect manually
      try {
        setDriveSyncStatus('syncing');
        await createBackup();
        const list = await listBackups();
        setBackupHistory(list);
        setDriveLastSync(new Date().toISOString());
        setDriveSyncStatus('synced');
        setLastBackupHash(hash);
        setSyncError(null);
      } catch (e) {
        setDriveSyncStatus('error');
        setSyncError(e instanceof Error ? e.message : 'sync error');
      }
    };

    const checkRestore = async () => {
      if (!isLocalDataEmpty()) return;
      const token = getToken();
      if (!token) return;
      try {
        const backups = await listBackups();
        if (backups.length > 0) setDriveRestoreBackups(backups);
      } catch { /* ignore */ }
    };

    // Init auth and check restore on mount
    initGoogleAuth(googleClientId).then(() => checkRestore()).catch(() => {});

    // Auto-sync interval
    const interval = setInterval(trySync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [driveConnected, googleClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate alerts on mount / data change
  useEffect(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ingMes = ingresos.filter(i => i.fecha.startsWith(key)).reduce((s, i) => s + i.importe, 0);
    const gasMes = gastos.filter(g => g.fecha.startsWith(key)).reduce((s, g) => s + g.importe, 0);
    const totalSaldo = cuentas.reduce((s, c) => s + toEur(c.saldo, c.divisa), 0);
    const tasaAhorro = ingMes > 0 ? ((ingMes - gasMes) / ingMes) * 100 : 0;

    // Liquidity alert
    if (totalSaldo < 500) {
      addAlerta({ tipo: 'danger', titulo: 'Liquidez baja', mensaje: `Saldo total en cuentas: €${totalSaldo.toFixed(0)}. Considera mantener al menos 1 mes de gastos.` });
    }
    // Savings rate alert
    if (ingMes > 0 && tasaAhorro < 10) {
      addAlerta({ tipo: 'warning', titulo: 'Tasa de ahorro baja', mensaje: `Tu tasa de ahorro este mes es del ${tasaAhorro.toFixed(1)}%. Se recomienda al menos el 20%.` });
    }
    // Budget alerts
    presupuestos.forEach(p => {
      if (p.limite <= 0) return;
      const gCat = gastos.filter(g => g.fecha.startsWith(key) && g.categoria === p.categoria).reduce((s, g) => s + g.importe, 0);
      if (gCat / p.limite >= 0.9) {
        addAlerta({ tipo: 'warning', titulo: `Presupuesto al límite: ${p.categoria}`, mensaje: `Has gastado €${gCat.toFixed(0)} de €${p.limite} presupuestados (${((gCat/p.limite)*100).toFixed(0)}%).` });
      }
    });
    // Portfolio drop alert
    posiciones.forEach(p => {
      const precio = precios[p.simbolo]?.precio ?? MOCK_TICKERS.find(t => t.symbol === p.simbolo)?.price ?? p.precioMedio;
      const drop = ((precio - p.precioMedio) / p.precioMedio) * 100;
      if (drop <= -10) {
        addAlerta({ tipo: 'danger', titulo: `Caída >10%: ${p.simbolo}`, mensaje: `${p.simbolo} ha caído un ${drop.toFixed(1)}% desde tu precio de compra.` });
      }
    });
    // Upcoming debt payments
    deudas.forEach(d => {
      const venc = new Date(d.fechaVencimiento);
      const days = Math.round((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0 && days <= 30) {
        addAlerta({ tipo: 'info', titulo: `Deuda próxima a vencer: ${d.nombre}`, mensaje: `La deuda "${d.nombre}" vence en ${days} días (${d.fechaVencimiento}).` });
      }
    });
    // Suscripciones alerts (3 days before cobro)
    suscripciones.filter(s => s.activa).forEach(s => {
      const d = new Date(s.fechaProximoCobro);
      const dias = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (dias >= 0 && dias <= 3) {
        addAlerta({ tipo: 'info', titulo: `Cobro próximo: ${s.nombre}`, mensaje: `${s.nombre} se cobra en ${dias === 0 ? 'hoy' : `${dias} día${dias > 1 ? 's' : ''}`} — ${s.importe.toFixed(2)} € (${s.frecuencia}). Método: ${s.metodoPago || 'N/A'}.` });
      }
    });

    // Inmobiliario alerts
    inmuebles.forEach(inm => {
      // Valor no actualizado >12 meses (using añoAdquisicion as rough proxy — alert if valorActual === precioCompra)
      if (inm.valorActual === inm.precioCompra) {
        addAlerta({ tipo: 'info', titulo: `Valor sin actualizar: ${inm.nombre}`, mensaje: `El valor de "${inm.nombre}" no ha sido actualizado (valor actual = precio de compra). Considera revisarlo.` });
      }
      // Yield neto < 3%
      if (inm.generaRenta && inm.rentaMensualBruta > 0 && inm.valorActual > 0) {
        const gastosAno = (inm.gastosIbiMes + inm.gastosComunidad + inm.gastosSeguro + inm.gastosMantenimiento + inm.gastosOtros) * 12;
        const rentaAnualNeta = inm.rentaMensualBruta * 12 - gastosAno;
        const yieldNeto = (rentaAnualNeta / inm.valorActual) * 100;
        if (yieldNeto < 3) {
          addAlerta({ tipo: 'warning', titulo: `Rentabilidad baja: ${inm.nombre}`, mensaje: `El yield neto de "${inm.nombre}" es del ${yieldNeto.toFixed(1)}%, por debajo del 3% recomendado.` });
        }
      }
      // Hipoteca asociada que vence en menos de 1 año
      if (inm.hipotecaAsociada) {
        const hip = deudas.find(d => d.id === inm.hipotecaAsociada);
        if (hip) {
          const venc = new Date(hip.fechaVencimiento);
          const days = Math.round((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0 && days <= 365) {
            addAlerta({ tipo: 'warning', titulo: `Hipoteca próxima a vencer: ${inm.nombre}`, mensaje: `La hipoteca de "${inm.nombre}" vence en ${days} días. Considera renegociar o refinanciar.` });
          }
        }
      }
    });
  }, []); // Only on mount to avoid spam

  // Close panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (alertasPanelRef.current && !alertasPanelRef.current.contains(e.target as Node)) {
        setShowAlertas(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await signOut();
  };

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const main = document.querySelector('main');
      if (!main) return;
      const canvas = await html2canvas(main as HTMLElement, { scale: 1.5, backgroundColor: '#0d0d10' });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgW = 210;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH);
      pdf.save(`mi-app-finanzas-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Error al generar PDF. Asegúrate de tener instalado jspdf y html2canvas.');
    }
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'var(--blue)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>MF</div>
          <span className="header-app-name" style={{ fontWeight: 700, fontSize: 16 }}>Mi App Financiera</span>
        </div>

        <nav className="header-nav" style={{ display: 'flex', gap: 4 }}>
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, textDecoration: 'none',
                fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                background: isActive ? 'var(--blue)' : 'transparent',
                color: isActive ? 'white' : 'var(--text2)',
              })}
            >
              <Icon size={15} />
              <span className="hide-mobile">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDemo ? (
            <span className="header-demo-badge" style={{ fontSize: 12, color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)' }}>
              Modo Demo
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)' }}>
              <span className="live-dot" />
              En vivo
            </div>
          )}
          {/* Alerts bell */}
          <div style={{ position: 'relative' }} ref={alertasPanelRef}>
            <button className="btn-icon" onClick={() => setShowAlertas(!showAlertas)} title="Alertas">
              <Bell size={16} />
              {noLeidas > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: 'var(--red)', borderRadius: '50%', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  {noLeidas > 9 ? '9+' : noLeidas}
                </span>
              )}
            </button>
            {showAlertas && (
              <div style={{ position: 'absolute', top: 40, right: 0, width: 340, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 500, maxHeight: 480, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Alertas {noLeidas > 0 && <span style={{ background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 11, marginLeft: 6 }}>{noLeidas}</span>}</span>
                  {noLeidas > 0 && <button onClick={marcarTodasLeidas} style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Marcar todas leídas</button>}
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {alertas.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>✅ Sin alertas activas</div>
                  ) : alertas.map(a => (
                    <div key={a.id} onClick={() => marcarLeida(a.id)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: a.leida ? 'transparent' : 'rgba(59,130,246,0.04)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{a.tipo === 'danger' ? '🔴' : a.tipo === 'warning' ? '🟡' : '🔵'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: a.leida ? 400 : 700, marginBottom: 2 }}>{a.titulo}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>{a.mensaje}</div>
                        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>{a.fecha}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeAlerta(a.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', flexShrink: 0 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Supabase sync indicator */}
          <div title={lastSync ? `Supabase sync: ${new Date(lastSync).toLocaleTimeString('es-ES')}` : 'Sin sincronizar'} style={{ display: 'flex', alignItems: 'center' }}>
            {syncStatus === 'syncing' || syncStatus === 'loading'
              ? <Loader2 size={14} color="var(--blue)" style={{ animation: 'spin 1s linear infinite' }} />
              : syncStatus === 'error'
              ? <CloudOff size={14} color="var(--red)" />
              : syncStatus === 'synced'
              ? <CheckCircle2 size={14} color="var(--green)" />
              : <Cloud size={14} color="var(--text2)" />
            }
          </div>
          {/* Google Drive sync indicator */}
          {driveConnected && (
            <div
              title={driveSyncStatus === 'synced' ? 'Drive: sincronizado' : driveSyncStatus === 'syncing' ? 'Drive: sincronizando...' : driveSyncStatus === 'error' ? 'Drive: error de sincronización' : 'Drive: conectado'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: driveSyncStatus === 'synced' ? 'var(--green)' : driveSyncStatus === 'syncing' ? 'var(--blue)' : driveSyncStatus === 'error' ? 'var(--red)' : 'var(--text2)' }}
            >
              {driveSyncStatus === 'syncing'
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <span style={{ width: 8, height: 8, borderRadius: '50%', background: driveSyncStatus === 'synced' ? 'var(--green)' : driveSyncStatus === 'error' ? 'var(--red)' : '#4285f4', display: 'inline-block' }} />
              }
              <span className="hide-mobile" style={{ fontSize: 10 }}>Drive</span>
            </div>
          )}
          {/* Chat IA */}
          <button className="btn-icon" onClick={() => setShowChat(!showChat)} title="Asesor IA" style={{ position: 'relative' }}>
            <MessageSquare size={16} />
            <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: '#a78bfa', borderRadius: '50%', border: '2px solid var(--bg2)' }} />
          </button>
          {/* PDF export */}
          <button className="btn-icon header-pdf-btn" onClick={handleExportPDF} title="Exportar PDF">
            <FileDown size={16} />
          </button>
          {/* Privacy toggle */}
          <button
            className="btn-icon"
            onClick={() => setPrivacyMode(!privacyMode)}
            title={privacyMode ? 'Mostrar valores' : 'Ocultar valores'}
            style={{ color: privacyMode ? 'var(--text2)' : 'var(--blue)' }}
          >
            {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button className="btn-icon" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
          </button>
          {/* Direct logout button — always visible */}
          {user && (
            <button
              className="btn-icon"
              onClick={handleSignOut}
              title="Cerrar sesión"
              style={{ color: 'var(--text2)' }}
            >
              <LogOut size={16} />
            </button>
          )}
          {/* User menu */}
          <div className="header-user-menu" style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={user?.email ?? 'Usuario'}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--blue)', border: 'none',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {(user?.email?.[0] ?? 'U').toUpperCase()}
            </button>
            {showUserMenu && (
              <div style={{
                position: 'absolute', top: 38, right: 0, width: 220,
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 500, overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>Conectado como</div>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%', padding: '12px 16px', background: 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    color: 'var(--red)', fontSize: 14, fontWeight: 500,
                  }}
                >
                  <LogOut size={15} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Demo banner */}
      {isDemo && (
        <div style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.3)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--amber)' }}>
            Modo demo activo — Los precios son simulados. Añade tu API Key de Alpha Vantage en ⚙️ Ajustes para datos reales.
          </span>
        </div>
      )}

      {/* Ticker */}
      <TickerBar />

      {/* Main */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>

      {/* Bottom navigation — mobile only */}
      <nav className="bottom-nav">
        {nav.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <InstallBanner />
      <OfflineBanner />

      {driveRestoreBackups && (
        <DriveRestoreModal
          backups={driveRestoreBackups}
          onClose={() => setDriveRestoreBackups(null)}
          onRestored={() => setDriveRestoreBackups(null)}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showChat && (
        <ChatIA
          onClose={() => { setShowChat(false); setChatInitQuestion(null); }}
          initQuestion={chatInitQuestion ?? undefined}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
