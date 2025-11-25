import React, { useState } from "react";
import { FaPhone } from "react-icons/fa";
import "../styles/HelplineButton.css";
import { useTranslation } from "react-i18next";

const HelplineButton = () => {
  const [showPopup, setShowPopup] = useState(false);
  const { t } = useTranslation();
  const helplineNumber = "+919844559599";

  return (
    <>
      {/* Floating Call Button */}
      <div className="helpline-floating-btn" onClick={() => setShowPopup(true)}>
        <FaPhone className="helpline-icon" />
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="helpline-popup-overlay" onClick={() => setShowPopup(false)}>
          <div
            className="helpline-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="helpline-close-btn"
              onClick={() => setShowPopup(false)}
            >
              ✕
            </button>

            <div className="call-icon-button">
              <FaPhone className="call-icon" />
            </div>

            <h3>{t("helpline_company_name")}</h3>
            <p>{t("helpline_message")}</p>

            <a href={`tel:${helplineNumber}`} className="helpline-callnow-btn">
              {t("call_now")}
            </a>
          </div>
        </div>
      )}
    </>
  );
};

export default HelplineButton;
