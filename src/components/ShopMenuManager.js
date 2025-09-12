// src/pages/ShopMenuManager.jsx
import React, { useEffect, useMemo, useState } from 'react';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const apiBase = 'https://jio-yatri-driver.onrender';
  const baseImg = (id) => `${apiBase}/api/shops/images/${id}`;

  // helpers
  const toNum = (v) => (typeof v === 'number' ? v : parseFloat(v));
  const imgUrlOf = (it) => (it?.image ? baseImg(it.image) : (it?.imageUrl || ''));
  const SPICE_COUNT = { mild: 1, medium: 2, spicy: 3 };

  useEffect(() => {
    const run = async () => {
      if (!shopId) return;
      const res = await axios.get(`${apiBase}/api/shops/${shopId}`);
      if (!res?.data?.success) throw new Error('Failed to load shop');

      const s = res.data.data;
      setShop(s);

      // normalize items (prevents NaN + missing image after save)
      const normalized = (s.items || []).map((o) => ({
        ...o,
        price: o.price != null ? Number(o.price) : null,
        image: o.image || null,
        imageUrl: o.imageUrl || (o.image ? baseImg(o.image) : null),
      }));
      setItems(normalized);
    };
    run().catch((e) => setError(e.message || 'Failed to load'));
    // eslint-disable-next-line
  }, [shopId]);

  // Validation for all categories
  // Validation for all categories
const canSave = useMemo(() => {
  if (!shop) return false;

  const isMenuType = ['hotel', 'bakery', 'cafe'].includes(shop.category);

  if (isMenuType) {
    return items.every((it) => {
      const p = toNum(it.price);
      const hasImg = !!(it.image || it.imageUrl);
      const categoryOk = shop.category !== 'hotel' || !!it.category; // only hotel needs category
      return it.name && Number.isFinite(p) && p >= 1 && hasImg && categoryOk;
    });
  }

  // grocery, vegetable, provision, medical
  return items.every((it) => {
    const p = toNum(it.price);
    return it.name && Number.isFinite(p) && p >= 0;
  });
}, [items, shop]);

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Called by ItemCatalogPicker when admin-provided item is chosen
  const addFromCatalog = (newItem) => {
    const exists = items.some(
      (it) => (it.name || '').trim().toLowerCase() === newItem.name.trim().toLowerCase()
    );
    if (exists) {
      setError('This item is already added.');
      return;
    }
    setError('');
    setItems((prev) => [
      ...prev,
      {
        ...newItem,
        price: newItem.price != null ? Number(newItem.price) : null,
        image: newItem.image || null,
        imageUrl: newItem.image ? baseImg(newItem.image) : (newItem.imageUrl || null),
      },
    ]);
  };

  const save = async () => {
    if (!user) {
      setError('You must be logged in.');
      return;
    }
    if (!shop) return;

    setSaving(true);
    setError('');
    setMsg('');

    try {
      const payloadItems = items.map((o) => ({
        ...o,
        price: o.price != null ? Number(o.price) : null,
      }));

      const fd = new FormData();
      fd.append('userId', user.uid);
      fd.append('items', JSON.stringify(payloadItems));
      fd.append('existingShopImages', JSON.stringify(shop.shopImages || []));

      const token = await user.getIdToken();
      const res = await axios.put(`${apiBase}/api/shops/${shopId}`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res?.data?.success) throw new Error(res?.data?.error || 'Save failed');

      setMsg('Menu saved');

      // Normalize fresh items from response for consistent UI
      const savedItems = (res.data.data.items || []).map((o) => ({
        ...o,
        price: o.price != null ? Number(o.price) : null,
        image: o.image || null,
        imageUrl: o.imageUrl || (o.image ? baseImg(o.image) : null),
      }));
      setItems(savedItems);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to save');
    } finally {
      setSaving(false);
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
    <Header/>
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

      {/* Catalog Picker (admin-provided images + names) */}
      <div className="menu-manager-catalog-section">
        <ItemCatalogPicker category={shop.category} onAdd={addFromCatalog} />
      </div>

      {/* Current items list */}
      <div className="menu-manager-items-section">
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
                    {/* hotel */}
                    {'veg' in it && (
                      <span className={`menu-manager-veg-indicator ${it.veg ? 'veg' : 'non-veg'}`}>
                        {it.veg ? 'Veg' : 'Non-Veg'}
                      </span>
                    )}
                    {it.category && <span className="menu-manager-item-category">{it.category}</span>}
                    {'spiceLevel' in it && it.spiceLevel && (
                      <span className="menu-manager-spice-level">
                        {'•'.repeat(SPICE_COUNT[it.spiceLevel] ?? 0)}
                      </span>
                    )}

                    {/* vegetable */}
                    {'organic' in it && it.organic && (
                      <span className="menu-manager-organic-badge">Organic</span>
                    )}

                    {/* medical */}
                    {'prescriptionRequired' in it && it.prescriptionRequired && (
                      <span className="menu-manager-prescription-badge">Rx Required</span>
                    )}

                    {/* provision */}
                    {'weight' in it && it.weight && (
                      <span className="menu-manager-attr">Weight: {it.weight}</span>
                    )}
                    {'brand' in it && it.brand && (
                      <span className="menu-manager-attr">Brand: {it.brand}</span>
                    )}
                  </div>

                  {/* grocery + hotel can send description */}
                  {it.description && (
                    <div className="menu-manager-desc">{it.description}</div>
                  )}

                  <div className="menu-manager-item-price">
                    ₹ {Number.isFinite(priceNum) ? priceNum.toFixed(2) : '--'}
                  </div>
                </div>

                <button onClick={() => removeItem(idx)} className="menu-manager-remove-btn">
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {error && <div className="menu-manager-error-msg">{error}</div>}
        {msg && <div className="menu-manager-success-msg">{msg}</div>}

        <div className="menu-manager-actions">
          <button onClick={() => navigate(-1)} className="menu-manager-cancel-btn">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave || saving}
            className={`menu-manager-save-btn ${!canSave || saving ? 'disabled' : ''}`}
          >
            {saving ? 'Saving…' : 'Save Menu'}
          </button>
        </div>
      </div>
    </div>
    <Footer/>
    </>
  );
}
