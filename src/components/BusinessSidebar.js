import React, { useEffect, useState } from "react";
import "../styles/BusinessSidebar.css";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import axios from "axios";

import { FaFileAlt, FaHistory, FaSignOutAlt, FaLanguage, FaStore, FaWallet } from "react-icons/fa";

const API_BASE = 'https://jio-yatri-driver.onrender.com';

const BusinessSidebar = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [shops, setShops] = useState([]);
    const [owner, setOwner] = useState(null);

    const [showLogoutPopup, setShowLogoutPopup] = useState(false);

    useEffect(() => {
        if (!isOpen || !user) return;
        fetchShopData();
    }, [isOpen, user]);

    const fetchShopData = async () => {
        try {
            const token = await user.getIdToken();
            const res = await axios.get(`${API_BASE}/api/dashboard/owner/${user.uid}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setShops(res.data?.data || []);
            console.log("🔹 Sidebar API Response:", res.data);
            setOwner(user);
        } catch (err) {
            console.error("❌ Fetch shop sidebar error:", err);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.clear();
        navigate("/");
    };

    return (
        <>
            <div className={`bs-overlay ${isOpen ? "show" : ""}`} onClick={onClose}>
                <div className="bs-side" onClick={(e) => e.stopPropagation()}>

                    {/* 🔹 Shops Section */}
                    <div className="bs-shop-list">
                        {shops.map((shop, index) => (
                            
                            <div key={shop._id || index} className="bs-shop-card">
                                <img
                                    src={
                                        shop.shopImageUrls?.[0] ||
                                        "https://via.placeholder.com/100x100?text=Shop"
                                    }
                                    className="bs-shop-img"
                                    alt={shop.shopName}
                                />
                                <div className="bs-shop-details">
                                    <h4>{shop.shopName}</h4>
                                    <p className="bs-address">{shop.address}</p>
                                </div>
                            </div>
                        ))}
                    </div>


                    {/* 🔹 Menu Section */}
                    <div className="bs-menu">
                        <div className="bs-item" onClick={() => navigate("/owner-documents")}>
                            <FaFileAlt /> <span>{t("documents")}</span>
                        </div>

                        <div className="bs-item" onClick={() => navigate("/business-orders")}>
                            <FaHistory /> <span>{t("shop_history")}</span>
                        </div>

                        <div className="bs-item" onClick={() => navigate("/select-language")}>
                            <FaLanguage /> <span>{t("change_language")}</span>
                        </div>
                        <div className="bs-item" onClick={() => navigate("/shop-wallet")}>
                            <FaWallet className="bs-icon" />
                            <span>{t("wallet")}</span>
                        </div>

                        <div className="bs-item logout" onClick={() => setShowLogoutPopup(true)}>
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

export default BusinessSidebar;
