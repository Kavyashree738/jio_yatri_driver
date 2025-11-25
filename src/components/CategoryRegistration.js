import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    FaStore, FaCarrot, FaMedkit, FaBoxes, FaTimes, FaPlus, FaTrash,
    FaSpinner, FaCheck, FaUpload, FaImage, FaClock, FaPhone, FaWallet,
    FaEnvelope, FaMapMarkerAlt, FaImages, FaFileImage, FaBreadSlice, FaCoffee
} from 'react-icons/fa';
import { MdLocalDining } from 'react-icons/md';
import axios from 'axios';
import AddressAutocomplete from '../components/AddressAutocomplete';
import '../styles/CategoryRegistration.css';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTranslation } from "react-i18next";

import groceryImg from '../assets/images/category/groceries.png';
import vegetableImg from '../assets/images/category/vegetable.png';
import provisionImg from '../assets/images/category/provision.png';
import medicalImg from '../assets/images/category/medical.png';
import hotelImg from '../assets/images/category/hotel.png';
import bakeryImg from '../assets/images/category/bakery.png';
import cafeImg from '../assets/images/category/cafe.png';

// Basic UPI VPA shape check: <id>@<handle>
const vpaRegex = /^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i;

// Category-specific configuration (UI + validation)
const CATEGORY_CONFIG = {
    grocery: {
        label: 'Groceries',
        color: '#4ECDC4',
        requireItemImage: false,
        itemFields: [
            { key: 'weight', type: 'text', label: 'Weight (e.g., 1kg / 500g)' },
            { key: 'brand', type: 'text', label: 'Brand' },
            { key: 'quantity', type: 'number', label: 'Quantity (stock available)' },
        ],
        defaultItem: { weight: '', brand: '', description: '' },
    },

    vegetable: {
        label: 'Vegetables',
        color: '#45B7D1',
        requireItemImage: false,
        itemFields: [
            { key: 'organic', type: 'boolean', label: 'Organic' },
        ],
        defaultItem: { organic: false, description: '' },
    },
    provision: {
        label: 'Provisions',
        color: '#FFA07A',
        requireItemImage: false,
        itemFields: [
            { key: 'weight', type: 'text', label: 'Weight (e.g., 1kg / 500g)' },
            { key: 'brand', type: 'text', label: 'Brand' },
            { key: 'quantity', type: 'number', label: 'Quantity (stock available)' }, // 👈 added
        ],
        defaultItem: { weight: '', brand: '', description: '' },
    },
    medical: {
        label: 'Medical',
        color: '#98D8C8',
        requireItemImage: false,
        itemFields: [],
        defaultItem: { prescriptionRequired: false, description: '' },
    },
    hotel: {
        label: 'Food Service',
        color: '#FF6B6B',
        requireItemImage: true, // image per item
        itemFields: [
            { key: 'veg', type: 'boolean', label: 'Vegetarian' },
            { key: 'category', type: 'select', label: 'Menu Category', options: ['main', 'breakfast', 'lunch', 'dinner', 'snacks', 'beverages'] },
            { key: 'spiceLevel', type: 'select', label: 'Spice Level', options: ['mild', 'medium', 'spicy'] },
        ],
        defaultItem: { veg: true, category: 'main', spiceLevel: 'medium', description: '' },
    },
    // NEW: Bakery (like hotel but NO spice/description; has veg)
    bakery: {
        label: 'Bakery',
        color: '#F4A261',
        requireItemImage: true,
        itemFields: [
            { key: 'veg', type: 'boolean', label: 'Vegetarian' },
        ],
        defaultItem: { veg: true },
    },
    // NEW: Cafe (like hotel but NO spice/veg/description)
    cafe: {
        label: 'Cafe',
        color: '#CDB4DB',
        requireItemImage: true,
        itemFields: [],
        defaultItem: {},
    },
};




