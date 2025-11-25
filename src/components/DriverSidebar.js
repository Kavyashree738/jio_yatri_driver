import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaWallet,
  FaFileAlt,
  FaHistory,
  FaSignOutAlt,
  FaGlobe
} from "react-icons/fa";
import { signOut } from "firebase/auth";
import "../styles/DriverSidebar.css";
import avatarImg from "../assets/images/avatar.jpg";
import { auth } from "../firebase";
import { useTranslation } from "react-i18next";

const API_BASE = "https://jio-yatri-driver.onrender.com";

const DriverSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [profileImage, setProfileImage] = useState(
    localStorage.getItem("driver_photo") || avatarImg
  );

  const [driverInfo, setDriverInfo] = useState({
    name: localStorage.getItem("driver_name"),
    vehicleNumber: localStorage.getItem("driver_vehicle"),
  });

  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  // 🔥 Fetch when sidebar opens
  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchDriverData = async () => {
      try {
        const token = await user.getIdToken();

        // Fetch Driver Info
        const driverRes = await fetch(
          `${API_BASE}/api/driver/info/${user.uid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const driverData = await driverRes.json();
        if (driverData?.data) {
          setDriverInfo(driverData.data);
          localStorage.setItem("driver_name", driverData.data.name);
          localStorage.setItem("driver_vehicle", driverData.data.vehicleNumber);
        }

        // Fetch Profile Image
        const imgRes = await fetch(
          `${API_BASE}/api/upload/profile-image/${user.uid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (imgRes.ok) {
          const blob = await imgRes.blob();
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64 = reader.result;
            setProfileImage(base64);
            localStorage.setItem("driver_photo", base64);
          };

          reader.readAsDataURL(blob);
        }

      } catch (error) {
        console.error("❌ Sidebar fetch failed:", error);
      }
    };

    fetchDriverData();
  }, [isOpen, user]);

  // 🚪 Logout
  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    navigate("/");
  };

  return (
    <>
      <div className={`ds-overlay ${isOpen ? "show" : ""}`} onClick={onClose}>
        <div className="ds-side" onClick={(e) => e.stopPropagation()}>

          {/* 🔹 Profile Header */}
          <div className="ds-profile" onClick={() => navigate("/profile")}>
            <img src={profileImage || avatarImg} className="ds-avatar" alt="profile" />
            <div className="ds-p-text">
              <h3>{driverInfo.name || t("driver")}</h3>
              <p>{driverInfo.vehicleNumber || t("no_vehicle")}</p>
            </div>
          </div>

          {/* 🔹 Menu */}
          <div className="ds-menu">

            <div className="ds-item" onClick={() => navigate("/wallet")}>
              <FaWallet /> <span>{t("wallet")}</span>
            </div>

            <div className="ds-item" onClick={() => navigate("/my-documents")}>
              <FaFileAlt /> <span>{t("my_documents")}</span>
            </div>

            <div className="ds-item" onClick={() => navigate("/delivery-history")}>
              <FaHistory /> <span>{t("delivery_history")}</span>
            </div>

            {/* 🔥 DAILY EARNINGS */}
            <div
              className="ds-item"
              onClick={() => navigate("/driver/earnings", { state: { driverInfo } })}
            >
              <FaWallet /> <span>{t("daily_earnings")}</span>
            </div>

            {/* 🌍 LANGUAGE SELECTION */}
            <div className="ds-item" onClick={() => navigate("/select-language")}>
              <FaGlobe /> <span>{t("change_language")}</span>
            </div>

            {/* 🔹 Logout */}
            <div className="ds-item logout" onClick={() => setShowLogoutPopup(true)}>
              <FaSignOutAlt /> <span>{t("logout")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 Logout Popup */}
      {showLogoutPopup && (
        <div className="logout-overlay">
          <div className="logout-popup">
            <h3>{t("logout")}</h3>
            <p>{t("logout_description")}</p>

            <div className="logout-btns">
              <button className="cancel" onClick={() => setShowLogoutPopup(false)}>
                {t("cancel")}
              </button>

              <button className="confirm" onClick={handleLogout}>
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DriverSidebar;
