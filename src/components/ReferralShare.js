import React, { useState, useEffect } from 'react';
import { FaCopy, FaWhatsapp, FaShareAlt, FaArrowLeft, FaGift } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/ReferralShare.css';
import gift from '../assets/images/gift-box.png';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { FaRupeeSign } from 'react-icons/fa';
import { useTranslation } from "react-i18next"; // 🔥 added

const ReferralShare = () => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [referralData, setReferralData] = useState(null);
    const [referralStats, setReferralStats] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(); // 🔥 added

  useEffect(() => {
    const fetchReferralCode = async () => {
      if (user) {
        try {
          setLoading(true);

          // Get Firebase auth token
          const token = await user.getIdToken();

          const response = await axios.get(
            `https://jio-yatri-driver.onrender.com/api/driver/${user.uid}/referral-code`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          setReferralData(response.data);
          setLoading(false);
        } catch (err) {
          console.error('Error fetching referral code:', err);
          setError(err.message);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchReferralCode();
  }, [user]);


  const copyToClipboard = () => {
    if (referralData) {
      navigator.clipboard.writeText(referralData.shareLink);
      setCopied(true);

      // Fire confetti effect
      fireConfetti();

      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fireConfetti = () => {
    // Basic confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Add some random bursts
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
    }, 250);

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 400);
  };


  const shareViaWhatsApp = () => {
    if (referralData) {
      const message = `${t("whatsapp_msg")} ${referralData.referralCode} ${referralData.shareLink}`; // 🔥 updated
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

 const shareViaOther = () => {
  if (!referralData) return;

  const message = `${referralData.shareLink}|${referralData.referralCode}`;

  // Try Flutter WebView bridge first
  if (window.NativeShare && typeof window.NativeShare.postMessage === 'function') {
    console.log("📤 Sending to Flutter:", message);
    window.NativeShare.postMessage(message);
  } 
  // For Android (older method)
  else if (window.Android && typeof window.Android.share === 'function') {
    window.Android.share(referralData.shareLink, referralData.referralCode);
  }
  // For iOS
  else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.NativeShare) {
    window.webkit.messageHandlers.NativeShare.postMessage(message);
  }
  // Web Share API (for browsers)
  else if (navigator.share) {
    navigator.share({
      title: t("share_title"), // 🔥 updated
      text: `${t("share_text")} ${referralData.referralCode}`, // 🔥 updated
      url: referralData.shareLink,
    }).catch(err => {
      console.log('Web Share API failed:', err);
      fallbackToClipboard();
    });
  }
  // Final fallback
  else {
    fallbackToClipboard();
  }

  function fallbackToClipboard() {
    navigator.clipboard.writeText(`${referralData.shareLink} (Code: ${referralData.referralCode})`);
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
          <p>{t("failed_fetch")}</p> {/* 🔥 updated */}
          <button onClick={() => window.location.reload()}>{t("retry")}</button> {/* 🔥 updated */}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="referral-share-container">
        <div className="referral-share-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            X
          </button>
          <h2>{t("refer_earn_title")}</h2> {/* 🔥 updated */}
        </div>
        <div className="referral-share-content auth-required">
          <div className="gift-icon">
            <FaGift />
          </div>
          <h3>{t("login_to_view")}</h3> {/* 🔥 new key */}
          <p>{t("login_to_continue")}</p> {/* 🔥 new key */}
          <button
            className="login-button"
            onClick={() => navigate('/home')}
          >
            {t("sign_in")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-share-container">


      <div className="referral-share-content">
        <div className="referral-hero-section">
          <div className="referral-share-header">
            <button className="back-button" onClick={() => navigate(-1)}>
              x
            </button>
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

        {referralData && (
          <>
            <div className="referral-card">
              <div className="card-header">
                <span className="card-title">{t("referral_code_title")}</span> {/* 🔥 updated */}
                <div className="card-badge">{t("active")}</div> {/* 🔥 updated */}
              </div>
              <div className="code-display">
                <span className="code-text">{referralData.referralCode}</span>
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
                {/* <button
                  className="share-button whatsapp"
                  onClick={shareViaWhatsApp}
                >
                  <FaWhatsapp className="button-icon" />
                  WhatsApp
                </button> */}
                <button
                  className="share-button other"
                  onClick={shareViaOther}
                >
                  <FaShareAlt className="button-icon" />
                  {t("share")} {/* 🔥 updated */}
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

export default ReferralShare;
