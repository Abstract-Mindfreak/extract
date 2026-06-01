import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ruTranslation from './locales/ru/translation.json';

const savedLanguage =
  typeof window !== 'undefined' ? window.localStorage.getItem('mmss.language') : null;

void i18n.use(initReactI18next).init({
  resources: {
    ru: {
      translation: ruTranslation,
    },
  },
  lng: savedLanguage || 'ru',
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
