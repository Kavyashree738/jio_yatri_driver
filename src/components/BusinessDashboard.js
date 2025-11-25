import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FaStar, FaPhone, FaWhatsapp, FaShoppingBag,
  FaClock, FaMapMarkerAlt, FaChevronLeft, FaChevronRight,
  FaMotorcycle, FaPlus, FaUtensils, FaStore, FaCarrot,
  FaBoxes, FaMedkit, FaEdit, FaTrash, FaYoutube,
  FaHamburger, FaPrescriptionBottleAlt, FaBreadSlice, FaShareAlt, FaCoffee,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/ShopDisplay.css';
import { useAuth } from '../context/AuthContext';
import { IoAddCircleSharp } from 'react-icons/io5';
import { useTranslation } from "react-i18next";

import HelplineButton from '../components/HelplineButton'

const OwnerShops = () => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user, softLogout } = useAuth();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  const categoryIcons = {
    hotel: <FaUtensils />,
    grocery: <FaStore />,
    vegetable: <FaCarrot />,
    provision: <FaBoxes />,
    medical: <FaMedkit />,
    bakery: <FaBreadSlice />, // ← NEW
    cafe: <FaCoffee />,
  };

  const categoryNames = {
    hotel: 'Hotel/Restaurant',
    grocery: 'Grocery Store',
    vegetable: 'Vegetable Vendor',
    provision: 'Provision Store',
    medical: 'Medical Store',
    bakery: 'Bakery',   // ← NEW
    cafe: 'Cafe',
  };

  useEffect(() => {
    const fetchOwnerShops = async () => {
      try {
        if (!user?.uid) return;

        const res = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/shops/owner/${user.uid}`
        );
        setShops(res.data.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to fetch your shops');
        setLoading(false);
      }
    };
    fetchOwnerShops();
  }, [user?.uid]);

  const handleEditShop = (shopId, e) => {
    e.stopPropagation();
    navigate(`/edit-shop/${shopId}`);
  };

  const handleAddMenu = (shopId, category, e) => {
    e.stopPropagation();
    navigate(`/shops/${shopId}/items?category=${category}`);
  };

  const handleShare = (shopId, e) => {
    e.stopPropagation();
    navigate(`/shops/${shopId}/share`);
  };

  const handleYoutubeClick = () => {
    window.open('https://youtube.com/@ambaninewstv?si=PBGWaPOKXdjV-Oa4', '_blank');
  };


  const handleLogoutClick = () => {
    setShowLogoutPopup(true);
  };

  const confirmLogout = () => {
    softLogout();
    if (window.Logout && window.Logout.postMessage) {
      window.Logout.postMessage("logout");
      // console.log("📩 Logout sent to WebView Flutter");
    }
    localStorage.clear();
    navigate('/home', { replace: true });
  };

  const handleDeleteShop = async (shopId, e) => {
    e.stopPropagation();
    try {
      await axios.delete(
        `https://jio-yatri-driver.onrender.com/api/shops/${shopId}`,
        { data: { userId: user.uid } }
      );
      setShops(shops.filter(shop => shop._id !== shopId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete shop');
    }
  };

  const getMenuIcon = (category) => {
    switch (category) {
      case 'hotel':
        return <FaHamburger />;
      case 'bakery': return <FaBreadSlice />;
      case 'cafe': return <FaCoffee />;
      case 'grocery':
        return <FaShoppingBag />;
      case 'vegetable':
        return <FaCarrot />;
      case 'provision':
        return <FaBreadSlice />;
      case 'medical':
        return <FaPrescriptionBottleAlt />;
      default:
        return <FaPlus />;
    }
  };

  if (loading) {
    return (
      <div className="sd-loading-container">
        <div className="sd-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sd-error-container">
        <p className="sd-error-message">{error}</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="sd-container">
        <div className="sds-header">
          <h1 className="sds-title">{t("shops_title")}</h1>

          <button onClick={handleLogoutClick} className="sds-logout-btn">
            {t("logout")}
          </button>

          <button className="sds-youtube-btn" onClick={handleYoutubeClick}>
            <FaYoutube className="sds-youtube-icon" />
          </button>
          <HelplineButton />
        </div>

        {shops.length === 0 ? (
          <div className="sd-no-shops">
            <p>{t("no_shops_yet")}</p>
            <button
              className="sd-primary-button"
              onClick={() => navigate('/register-shop')}
            >
              {t("register_first_shop")}
            </button>
          </div>
        ) : (
          <>
            <div className="sd-shops-grid">
              {shops.map((shop) => (
                <div
                  key={shop._id}
                  className="sd-shop-card"
                  onClick={() => navigate(`/shop/${shop._id}`)}
                >
                  <div className="sd-shop-actions-owner">
                    <button
                      className="sd-edit-button"
                      onClick={(e) => handleEditShop(shop._id, e)}
                      title="Edit Shop"
                    >
                      <FaEdit />
                    </button>

                    <button
                      className="sd-add-menu-button"
                      onClick={(e) => handleAddMenu(shop._id, shop.category, e)}
                      title="Add Menu Items"
                    >
                      <IoAddCircleSharp />
                    </button>

                    <button
                      className="sd-share-button"
                      onClick={(e) => handleShare(shop._id, e)}
                      title="Share Shop Referral"
                    >
                      <FaShareAlt />
                    </button>

                    {/* Optional delete
                    <button
                      className="sd-delete-button"
                      onClick={(e) => handleDeleteShop(shop._id, e)}
                      title="Delete Shop"
                    >
                      <FaTrash />
                    </button> */}
                  </div>

                  {/* <div className="sd-shop-category-badge">
                    {categoryIcons[shop.category]}
                    <span>{categoryNames[shop.category]}</span>
                  </div> */}

                  <div className="sd-shop-images">
                    <div className="sd-shop-image-strip">
                      {shop.shopImageUrls?.map((imgUrl, index) => (
                        <img
                          key={index}
                          src={imgUrl}
                          alt={`${shop.shopName} ${index + 1}`}
                          className="sd-shop-thumb"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="sd-shop-info">
                    <h2 className="sd-shop-name">{shop.shopName}</h2>

                    <div className="sd-shop-address">
                      <FaMapMarkerAlt className="sd-icon" />
                      <span>{shop.address?.address || 'Address not specified'}</span>
                    </div>

                    <div className="sd-shop-stats">
                      <div className="sd-stat-item">
                        <FaStar className="sd-icon" />
                        <span>{shop.averageRating || t("new")}</span>
                      </div>
                      <div className="sd-stat-item">
                        <FaShoppingBag className="sd-icon" />
                        <span>{shop.items?.length || 0} {t("items")}</span>

                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="add-another-shop-section">
              <div className="add-another-shop-content">
                <h3>{t("another_shop_title")}</h3>
                <p>{t("another_shop_desc")}</p>
                <button
                  className="add-another-shop-btn"
                  onClick={() => navigate('/register-shop')}
                >
                  <FaPlus /> {t("register_another_shop")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {showLogoutPopup && (
        <div className="sds-popup-overlay">
          <div className="sds-popup">
            <div className="sds-popup-alert">
              <span className="sds-popup-icon">!</span>
            </div>
            <h2>{t("logout_popup_title")}</h2>
            <p>{t("logout_popup_desc")}.</p>
            <div className="sds-popup-buttons">
              <button className="sds-cancel-btn" onClick={() => setShowLogoutPopup(false)}>{t("cancel")}</button>
              <button className="sds-logout-confirm-btn" onClick={confirmLogout}>{t("logout")}</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default OwnerShops;