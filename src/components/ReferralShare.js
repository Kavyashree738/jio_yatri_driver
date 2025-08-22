import React, { useState, useEffect } from 'react';
import { FaCopy, FaWhatsapp, FaShareAlt, FaArrowLeft, FaGift } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/ReferralShare.css';
import gift from '../assets/images/gift-box.png';
import axios from 'axios';
import confetti from 'canvas-confetti';
const ReferralShare = () => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [referralData, setReferralData] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

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
      const message = `Join our platform using my referral code ${referralData.referralCode} and get ₹10 cashback! ${referralData.shareLink}`;
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const shareViaOther = async () => {
    if (!referralData) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join and get ₹10 cashback!',
          text: `Use my referral code ${referralData.referralCode} to get ₹10 cashback!`,
          url: referralData.shareLink,
        });
      } else {
        copyToClipboard();
      }
    } catch (err) {
      console.log('Error sharing:', err);
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
          <p>Error loading referral information. Please try again.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
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
          <h2>Refer & Earn</h2>
        </div>
        <div className="referral-share-content auth-required">
          <div className="gift-icon">
            <FaGift />
          </div>
          <h3>Please sign in to access your referral code</h3>
          <p>Log in to start earning rewards by inviting your friends</p>
          <button
            className="login-button"
            onClick={() => navigate('/home')}
          >
            Sign In
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
            <h2>Refer & Earn</h2>
          </div>
          <div className="gift-icon">
            <img src={gift} alt="Gift" />
          </div>
          <h3>Invite Friends & Earn Together!</h3>
          <p className="subtext">
            Share your referral code and get <span className="highlight">₹10 cashback</span> when they sign up
          </p>
        </div>

        {referralData && (
          <>
            <div className="referral-card">
              <div className="card-header">
                <span className="card-title">Your Referral Code</span>
                <div className="card-badge">Active</div>
              </div>
              <div className="code-display">
                <span className="code-text">{referralData.referralCode}</span>
                <button
                  className={`copy-button ${copied ? 'copied' : ''}`}
                  onClick={copyToClipboard}
                >
                  <FaCopy /> {copied ? 'Copied!' : 'Copy'}
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
                  Share
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReferralShare;