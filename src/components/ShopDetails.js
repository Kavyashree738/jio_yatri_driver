// src/pages/ShopDetails.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaStar, FaClock, FaMapMarkerAlt, FaChevronLeft,
  FaChevronRight, FaPhone, FaWhatsapp, FaUtensils,
  FaStore, FaCarrot, FaBoxes, FaMedkit, FaFire,
  FaBreadSlice, FaCoffee
} from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "../styles/ShopDetails.css";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

import { FaTrashAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslation } from "react-i18next";

const categoryIcons = {
  hotel: <FaUtensils />,
  grocery: <FaStore />,
  vegetable: <FaCarrot />,
  provision: <FaBoxes />,
  medical: <FaMedkit />,
  bakery: <FaBreadSlice />,
  cafe: <FaCoffee />
};

const ShopDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPhone, setShowPhone] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [vegFilter, setVegFilter] = useState("all");

  // auth (to show owner actions)
  const { user } = useAuth();

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { t } = useTranslation();

  // Cart (kept as in your codebase)
  const { addItem, cart } = useCart();
  const shopCartItems = shop ? (cart?.[shop._id]?.items || []) : [];
  const cartCount = shopCartItems.reduce((s, it) => s + (it.quantity || 0), 0);

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hour, minute] = timeStr.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const res = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/shops/${id}`
        );
        setShop(res.data.data);
      } catch (err) {
        setError(
          err.response?.data?.error || err.message || t("failed_fetch_shop")
        );
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
  }, [id, t]);

  const handleThumbnailClick = (index) => setCurrentImageIndex(index);

  const navigateImage = (direction) => {
    if (!shop?.shopImageUrls) return;
    if (direction === "prev") {
      setCurrentImageIndex((prev) =>
        prev === 0 ? shop.shopImageUrls.length - 1 : prev - 1
      );
    } else {
      setCurrentImageIndex((prev) =>
        prev === shop.shopImageUrls.length - 1 ? 0 : prev + 1
      );
    }
  };

  const openWhatsApp = (phone, shopName) => {
    if (!phone) {
      alert(t("phone_missing"));
      return;
    }
    const rawPhone = phone.replace(/\D/g, "");
    const phoneNumber = rawPhone.startsWith("91") ? rawPhone : "91" + rawPhone;
    const message = encodeURIComponent(
      t("whatsapp_business_msg", { shopName })
    );
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(
      navigator.userAgent
    );
    const url = isMobile
      ? `https://wa.me/${phoneNumber}?text=${message}`
      : `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${message}`;
    window.open(url, "_blank");
  };

  // Apply filters intelligently:
  // - Category filter applies only for hotel (because only hotel items have category like breakfast/lunch…)
  // - Veg/Non-veg applies for hotel & bakery (cafe doesn't have veg flag)
  const filteredItems = () => {
    if (!shop?.itemsWithUrls?.length && !shop?.items?.length) return [];
    const items = shop.itemsWithUrls || shop.items;

    const supportsVeg = ["hotel", "bakery"].includes(shop.category);
    const isHotel = shop.category === "hotel";

    return items.filter((item) => {
      const categoryMatch =
        !isHotel ||
        filter === "all" ||
        (item.category && item.category.toLowerCase() === filter);

      let vegMatch = true;
      if (vegFilter !== "all" && supportsVeg) {
        if (vegFilter === "veg") vegMatch = item.veg === true;
        if (vegFilter === "nonveg") vegMatch = item.veg === false;
      }
      return categoryMatch && vegMatch;
    });
  };

  if (loading) {
    return (
      <div className="sd-loading-screen">
        <div className="sd-spinner"></div>
        <p>{t("loading_shop_details")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sd-error-screen">
        <p>{error}</p>
        <button className="sd-back-btn" onClick={() => navigate(-1)}>
          {t("go_back")}
        </button>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="sd-error-screen">
        <p>{t("shop_not_found")}</p>
        <button className="sd-back-btn" onClick={() => navigate(-1)}>
          {t("go_back")}
        </button>
      </div>
    );
  }

  const isOwner = user && String(user.uid) === String(shop.userId);

  return (
    <>
      <Header />
      <div className="sd-details-container">
        <button
          className="sd-back-btn"
          onClick={() => navigate("/business-dashboard")}
        >
          <FaChevronLeft /> {t("back_to_list")}
        </button>

        <div className="sd-category-badge">
          {categoryIcons[shop.category] || <FaStore />}
          <span>{shop.category || t("shop_label")}</span>
        </div>

        {/* Image Gallery */}
        <div className="sd-gallery-container">
          {shop.shopImageUrls?.length > 0 && (
            <>
              <div className="sd-main-image">
                <img
                  src={shop.shopImageUrls[currentImageIndex]}
                  alt={`${shop.shopName} ${currentImageIndex + 1}`}
                  className="sd-current-image"
                />
                <button
                  className="sd-nav-btn sd-prev-btn"
                  onClick={() => navigateImage("prev")}
                >
                  <FaChevronLeft />
                </button>
                <button
                  className="sd-nav-btn sd-next-btn"
                  onClick={() => navigateImage("next")}
                >
                  <FaChevronRight />
                </button>
                <div className="sd-image-counter">
                  {currentImageIndex + 1} / {shop.shopImageUrls.length}
                </div>
              </div>
              <div className="sd-thumbnail-container">
                {shop.shopImageUrls.map((img, index) => (
                  <div
                    className={`sd-thumbnail ${index === currentImageIndex ? "sd-active" : ""}`}
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                  >
                    <img src={img} alt={`Thumbnail ${index + 1}`} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Shop Info */}
        <div className="sd-content-container">
          <div className="sd-header">
            <div className="sd-header-info">
              <h1 className="sd-title">{shop.shopName}</h1>
              <div className="sd-meta-container">
                <div className="sd-meta-item">
                  <FaMapMarkerAlt className="sd-meta-icon" />
                  <span>{shop.address?.address || t("address_not_available")}</span>
                </div>
                <div className="sd-meta-item">
                  <FaClock className="sd-meta-icon" />
                  <span>
                    {shop.openingTime
                      ? t("opens_at", { time: formatTime(shop.openingTime) })
                      : t("opening_time_not_available")}
                  </span>
                  <span>
                    {shop.closingTime &&
                      ` | ${t("closes_at", { time: formatTime(shop.closingTime) })}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="sd-action-container">
              {/* Owner-only Add/Edit button */}
              {isOwner && (
                <div className="sd-owner-actions">
                  <button
                    className="sd-manage-menu-btn"
                    onClick={() => navigate(`/shop/${shop._id}/menu`)}
                    title={t("add_edit_items_title")}
                  >
                    {t("add_edit_items")}
                  </button>

                  <button
                    className="sd-delete-btn"
                    title={t("delete_shop_title")}
                    onClick={() => setShowDeletePopup(true)}
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              )}

              {/* <div className="sd-contact-actions">
                {showPhone ? (
                  <a href={`tel:${shop.phone}`} className="sd-call-btn">
                    <FaPhone /> {shop.phone}
                  </a>
                ) : (
                  <button className="sd-call-btn" onClick={() => setShowPhone(true)}>
                    <FaPhone /> Show Number
                  </button>
                )}
                <button
                  className="sd-whatsapp-btn"
                  onClick={() => openWhatsApp(shop.phone, shop.shopName)}
                >
                  <FaWhatsapp /> WhatsApp
                </button>
              </div> */}
            </div>
          </div>

          {/* Products Section */}
          <div className="sd-products-section">
            <h2 className="sd-section-title">
              {["hotel", "bakery", "cafe"].includes(shop.category)
                ? t("menu_items_title")
                : t("products_title")}
            </h2>

            {/* Filters: full (category + veg) for hotel; veg-only for bakery */}
            {["hotel", "bakery"].includes(shop.category) && (
              <div className="sd-filters-container">
                {shop.category === "hotel" && (
                  <div className="sd-filter-group">
                    <h4>{t("filter_category")}</h4>
                    <div className="sd-filter-buttons">
                      {["all", "breakfast", "lunch", "dinner", "snacks"].map((c) => (
                        <button
                          key={c}
                          className={filter === c ? "active" : ""}
                          onClick={() => setFilter(c)}
                        >
                          {t(`category_${c}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="sd-filter-group">
                  <h4>{t("filter_type")}</h4>
                  <div className="sd-filter-buttons">
                    {[
                      ["all", t("type_all")],
                      ["veg", t("type_veg")],
                      ["nonveg", t("type_nonveg")],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        className={vegFilter === val ? "active" : ""}
                        onClick={() => setVegFilter(val)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {filteredItems().length > 0 ? (
              <div className="sd-products-grid">
                {filteredItems().map((item) => (
                  <div className="sd-product-card" key={item._id || item.name}>
                    <div className="sd-product-image-container">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="sd-product-image"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/placeholder-food.jpg";
                          }}
                        />
                      ) : (
                        <div className="sd-product-image-placeholder">
                          {shop.category === "hotel" && <FaUtensils className="sd-placeholder-icon" />}
                          {shop.category === "bakery" && <FaBreadSlice className="sd-placeholder-icon" />}
                          {shop.category === "cafe" && <FaCoffee className="sd-placeholder-icon" />}
                          {["grocery", "vegetable", "provision", "medical"].includes(shop.category) && (
                            <FaBoxes className="sd-placeholder-icon" />
                          )}
                        </div>
                      )}

                      {/* Veg/Non-Veg badge for hotel & bakery only */}
                      {["hotel", "bakery"].includes(shop.category) && typeof item.veg === "boolean" && (
                        <div className={`sd-veg-badge ${item.veg ? "veg" : "nonveg"}`}>
                          {item.veg ? t("veg") : t("non_veg")}
                        </div>
                      )}
                    </div>

                    <div className="sd-product-info">
                      <div className="sd-product-name-price">
                        <h3 className="sd-product-name">{item.name}</h3>
                        <p className="sd-product-price">₹{item.price}</p>
                      </div>

                      {/* Category label only for hotel menu items */}
                      {shop.category === "hotel" && item.category && (
                        <p className="sd-food-category">
                          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                        </p>
                      )}

                      {/* Provision meta */}
                      {["provision", "grocery"].includes(shop.category) && (item.brand || item.weight || item.quantity !== undefined) && (
                        <div className="sd-provision-meta">
                          {item.brand && (
                            <span className="sd-provision-chip sd-provision-brand">
                              {item.brand}
                            </span>
                          )}
                          {item.weight && (
                            <span className="sd-provision-chip sd-provision-weight">
                              {item.weight}
                            </span>
                          )}
                          {item.quantity !== undefined && (
                            <span className="sd-provision-chip sd-provision-qty">
                              {t("qty_label")} {item.quantity}
                            </span>
                          )}
                        </div>
                      )}

                      {item.description && (
                        <p className="sd-product-desc">{item.description}</p>
                      )}

                      {/* Tags */}
                      <div className="sd-product-tags">
                        {item.organic && (
                          <span className="sd-product-tag organic">
                            {t("tag_organic")}
                          </span>
                        )}
                        {item.prescriptionRequired && (
                          <span className="sd-product-tag prescription">
                            {t("tag_prescription_required")}
                          </span>
                        )}
                        {shop.category === "hotel" && item.spiceLevel && (
                          <span className={`sd-product-tag spice-${item.spiceLevel}`}>
                            <FaFire /> {item.spiceLevel.charAt(0).toUpperCase() + item.spiceLevel.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sd-no-products">
                {["hotel", "bakery"].includes(shop.category)
                  ? t("no_menu_items_match")
                  : t("no_products_available")}
              </p>
            )}
          </div>
        </div>
      </div>
      {showDeletePopup && (
  <div className="sd-popup-overlay">
    <div className="sd-popup">
      <h3>{t("delete_shop_title")}</h3>
      <p>{t("delete_shop_confirm_text")}</p>

      <div className="sd-popup-actions">
        <button
          className="sd-confirm-delete"
          onClick={async () => {
            setDeleting(true);
            try {
              await axios.delete(
                `https://jio-yatri-driver.onrender.com/api/shops/${shop._id}`,
                { data: { userId: user?.uid } }
              );
              toast.success(t("shop_delete_success"));
              navigate("/business-dashboard");
            } catch (err) {
              toast.error(err.response?.data?.error || t("shop_delete_failed"));
            } finally {
              setDeleting(false);
              setShowDeletePopup(false);
            }
          }}
          disabled={deleting}
        >
          {deleting ? t("deleting") : t("delete_yes")}
        </button>

        <button
          className="sd-cancel-delete"
          onClick={() => setShowDeletePopup(false)}
        >
          {t("delete_cancel")}
        </button>
      </div>
    </div>
  </div>
)}

      <Footer />
    </>
  );
};

export default ShopDetails;
