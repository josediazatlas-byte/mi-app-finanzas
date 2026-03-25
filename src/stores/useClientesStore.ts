import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Cliente {
  id: string;
  nombreRazonSocial: string;
  nifCif: string;
  direccion: string;
  email: string;
  telefono: string;
  notas: string;
}

interface ClientesStore {
  clientes: Cliente[];
  addCliente: (c: Omit<Cliente, 'id'>) => void;
  updateCliente: (id: string, c: Partial<Omit<Cliente, 'id'>>) => void;
  removeCliente: (id: string) => void;
}

const defaultClientes: Cliente[] = [
  { id: '1', nombreRazonSocial: 'Empresa Demo S.L.', nifCif: 'B12345678', direccion: 'Calle Mayor 1, Madrid', email: 'contacto@empresademo.es', telefono: '910000001', notas: '' },
];

export const useClientesStore = create<ClientesStore>()(
  persist(
    (set) => ({
      clientes: defaultClientes,
      addCliente: (c) => set((s) => ({ clientes: [...s.clientes, { ...c, id: Date.now().toString() }] })),
      updateCliente: (id, c) => set((s) => ({ clientes: s.clientes.map((x) => x.id === id ? { ...x, ...c } : x) })),
      removeCliente: (id) => set((s) => ({ clientes: s.clientes.filter((x) => x.id !== id) })),
    }),
    { name: 'clientes-store' }
  )
);
