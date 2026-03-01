import * as i18nModule from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as LanguageDetectorModule from 'i18next-browser-languagedetector';

// Handle both ESM and CJS exports for Vite 7 compatibility
const i18n = (i18nModule.default || i18nModule) as typeof i18nModule.default;
const LanguageDetector = LanguageDetectorModule.default || LanguageDetectorModule;

import enTranslations from './locales/en.json';
import frTranslations from './locales/fr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      fr: {
        translation: frTranslations,
      },
    },
    lng: 'fr', // Default language is French
    fallbackLng: 'fr', // Fallback to French if translation is missing
    interpolation: {
      escapeValue: false,
    },
    // Synchronous initialization - resources are bundled, no async loading needed
    initImmediate: false,
    // Language detector options - prioritize localStorage, then default to French
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
