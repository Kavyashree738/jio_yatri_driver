// src/pages/ShopItemsManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaPlus, FaTrash, FaSpinner, FaCheck, FaImage, FaTimes, FaUpload
} from 'react-icons/fa';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/ShopItemsManager.css';
import { useAuth } from '../context/AuthContext';
import { IoMdArrowRoundBack } from "react-icons/io";
// Per-category UI + validation config
const CATEGORY_CONFIG = {
  hotel: {
    label: 'Restaurant',
    requireImage: true,
    itemFields: [
      { key: 'veg', type: 'boolean', label: 'Vegetarian' },
      {
        key: 'category', type: 'select', label: 'Menu Category',
        options: ['main', 'breakfast', 'lunch', 'dinner', 'snacks', 'beverages']
      },
      { key: 'spiceLevel', type: 'select', label: 'Spice Level', options: ['mild', 'medium', 'spicy'] },
      // { key: 'description', type: 'textarea', label: 'Description', maxLength: 100 },
    ],
    defaultItem: {
      veg: true, category: 'main', spiceLevel: 'medium', description: ''
    }
  },
  grocery: {
    label: 'Grocery',
    requireImage: false,
    // itemFields: [{ key: 'description', type: 'textarea', label: 'Description' }],
    defaultItem: { description: '' }
  },
  vegetable: {
    label: 'Vegetable',
    requireImage: false,
    itemFields: [{ key: 'organic', type: 'boolean', label: 'Organic' }],
    defaultItem: { organic: false }
  },
  provision: {
    label: 'Provision',
    requireImage: false,
    itemFields: [
      { key: 'weight', type: 'text', label: 'Weight' },
      { key: 'brand', type: 'text', label: 'Brand' },
    ],
    defaultItem: { weight: '', brand: '' }
  },
  medical: {
    label: 'Medical',
    requireImage: false,
    // itemFields: [{ key: 'prescriptionRequired', type: 'boolean', label: 'Prescription Required' }],
    // defaultItem: { prescriptionRequired: false }
  },
};

const ShopItemsManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { shopId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [shopCategory, setShopCategory] = useState(null);
  const [shopName, setShopName] = useState('');
  const [formData, setFormData] = useState({ items: [] });

  // Preserve shop gallery so it doesn't get wiped when updating only items
  const [existingShopImages, setExistingShopImages] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const catCfg = useMemo(
    () => CATEGORY_CONFIG[shopCategory] || CATEGORY_CONFIG.hotel,
    [shopCategory]
  );

  useEffect(() => {
    if (!user) {
      navigate('/home');
      return;
    }

    const fetchShopData = async () => {
      try {
        const token = await user.getIdToken(true);
        const res = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/shops/${shopId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const shopData = res.data?.data || {};

        setShopCategory(shopData.category || null);
        setShopName(shopData.shopName || '');
        setExistingShopImages(Array.isArray(shopData.shopImages) ? shopData.shopImages : []);

        // Normalize items array and keep image state split between existing + new file
        const items = Array.isArray(shopData.items) ? shopData.items.map((item) => ({
          ...item,
          // Existing mongo id preferred; derive from URL if missing
          existingImageId: item.image || (item.imageUrl ? String(item.imageUrl).split('/').pop() : undefined),
          existingImageUrl: item.imageUrl,
          image: null, // new file slot, defaults to none
        })) : [];

        setFormData({ items });
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load shop data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchShopData();
  }, [user, shopId, navigate]);

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleItemImageUpload = (index, file) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        image: file, // new file
        existingImageId: undefined,
        existingImageUrl: undefined,
      };
      return { ...prev, items };
    });
  };

  const removeItemImage = (index) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        image: null,
        existingImageId: undefined,
        existingImageUrl: undefined,
      };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    const defaults = catCfg.defaultItem || {};
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          name: '',
          price: '',
          image: null,
          existingImageId: undefined,
          existingImageUrl: undefined,
          ...defaults,
        },
      ],
    }));
  };

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    if (!formData.items.length) {
      setError('Please add at least one item');
      return false;
    }

    if (formData.items.some((i) => !i.name || i.price === '' || i.price === null)) {
      setError('Please fill all required fields for each item');
      return false;
    }

    const needsImg = !!catCfg.requireImage;
    if (needsImg && formData.items.some((i) => !i.image && !i.existingImageId)) {
      setError('Please upload an image for each menu item');
      return false;
    }

    if (formData.items.some((i) => i.image instanceof File && i.image.size > 5 * 1024 * 1024)) {
      setError('Each image must be 5MB or less');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('userId', user.uid);
      fd.append('shopId', shopId);

      // Preserve gallery (prevents wiping when menu-only update)
      fd.append('existingShopImages', JSON.stringify(existingShopImages || []));

      // Only send fields relevant to this shop category
      const allowed = new Set(['name', 'price', ...(catCfg.itemFields?.map(f => f.key) || [])]);

      const itemsToSend = formData.items.map((item) => {
        const out = {};
        allowed.forEach((k) => {
          if (item[k] !== undefined && item[k] !== null && item[k] !== '') {
            out[k] = item[k];
          }
        });
        // keep old image id if no new file
        if (!item.image && item.existingImageId) out.image = item.existingImageId;
        return out;
      });




      fd.append('items', JSON.stringify(itemsToSend));

      // Add new files in the same order we built itemsToSend
      formData.items.forEach((item) => {
        if (item.image instanceof File) {
          fd.append('itemImages', item.image);
        }
      });
      console.log('itemsToSend', JSON.stringify(itemsToSend, null, 2));

      const token = await user.getIdToken();
      const apiUrl = `https://jio-yatri-driver.onrender.com/api/shops/${shopId}`;

      // PUT is kept to match your backend; if it supports PATCH, switching is fine.
      const res = await axios.put(apiUrl, fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Update failed');
      }

      setSuccess('Menu updated successfully!');
      setTimeout(() => navigate(`/shop/${shopId}`), 1200);
    } catch (err) {
      const msg =
        err?.response?.status === 413
          ? 'File too large (max 5MB)'
          : err?.response?.data?.error || err.message || 'Update failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="item-manager-loading-container">
          <div className="item-manager-loading-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <FaSpinner className="item-manager-loading-spinner" />
            <p>Loading items…</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <button
        type="button"
        className="item-manager-back-btn"
        onClick={() => navigate(-1)}
      >
        <IoMdArrowRoundBack /> Back
      </button>

      <div className="item-manager-main-container">
        <div className="item-manager-content-card">
          <h1 className="item-manager-title">
            Edit {CATEGORY_CONFIG[shopCategory]?.label || 'Shop'} Items
            {shopName ? <span style={{ fontWeight: 400, marginLeft: 8 }}>— {shopName}</span> : null}
          </h1>

          {error && <div className="item-manager-error-message">{error}</div>}
          {success && <div className="item-manager-success-message">{success}</div>}

          <form onSubmit={handleSubmit}>
            {formData.items.map((item, index) => (
              <div key={index} className="item-manager-form-section">
                <h3>Item {index + 1}</h3>

                {/* Name */}
                <div className="item-manager-form-group">
                  <label>Item Name <span className="item-manager-required-field">*</span></label>
                  <input
                    type="text"
                    value={item.name || ''}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    required
                  />
                </div>

                {/* Price */}
                <div className="item-manager-form-group">
                  <label>Price (₹) <span className="item-manager-required-field">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                    required
                  />
                </div>

                {/* Dynamic category-specific fields */}
                {catCfg.itemFields?.map((f) => (
                  <div className="item-manager-form-group" key={f.key}>
                    <label>
                      {f.label}{f.type !== 'textarea' && ' '} {f.type === 'select' || f.type === 'text' ? <span className="item-manager-required-field">*</span> : null}
                    </label>

                    {f.type === 'boolean' && (
                      <button
                        type="button"
                        className={`item-manager-toggle-btn ${item[f.key] ? 'item-manager-toggle-active' : ''}`}
                        onClick={() => handleItemChange(index, f.key, !item[f.key])}
                      >
                        {item[f.key] ? 'Yes' : 'No'}
                      </button>
                    )}

                    {f.type === 'select' && (
                      <select
                        value={item[f.key] ?? f.options[0]}
                        onChange={(e) => handleItemChange(index, f.key, e.target.value)}
                        required
                      >
                        {f.options.map((opt) => (
                          <option key={opt} value={opt}>{opt[0].toUpperCase() + opt.slice(1)}</option>
                        ))}
                      </select>
                    )}

                    {f.type === 'text' && (
                      <input
                        type="text"
                        value={item[f.key] || ''}
                        onChange={(e) => handleItemChange(index, f.key, e.target.value)}
                        required
                      />
                    )}

                    {f.type === 'textarea' && (
                      <textarea
                        rows="3"
                        value={item[f.key] || ''}
                        onChange={(e) => handleItemChange(index, f.key, e.target.value)}
                        maxLength={f.maxLength}
                        placeholder="Short description"
                      />
                    )}
                  </div>
                ))}

                {/* Image section (required for hotel, optional for others) */}
                <div className="item-manager-form-group">
                  <label>
                    Item Image {catCfg.requireImage ? <span className="item-manager-required-field">*</span> : <span className="item-manager-optional-field">(optional)</span>}
                  </label>

                  {/* Existing image preview */}
                  {item.existingImageUrl && (
                    <div className="item-manager-image-preview">
                      <div className="item-manager-image-preview-content">
                        <FaImage className="item-manager-image-icon" />
                        <span className="item-manager-image-text">Existing Image</span>
                        <button
                          type="button"
                          className="item-manager-remove-image-btn"
                          onClick={() => removeItemImage(index)}
                          aria-label="Remove existing image"
                        >
                          <FaTimes />
                        </button>
                      </div>
                      <img src={item.existingImageUrl} alt="Preview" className="item-manager-image-thumb" />
                    </div>
                  )}

                  {/* New file preview */}
                  {item.image && (
                    <div className="item-manager-image-preview">
                      <div className="item-manager-image-preview-content">
                        <FaImage className="item-manager-image-icon" />
                        <span className="item-manager-image-text">{item.image.name}</span>
                        <button
                          type="button"
                          className="item-manager-remove-image-btn"
                          onClick={() => removeItemImage(index)}
                          aria-label="Remove new image"
                        >
                          <FaTimes />
                        </button>
                      </div>
                      <img src={URL.createObjectURL(item.image)} alt="Preview" className="item-manager-image-thumb" />
                    </div>
                  )}

                  {/* File input */}
                  <label className="item-manager-file-upload-label">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setError('Each image must be 5MB or less');
                          return;
                        }
                        handleItemImageUpload(index, file);
                      }}
                      className="item-manager-file-input"
                    />
                    <span className="item-manager-file-upload-btn">
                      <FaUpload /> {item.image || item.existingImageUrl ? 'Change Image' : 'Upload Image'}
                    </span>
                    <span className="item-manager-file-upload-note">(JPG, PNG, max 5MB)</span>
                  </label>
                </div>

                {/* Remove item */}
                <button
                  type="button"
                  className="item-manager-remove-item-btn"
                  onClick={() => removeItem(index)}
                >
                  <FaTrash /> Remove Item
                </button>
              </div>
            ))}

            {/* Add item */}
            <button type="button" className="item-manager-add-item-btn" onClick={addItem}>
              <FaPlus /> Add Item
            </button>

            {/* Submit */}
            <button type="submit" className="item-manager-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <FaSpinner className="item-manager-submit-spinner" /> Updating...
                </>
              ) : (
                <>
                  <FaCheck /> Update Items
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ShopItemsManager;