import React from 'react';
import '../styles/Footer.css';
import logo from '../assets/images/footer-logo-image.png';
import { FaFacebookF, FaInstagram, FaTwitter, FaLinkedin } from 'react-icons/fa';
import qr from '../assets/images/qr-code.png';
import googlePlay from '../assets/images/googleplaystore.png';
import appStore from '../assets/images/apple-logo.png';
import { useTranslation } from "react-i18next";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-top">
        
        {/* LOGO SECTION */}
        <div className="footer-logo">
          <img 
            src={logo} 
            alt={t("footer_logo_alt")}
            loading="lazy"
            width="120"
          />
          <p>{t("trusted_partner")}</p>
        </div>
        
        {/* APP SECTION */}
        <div className="app-coming-soon">
          <p className="coming-soon-text">{t("app_coming_soon")}</p>

          <div className="app-download-badges">
            {/* GOOGLE PLAY */}
            <div className="store-badge google-play-badge">
              <div className="badge-content">
                <img 
                  src={googlePlay} 
                  alt="Google Play"
                  className="app-badge"
                  loading="lazy"
                />
                <div className="badge-text">
                  <span className="get-it-on">{t("get_it_on")}</span>
                  <span className="store-name">{t("google_play")}</span>
                </div>
              </div>
            </div>

            {/* APP STORE */}
            <div className="store-badge app-store-badge">
              <div className="badge-content">
                <img 
                  src={appStore} 
                  alt="App Store"
                  className="app-badge"
                  loading="lazy"
                />
                <div className="badge-text">
                  <span className="get-it-on">{t("download_on")}</span>
                  <span className="store-name">{t("app_store")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOLLOW SECTION */}
        <div className="footer-social">
          <h4>{t("follow_us")}</h4>
          <div className="social-icons">
            <a href="#" aria-label="Facebook"><FaFacebookF /></a>
            <a href="#" aria-label="Instagram"><FaInstagram /></a>
            <a href="#" aria-label="Twitter"><FaTwitter /></a>
            <a href="#" aria-label="LinkedIn"><FaLinkedin /></a>
          </div>
        </div>

        {/* QR SECTION */}
        <div className="footer-app">
          <h4>{t("download_our_app")}</h4>
          <img 
            src={qr} 
            alt={t("qr_alt")}
            className="qr-code"
            loading="lazy"
            width="100"
            height="100"
          />
          <p>{t("scan_to_install")}</p>
        </div>
      </div>

      {/* BOTTOM SECTION */}
      <div className="footer-bottom">
        <p>{t("cin")}: U62020KA2025PTC197886</p>
        <h3>{t("company_name")}</h3>

        <div className="footer-links">
          <a href="/about">{t("about_us")}</a>
          <a href="/careers">{t("careers")}</a>
          <a href="/contact">{t("contact")}</a>
          <a href="/privacy-policy">{t("privacy_policy")}</a>
          <a href="/terms">{t("terms_conditions")}</a>
        </div>

        <p>© {currentYear} {t("copyright")}</p>
      </div>
    </footer>
  );
};

export default Footer;
