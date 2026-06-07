import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from '@/i18n/es.json';

// Default and fallback language is Spanish. Adding a language = add a resource
// here with the same key structure (see src/i18n/es.json).
export const resources = {
  es: { translation: es },
} as const;

const deviceLanguage = getLocales()[0]?.languageCode ?? 'es';
const supported = Object.keys(resources);
const initialLanguage = supported.includes(deviceLanguage) ? deviceLanguage : 'es';

if (!i18n.isInitialized) {
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'es',
    defaultNS: 'translation',
    interpolation: {
      // React already escapes values.
      escapeValue: false,
    },
  });
}

export default i18n;
