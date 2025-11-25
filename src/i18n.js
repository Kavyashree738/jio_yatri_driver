import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./i18n/en.json";
import kn from "./i18n/kn.json";
import hi from "./i18n/hi.json";
import te from "./i18n/te.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    resources: {
      en: { translation: en },
      kn: { translation: kn },
      hi: { translation: hi },
      te: { translation: te },
    },
  });

// 🔥 Update <html lang="xx"> when language changes
i18n.on("languageChanged", (lng) => {
  document.documentElement.setAttribute("lang", lng);
});

// 🔥 Set initial language when page loads
document.documentElement.setAttribute("lang", i18n.language || "en");

export default i18n;
