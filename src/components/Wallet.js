import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import coinsAnimation from "../assets/animations/coins.json";
import "../styles/Wallet.css";
import { useTranslation } from "react-i18next";

const API_BASE = "https://jio-yatri-driver.onrender.com";

const Wallet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const token = await user.getIdToken();

        const res = await fetch(`${API_BASE}/api/driver/info/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setBalance(data.data?.earnings || 0);
      } catch (err) {
        console.error("❌ Wallet Fetch Failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, [user]);

  if (loading) {
  return (
    <div className="wallet-loader-container">
      <div className="wallet-loader"></div>
    </div>
  );
}


  return (
    <div className="wallet-container">
      
      {/* 🔙 Back Header */}
      <div className="wallet-header">
        <button className="wallet-back" onClick={() => navigate(-1)}>←</button>
        <h2>{t("wallet")}</h2>
      </div>

      {/* Balance Card */}
      <div className="wallet-card">
        <p className="wallet-label">{t("balance")}</p>
        <h1 className="wallet-amount">₹{Number(balance).toFixed(2)}</h1>
      </div>

      {/* Lottie Animation */}
      <div className="wallet-animation small">
        <Lottie animationData={coinsAnimation} loop autoPlay style={{ height: 180 }} />
      </div>
    </div>
  );
};

export default Wallet;
