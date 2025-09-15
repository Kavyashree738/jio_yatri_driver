// src/pages/ShopMenuManager.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ItemCatalogPicker from './ItemCatalogPicker';
import { useAuth } from '../context/AuthContext';
import '../styles/ShopMenuManager.css';
import Header from './Header';
import Footer from './Footer';

export default function ShopMenuManager() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const apiBase ='https://jio-yatri-driver.onrender.com';
  const baseImg = (id) => `${apiBase}/api/shops/images/${id}`;

  // helpers
  const toNum = (v) => (typeof v === 'number' ? v : parseFloat(v));
  const imgUrlOf = (it) => (it?.image ? baseImg(it.image) : (it?.imageUrl || ''));

  useEffect(() => {
    const run = async () => {
      if (!shopId) return;
      try {
        const res = await axios.get(`${apiBase}/api/shops/${shopId}`);
        if (!res?.data?.success) throw new Error('Failed to load shop');

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
        setError(e.message || 'Failed to load');
      }
    };
    run();
  }, [shopId]);

  // ✅ Save a single item immediately
  const saveSingleItem = async (newItem) => {
    if (!user || !shop) {
      setError('You must be logged in.');
      return;
    }

    try {
      const payloadItems = [...items, {
        ...newItem,
        price: newItem.price != null ? Number(newItem.price) : null,
        quantity: newItem.quantity != null ? Number(newItem.quantity) : 0,
      }];

      const fd = new FormData();
      fd.append('userId', user.uid);
      fd.append('items', JSON.stringify(payloadItems));
      fd.append('existingShopImages', JSON.stringify(shop.shopImages || []));

      const token = await user.getIdToken();
      const res = await axios.put(`${apiBase}/api/shops/${shopId}`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res?.data?.success) throw new Error(res?.data?.error || 'Save failed');

      // update UI
      const savedItems = (res.data.data.items || []).map((o) => ({
        ...o,
        price: o.price != null ? Number(o.price) : null,
        quantity: o.quantity != null ? Number(o.quantity) : 0,
        image: o.image || null,
        imageUrl: o.imageUrl || (o.image ? baseImg(o.image) : null),
      }));

      setItems(savedItems);
      setMsg('Item saved successfully');
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to save item');
    }
  };

  if (authLoading) return <div className="menu-manager-loading">Loading auth…</div>;
  if (!user) return <div className="menu-manager-login-prompt">Please login</div>;
  if (!shop)
    return (
      <div className="menu-manager-loading-shop">
        Loading shop… {error && <span className="menu-manager-error-text">{error}</span>}
      </div>
    );

  return (
    <>
      <Header />
      <div className="menu-manager-container">
        <button onClick={() => navigate(-1)} className="menu-manager-back-btn">
          ← Back
        </button>

        <div className="menu-manager-header">
          <h1 className="menu-manager-title">{shop.shopName}</h1>
          <div className="menu-manager-details">
            Category: <b>{shop.category}</b> • Shop ID: {shop._id}
          </div>
        </div>

        {/* Catalog Picker */}
        <div className="menu-manager-catalog-section">
          <ItemCatalogPicker category={shop.category} onAdd={saveSingleItem} />
        </div>

        {/* Current items list */}
        {/* <div className="menu-manager-items-section">
          <h3 className="menu-manager-subtitle">Menu Items ({items.length})</h3>
          {!items.length && (
            <div className="menu-manager-empty-state">
              No items yet. Use the catalog above to add.
            </div>
          )}

          <div className="menu-manager-items-grid">
            {items.map((it, idx) => {
              const priceNum = toNum(it.price);
              const imgUrl = imgUrlOf(it);

              return (
                <div key={idx} className="menu-manager-item-card">
                  <div className="menu-manager-item-image-container">
                    <div
                      className="menu-manager-item-image"
                      style={{ backgroundImage: imgUrl ? `url(${imgUrl})` : 'none' }}
                    />
                  </div>

                  <div className="menu-manager-item-details">
                    <div className="menu-manager-item-name">{it.name}</div>

                    <div className="menu-manager-item-properties">
                      {'weight' in it && it.weight && (
                        <span className="menu-manager-attr">Weight: {it.weight}</span>
                      )}
                      {'brand' in it && it.brand && (
                        <span className="menu-manager-attr">Brand: {it.brand}</span>
                      )}
                      {['grocery', 'provision'].includes(shop.category) && (
                        <span className="menu-manager-attr">Qty: {it.quantity}</span>
                      )}
                    </div>

                    <div className="menu-manager-item-price">
                      ₹ {Number.isFinite(priceNum) ? priceNum.toFixed(2) : '--'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <div className="menu-manager-error-msg">{error}</div>}
          {msg && <div className="menu-manager-success-msg">{msg}</div>}
        </div> */}
      </div>
      <Footer />
    </>
  );
}
