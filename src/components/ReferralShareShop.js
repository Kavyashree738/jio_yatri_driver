import React, { useEffect, useState } from 'react';
import { FaCopy, FaWhatsapp, FaShareAlt } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/ReferralShare.css';
import gift from '../assets/images/gift-box.png';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { FaRupeeSign } from 'react-icons/fa';
import { useTranslation } from "react-i18next"; // 🔥 added

const ReferralShareShop = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(); // 🔥 added

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [referral, setReferral] = useState(null);
    const [referralStats, setReferralStats] = useState(null);

  useEffect(() => {
    const fetchReferral = async () => {
      if (!user?.uid || !shopId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const token = await user.getIdToken();
        const base = 'https://jio-yatri-driver.onrender.com';
        const res = await axios.get(`${base}/api/shops/${shopId}/referral-code`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.data?.success) throw new Error(res.data?.error || t("failed_fetch")); // 🔥 updated
        setReferral({
          referralCode: res.data.referralCode,
          shareLink: res.data.shareLink
        });
      } catch (e) {
        setError(e.response?.data?.error || e.message || t("failed_fetch")); // 🔥 updated
      } finally {
        setLoading(false);
      }
    };
    fetchReferral();
  }, [user, shopId, t]);

  const fireConfetti = () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } }), 250);
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } }), 400);
  };

  const copyToClipboard = () => {
    if (!referral) return;
    navigator.clipboard.writeText(referral.shareLink);
    setCopied(true);
    fireConfetti();
    setTimeout(() => setCopied(false), 1800);
  };

  const shareViaWhatsApp = () => {
    if (!referral) return;
    const msg = `${t("whatsapp_msg")} ${referral.referralCode} ${referral.shareLink}`; // 🔥 updated
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

const shareNative = async () => {
  if (!referral || !referral.shareLink) return;

  const message = `${referral.shareLink}|${referral.referralCode}`;

  // 1️⃣ Flutter WebView bridge
  if (window.NativeShare && typeof window.NativeShare.postMessage === 'function') {
    console.log("📤 Sending to Flutter:", message);
    window.NativeShare.postMessage(message);
  } 
  // 2️⃣ Android WebView bridge
  else if (window.Android && typeof window.Android.share === 'function') {
    console.log("📤 Sending to Android bridge:", message);
    window.Android.share(referral.shareLink, referral.referralCode);
  } 
  // 3️⃣ iOS WebView bridge
  else if (
    window.webkit &&
    window.webkit.messageHandlers &&
    window.webkit.messageHandlers.NativeShare
  ) {
    console.log("📤 Sending to iOS bridge:", message);
    window.webkit.messageHandlers.NativeShare.postMessage(message);
  } 
  // 4️⃣ Mobile browser Web Share API
  else if (navigator.share) {
    try {
      await navigator.share({
        title: t("share_title"), // 🔥 updated
        text: `${t("share_text")} ${referral.referralCode}`, // 🔥 updated
        url: referral.shareLink,
      });
    } catch (err) {
      console.log('Web Share API failed:', err);
      fallbackToClipboard();
    }
  } 
  // 5️⃣ WhatsApp fallback for mobile
  else if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    const waMsg = `${t("whatsapp_msg")} ${referral.referralCode} ${referral.shareLink}`; // 🔥 updated
    window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
  } 
  // 6️⃣ Final fallback: clipboard
  else {
    fallbackToClipboard();
  }

  function fallbackToClipboard() {
    navigator.clipboard.writeText(`${referral.shareLink} (Code: ${referral.referralCode})`);
    alert(t("copied")); // 🔥 updated
  }
};





  if (loading) {
    return (
      <div className="referral-share-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="referral-share-container">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => navigate(-1)}>{t("back")}</button> {/* 🔥 updated */}
        </div>
      </div>
    );
  }

  return (
    <div className="referral-share-container">
      <div className="referral-share-content">
        <div className="referral-hero-section">
          <div className="referral-share-header">
            <button className="back-button" onClick={() => navigate(-1)}>x</button>
            <h2>{t("refer_earn_title")}</h2> {/* 🔥 updated */}
          </div>
          <div className="gift-icon">
            <img src={gift} alt="Gift" />
          </div>
          <h3>{t("invite_earn")}</h3> {/* 🔥 updated */}
          <p className="subtext">
            {t("share_referral")} <span className="highlight">{t("cashback_amount")}</span> {/* 🔥 updated */}
          </p>
        </div>

        {referral && (
          <>
            <div className="referral-card">
              <div className="card-header">
                <span className="card-title">{t("referral_code_title")}</span> {/* 🔥 updated */}
                <div className="card-badge">{t("active")}</div> {/* 🔥 updated */}
              </div>
              <div className="code-display">
                <span className="code-text">{referral.referralCode}</span>
                <button
                  className={`copy-button ${copied ? 'copied' : ''}`}
                  onClick={copyToClipboard}
                >
                  <FaCopy /> {copied ? t("copied") : t("copy_link")} {/* 🔥 updated */}
                </button>
              </div>
            </div>

            <div className="share-section">
              <div className="share-buttons">

                <button className="share-button other" onClick={shareNative}>
                  <FaShareAlt className="button-icon" /> {t("share")} {/* 🔥 updated */}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {referralStats && (
        <div className="referral-reward-card">
          <div className="reward-icon">
            <FaRupeeSign />
          </div>
          <div className="reward-details">
            <h4>{t("earnings_title")}</h4> {/* 🔥 updated */}
            <p className="reward-amount">₹{referralStats.totalEarnings}</p>
            <p className="reward-sub">
              {referralStats.totalReferrals} {t("joined_using_code")} {/* 🔥 updated */}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralShareShop;
