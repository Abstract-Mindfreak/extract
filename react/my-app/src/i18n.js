import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ruTranslation from "./locales/ru/translation.json";
import appPersistenceService from "./services/AppPersistenceService";

i18n.use(initReactI18next).init({
  resources: {
    ru: {
      translation: ruTranslation,
    },
  },
  lng: "ru",
  fallbackLng: "ru",
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

if (typeof window !== "undefined") {
  void appPersistenceService
    .getSetting("i18n", "mmss.language", "ru")
    .then((savedLanguage) => {
      if (savedLanguage && savedLanguage !== i18n.language) {
        i18n.changeLanguage(savedLanguage);
      }
    })
    .catch(() => {
      // noop
    });
}

export default i18n;
