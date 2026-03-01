import * as i18nModule from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as LanguageDetectorModule from 'i18next-browser-languagedetector';

// Handle both ESM and CJS exports for Vite 7 compatibility
const i18n = (i18nModule.default || i18nModule) as typeof i18nModule.default;
const LanguageDetector = LanguageDetectorModule.default || LanguageDetectorModule;

// Vite 7: Use ?url query to force proper JSON handling
import enTranslations from './locales/en.json?raw';
import frTranslations from './locales/fr.json?raw';

// Parse the raw JSON strings
const en = JSON.parse(enTranslations);
const fr = JSON.parse(frTranslations);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en,
      },
      fr: {
        translation: fr,
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
