import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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
