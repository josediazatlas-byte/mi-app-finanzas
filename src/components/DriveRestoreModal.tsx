import { useState } from 'react';
import { CloudDownload, X, RefreshCw } from 'lucide-react';
import type { BackupEntry } from '../services/googleDrive';
import { restoreBackup } from '../services/googleDrive';
import toast from 'react-hot-toast';

interface Props {
  backups: BackupEntry[];
  onClose: () => void;
  onRestored: () => void;
}

export default function DriveRestoreModal({ backups, onClose, onRestored }: Props) {
  const [restoring, setRestoring] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(backups[0]?.id ?? '');

  const latest = backups[0];

  const handleRestore = async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      await restoreBackup(selectedId);
      toast.success('Datos restaurados correctamente');
      onRestored();
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(`Error al restaurar: ${e instanceof Error ? e.message : 'desconocido'}`);
      setRestoring(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1_048_576).toFixed(1)} MB`;

  return (
    <div className="modal-overlay" style={{ zIndex: 600 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(66,133,244,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CloudDownload size={18} color="#4285f4" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Datos encontrados en Drive</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Copia de seguridad disponible</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {latest && (
          <div style={{ background: 'rgba(66,133,244,0.08)', border: '1px solid rgba(66,133,244,0.3)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Última copia: {fmtDate(latest.modifiedAt)}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tamaño: {fmtSize(latest.sizeBytes)}</div>
          </div>
        )}

        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
          Encontramos datos guardados en tu Google Drive. ¿Quieres restaurarlos en este dispositivo?
        </p>

        {backups.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <label className="label">Seleccionar copia</label>
            <select className="select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              {backups.map((b, i) => (
                <option key={b.id} value={b.id}>
                  {i === 0 ? '⭐ ' : ''}{fmtDate(b.modifiedAt)} · {fmtSize(b.sizeBytes)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Empezar desde cero
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', background: '#4285f4' }}
            onClick={handleRestore}
            disabled={restoring || !selectedId}
          >
            {restoring
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Restaurando...</>
              : <><CloudDownload size={14} /> Restaurar datos</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
