import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaPhone, FaStar } from "react-icons/fa";
import { signOut } from "firebase/auth";

import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import "../styles/DriverProfile.css";
import ImageCropper from './ImageCropper';
import avatarImg from "../assets/images/avatar.jpg";

// Vehicle images
import twoWheelerImg from "../assets/images/vehicles/two-wheeler.png";
import threeWheelerImg from "../assets/images/vehicles/three-wheeler.png";
import truckImg from "../assets/images/vehicles/tata-407.png";
import pickupImg from "../assets/images/vehicles/bulara.png";
import tata407Img from "../assets/images/vehicles/tata-407.png";
import { useTranslation } from "react-i18next";

import axios from "axios";


import Header from "./Header";
import Footer from "./Footer";

const DriverProfile = () => {
    const { user, setMessage } = useAuth();
    const navigate = useNavigate();

    const { t, i18n } = useTranslation();

    const [driverInfo, setDriverInfo] = useState(null);
    const [shipments, setShipments] = useState([]);
    const [profileImage, setProfileImage] = useState(avatarImg);
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isRegistered, setIsRegistered] = useState(true);
    const [passbookUploaded, setPassbookUploaded] = useState(false);
    const [status, setStatus] = useState('inactive');

    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);


    const [showLogoutPopup, setShowLogoutPopup] = useState(false);




    const [cropMode, setCropMode] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const [showUploadOptions, setShowUploadOptions] = useState(false);
    const [settlement, setSettlement] = useState({
        today: { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
        pending: []
    });

    useEffect(() => {
        if (!user) return;

        const fetchShipments = async () => {
            try {
                const token = await user.getIdToken();
                const res = await axios.get(
                    `https://jio-yatri-driver.onrender.com/api/shipments/driver/${user.uid}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                // Some APIs return {data: []}, some just []
                const shipmentList = Array.isArray(res.data) ? res.data : res.data.data;
                setShipments(shipmentList || []);

                console.log("✅ Shipments fetched for driver:", shipmentList);
            } catch (err) {
                console.error("❌ Error fetching shipments:", err.message);
            }
        };

        fetchShipments();
    }, [user]);


    // ---------- Data fetching with full debug logs ----------
    const fetchDriverInfo = useCallback(async () => {
        try {
            const token = await user.getIdToken();

            // First check for pending settlements
            // const settlementCheckRes = await fetch(
            //     ` http://localhost:5000/api/settlement/check-settlement/${user.uid}`,
            //     {
            //         method: 'GET',
            //         headers: { Authorization: `Bearer ${token}` }
            //     }
            // );

            // if (!settlementCheckRes.ok) {
            //     throw new Error('Failed to check settlements');
            // }

            // Then fetch all driver data
            const [driverRes, imageRes, settlementRes] = await Promise.all([
                fetch(`https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`https://jio-yatri-driver.onrender.com/api/settlement/driver/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (driverRes.status === 404) {
                setIsRegistered(false);
                setLoading(false);
                return;
            }

            if (!driverRes.ok) throw new Error('Failed to fetch driver info');

            const driverData = await driverRes.json();
            const settlementData = await settlementRes.json();

            setDriverInfo(driverData.data);
            setPassbookUploaded(!!driverData.data?.passbook);
            setStatus(driverData.data?.status || 'inactive');
            setSettlement({
                today: settlementData.currentDaySettlement || {
                    cashCollected: 0,
                    onlineCollected: 0,
                    driverEarned: 0,
                    ownerEarned: 0
                },
                pending: settlementData.pending || []
            });

            try {
                if (imageRes.ok) {
                    const blob = await imageRes.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    setProfileImage(imageUrl);
                } else if (user.photoURL) {
                    setProfileImage(user.photoURL);
                } else {
                    console.warn('⚠️ Profile image missing, using default avatar.');
                    setProfileImage('/assets/images/avatar.jpg');
                }
            } catch (imgErr) {
                console.warn('⚠️ Profile image fetch failed:', imgErr.message);
                setProfileImage('/assets/default-avatar.jpg');
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        const tag = "[DriverProfile:useEffect]";
        if (!user) {
            console.warn(`${tag} No user, skipping fetch`);
            setLoading(false);
            return;
        }
        console.log(`${tag} User exists, fetching profile`);
        fetchDriverInfo();
    }, [user, fetchDriverInfo]);

    // ---------- Helpers ----------
    const completedDeliveries = useMemo(
        () => shipments.filter((s) => s.status?.toLowerCase() === "delivered").length,
        [shipments]
    );

    const ratingValue = Number(driverInfo?.ratings?.average || 0);
    const stars = Array.from({ length: 5 }, (_, i) => i < Math.floor(ratingValue));


    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        console.log("📝 [Upload] onChange fired. File:", file);

        if (!file) {
            console.warn("⚠️ [Upload] No file selected");
            return;
        }

        if (!/^image\//.test(file.type)) {
            console.error("❌ [Upload] Not an image. type:", file.type);
            setError("Please select an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            console.error("❌ [Upload] File too large:", file.size);
            setError("Image size should be less than 5MB");
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        console.log("✅ [Upload] Local preview URL:", previewUrl);

        setSelectedImage(previewUrl);
        setCropMode(true);           // open cropper
        console.log("🟩 [Crop] cropMode -> true");
    };

    const handleCropComplete = async (croppedImageUrl) => {
        console.log("✅ [Crop] Completed. URL:", croppedImageUrl);
        setCropMode(false);
        setProfileImage(croppedImageUrl);

        try {
            setIsUploading(true);
            const blob = await fetch(croppedImageUrl).then((r) => r.blob());
            console.log("🧱 [Upload] Cropped blob size:", blob.size);

            const formData = new FormData();
            formData.append("file", blob, "profile.jpg");

            const token = await user.getIdToken(true);
            console.log("🔐 [Upload] Using token (first 10):", token.slice(0, 10) + "...");

            const res = await fetch("https://jio-yatri-driver.onrender.com/api/upload/profile-image", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            console.log("📤 [Upload] Response status:", res.status);
            const resText = await res.text();
            console.log("📤 [Upload] Response text:", resText);

            if (!res.ok) throw new Error("Upload failed: " + res.status);

            // 🔄 Force refresh the image from server (avoid cache)
            const bust = Date.now();
            const refreshed = await fetch(
                `https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}?t=${bust}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (refreshed.ok) {
                const newBlob = await refreshed.blob();
                const newUrl = URL.createObjectURL(newBlob);
                console.log("🆕 [Upload] Server image refreshed URL:", newUrl);
                setProfileImage(newUrl);
            } else {
                console.warn("⚠️ [Upload] Could not refetch server image. status:", refreshed.status);
            }
        } catch (err) {
            console.error("❌ [Upload] Error during upload:", err);
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const inr = (n = 0) =>
        new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(n) || 0);

    const vehiclePic = (() => {
        const t = (driverInfo?.vehicleType || "").toLowerCase();
        if (t.includes("two")) return twoWheelerImg;
        if (t.includes("three")) return threeWheelerImg;
        if (t.includes("pickup")) return pickupImg;
        if (t.includes("407")) return tata407Img;
        if (t.includes("truck")) return truckImg;
        return pickupImg;
    })();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            if (window.Logout && window.Logout.postMessage) {
                window.Logout.postMessage("logout");
            }
            setMessage?.({ text: "Logged out successfully", isError: false });
            localStorage.clear();
            navigate("/");
        } catch (err) {
            setMessage?.({ text: err.message, isError: true });
        }
    };

    // ---------- UI ----------
    if (!user) {
        return (
            <div className="p-center">
                <div className="p-card p-auth">
                    <h2>{t("not_logged_in")}</h2>
                    <button className="p-btn p-btn-primary" onClick={() => navigate("/home")}>
                        {t("go_to_login")}
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-loading-container">
                <div className="p-spinner"></div>

            </div>
        );
    }


    if (error) {
        return (
            <div className="p-center">
                <div className="p-card p-error">{error}</div>
            </div>
        );
    }

    return (
        <>
            <Header />
            <div className="p-wrap">
                <div className="p-card p-profile-card">
                    {/* Avatar + Vehicle Illustration */}
                    <div className="p-top">
                        <div className="p-avatar-ring">
                            <img
                                src={profileImage || avatarImg}
                                alt="Driver"
                                className="p-avatar"
                                onError={(e) => (e.currentTarget.src = avatarImg)}
                            />

                            <label className="p-upload-label">
                                <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                                <span className="p-upload-text">📸</span>
                            </label>
                        </div>

                        <img src={vehiclePic} alt="Vehicle" className="p-vehicle" />
                    </div>

                    {/* Name + Rating */}
                    <div className="p-details">

                        <div className="p-name-row">
                            <h1 className="p-name">{driverInfo?.name || "Driver"}</h1>
                            <div className="p-stars">
                                {stars.map((filled, i) => (
                                    <FaStar key={i} className={`p-star ${filled ? "p-star--filled" : ""}`} />
                                ))}
                                {/* <span className="p-rating-number">
                                {ratingValue > 0 ? ratingValue.toFixed(1) : "—"}
                            </span> */}
                            </div>
                        </div>

                        {/* Contact + Vehicle line */}
                        <div className="p-meta">
                            <div className="p-meta-row">
                                <FaPhone className="p-meta-icon" />
                                <span>{driverInfo?.phone || "N/A"}</span>
                            </div>
                            <div className="p-meta-row">
                                <span className="p-dot" />
                                <span className="p-vehicletxt">
                                    {driverInfo?.vehicleType || "Vehicle"} •{" "}
                                    {driverInfo?.vehicleNumber || "—"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    {/* Stats */}
                    <div className="p-stats">
                        {/* Top full width earnings */}
                        <div className="p-stat-earnings">
                            <div className="p-stat-label">{t("your_earnings")}</div>
                            <div className="p-stat-value">₹ {inr(driverInfo?.earnings)}</div>
                        </div>

                        {/* Bottom two columns */}
                        <div className="p-stats-bottom">
                            <div className="p-stat-box">
                                <div className="p-stat-label">{t("rating")}</div>
                                <div className="p-stat-value">
                                    {ratingValue > 0 ? ratingValue.toFixed(1) : "—"}
                                </div>
                            </div>

                            <div className="p-stat-box">
                                <div className="p-stat-label">{t("completed_deliveries")}</div>
                                <div className="p-stat-value">{completedDeliveries}</div>
                            </div>
                        </div>
                    </div>


                    {/* Actions */}
                    <div className="p-buttons">
                        <div className="p-buttons-row">
                            <button className="p-btn half" onClick={() => navigate("/delivery-history")}>
                                {t("delivery_history")}
                            </button>
                            <button
                                className="p-btn half"
                                onClick={() => navigate("/driver/earnings", { state: { driverInfo } })}
                            >
                                {t("daily_earnings")}
                            </button>
                        </div>
                        <button className="p-btn logout" onClick={() => setShowLogoutPopup(true)}>
                            {t("logout")}
                        </button>

                    </div>
                </div>
            </div>
            {cropMode && selectedImage && (
                <div className="cropper-overlay">
                    <div className="cropper-modal">
                        <ImageCropper
                            image={selectedImage}
                            onCropComplete={handleCropComplete}
                            onCancel={() => setCropMode(false)}
                        />
                    </div>
                </div>
            )}

            {showLogoutPopup && (
                <div className="logout-overlay">
                    <div className="logout-popup">
                        <div className="logout-icon">❗</div>
                        <h3>{t("logout_now")}</h3>
                        <p>{t("logout_description")}.</p>

                        <div className="logout-buttons">
                            <button className="cancel-btn" onClick={() => setShowLogoutPopup(false)}>
                                {t("cancel")}
                            </button>
                            <button className="logout-btn" onClick={handleLogout}>
                                {t("logout")}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <Footer />
        </>
    );
};

export default DriverProfile;