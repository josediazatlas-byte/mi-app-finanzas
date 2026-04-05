import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BackupEntry } from '../services/googleDrive';

export type DriveStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface DriveStore {
  connected: boolean;
  syncStatus: DriveStatus;
  lastSync: string | null;       // ISO string
  lastBackupHash: string;
  backupHistory: BackupEntry[];
  syncError: string | null;

  setConnected: (v: boolean) => void;
  setSyncStatus: (s: DriveStatus) => void;
  setLastSync: (ts: string | null) => void;
  setLastBackupHash: (h: string) => void;
  setBackupHistory: (list: BackupEntry[]) => void;
  setSyncError: (e: string | null) => void;
}

export const useDriveStore = create<DriveStore>()(
  persist(
    (set) => ({
      connected: false,
      syncStatus: 'idle',
      lastSync: null,
      lastBackupHash: '',
      backupHistory: [],
      syncError: null,

      setConnected:       (connected)       => set({ connected }),
      setSyncStatus:      (syncStatus)      => set({ syncStatus }),
      setLastSync:        (lastSync)        => set({ lastSync }),
      setLastBackupHash:  (lastBackupHash)  => set({ lastBackupHash }),
      setBackupHistory:   (backupHistory)   => set({ backupHistory }),
      setSyncError:       (syncError)       => set({ syncError }),
    }),
    { name: 'drive-store' }
  )
);
