// src/pages/EditShopRegistration.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FaStore, FaCarrot, FaMedkit, FaBoxes, FaTimes, FaPlus, FaTrash,
    FaSpinner, FaCheck, FaUpload, FaImage, FaClock, FaPhone, FaWallet,
    FaEnvelope, FaMapMarkerAlt, FaImages, FaFileImage, FaArrowLeft, FaArrowRight
} from 'react-icons/fa';
import { MdLocalDining } from 'react-icons/md';
import axios from 'axios';
import AddressAutocomplete from '../components/AddressAutocomplete';
import '../styles/CategoryRegistration.css';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Category-specific config (UI + defaults + validation)
const CATEGORY_CONFIG = {
    grocery: {
        label: 'Groceries',
        color: '#4ECDC4',
        requireItemImage: false,
        itemFields: [
            // { key: 'description', type: 'textarea', label: 'Description', maxLength: 200 },
        ],
        defaultItem: { description: '' },
        keepKeys: ['name', 'price', 'description'],
    },
    vegetable: {
        label: 'Vegetables',
        color: '#45B7D1',
        requireItemImage: false,
        itemFields: [
            { key: 'organic', type: 'boolean', label: 'Organic' },
            // { key: 'description', type: 'textarea', label: 'Description', maxLength: 200 },
        ],
        defaultItem: { organic: false, description: '' },
        keepKeys: ['name', 'price', 'organic', 'description'],
    },
    provision: {
        label: 'Provisions',
        color: '#FFA07A',
        requireItemImage: false,
        itemFields: [
            { key: 'weight', type: 'text', label: 'Weight (e.g., 1kg / 500g)' },
            { key: 'brand', type: 'text', label: 'Brand' },
            // { key: 'description', type: 'textarea', label: 'Description', maxLength: 200 },
        ],
        defaultItem: { weight: '', brand: '', description: '' },
        keepKeys: ['name', 'price', 'weight', 'brand', 'description'],
    },
    medical: {
        label: 'Medical',
        color: '#98D8C8',
        requireItemImage: false,
        itemFields: [
            //   { key: 'prescriptionRequired', type: 'boolean', label: 'Prescription Required' },
            //   { key: 'description', type: 'textarea', label: 'Description', maxLength: 200 },
        ],
        defaultItem: { prescriptionRequired: false, description: '' },
        keepKeys: ['name', 'price', 'prescriptionRequired', 'description'],
    },
    hotel: {
        label: 'Food Service',
        color: '#FF6B6B',
        requireItemImage: true, // hotel requires image per item per your schema
        itemFields: [
            { key: 'veg', type: 'boolean', label: 'Vegetarian' },
            { key: 'category', type: 'select', label: 'Menu Category', options: ['main', 'breakfast', 'lunch', 'dinner', 'snacks', 'beverages'] },
            { key: 'spiceLevel', type: 'select', label: 'Spice Level', options: ['mild', 'medium', 'spicy'] },
            // { key: 'description', type: 'textarea', label: 'Description', maxLength: 100 },
        ],
        defaultItem: { veg: true, category: 'main', spiceLevel: 'medium', description: '' },
        keepKeys: ['name', 'price', 'veg', 'category', 'spiceLevel', 'description'],
    },
};

const categoriesForIndicator = [
    { name: 'Groceries', value: 'grocery', icon: <FaStore />, color: CATEGORY_CONFIG.grocery.color },
    { name: 'Vegetables', value: 'vegetable', icon: <FaCarrot />, color: CATEGORY_CONFIG.vegetable.color },
    { name: 'Provisions', value: 'provision', icon: <FaBoxes />, color: CATEGORY_CONFIG.provision.color },
    { name: 'Medical', value: 'medical', icon: <FaMedkit />, color: CATEGORY_CONFIG.medical.color },
    { name: 'Food Service', value: 'hotel', icon: <MdLocalDining />, color: CATEGORY_CONFIG.hotel.color },
];

