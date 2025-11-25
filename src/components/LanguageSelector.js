import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "../styles/LanguageSelector.css";

const LanguageSelector = () => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();

  const languages = [
    { code: "en", label: "English", display: "A", color: "#2ABAB4" },
    { code: "hi", label: "हिन्दी", display: "अ", color: "#3C82FF" },
    { code: "kn", label: "ಕನ್ನಡ", display: "ಕ", color: "#F39C12" },
    { code: "te", label: "తెలుగు", display: "తె", color: "#27AE60" },
  ];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language");
    if (savedLang) i18n.changeLanguage(savedLang);
  }, [i18n]);

  const selectLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem("app_language", langCode);
    navigate("/home");
  };

  return (
    <div className="lang-screen">
      <h2 className="lang-title">{t("choose_language")}</h2>
      <p className="lang-sub">{t("choose_language_sub")}</p>

      <div className="lang-grid">
        {languages.map((lang) => (
          <div
            key={lang.code}
            className="lang-card"
            style={{ backgroundColor: lang.color }}
            onClick={() => selectLanguage(lang.code)}
          >
            <span className="lang-label">{lang.label}</span>
            <span className="lang-display">{lang.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;