const CategoryRegistration = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [sp] = useSearchParams();
    const { t } = useTranslation();
    const { user, loading: authLoading, refreshUserMeta } = useAuth();

    const categoriesForGrid = [
        { name: t("category_grocery"), value: 'grocery', image: groceryImg, color: CATEGORY_CONFIG.grocery.color },
        { name: t("category_vegetable"), value: 'vegetable', image: vegetableImg, color: CATEGORY_CONFIG.vegetable.color },
        { name: t("category_provision"), value: 'provision', image: provisionImg, color: CATEGORY_CONFIG.provision.color },
        { name: t("category_medical"), value: 'medical', image: medicalImg, color: CATEGORY_CONFIG.medical.color },
        { name: t("category_hotel"), value: 'hotel', image: hotelImg, color: CATEGORY_CONFIG.hotel.color },
        { name: t("category_bakery"), value: 'bakery', image: bakeryImg, color: CATEGORY_CONFIG.bakery.color },
        { name: t("category_cafe"), value: 'cafe', image: cafeImg, color: CATEGORY_CONFIG.cafe.color },
    ];

    const [needKyc, setNeedKyc] = useState(false);
    const [aadhaarFile, setAadhaarFile] = useState(null);
    const [panFile, setPanFile] = useState(null);

    useEffect(() => {
        const checkNeedKyc = async () => {
            if (!user?.uid) return;

            const apiBase = 'https://jio-yatri-driver.onrender.com';

            try {
                const shopsRes = await axios.get(`${apiBase}/api/shops/owner/${user.uid}`);
                const count = Array.isArray(shopsRes?.data?.data) ? shopsRes.data.data.length : 0;

                const token = await user.getIdToken();
                let status = 'none';
                try {
                    const kycRes = await axios.get(`${apiBase}/api/user/me/kyc`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    status = kycRes?.data?.data?.status || 'none';
                } catch { /* ignore */ }

                const kycAlreadyOk = (status === 'submitted' || status === 'verified');
                setNeedKyc(count === 0 && !kycAlreadyOk);
            } catch {
                setNeedKyc(true);
            }
        };
        checkNeedKyc();
    }, [user?.uid]);

    // referral code
    const referralCode = (
        location.state?.referralCode ||
        sp.get('shop_ref') ||
        localStorage.getItem('shopReferralCode') ||
        ''
    ).toUpperCase();

    const [selectedCategory, setSelectedCategory] = useState(location.state?.category || '');
    const [showCategorySelection, setShowCategorySelection] = useState(!location.state?.category);

    const [formData, setFormData] = useState({
        shopName: '',
        phone: '',
        phonePeNumber: '',
        upiId: '',
        email: '',
        address: { address: '', coordinates: { lat: null, lng: null } },
        openingTime: '',
        closingTime: '',
        items: [],
    });

    const [shopImages, setShopImages] = useState([]);
    const [activeSection, setActiveSection] = useState('basic');
    const [progress, setProgress] = useState(0);

    const { label: catLabel, requireItemImage, itemFields, defaultItem } =
        useMemo(() => (selectedCategory ? CATEGORY_CONFIG[selectedCategory] : {}), [selectedCategory]);

    // auth gate
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/home', { state: { from: '/category-registration' } });
        }
    }, [user, authLoading, navigate]);

    // seed item when category picked
    useEffect(() => {
        if (!selectedCategory) return;
        setShowCategorySelection(false);

        setFormData((prev) => ({
            ...prev,
            items: prev.items.length
                ? prev.items
                : [{ name: '', price: '', image: null, ...(defaultItem || {}) }],
        }));
    }, [selectedCategory, defaultItem]);

    // progress calculation
    useEffect(() => {
        let completed = 0;

        // Basic info (40%)
        if (formData.shopName) completed += 10;
        if (formData.phone) completed += 10;
        if (formData.phonePeNumber) completed += 10;
        if (formData.upiId) completed += 10;
        if (formData.address.address) completed += 10;

        // Timing (10%)
        if (formData.openingTime && formData.closingTime) completed += 20;

        // Items (30%)
        // if (formData.items.length > 0) {
        //     completed += 10; // At least one item

        //     // Check if all items have required fields
        //     const minPrice = ['hotel', 'bakery', 'cafe'].includes(selectedCategory) ? 1 : 0;
        //     const allItemsValid = formData.items.every(item =>
        //         item.name && item.price !== '' && Number(item.price) >= minPrice
        //     );

        //     if (allItemsValid) completed += 20;
        // }

        // Images (20%)
        if (shopImages.length > 0) completed += 30;

        setProgress(Math.min(100, completed));
    }, [formData, shopImages, selectedCategory]);

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        setFormData((prev) => ({
            ...prev,
            items: [{ name: '', price: '', image: null, ...(CATEGORY_CONFIG[category]?.defaultItem || {}) }],
        }));
        setActiveSection('basic');
    };

    // handlers
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
            const items = [...prev.items];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, items };
        });
    };

    const handleItemImageUpload = (index, file) => {
        setFormData((prev) => {
            const items = [...prev.items];
            items[index] = { ...items[index], image: file };
            return { ...prev, items };
        });
    };

    const addItem = () => {
        if (!selectedCategory) return;
        setFormData((prev) => ({
            ...prev,
            items: [...prev.items, { name: '', price: '', image: null, ...(defaultItem || {}) }],
        }));
    };

    const removeItem = (index) => {
        setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    };

    // Validation (price rule differs by category; image per item for hotel/bakery/cafe)
    const validateForm = () => {
        let isValid = true;
        let errorMessage = '';

        if (!selectedCategory) {
            errorMessage = 'Please select a business category';
            isValid = false;
        } else if (!formData.shopName.trim()) {
            errorMessage = 'Shop name is required';
            isValid = false;
        } else if (!/^[0-9]{10}$/.test(formData.phone || '')) {
            errorMessage = 'Please enter a valid 10-digit phone number';
            isValid = false;
        } else if (!/^[0-9]{10}$/.test(formData.phonePeNumber || '')) {
            errorMessage = 'Please enter a valid 10-digit PhonePe number';
            isValid = false;
        } else if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errorMessage = 'Please enter a valid email address';
            isValid = false;
        } else if (!vpaRegex.test(formData.upiId || '')) {
            errorMessage = 'Please enter a valid UPI ID (e.g., name@bank)';
            isValid = false;
        } else if (!formData.address.address) {
            errorMessage = 'Please select an address from the suggestions';
            isValid = false;
        } else if (!formData.openingTime || !formData.closingTime) {
            errorMessage = 'Opening and closing times are required';
            isValid = false;
        } else if (shopImages.some((f) => f.size > 5 * 1024 * 1024)) {
            errorMessage = 'Each shop image must be 5MB or less';
            isValid = false;
        } else if (needKyc && (!aadhaarFile || !panFile)) {
            errorMessage = 'Please upload both Aadhaar and PAN (PDF or image)';
            isValid = false;
        }

        if (errorMessage) {
            setError(errorMessage);
            // Scroll to top to show error
            window.scrollTo(0, 0);
        }

        return isValid;
    };


    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!validateForm()) return;
        if (!user) return setError('You must be logged in to register');

        setIsSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('userId', user.uid);
            fd.append('category', selectedCategory);
            fd.append('shopName', formData.shopName);
            fd.append('phone', formData.phone);
            fd.append('upiId', (formData.upiId || '').trim().toLowerCase());
            fd.append('phonePeNumber', formData.phonePeNumber);
            fd.append('email', formData.email || '');
            fd.append('address', JSON.stringify(formData.address));
            fd.append('openingTime', formData.openingTime);
            fd.append('closingTime', formData.closingTime);

            // Only keep item props relevant to the selected category
            // const allowedKeys = new Set(['name', 'price', ...(itemFields || []).map(f => f.key)]);
            // const itemsForApi = formData.items.map((it) => {
            //     const out = {};
            //     allowedKeys.forEach((k) => {
            //         if (it[k] !== undefined && it[k] !== null && it[k] !== '') out[k] = it[k];
            //     });
            //     return out;
            // });
            // fd.append('items', JSON.stringify(itemsForApi));

            if (referralCode) fd.append('referralCode', referralCode);

            shopImages.forEach((file) => fd.append('shopImages', file));
            // formData.items.forEach((it) => {
            //     if (it.image instanceof File) fd.append('itemImages', it.image);
            // });

            if (needKyc) {
                if (aadhaarFile) fd.append('aadhaar', aadhaarFile);
                if (panFile) fd.append('pan', panFile);
            }

            const token = await user.getIdToken();
            const apiBase = 'https://jio-yatri-driver.onrender.com';
            const res = await axios.post(`${apiBase}/api/shops/register`, fd, {
                headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
            });

            if (!res?.data?.success) throw new Error(res?.data?.error || 'Registration failed');

            setSuccess('Registration successful!');
            try { if (refreshUserMeta) await refreshUserMeta(user); } catch (_) { }
            const submittedKyc = needKyc || !!aadhaarFile || !!panFile;
            navigate(submittedKyc ? '/kyc-pending' : '/business-dashboard', { replace: true });
        } catch (err) {
            const msg = err?.response?.status === 413
                ? 'A file is too large (max 5MB)'
                : err?.response?.data?.error || err.message || 'Registration failed';
            setError(msg);
            window.scrollTo(0, 0);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="hr-loading-container">
                <FaSpinner className="hr-spinner" />
                <p>Checking authentication...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="hr-auth-error">
                <p>You need to be logged in to register.</p>
                <button onClick={() => navigate('/home')}>Go to Login</button>
            </div>
        );
    }

    // Category selection
    if (showCategorySelection || !selectedCategory) {
        return (
            <>
                <Header />
                <div className="hr-container">
                    <div className="hr-card">
                        <div className="hr-header">
                            <h1 className="hr-title">{t("select_business_category")}</h1>
                            <p className="hr-subtitle">{t("select_business_category_sub")}</p>
                        </div>

                        <div className="hr-category-grid">
                            {categoriesForGrid.map((category) => (
                                <div
                                    key={category.value}
                                    className="hr-category-card"
                                    onClick={() => handleCategorySelect(category.value)}
                                >
                                    <img
                                        src={category.image}
                                        alt={category.name}
                                        className="hr-category-image"
                                    />
                                    <h3 className="hr-category-name">{category.name}</h3>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
                <Footer />
            </>
        );
    }

    const ItemsStepTitle =
        ['hotel', 'bakery', 'cafe'].includes(selectedCategory) ? 'Menu Items' : 'Items';

    const itemsTabDisabled =
        !formData.shopName || !formData.phone || !formData.upiId || !formData.phonePeNumber || !formData.address.address;

    const imagesTabDisabled =
        formData.items.length === 0 ||
        (requireItemImage && formData.items.some((i) => !i.image));

    const reviewTabDisabled = shopImages.length === 0;

    const getCategoryIndicator = () => {
        const c = categoriesForGrid.find((x) => x.value === selectedCategory);
        if (!c) return null;
        return (
            <div className="hr-category-indicator" style={{ backgroundColor: c.color }}>
                {c.icon}
                <span>{c.name}</span>
            </div>
        );
    };

    return (
        <>
            <Header />
            <div className="hr-container">
                <div className="hr-card">
                    <div className="hr-header">
                        <h1 className="hr-title">{t("hr_register_title", { category: catLabel })}
                        </h1>
                        <p className="hr-subtitle">{t("hr_register_subtitle")}</p>

                        {getCategoryIndicator()}

                        <div className="hr-progress-container">
                            <div className="hr-progress-bar" style={{ width: `${progress}%` }}>
                                <span className="hr-progress-text">{progress} {t("hr_progress_complete", { progress })}</span>
                            </div>
                        </div>

                        <div className="hr-navigation">
                            <button
                                className={`hr-nav-btn ${activeSection === 'basic' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('basic')}
                            >
                                <FaStore className="hr-nav-icon" />
                                {t("hr_tab_basic")}
                            </button>

                            {/* <button
                                className={`hr-nav-btn ${activeSection === 'items' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('items')}
                                disabled={itemsTabDisabled}
                            >
                                <MdLocalDining className="hr-nav-icon" />
                                {ItemsStepTitle}
                            </button> */}

                            <button
                                className={`hr-nav-btn ${activeSection === 'images' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('images')}
                                disabled={imagesTabDisabled}
                            >
                                <FaImage className="hr-nav-icon" />
                                {t("hr_tab_images")}
                            </button>

                            <button
                                className={`hr-nav-btn ${activeSection === 'review' ? 'hr-active' : ''}`}
                                onClick={() => setActiveSection('review')}
                                disabled={reviewTabDisabled}
                            >
                                <FaCheck className="hr-nav-icon" />
                                {t("hr_tab_review")}
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

                    <form onSubmit={handleSubmit} className="hr-form">
                        {/* Basic */}
                        <div className={`hr-section ${activeSection !== 'basic' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaStore className="hr-section-icon" />
                                {t("hr_basic_info")}
                            </h2>

                            <div className="hr-form-grid">
                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaStore className="hr-input-icon" />
                                        {t("shop_name")} <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="shopName"
                                        value={formData.shopName}
                                        onChange={handleInputChange}
                                        placeholder={t("enter_shop_name")}
                                        className="hr-input"
                                        required
                                    />
                                </div>

                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaPhone className="hr-input-icon" />
                                        {t("hr_phone_label")} <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder={t("hr_phone_placeholder")}
                                        className="hr-input"
                                        pattern="[0-9]{10}"
                                        required
                                    />
                                </div>

                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaWallet className="hr-input-icon" />
                                        {t("hr_phonepe_label")} <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="phonePeNumber"
                                        value={formData.phonePeNumber}
                                        onChange={handleInputChange}
                                        placeholder={t("hr_phonepe_placeholder")}
                                        className="hr-input"
                                        pattern="[0-9]{10}"
                                        required
                                    />
                                </div>

                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaWallet className="hr-input-icon" />
                                        {t("hr_upi_label")}<span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="upiId"
                                        value={formData.upiId}
                                        onChange={handleInputChange}
                                        placeholder={t("hr_upi_placeholder")}
                                        className="hr-input"
                                        required
                                    />
                                    <small className="hr-hint">{t("hr_upi_hint")}</small>
                                </div>

                                <div className="hr-form-group">
                                    <label className="hr-label">
                                        <FaEnvelope className="hr-input-icon" />
                                        {t("hr_email_label")}
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder={t("hr_email_placeholder")}
                                        className="hr-input"
                                    />
                                </div>

                                <div className="hr-form-group hr-time-group">
                                    <label className="hr-label">
                                        <FaClock className="hr-input-icon" />
                                        {t("hr_opening_time")} <span className="hr-required">*</span>
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
                                        {t("hr_closing_time")} <span className="hr-required">*</span>
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
                                    {t("hr_address_label")} <span className="hr-required">*</span>
                                </label>
                                <AddressAutocomplete
                                    onSelect={handleAddressSelect}
                                    initialValue={formData.address.address}
                                />
                            </div>

                            {/* KYC for first-time business registration */}
                            {needKyc && (
                                <div className="hr-form-group hr-full-width">
                                    <h3 className="hr-section-subtitle" style={{ marginTop: '8px' }}>
                                        {t("kyc_required")}
                                    </h3>

                                    <div className="hr-form-grid">

                                        {/* Aadhaar */}
                                        <div className="hr-form-group">
                                            <label className="hr-label">
                                                {t("aadhaar")} <span className="hr-required">*</span>
                                            </label>
                                            <div className="hr-file-wrapper">
                                                <input
                                                    id="aadhaar"
                                                    type="file"
                                                    accept=".pdf,image/*"
                                                    className="hr-file-input"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (!f) return;
                                                        if (f.size > 5 * 1024 * 1024) return setError(t("aadhaar_size_error"));
                                                        setAadhaarFile(f);
                                                    }}
                                                    required
                                                />
                                                <label htmlFor="aadhaar" className="hr-file-label">{t("choose_file")}</label>
                                                <span className="hr-file-name">
                                                    {aadhaarFile ? aadhaarFile.name : t("no_file_chosen")}
                                                </span>
                                            </div>
                                        </div>

                                        {/* PAN */}
                                        <div className="hr-form-group">
                                            <label className="hr-label">
                                                {t("pan")} <span className="hr-required">*</span>
                                            </label>
                                            <div className="hr-file-wrapper">
                                                <input
                                                    id="pan"
                                                    type="file"
                                                    accept=".pdf,image/*"
                                                    className="hr-file-input"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (!f) return;
                                                        if (f.size > 5 * 1024 * 1024) return setError(t("pan_size_error"));
                                                        setPanFile(f);
                                                    }}
                                                    required
                                                />
                                                <label htmlFor="pan" className="hr-file-label">{t("choose_file")}</label>
                                                <span className="hr-file-name">
                                                    {panFile ? panFile.name : t("no_file_chosen")}
                                                </span>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}


                            <div className="hr-section-actions">
                                <button
                                    type="button"
                                    className="hr-btn hr-btn-next"
                                    onClick={() => setActiveSection('images')}
                                    disabled={false} // or keep condition if you want
                                >
                                    {t("next_shop_images")} <FaImage />

                                </button>
                            </div>

                        </div>

                        {/* Shop Images */}
                        <div className={`hr-section ${activeSection !== 'images' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaImage className="hr-section-icon" />
                                {t("upload_shop_images")}
                            </h2>

                            <div className="hr-file-upload-group">
                                <label className="hr-label">
                                    <FaImages className="hr-input-icon" />
                                    {t("shop_images_label")}
                                </label>

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
                                                    setError('Some files were larger than 5MB and were skipped.');
                                                    window.scrollTo(0, 0);
                                                }
                                                const newImages = [...shopImages, ...valid].slice(0, 5);
                                                setShopImages(newImages);
                                            }}
                                        />

                                        <span className="hr-file-upload-text">
                                            {shopImages.length
                                                ? t("files_selected", { count: shopImages.length })
                                                : t("no_files_selected")}
                                        </span>
                                        <span className="hr-file-upload-button">
                                            <FaUpload style={{ marginRight: '8px' }} /> {t("browse")}
                                        </span>
                                    </label>
                                </div>

                                {shopImages.length > 0 && (
                                    <div className="hr-image-previews">
                                        {shopImages.map((img, index) => (
                                            <div key={`${img.name}-${index}`} className="hr-image-preview">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FaFileImage style={{ color: '#6b73ff', flexShrink: 0 }} />
                                                    <span className="hr-image-name" title={img.name}>
                                                        {img.name.length > 20
                                                            ? `${img.name.substring(0, 15)}...${img.name.split('.').pop()}`
                                                            : img.name}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                                                        {(img.size / 1024 / 1024).toFixed(2)}MB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShopImages((prev) => prev.filter((_, i) => i !== index));
                                                        }}
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
                                <button type="button" className="hr-btn hr-btn-prev" onClick={() => setActiveSection('basic')}>
                                    ← {t("back")}
                                </button>

                                <button
                                    type="button"
                                    className="hr-btn hr-btn-next"
                                    onClick={() => setActiveSection('review')}
                                    disabled={reviewTabDisabled}
                                >
                                    {t("next_review")} →
                                </button>
                            </div>
                        </div>

                        {/* Review */}
                        <div className={`hr-section ${activeSection !== 'review' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaCheck className="hr-section-icon" />
                               {t("review_information")}
                            </h2>

                            <div className="hr-review-container">
                                <div className="hr-review-section">
                                    <h3 className="hr-review-subtitle">
                                        <FaStore className="hr-review-icon" />
                                      {t("basic_information")}
                                    </h3>
                                    <div className="hr-review-grid">
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">{t("shop_name")}:</span>
                                            <span className="hr-review-value">{formData.shopName}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">{t("phone")}:</span>
                                            <span className="hr-review-value">{formData.phone}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">{t("phonepe")}:</span>
                                            <span className="hr-review-value">{formData.phonePeNumber}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">{t("upi_id")}:</span>
                                            <span className="hr-review-value">{formData.upiId}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">{t("email")}:</span>
                                            <span className="hr-review-value">{formData.email || '-'}</span>
                                        </div>
                                        <div className="hr-review-item">
                                            <span className="hr-review-label">{t("timings")}:</span>
                                            <span className="hr-review-value">
                                                {formData.openingTime} - {formData.closingTime}
                                            </span>
                                        </div>
                                        <div className="hr-review-item hr-full-width">
                                            <span className="hr-review-label">{t("address")}:</span>
                                            <span className="hr-review-value">{formData.address.address}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* 
                                <div className="hr-review-section">
                                    <h3 className="hr-review-subtitle">
                                        <MdLocalDining className="hr-review-icon" />
                                        {ItemsStepTitle} ({formData.items.length})
                                    </h3>
                                    <div className="hr-review-items">
                                        {formData.items.slice(0, 3).map((item, index) => (
                                            <div key={index} className="hr-review-item-detail">
                                                <span className="hr-item-name">
                                                    {item.name}
                                                    {['hotel', 'bakery'].includes(selectedCategory) && typeof item.veg === 'boolean' && (
                                                        <span className={`hr-veg-badge ${item.veg ? 'veg' : 'nonveg'}`}>
                                                            {item.veg ? 'Veg' : 'Non-Veg'}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="hr-item-price">₹{item.price}</span>
                                                {selectedCategory === 'hotel' && item.category && (
                                                    <span className="hr-item-category">({item.category})</span>
                                                )}

                                                {["grocery", "provision"].includes(selectedCategory) && (
                                                    <span className="hr-item-meta">
                                                        {item.brand && `Brand: ${item.brand}`}
                                                        {item.weight && ` • ${item.weight}`}
                                                        {item.quantity !== undefined && ` • Qty: ${item.quantity}`}
                                                    </span>
                                                )}

                                            </div>
                                        ))}

                                        {formData.items.length > 3 && (
                                            <div className="hr-review-more-items">+ {formData.items.length - 3} more items</div>
                                        )}
                                    </div>
                                </div> */}

                                <div className="hr-review-section">
                                    <h3 className="hr-review-subtitle">
                                        <FaImage className="hr-review-icon" />
                                        {t("images")}
                                    </h3>
                                    <div className="hr-review-images-info">
                                        <div className="hr-images-count">
                                            <span className="hr-count-bubble">{shopImages.length}</span>
                                            <span>{t("shop_images")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="hr-section-actions">
                                <button type="button" className="hr-btn hr-btn-prev" onClick={() => setActiveSection('images')}>
                                    ←{t("back")}

                                </button>
                                <button type="submit" className="hr-btn hr-btn-submit" disabled={isSubmitting}>
                                     {isSubmitting ? (<><FaSpinner className="hr-spinner" /> {t("registering")}...</>) : t("submit_registration")}
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

export default CategoryRegistration;