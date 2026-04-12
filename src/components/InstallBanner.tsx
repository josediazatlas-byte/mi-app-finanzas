import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or installed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Already installed as standalone?
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(var(--bottom-nav-h, 0px) + var(--safe-bottom, 0px) + 12px)',
      left: 12, right: 12, zIndex: 300,
      background: 'linear-gradient(135deg, #1a0a2e 0%, #0f1729 100%)',
      border: '1px solid rgba(134,59,255,0.4)',
      borderRadius: 16, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'slide-up-banner 0.3s cubic-bezier(0.32,0.72,0,1)',
    }}>
      {/* App icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, #863bff 0%, #47bfff 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 15, color: 'white',
      }}>
        MF
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
          Instala In-Control
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.3 }}>
          Acceso rápido desde tu pantalla de inicio
        </div>
      </div>

      <button
        onClick={handleInstall}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #863bff, #47bfff)',
          color: 'white', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Download size={14} />
        Instalar
      </button>

      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4, flexShrink: 0 }}
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>

      <style>{`
        @keyframes slide-up-banner {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
