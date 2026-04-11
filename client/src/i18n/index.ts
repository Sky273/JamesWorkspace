import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import frMessages from './locales/fr';

type SupportedLanguage = 'en' | 'fr';

const FALLBACK_LANGUAGE: SupportedLanguage = 'fr';
const BUNDLED_RESOURCES = {
  fr: frMessages,
} satisfies Record<typeof FALLBACK_LANGUAGE, Record<string, unknown>>;

const LANGUAGE_LOADERS: Record<SupportedLanguage, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en'),
  fr: () => Promise.resolve({ default: BUNDLED_RESOURCES.fr }),
};
const loadedLanguages = new Set<SupportedLanguage>();

const normalizeLanguage = (language?: string): SupportedLanguage => {
  const normalized = (language || '').toLowerCase();
  return normalized.startsWith('en') ? 'en' : 'fr';
};

const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window === 'undefined') {
    return FALLBACK_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem('i18nextLng');
  if (storedLanguage) {
    return normalizeLanguage(storedLanguage);
  }

  return FALLBACK_LANGUAGE;
};

const loadLanguageResources = async (language: SupportedLanguage): Promise<void> => {
  if (loadedLanguages.has(language)) {
    return;
  }

  const module = await LANGUAGE_LOADERS[language]();
  i18n.addResourceBundle(language, 'translation', module.default, true, true);
  loadedLanguages.add(language);
};

const bootstrapI18n = async (): Promise<void> => {
  const initialLanguage = getInitialLanguage();

  i18n.use(LanguageDetector).use(initReactI18next);

  await i18n.init({
    resources: {
      fr: {
        translation: BUNDLED_RESOURCES.fr,
      },
    },
    lng: FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: ['en', 'fr'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    partialBundledLanguages: true,
    showSupportNotice: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

  loadedLanguages.add(FALLBACK_LANGUAGE);

  if (initialLanguage !== FALLBACK_LANGUAGE) {
    void loadLanguageResources(initialLanguage).then(() => {
      if (i18n.language !== initialLanguage) {
        void i18n.changeLanguage(initialLanguage);
      }
    });
  }

  const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
  i18n.changeLanguage = async (language, callback) => {
    const nextLanguage = language ? normalizeLanguage(language) : undefined;
    if (nextLanguage) {
      await loadLanguageResources(nextLanguage);
    }
    return originalChangeLanguage(nextLanguage, callback);
  };

  if (initialLanguage === FALLBACK_LANGUAGE && i18n.language !== initialLanguage) {
    await i18n.changeLanguage(initialLanguage);
  }
};

export const i18nReady = bootstrapI18n();

export default i18n;
