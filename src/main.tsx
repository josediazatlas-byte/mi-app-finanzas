import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import './responsive.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--bg2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          fontSize: '14px',
        },
      }}
    />
  </StrictMode>,
);
