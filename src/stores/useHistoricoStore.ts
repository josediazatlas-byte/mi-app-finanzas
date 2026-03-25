import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SnapshotPatrimonio {
  fecha: string; // YYYY-MM-DD
  patrimonio: number;
  activos: number;
  pasivos: number;
}

interface HistoricoStore {
  snapshots: SnapshotPatrimonio[];
  addSnapshot: (s: SnapshotPatrimonio) => void;
  clearSnapshots: () => void;
}

function buildDefaultSnapshots(): SnapshotPatrimonio[] {
  const today = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
    const base = 8000 + i * 1400 + (i % 3 === 0 ? -300 : 200);
    const activos = Math.round(base * 1.18);
    const pasivos = Math.round(base * 0.18);
    return {
      fecha: d.toISOString().slice(0, 10),
      patrimonio: Math.round(base),
      activos,
      pasivos,
    };
  });
}

export const useHistoricoStore = create<HistoricoStore>()(
  persist(
    (set) => ({
      snapshots: buildDefaultSnapshots(),
      addSnapshot: (snap) => set((s) => {
        const filtered = s.snapshots.filter(x => x.fecha.slice(0, 7) !== snap.fecha.slice(0, 7));
        return { snapshots: [...filtered, snap].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-24) };
      }),
      clearSnapshots: () => set({ snapshots: [] }),
    }),
    { name: 'historico-store' }
  )
);
