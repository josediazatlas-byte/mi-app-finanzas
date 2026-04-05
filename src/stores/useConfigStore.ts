import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AutonomoProfile {
  nombre: string;
  nif: string;
  direccion: string;
  email: string;
  telefono: string;
  iban: string;
  logo: string; // base64
  ivaDefault: number;
  retencionDefault: number;
  serieFacturacion: string;
}

interface ConfigStore {
  apiKey: string;
  anthropicKey: string;
  fmpKey: string;
  exchangeRateKey: string;
  fredKey: string;
  googleClientId: string;
  autoRefresh: boolean;
  baseCurrency: 'EUR' | 'USD' | 'GBP';
  autonomo: AutonomoProfile;
  privacyMode: boolean;
  setApiKey: (key: string) => void;
  setAnthropicKey: (key: string) => void;
  setFmpKey: (key: string) => void;
  setExchangeRateKey: (key: string) => void;
  setFredKey: (key: string) => void;
  setGoogleClientId: (id: string) => void;
  setAutoRefresh: (v: boolean) => void;
  setBaseCurrency: (c: 'EUR' | 'USD' | 'GBP') => void;
  setAutonomo: (p: Partial<AutonomoProfile>) => void;
  setPrivacyMode: (v: boolean) => void;
  exportData: () => void;
  importData: (json: string) => void;
  clearAllData: () => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      apiKey: '',
      anthropicKey: '',
      fmpKey: '',
      exchangeRateKey: '',
      fredKey: '',
      googleClientId: '',
      autoRefresh: true,
      baseCurrency: 'EUR',
      autonomo: { nombre: '', nif: '', direccion: '', email: '', telefono: '', iban: '', logo: '', ivaDefault: 21, retencionDefault: 15, serieFacturacion: String(new Date().getFullYear()) },
      privacyMode: true,
      setApiKey: (apiKey) => set({ apiKey }),
      setAnthropicKey: (anthropicKey) => { set({ anthropicKey }); localStorage.setItem('anthropic_api_key', anthropicKey); },
      setFmpKey: (fmpKey) => { set({ fmpKey }); localStorage.setItem('fmp_api_key', fmpKey); },
      setExchangeRateKey: (exchangeRateKey) => { set({ exchangeRateKey }); localStorage.setItem('exchange_rate_api_key', exchangeRateKey); },
      setFredKey: (fredKey) => { set({ fredKey }); localStorage.setItem('fred_api_key', fredKey); },
      setGoogleClientId: (googleClientId) => set({ googleClientId }),
      setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
      setBaseCurrency: (baseCurrency) => set({ baseCurrency }),
      setAutonomo: (p) => set((s) => ({ autonomo: { ...s.autonomo, ...p } })),
      setPrivacyMode: (privacyMode) => set({ privacyMode }),
      exportData: () => {
        const data: Record<string, unknown> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) data[key] = JSON.parse(localStorage.getItem(key) || 'null');
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mi-app-financiera-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      importData: (json) => {
        try {
          const data = JSON.parse(json);
          Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
          window.location.reload();
        } catch {
          alert('Error al importar los datos');
        }
      },
      clearAllData: () => {
        localStorage.clear();
        window.location.reload();
      },
    }),
    { name: 'config-store' }
  )
);
