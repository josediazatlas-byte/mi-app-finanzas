// v2.1 - Planes de Ahorro incluido
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { loadUserData, setupSyncSubscriptions, hasLocalStorageData } from './hooks/useSupabaseSync';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import MigracionModal from './components/MigracionModal';
import Inicio from './pages/Inicio';
import Finanzas from './pages/Finanzas';
import Inversiones from './pages/Inversiones';
import Analisis from './pages/Analisis';
import Herramientas from './pages/Herramientas';
import Documentos from './pages/Documentos';
import Fondos from './pages/Fondos';

export default function App() {
  const { user, loading } = useAuth();
  const [appReady, setAppReady] = useState(false);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    if (!user) {
      setAppReady(false);
      setShowMigration(false);
      return;
    }

    // Already migrated for this user?
    const migrated = localStorage.getItem('supabase-migrated') === user.id;

    loadUserData(user.id).then((hasCloudData) => {
      setAppReady(true);
      if (!hasCloudData && !migrated && hasLocalStorageData()) {
        setShowMigration(true);
      }
    });

    const cleanup = setupSyncSubscriptions(user.id);
    return cleanup;
  }, [user]);

  // Auth loading
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <Loader2 size={32} color="var(--blue)" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text2)', fontSize: 14 }}>Cargando...</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Not authenticated
  if (!user) return <Auth />;

  // Authenticated but still loading cloud data
  if (!appReady) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <Loader2 size={32} color="var(--blue)" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text2)', fontSize: 14 }}>Sincronizando datos...</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {showMigration && (
        <MigracionModal
          userId={user.id}
          onClose={() => setShowMigration(false)}
        />
      )}
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/inversiones" element={<Inversiones />} />
          <Route path="/fondos" element={<Fondos />} />
          <Route path="/analisis" element={<Analisis />} />
          <Route path="/herramientas" element={<Herramientas />} />
          <Route path="/documentos" element={<Documentos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
