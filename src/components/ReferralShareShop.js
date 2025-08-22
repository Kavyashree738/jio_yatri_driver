import React, { useEffect, useState } from 'react';
import { FaCopy, FaWhatsapp, FaShareAlt } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/ReferralShare.css';
import gift from '../assets/images/gift-box.png';
import axios from 'axios';
import confetti from 'canvas-confetti';

const ReferralShareShop = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [referral, setReferral] = useState(null);

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
        if (!res.data?.success) throw new Error(res.data?.error || 'Failed to fetch');
        setReferral({
          referralCode: res.data.referralCode,
          shareLink: res.data.shareLink
        });
      } catch (e) {
        setError(e.response?.data?.error || e.message || 'Failed to load referral code');
      } finally {
        setLoading(false);
      }
    };
    fetchReferral();
  }, [user, shopId]);

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
    const msg = `Join using my shop referral code ${referral.referralCode} and get ₹10 cashback! ${referral.shareLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const shareNative = async () => {
    if (!referral) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join and get ₹10 cashback!',
          text: `Use my shop referral code ${referral.referralCode} to get ₹10 cashback!`,
          url: referral.shareLink
        });
      } else {
        copyToClipboard();
      }
    } catch (e) {
      // ignore cancel
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
          <button onClick={() => navigate(-1)}>Back</button>
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
            <h2>Shop Refer & Earn</h2>
          </div>
          <div className="gift-icon">
            <img src={gift} alt="Gift" />
          </div>
          <h3>Invite Shops & Earn!</h3>
          <p className="subtext">
            Share your <b>shop referral code</b> and get <span className="highlight">₹10 cashback</span> when they register
          </p>
        </div>

        {referral && (
          <>
            <div className="referral-card">
              <div className="card-header">
                <span className="card-title">Your Shop Referral Code</span>
                <div className="card-badge">Active</div>
              </div>
              <div className="code-display">
                <span className="code-text">{referral.referralCode}</span>
                <button
                  className={`copy-button ${copied ? 'copied' : ''}`}
                  onClick={copyToClipboard}
                >
                  <FaCopy /> {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            <div className="share-section">
              <div className="share-buttons">
                <button className="share-button whatsapp" onClick={shareViaWhatsApp}>
                  <FaWhatsapp className="button-icon" /> WhatsApp
                </button>
                <button className="share-button other" onClick={shareNative}>
                  <FaShareAlt className="button-icon" /> Share
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReferralShareShop;
