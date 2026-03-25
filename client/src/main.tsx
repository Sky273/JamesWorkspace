/**
 * Main Entry Point
 * TypeScript version
 */

// IMPORTANT: i18n must be imported FIRST before any React components
import i18n, { i18nReady } from './i18n';
import { I18nextProvider } from 'react-i18next';

import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';
import { AuthProvider } from './context/AuthContext';
import { installGlobalErrorHandling } from './bootstrap/globalErrorHandling';

installGlobalErrorHandling();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

const renderApp = () => {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nextProvider>
    </StrictMode>
  );
};

void i18nReady
  .then(renderApp)
  .catch((error) => {
    console.error('[i18n] Failed to initialize translations', error);
    throw error;
  });
