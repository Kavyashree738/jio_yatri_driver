// src/pages/ShopMenuManager.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ItemCatalogPicker from './ItemCatalogPicker';
import { useAuth } from '../context/AuthContext';
import '../styles/ShopMenuManager.css';
import Header from './Header';
import Footer from './Footer';
import { useTranslation } from "react-i18next"; // 🔥 added

export default function ShopMenuManager() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation(); // 🔥 added

  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const apiBase = 'https://jio-yatri-driver.onrender.com';
  const baseImg = (id) => `${apiBase}/api/shops/images/${id}`;

  // helpers
  const toNum = (v) => (typeof v === 'number' ? v : parseFloat(v));
  const imgUrlOf = (it) => (it?.image ? baseImg(it.image) : (it?.imageUrl || ''));

  useEffect(() => {
    const run = async () => {
      if (!shopId) return;
      try {
        const res = await axios.get(`${apiBase}/api/shops/${shopId}`);
        if (!res?.data?.success) throw new Error(t("failed_to_load_shop"));

        const s = res.data.data;
        setShop(s);

        // normalize items
        const normalized = (s.items || []).map((o) => ({
          ...o,
          price: o.price != null ? Number(o.price) : null,
          quantity: o.quantity != null ? Number(o.quantity) : 0,
          image: o.image || null,
          imageUrl: o.imageUrl || (o.image ? baseImg(o.image) : null),
        }));
        setItems(normalized);
      } catch (e) {
        setError(e.message || t("failed_to_load"));
      }
    };
    run();
  }, [shopId, t]);

  // ✅ Save a single item immediately
 const saveSingleItem = async (newItem) => {
  if (!user || !shop) {
    setError(t("must_be_logged_in"));
    return;
  }

  try {
    const fd = new FormData();
    fd.append('userId', user.uid);
    fd.append(
      'item',
      JSON.stringify({
        ...newItem,
        price: newItem.price != null ? Number(newItem.price) : null,
        quantity: newItem.quantity != null ? Number(newItem.quantity) : 0,
      })
    );
    fd.append('existingShopImages', JSON.stringify(shop.shopImages || []));

    const token = await user.getIdToken();
    const res = await axios.put(`${apiBase}/api/shops/${shopId}/add-item`, fd, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res?.data?.success) throw new Error(res?.data?.error || t("save_failed"));

    setItems(res.data.data.items);
    setMsg(t("item_saved"));
    setError('');
  } catch (e) {
    setError(e?.response?.data?.error || e.message || t("failed_to_save_item"));
  }
};


  if (authLoading) return <div className="menu-manager-loading">{t("loading_auth")}</div>;
  if (!user) return <div className="menu-manager-login-prompt">{t("please_login")}</div>;
  if (!shop)
    return (
      <div className="menu-manager-loading-shop">
        {t("loading_shop")} {error && <span className="menu-manager-error-text">{error}</span>}
      </div>
    );

  return (
    <>
      <Header />
      <div className="menu-manager-container">
        <button onClick={() => navigate(-1)} className="menu-manager-back-btn">
          ← {t("back")}
        </button>

        <div className="menu-manager-header">
          <h1 className="menu-manager-title">{shop.shopName}</h1>
          <div className="menu-manager-details">
            {t("category")}: <b>{shop.category}</b> • {t("shop_id")}: {shop._id}
          </div>
        </div>

        {/* Catalog Picker */}
        <div className="menu-manager-catalog-section">
          <ItemCatalogPicker category={shop.category} onAdd={saveSingleItem} />
        </div>

      </div>
      <Footer />
    </>
  );
}
