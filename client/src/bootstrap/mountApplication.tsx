import type { Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { I18nextProvider } from 'react-i18next';

import App from '../App';
import i18n, { i18nReady } from '../i18n';

export async function mountApplication(root: Root): Promise<void> {
  await i18nReady;

  root.render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </StrictMode>
  );
}