const EditShopRegistration = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { shopId } = useParams();

    const [selectedCategory, setSelectedCategory] = useState('');
    const [isOwner, setIsOwner] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [formData, setFormData] = useState({
        shopName: '',
        phone: '',
        phonePeNumber: '',
        email: '',
        address: { address: '', coordinates: { lat: null, lng: null } },
        openingTime: '',
        closingTime: '',
        items: [],
    });

    const [shopImages, setShopImages] = useState([]); // new shop images to upload
    const [existingShopImages, setExistingShopImages] = useState([]); // IDs of existing shop images

    const [activeSection, setActiveSection] = useState('basic');
    const [progress, setProgress] = useState(25);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const catCfg = useMemo(
        () => (selectedCategory ? CATEGORY_CONFIG[selectedCategory] : null),
        [selectedCategory]
    );

    // Gate if not logged in
    useEffect(() => {
        if (!authLoading && !user) navigate('/home', { state: { from: `/edit-shop/${shopId}` } });
    }, [user, authLoading, navigate, shopId]);

    // Load shop
    useEffect(() => {
        const fetchShop = async () => {
            try {
                const token = await user.getIdToken(true);
                const apiBase = 'https://jio-yatri-driver.onrender.com';
                const res = await axios.get(`${apiBase}/api/shops/${shopId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const shop = res.data?.data || {};
                if (shop.userId !== user.uid) {
                    setIsOwner(false);
                    setIsLoading(false);
                    return;
                }

                // Normalize items: keep existing image id/url separate from new file
                const cfg = CATEGORY_CONFIG[shop.category] || CATEGORY_CONFIG.hotel;
                const items = (shop.items || []).map((it) => ({
                    name: it.name || '',
                    price: it.price ?? '',
                    // category-specific fields:
                    ...cfg.defaultItem,
                    ...['veg', 'category', 'spiceLevel', 'description', 'organic', 'weight', 'brand', 'prescriptionRequired']
                        .reduce((acc, k) => ({ ...acc, [k]: it[k] !== undefined ? it[k] : acc[k] }), cfg.defaultItem),
                    image: null, // placeholder for NEW File
                    existingImageId: it.image || (it.imageUrl ? String(it.imageUrl).split('/').pop() : undefined),
                    existingImageUrl: it.imageUrl || null,
                }));

                setFormData({
                    shopName: shop.shopName || '',
                    phone: shop.phone || '',
                    phonePeNumber: shop.phonePeNumber || '',
                    email: shop.email || '',
                    address: shop.address || { address: '', coordinates: { lat: null, lng: null } },
                    openingTime: shop.openingTime || '',
                    closingTime: shop.closingTime || '',
                    items: items.length ? items : [{
                        name: '', price: '', image: null, ...cfg.defaultItem,
                    }],
                });

                setExistingShopImages(Array.isArray(shop.shopImages) ? shop.shopImages : []);
                setSelectedCategory(shop.category || '');
                setIsOwner(true);
                setIsLoading(false);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load shop data');
                setIsOwner(false);
                setIsLoading(false);
            }
        };

        if (user && shopId) fetchShop();
    }, [user, shopId]);

    // Progress
    useEffect(() => {
        let completed = 0;
        if (formData.shopName) completed += 10;
        if (formData.phone) completed += 10;
        if (formData.phonePeNumber) completed += 10;
        if (formData.address?.address) completed += 10;
        if (formData.openingTime && formData.closingTime) completed += 10;
        if ((formData.items || []).length > 0) completed += 30;
        if ((shopImages?.length || 0) + (existingShopImages?.length || 0) > 0) completed += 20;
        setProgress(Math.min(100, completed));
    }, [formData, shopImages, existingShopImages]);

    // Handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddressSelect = (addressData) => {
        setFormData((prev) => ({
            ...prev,
            address: { address: addressData.address, coordinates: addressData.coordinates },
        }));
    };

    const handleItemChange = (index, field, value) => {
        setFormData((prev) => {
            const items = [...(prev.items || [])];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, items };
        });
    };

    const handleItemImageUpload = (index, file) => {
        setFormData((prev) => {
            const items = [...(prev.items || [])];
            items[index] = {
                ...items[index],
                image: file,                 // new file
                existingImageId: undefined,  // stop using old id
                existingImageUrl: undefined, // hide old preview
            };
            return { ...prev, items };
        });
    };

    const removeItemImage = (index) => {
        setFormData((prev) => {
            const items = [...(prev.items || [])];
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
        const cfg = catCfg || CATEGORY_CONFIG.hotel;
        setFormData((prev) => ({
            ...prev,
            items: [
                ...(prev.items || []),
                { name: '', price: '', image: null, ...cfg.defaultItem },
            ],
        }));
    };

    const removeItem = (index) => {
        setFormData((prev) => ({
            ...prev,
            items: (prev.items || []).filter((_, i) => i !== index),
        }));
    };

    // Validation (hotel requires image per item)
    const validateForm = () => {
        if (!selectedCategory) { setError('Category not found for this shop'); return false; }
        if (!formData.shopName.trim()) { setError('Shop name is required'); return false; }
        if (!/^[0-9]{10}$/.test(formData.phone || '')) { setError('Enter a valid 10-digit phone number'); return false; }
        if (!/^[0-9]{10}$/.test(formData.phonePeNumber || '')) { setError('Enter a valid 10-digit PhonePe number'); return false; }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Enter a valid email'); return false; }
        if (!formData.address?.address) { setError('Please select an address from the suggestions'); return false; }
        if (!formData.openingTime || !formData.closingTime) { setError('Opening and closing times are required'); return false; }
        if (!(formData.items || []).length) { setError('Please add at least one item'); return false; }
        if ((formData.items || []).some((it) => !it.name || it.price === '' || it.price === null || Number(it.price) < 0)) {
            setError('Fill required fields for each item (name, non-negative price)');
            return false;
        }
        if (catCfg?.requireItemImage && (formData.items || []).some((it) => !it.image && !it.existingImageId)) {
            setError('Please upload an image for each menu item');
            return false;
        }
        if ((formData.items || []).some((it) => it.image instanceof File && it.image.size > 5 * 1024 * 1024)) {
            setError('Each item image must be 5MB or less');
            return false;
        }
        if ((shopImages || []).some((f) => f.size > 5 * 1024 * 1024)) {
            setError('Each shop image must be 5MB or less');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!validateForm()) return;
        if (!user) { setError('You must be logged in to update'); return; }

        setIsSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('userId', user.uid);
            fd.append('shopId', shopId);
            fd.append('category', selectedCategory);
            fd.append('shopName', formData.shopName);
            fd.append('phone', formData.phone);
            fd.append('phonePeNumber', formData.phonePeNumber);
            fd.append('email', formData.email || '');
            fd.append('address', JSON.stringify(formData.address));
            fd.append('openingTime', formData.openingTime);
            fd.append('closingTime', formData.closingTime);

            // Preserve existing shop image IDs
            fd.append('existingShopImages', JSON.stringify(existingShopImages || []));

            // Items payload (only send keys relevant to category; include existing image id when no new file)
            const keep = new Set(catCfg?.keepKeys || []);
            const itemsToSend = (formData.items || []).map((it) => {
                const out = {};
                keep.forEach((k) => {
                    if (it[k] !== undefined && it[k] !== null && it[k] !== '') out[k] = it[k];
                });
                if (!it.image && it.existingImageId) {
                    out.image = it.existingImageId; // tell backend to reuse existing GridFS id
                }
                return out;
            });
            fd.append('items', JSON.stringify(itemsToSend));

            // New shop images (files)
            (shopImages || []).forEach((file) => fd.append('shopImages', file));

            // New item images — append only for items that chose a File
            (formData.items || []).forEach((it) => {
                if (it.image instanceof File) fd.append('itemImages', it.image);
            });

            const token = await user.getIdToken();
            const apiBase = 'https://jio-yatri-driver.onrender.com';
            const res = await axios.put(`${apiBase}/api/shops/${shopId}`, fd, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.data?.success) throw new Error(res.data?.error || 'Update failed');

            setSuccess('Update successful! Redirecting…');
            setTimeout(() => navigate(`/shop/${shopId}`), 1200);
        } catch (err) {
            const msg =
                err?.response?.status === 413
                    ? 'File size too large (max 5MB)'
                    : err?.response?.data?.error || err.message || 'Update failed';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const removeExistingShopImage = (index) => {
        setExistingShopImages((prev) => prev.filter((_, i) => i !== index));
    };

    const categoryIndicator = () => {
        const c = categoriesForIndicator.find((x) => x.value === selectedCategory);
        if (!c) return null;
        return (
            <div className="hr-category-indicator" style={{ backgroundColor: c.color }}>
                {c.icon}
                <span>{c.name}</span>
            </div>
        );
    };

    if (authLoading || isLoading) {
        return (
            <div className="hr-loading-container">
                <FaSpinner className="hr-spinner" />
                <p>Loading…</p>
            </div>
        );
    }

    if (isOwner === false) {
        return (
            <div className="hr-auth-error">
                <p>You are not authorized to edit this shop.</p>
                <button onClick={() => navigate('/home')}>Go Back</button>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="hr-auth-error">
                <p>You need to be logged in to edit shop details.</p>
                <button onClick={() => navigate('/home')}>Go to Login</button>
            </div>
        );
    }

    const itemsTabDisabled =
        !formData.shopName || !formData.phone || !formData.phonePeNumber || !formData.address?.address;

    const imagesTabDisabled = !(formData.items || []).length ||
        (catCfg?.requireItemImage && (formData.items || []).some((i) => !i.image && !i.existingImageId));

    const reviewTabDisabled = (shopImages.length === 0 && existingShopImages.length === 0);

    const ItemsStepTitle = selectedCategory === 'hotel' ? 'Menu Items' : 'Items';

    return (
        <>
            <Header />
            <div className="hr-container">
                <div className="hr-card">
                    <div className="hr-header">
                        <h1 className="hr-title">Edit Your {catCfg?.label} Business</h1>
                        <p className="hr-subtitle">Update your business details</p>

                        {categoryIndicator()}

                        <div className="hr-progress-container">
                            <div className="hr-progress-bar" style={{ width: `${progress}%` }}>
                                <span className="hr-progress-text">{progress}% Complete</span>
                            </div>
                        </div>

                        <div className="hr-navigation">
                            <button
                                className={`hr-nav-btn ${activeSection === 'basic' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('basic')}
                            >
                                <FaStore className="hr-nav-icon" />
                                Basic Info
                            </button>

                            <button
                                className={`hr-nav-btn ${activeSection === 'items' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('items')}
                                disabled={itemsTabDisabled}
                            >
                                <MdLocalDining className="hr-nav-icon" />
                                {ItemsStepTitle}
                            </button>

                            <button
                                className={`hr-nav-btn ${activeSection === 'images' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('images')}
                                disabled={imagesTabDisabled}
                            >
                                <FaImage className="hr-nav-icon" />
                                Images
                            </button>

                            <button
                                className={`hr-nav-btn ${activeSection === 'review' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('review')}
                                disabled={reviewTabDisabled}
                            >
                                <FaCheck className="hr-nav-icon" />
                                Review
                            </button>
                        </div>
                    </div>

                    {/* Alerts */}
                    {error && (
                        <div className="hr-alert hr-error">
                            <div className="hr-alert-icon">!</div>
                            <div className="hr-alert-message">{error}</div>
                            <button className="hr-alert-close" onClick={() => setError('')}>
                                <FaTimes />
                            </button>
                        </div>
                    )}
                    {success && (
                        <div className="hr-alert hr-success">
                            <div className="hr-alert-icon">✓</div>
                            <div className="hr-alert-message">{success}</div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="hr-form" noValidate>
                        {/* Basic */}
                        <div className={`hr-section ${activeSection !== 'basic' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaStore className="hr-section-icon" />
                                Basic Information
                            </h2>

                            <div className="hr-form-grid">
                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaStore className="hr-input-icon" />
                                        Shop Name <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="shopName"
                                        value={formData.shopName}
                                        onChange={handleInputChange}
                                        placeholder="Enter shop name"
                                        className="hr-input"
                                        required
                                    />
                                </div>

                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaPhone className="hr-input-icon" />
                                        Phone Number <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="10-digit phone number"
                                        className="hr-input"
                                        pattern="[0-9]{10}"
                                        required
                                    />
                                </div>

                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaWallet className="hr-input-icon" />
                                        PhonePe Number <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="phonePeNumber"
                                        value={formData.phonePeNumber}
                                        onChange={handleInputChange}
                                        placeholder="10-digit PhonePe number"
                                        className="hr-input"
                                        pattern="[0-9]{10}"
                                        required
                                    />
                                </div>

                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaEnvelope className="hr-input-icon" />
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="example@domain.com"
                                        className="hr-input"
                                    />
                                </div>

                                <div className="hr-form-group hr-time-group">
                                    <label className="hr-label">
                                        <FaClock className="hr-input-icon" />
                                        Opening Time <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        name="openingTime"
                                        value={formData.openingTime}
                                        onChange={handleInputChange}
                                        className="hr-time-input"
                                        required
                                    />
                                </div>

                                <div className="hr-form-group hr-time-group">
                                    <label className="hr-label">
                                        <FaClock className="hr-input-icon" />
                                        Closing Time <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        name="closingTime"
                                        value={formData.closingTime}
                                        onChange={handleInputChange}
                                        className="hr-time-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="hr-form-group hr-address-group">
                                <label className="hr-label">
                                    <FaMapMarkerAlt className="hr-input-icon" />
                                    Address <span className="hr-required">*</span>
                                </label>
                                <AddressAutocomplete
                                    onSelect={handleAddressSelect}
                                    initialValue={formData.address?.address}
                                />
                            </div>

                            <div className="hr-section-actions">
                                <button
                                    type="button"
                                    className="hr-btn hr-btn-next"
                                    onClick={() => setActiveSection('items')}
                                    disabled={itemsTabDisabled}
                                >
                                    Next: {ItemsStepTitle} <MdLocalDining />
                                </button>
                            </div>
                        </div>

                        {/* Items */}
                        <div className={`hr-section ${activeSection !== 'items' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                {/* <MdLocalDining className="hr-section-icon" /> */}
                                {ItemsStepTitle}
                            </h2>

                            {(formData.items || []).map((item, index) => (
                                <div key={index} className="hr-item-form">
                                    <h3 className="hr-item-title">{selectedCategory === 'hotel' ? 'Menu Item' : 'Item'} {index + 1}</h3>

                                    <div className="hr-form-grid">
                                        <div className="hr-form-group">
                                            <label className="hr-label">Name</label>
                                            <input
                                                type="text" name={`itemName-${index}`}
                                                value={item.name}
                                                step="any" 
                                                inputMode="decimal" 
                                                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                                className="hr-input"
                                                required={activeSection === 'items'}
                                            />
                                        </div>

                                        <div className="hr-form-group">
                                            <label className="hr-label">Price (₹)</label>
                                            <input
                                                type="number"
                                                name={`itemPrice-${index}`}
                                                min="0"
                                                value={item.price}
                                                onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                                className="hr-input"
                                                required={activeSection === 'items'}
                                            />
                                        </div>

                                        {/* Dynamic per-category fields */}
                                        {catCfg?.itemFields?.map((f) => (
                                            <div className="hr-form-group" key={`${f.key}-${index}`}>
                                                <label className="hr-label">{f.label}</label>

                                                {f.type === 'boolean' && (
                                                    <div className="hr-veg-toggle-container">
                                                        <button
                                                            type="button"
                                                            className={`hr-veg-toggle ${item[f.key] ? 'active' : ''}`}
                                                            onClick={() => handleItemChange(index, f.key, !item[f.key])}
                                                        >
                                                            {item[f.key] ? 'Yes' : 'No'}
                                                        </button>
                                                    </div>
                                                )}

                                                {f.type === 'select' && (
                                                    <select
                                                        value={item[f.key] ?? f.options?.[0]}
                                                        onChange={(e) => handleItemChange(index, f.key, e.target.value)}
                                                        className="hr-select"
                                                        required
                                                    >
                                                        {f.options?.map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {opt[0].toUpperCase() + opt.slice(1)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}

                                                {f.type === 'text' && (
                                                    <input
                                                        type="text"
                                                        value={item[f.key] || ''}
                                                        onChange={(e) => handleItemChange(index, f.key, e.target.value)}
                                                        className="hr-input"
                                                    />
                                                )}

                                                {f.type === 'textarea' && (
                                                    <textarea
                                                        value={item[f.key] || ''}
                                                        onChange={(e) => handleItemChange(index, f.key, e.target.value)}
                                                        className="hr-input"
                                                        rows="1"
                                                        maxLength={f.maxLength}
                                                        placeholder="Short description"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Item Image (required only for hotel) */}
                                    <div className="hr-form-group hr-full-width">
                                        <label className="hr-label">
                                            <FaImage className="hr-input-icon" />
                                            Item Image {catCfg?.requireItemImage ? <span className="hr-required">*</span> : <span className="hr-optional">(optional)</span>}
                                        </label>

                                        {/* Existing image preview (if any) */}
                                        {item.existingImageUrl && (
                                            <div className="hr-existing-image-container">
                                                <div className="hr-image-preview">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <FaFileImage style={{ color: '#6b73ff', flexShrink: 0 }} />
                                                        <span className="hr-image-name">Existing Image</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItemImage(index)}
                                                        className="hr-btn-remove-image"
                                                        aria-label="Remove image"
                                                    >
                                                        <FaTimes />
                                                    </button>
                                                </div>
                                                {/* <img src={item.existingImageUrl} alt="Existing" className="hr-image-thumbnail" /> */}
                                                <p className="hr-image-note">Upload a new image below to replace</p>
                                            </div>
                                        )}

                                        {/* New file chooser */}
                                        <div className="hr-file-upload-container">
                                            <label className="hr-file-upload-label">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (!f) return;
                                                        if (f.size > 5 * 1024 * 1024) {
                                                            setError('Each item image must be 5MB or less');
                                                            return;
                                                        }
                                                        handleItemImageUpload(index, f);
                                                    }}
                                                    className="hr-file-input"
                                                />
                                                <span className="hr-file-upload-text">
                                                    {item.image ? item.image.name : 'No file selected'}
                                                </span>
                                                <span className="hr-file-upload-button">
                                                    <FaUpload style={{ marginRight: 8 }} /> Browse
                                                </span>
                                            </label>
                                        </div>

                                        {/* New image preview */}
                                        {item.image && (
                                            <div className="hr-image-preview">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FaFileImage style={{ color: '#6b73ff', flexShrink: 0 }} />
                                                    <span className="hr-image-name" title={item.image.name}>
                                                        {item.image.name.length > 22
                                                            ? `${item.image.name.slice(0, 16)}...${item.image.name.split('.').pop()}`
                                                            : item.image.name}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                                                        {(item.image.size / 1024 / 1024).toFixed(2)}MB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleItemChange(index, 'image', null)}
                                                        className="hr-btn-remove-image"
                                                        aria-label="Remove image"
                                                    >
                                                        <FaTimes />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="hr-item-actions">
                                        {index > 0 && (
                                            <button type="button" className="hr-btn hr-btn-remove" onClick={() => removeItem(index)}>
                                                <FaTrash /> Remove Item
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <button type="button" className="hr-btn hr-btn-add" onClick={addItem}>
                                <FaPlus /> Add {selectedCategory === 'hotel' ? 'Menu Item' : 'Item'}
                            </button>

                            <div className="hr-section-actions">
                                <button type="button" className="hr-btn hr-btn-prev" onClick={() => setActiveSection('basic')}>
                                    <FaArrowLeft /> Back
                                </button>
                                <button
                                    type="button"
                                    className="hr-btn hr-btn-next"
                                    onClick={() => setActiveSection('images')}
                                    disabled={imagesTabDisabled}
                                >
                                    Next: Images <FaImage />
                                </button>
                            </div>
                        </div>

                        {/* Shop Images */}
                        <div className={`hr-section ${activeSection !== 'images' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaImage className="hr-section-icon" />
                                Shop Images
                            </h2>

                            {/* Existing images */}
                            {existingShopImages.length > 0 && (
                                <div className="hr-existing-images-container">
                                    <h4 className="hr-existing-images-title">Existing Images</h4>
                                    <div className="hr-image-previews">
                                        {existingShopImages.map((imgId, index) => (
                                            <div key={`existing-${imgId}-${index}`} className="hr-image-preview">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FaFileImage style={{ color: '#6b73ff', flexShrink: 0 }} />
                                                    <span className="hr-image-name">Image {index + 1}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeExistingShopImage(index)}
                                                    className="hr-btn-remove-image"
                                                    aria-label="Remove image"
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New images */}
                            <div className="hr-file-upload-group">
                                <label className="hr-label">
                                    <FaImages className="hr-input-icon" />
                                    Upload New Images (up to 5)
                                </label>
                                <p className="hr-upload-hint">High-quality JPG/PNG, max 5MB each</p>

                                <div className="hr-file-upload-container">
                                    <label className="hr-file-upload-label">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                const valid = files.filter((f) => f.size <= 5 * 1024 * 1024);
                                                if (files.length !== valid.length) {
                                                    alert('Some files were larger than 5MB and were skipped');
                                                }
                                                setShopImages((prev) => [...prev, ...valid].slice(0, 5));
                                            }}
                                        />
                                        <span className="hr-file-upload-text">
                                            {shopImages.length ? `${shopImages.length} file(s) selected` : 'No files selected'}
                                        </span>
                                        <span className="hr-file-upload-button">
                                            <FaUpload style={{ marginRight: 8 }} /> Browse
                                        </span>
                                    </label>
                                </div>

                                {shopImages.length > 0 && (
                                    <div className="hr-image-previews">
                                        {shopImages.map((img, index) => (
                                            <div key={`${img.name}-${index}`} className="hr-image-preview">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FaFileImage style={{ color: '#6b73ff', flexShrink: 0 }} />
                                                    <span className="hr-image-name" title={img.name}>
                                                        {img.name.length > 22
                                                            ? `${img.name.slice(0, 16)}...${img.name.split('.').pop()}`
                                                            : img.name}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                                                        {(img.size / 1024 / 1024).toFixed(2)}MB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShopImages((prev) => prev.filter((_, i) => i !== index))}
                                                        className="hr-btn-remove-image"
                                                        aria-label="Remove image"
                                                    >
                                                        <FaTimes />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="hr-section-actions">
                                <button type="button" className="hr-btn hr-btn-prev" onClick={() => setActiveSection('items')}>
                                    <FaArrowLeft /> Back
                                </button>
                                <button
                                    type="button"
                                    className="hr-btn hr-btn-next"
                                    onClick={() => setActiveSection('review')}
                                    disabled={reviewTabDisabled}
                                >
                                    Next: Review <FaArrowRight />
                                </button>
                            </div>
                        </div>

                        {/* Review */}
                        <div className={`hr-section ${activeSection !== 'review' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaCheck className="hr-section-icon" />
                                Review Your Changes
                            </h2>

                            <div className="hr-review-container">
                                <div className="hr-review-section">
                                    <h3 className="hr-review-subtitle">
                                        <FaStore className="hr-review-icon" />
                                        Basic Information
                                    </h3>
                                    <div className="hr-review-grid">
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">Shop Name:</span>
                                            <span className="hr-review-value">{formData.shopName}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">Phone:</span>
                                            <span className="hr-review-value">{formData.phone}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">PhonePe:</span>
                                            <span className="hr-review-value">{formData.phonePeNumber}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">Email:</span>
                                            <span className="hr-review-value">{formData.email || '-'}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">Timings:</span>
                                            <span className="hr-review-value">
                                                {formData.openingTime} - {formData.closingTime}
                                            </span>
                                        </div>
                                        <div className="hr-review-item hr-full-width">
                                            <span className="hr-review-label">Address:</span>
                                            <span className="hr-review-value">{formData.address?.address}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="hr-review-section">
                                    <h3 className="hr-review-subtitle">
                                        <MdLocalDining className="hr-review-icon" />
                                        {ItemsStepTitle} ({(formData.items || []).length})
                                    </h3>
                                    <div className="hr-review-items">
                                        {(formData.items || []).slice(0, 3).map((item, index) => (
                                            <div key={index} className="hr-review-item-detail">
                                                <span className="hr-item-name">
                                                    {item.name}
                                                    {selectedCategory === 'hotel' && (
                                                        <span className={`hr-veg-badge ${item.veg ? 'veg' : 'nonveg'}`}>
                                                            {item.veg ? 'Veg' : 'Non-Veg'}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="hr-item-price">₹{item.price}</span>
                                                {selectedCategory === 'hotel' && item.category && (
                                                    <span className="hr-item-category">({item.category})</span>
                                                )}
                                            </div>
                                        ))}
                                        {(formData.items || []).length > 3 && (
                                            <div className="hr-review-more-items">
                                                + {(formData.items || []).length - 3} more items
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="hr-review-section">
                                    <h3 className="hr-review-subtitle">
                                        <FaImage className="hr-review-icon" />
                                        Images
                                    </h3>
                                    <div className="hr-review-images-info">
                                        <div className="hr-images-count">
                                            <span className="hr-count-bubble">{existingShopImages.length}</span>
                                            <span>Existing</span>
                                        </div>
                                        <div className="hr-images-count">
                                            <span className="hr-count-bubble">{shopImages.length}</span>
                                            <span>New</span>
                                        </div>
                                        <div className="hr-images-count">
                                            <span className="hr-count-bubble">
                                                {(formData.items || []).filter((i) => i.image || i.existingImageId).length}
                                            </span>
                                            <span>Item Images</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="hr-section-actions">
                                <button
                                    type="button"
                                    className="hr-btn hr-btn-prev"
                                    onClick={() => setActiveSection('images')}
                                >
                                    <FaArrowLeft /> Back
                                </button>
                                <button type="submit" className="hr-btn hr-btn-submit" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <FaSpinner className="hr-spinner" /> Updating…
                                        </>
                                    ) : (
                                        <>
                                            <FaCheck /> Update
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default EditShopRegistration;
