import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      setShowBackOnline(false);
    };
    const goOnline = () => {
      setOffline(false);
      setShowBackOnline(true);
      // Hide "back online" after 3s
      setTimeout(() => setShowBackOnline(false), 3000);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline && !showBackOnline) return null;

  return (
    <div style={{
      position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
      zIndex: 400, maxWidth: 360, width: 'calc(100% - 32px)',
      background: offline ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
      border: `1px solid ${offline ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
      borderRadius: 12, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      animation: 'fade-in-banner 0.25s ease',
    }}>
      {offline
        ? <WifiOff size={16} color="var(--red)" />
        : <Wifi size={16} color="var(--green)" />
      }
      <span style={{ fontSize: 13, fontWeight: 600, color: offline ? 'var(--red)' : 'var(--green)' }}>
        {offline ? 'Sin conexión — mostrando datos en caché' : 'Conexión restaurada'}
      </span>
      <style>{`
        @keyframes fade-in-banner {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
