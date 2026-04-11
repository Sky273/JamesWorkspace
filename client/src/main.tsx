/**
 * Main Entry Point
 * TypeScript version
 */

import ReactDOM from 'react-dom/client';
import './styles/main.css';
import { installGlobalErrorHandling } from './bootstrap/globalErrorHandling';

installGlobalErrorHandling();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

const root = ReactDOM.createRoot(rootElement);

root.render(
  <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-primary-600 dark:border-slate-800" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Chargement...</p>
    </div>
  </div>
);

const loadApplication = async () => {
  const { mountApplication } = await import('./bootstrap/mountApplication');
  await mountApplication(root);
};

window.setTimeout(() => {
  void loadApplication().catch((error) => {
    console.error('[bootstrap] Failed to mount application', error);
    throw error;
  });
}, 0);
