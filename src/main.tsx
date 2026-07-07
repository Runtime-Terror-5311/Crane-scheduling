import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept fetch calls to dynamically support VITE_APP_URL for cross-origin deployments
const originalFetch = window.fetch;
if (originalFetch) {
  try {
    Object.defineProperty(window, 'fetch', {
      value: function (input: RequestInfo | URL, init?: RequestInit) {
        const appUrl = (import.meta as any).env.VITE_APP_URL || "";
        if (appUrl && typeof input === "string" && input.startsWith("/api/")) {
          const normalizedAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
          return originalFetch(normalizedAppUrl + input, {
            credentials: "include",
            ...init,
          });
        }
        return originalFetch(input, init);
      },
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    console.warn("Failed to override window.fetch directly. Falling back to default fetch behavior:", e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
