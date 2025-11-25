import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import coinsAnimation from "../assets/animations/coins.json";
import "../styles/Wallet.css";
import { useTranslation } from "react-i18next";

const API_BASE = 'https://jio-yatri-driver.onrender.com';

const ShopWallet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchEarnings();
  }, [user]);

  const fetchEarnings = async () => {
    try {
      const token = await user.getIdToken();

      const res = await fetch(
        `${API_BASE}/api/orders/earnings/owner/${user.uid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();
      setTotalEarnings(data.totalEarnings || 0);
      setTotalOrders(data.totalOrders || 0);
    } catch (err) {
      console.error("❌ Failed fetching shop wallet:", err);
    } finally {
      setLoading(false);
    }
  };

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
        <p className="wallet-label">{t("total_earnings")}</p>
        <h1 className="wallet-amount">₹{Number(totalEarnings).toFixed(2)}</h1>

        <p className="wallet-orders">
          {t("total_orders")}: <b>{totalOrders}</b>
        </p>
      </div>

      {/* Lottie Animation */}
      <div className="wallet-animation small">
        <Lottie animationData={coinsAnimation} loop autoPlay style={{ height: 180 }} />
      </div>
    </div>
  );
};

export default ShopWallet;
