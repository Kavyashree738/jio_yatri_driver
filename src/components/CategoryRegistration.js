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

// Basic UPI VPA shape check: <id>@<handle>
const vpaRegex = /^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i;

// Category-specific configuration (UI + validation)
const CATEGORY_CONFIG = {
    grocery: {
        label: 'Groceries',
        color: '#4ECDC4',
        requireItemImage: false,
        itemFields: [],
        defaultItem: { description: '' },
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

const categoriesForGrid = [
    { name: 'Groceries', value: 'grocery', icon: <FaStore />, color: CATEGORY_CONFIG.grocery.color },
    { name: 'Vegetables', value: 'vegetable', icon: <FaCarrot />, color: CATEGORY_CONFIG.vegetable.color },
    { name: 'Provisions', value: 'provision', icon: <FaBoxes />, color: CATEGORY_CONFIG.provision.color },
    { name: 'Medical', value: 'medical', icon: <FaMedkit />, color: CATEGORY_CONFIG.medical.color },
    { name: 'Food Service', value: 'hotel', icon: <MdLocalDining />, color: CATEGORY_CONFIG.hotel.color },
    // NEW:
    { name: 'Bakery', value: 'bakery', icon: <FaBreadSlice />, color: CATEGORY_CONFIG.bakery.color },
    { name: 'Cafe', value: 'cafe', icon: <FaCoffee />, color: CATEGORY_CONFIG.cafe.color },
];

const CategoryRegistration = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [sp] = useSearchParams();
    const { user, loading: authLoading, refreshUserMeta } = useAuth();

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
    const [progress, setProgress] = useState(25);

    

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

    // progress
    useEffect(() => {
        let completed = 0;
        if (formData.shopName) completed += 10;
        if (formData.phone) completed += 10;
        if (formData.phonePeNumber) completed += 10;
        if (formData.upiId) completed += 10;
        if (formData.address.address) completed += 10;
        if (formData.openingTime && formData.closingTime) completed += 10;
        if (formData.items.length > 0) completed += 30;
        if (shopImages.length > 0) completed += 20;
        setProgress(Math.min(100, completed));
    }, [formData, shopImages]);

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
  } else if (!formData.items.length) {
    errorMessage = 'Please add at least one item';
    isValid = false;
  } else {
    const minPrice = ['hotel', 'bakery', 'cafe'].includes(selectedCategory) ? 1 : 0;
    if (formData.items.some((it) => !it.name || it.price === '' || it.price === null || Number(it.price) < minPrice)) {
      errorMessage = `Please fill all required fields for each item (name, price ≥ ${minPrice})`;
      isValid = false;
    } else if (requireItemImage && formData.items.some((it) => !it.image)) {
      errorMessage = 'Please upload an image for each item';
      isValid = false;
    } else if (formData.items.some((it) => it.image instanceof File && it.image.size > 5 * 1024 * 1024)) {
      errorMessage = 'Each item image must be 5MB or less';
      isValid = false;
    } else if (shopImages.some((f) => f.size > 5 * 1024 * 1024)) {
      errorMessage = 'Each shop image must be 5MB or less';
      isValid = false;
    } else if (needKyc && (!aadhaarFile || !panFile)) {
      errorMessage = 'Please upload both Aadhaar and PAN (PDF or image)';
      isValid = false;
    }
  }
  
  if (errorMessage) {
    setError(errorMessage);
  }
  
  return isValid;
};


    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
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
            const allowedKeys = new Set(['name', 'price', ...(itemFields || []).map(f => f.key)]);
            const itemsForApi = formData.items.map((it) => {
                const out = {};
                allowedKeys.forEach((k) => {
                    if (it[k] !== undefined && it[k] !== null && it[k] !== '') out[k] = it[k];
                });
                return out;
            });
            fd.append('items', JSON.stringify(itemsForApi));

            if (referralCode) fd.append('referralCode', referralCode);

            shopImages.forEach((file) => fd.append('shopImages', file));
            formData.items.forEach((it) => {
                if (it.image instanceof File) fd.append('itemImages', it.image);
            });

            if (needKyc) {
                if (aadhaarFile) fd.append('aadhaar', aadhaarFile);
                if (panFile) fd.append('pan', panFile);
            }

            const token = await user.getIdToken();
            const apiBase = 'https://jio-yatri-driver.onrender';
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
                            <h1 className="hr-title">Select Your Business Category</h1>
                            <p className="hr-subtitle">Choose the category that best describes your business</p>
                        </div>

                        <div className="hr-category-grid">
                            {categoriesForGrid.map((category) => (
                                <div
                                    key={category.value}
                                    className="hr-category-card"
                                    style={{ backgroundColor: category.color }}
                                    onClick={() => handleCategorySelect(category.value)}
                                >
                                    <div className="hr-category-icon">{category.icon}</div>
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
                        <h1 className="hr-title">Register Your {catLabel} Business</h1>
                        <p className="hr-subtitle">Fill in the details to list your business on our platform</p>

                        {getCategoryIndicator()}

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

                    <form onSubmit={handleSubmit} className="hr-form">
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
                                        <FaWallet className="hr-input-icon" />
                                        UPI ID  <span className="hr-required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="upiId"
                                        value={formData.upiId}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 9876543210@ybl"
                                        className="hr-input"
                                        required
                                        
                                    />
                                    {/* <small className="hr-hint">This is your UPI ID (like <code>name@bank</code>), not your phone number.</small> */}
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
                                    initialValue={formData.address.address}
                                />
                            </div>
                            {/* KYC for first-time business registration */}
                            {needKyc && (
                                <div className="hr-form-group hr-full-width">
                                    <h3 className="hr-section-subtitle" style={{ marginTop: '8px' }}>
                                        KYC Documents (Required for first shop)
                                    </h3>

                                    <div className="hr-form-grid">
                                        {/* Aadhaar */}
                                        <div className="hr-form-group">
                                            <label className="hr-label">
                                                Aadhaar (PDF or Image) <span className="hr-required">*</span>
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
                                                        if (f.size > 5 * 1024 * 1024) return setError("Aadhaar file must be 5MB or less");
                                                        setAadhaarFile(f);
                                                    }}
                                                    required
                                                />
                                                <label htmlFor="aadhaar" className="hr-file-label">Choose File</label>
                                                <span className="hr-file-name">{aadhaarFile ? aadhaarFile.name : "No file chosen"}</span>
                                            </div>
                                        </div>

                                        {/* PAN */}
                                        <div className="hr-form-group">
                                            <label className="hr-label">
                                                PAN (PDF or Image) <span className="hr-required">*</span>
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
                                                        if (f.size > 5 * 1024 * 1024) return setError("PAN file must be 5MB or less");
                                                        setPanFile(f);
                                                    }}
                                                    required
                                                />
                                                <label htmlFor="pan" className="hr-file-label">Choose File</label>
                                                <span className="hr-file-name">{panFile ? panFile.name : "No file chosen"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                            <h2 className="hr-section-title">{ItemsStepTitle}</h2>

                            {formData.items.map((item, index) => (
                                <div key={index} className="hr-item-form">
                                    <h3 className="hr-item-title">
                                        {['hotel', 'bakery', 'cafe'].includes(selectedCategory) ? 'Menu Item' : 'Item'} {index + 1}
                                    </h3>

                                    <div className="hr-form-grid">
                                        {/* Name */}
                                        <div className="hr-form-group">
                                            <label className="hr-label">Name</label>
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                                className="hr-input"
                                                required
                                            />
                                        </div>

                                        {/* Price */}
                                        <div className="hr-form-group">
                                            <label className="hr-label">Price (₹)</label>
                                            <input
                                                type="number"
                                                min={['hotel', 'bakery', 'cafe'].includes(selectedCategory) ? 1 : 0}
                                                value={item.price}
                                                onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                                className="hr-input"
                                                required
                                            />
                                        </div>

                                        {/* Dynamic per-category fields */}
                                        {(itemFields || []).map((f) => (
                                            <div className="hr-form-group" key={`${f.key}-${index}`}>
                                                <label className="hr-label">
                                                    {f.label}{f.type === 'select' || f.type === 'text' ? <span className="hr-required">*</span> : null}
                                                </label>

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
                                                        required
                                                    />
                                                )}

                                                {f.type === 'textarea' && (
                                                    <textarea
                                                        value={item[f.key] || ''}
                                                        onChange={(e) => handleItemChange(index, f.key, e.target.value)}
                                                        className="hr-input"
                                                        rows="3"
                                                        maxLength={f.maxLength}
                                                        placeholder="Short description"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Item Image (required for hotel/bakery/cafe) */}
                                    <div className="hr-form-group hr-full-width">
                                        <label className="hr-label">
                                            <FaImage className="hr-input-icon" />
                                            Item Image {requireItemImage ? <span className="hr-required">*</span> : <span className="hr-optional">(optional)</span>}
                                        </label>

                                        <div className="hr-file-upload-container">
                                            <label className="hr-file-upload-label">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (!f) return;
                                                        if (f.size > 5 * 1024 * 1024) return setError('Each item image must be 5MB or less');
                                                        handleItemImageUpload(index, f);
                                                    }}
                                                    className="hr-file-input"
                                                />
                                                <span className="hr-file-upload-text">
                                                    {item.image ? item.image.name : 'No file selected'}
                                                </span>
                                                <span className="hr-file-upload-button">
                                                    <FaUpload style={{ marginRight: '8px' }} /> Browse
                                                </span>
                                            </label>
                                        </div>

                                        {item.image && (
                                            <div className="hr-image-preview">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FaFileImage style={{ color: '#6b73ff', flexShrink: 0 }} />
                                                    <span className="hr-image-name" title={item.image.name}>
                                                        {item.image.name.length > 20
                                                            ? `${item.image.name.substring(0, 15)}...${item.image.name.split('.').pop()}`
                                                            : item.image.name}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                                                        {(item.image.size / 1024 / 1024).toFixed(2)}MB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData((prev) => {
                                                                const items = [...prev.items];
                                                                items[index] = { ...items[index], image: null };
                                                                return { ...prev, items };
                                                            });
                                                        }}
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
                                <FaPlus /> Add {['hotel', 'bakery', 'cafe'].includes(selectedCategory) ? 'Menu Item' : 'Item'}
                            </button>

                            <div className="hr-section-actions">
                                <button type="button" className="hr-btn hr-btn-prev" onClick={() => setActiveSection('basic')}>
                                    ← Back
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

                        {/* Shop Images (unchanged) */}
                        {/* Shop Images */}
                        <div className={`hr-section ${activeSection !== 'images' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaImage className="hr-section-icon" />
                                Upload Shop Images
                            </h2>

                            <div className="hr-file-upload-group">
                                <label className="hr-label">
                                    <FaImages className="hr-input-icon" />
                                    Shop Images (up to 5)
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
                                                    alert('Some files were larger than 5MB and were skipped.');
                                                }
                                                const newImages = [...shopImages, ...valid].slice(0, 5);
                                                setShopImages(newImages);
                                            }}
                                        />
                                
                                        <span className="hr-file-upload-text">
                                            {shopImages.length ? `${shopImages.length} file(s) selected` : 'No files selected'}
                                        </span>
                                        <span className="hr-file-upload-button">
                                            <FaUpload style={{ marginRight: '8px' }} /> Browse
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
                                <button type="button" className="hr-btn hr-btn-prev" onClick={() => setActiveSection('items')}>
                                    ← Back
                                </button>
                                <button
                                    type="button"
                                    className="hr-btn hr-btn-next"
                                    onClick={() => setActiveSection('review')}
                                    disabled={reviewTabDisabled}
                                >
                                    Next: Review →
                                </button>
                            </div>
                        </div>

                        {/* Review */}
                        <div className={`hr-section ${activeSection !== 'review' ? 'hr-hidden' : ''}`}>
                            <h2 className="hr-section-title">
                                <FaCheck className="hr-section-icon" />
                                Review Your Information
                            </h2>

                            <div className="hr-review-container">
                                {/* Basic info (unchanged) */}

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
                                            <span className="hr-review-label">UPI ID:</span>
                                            <span className="hr-review-value">{formData.upiId}</span>
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
                                            <span className="hr-review-value">{formData.address.address}</span>
                                        </div>
                                    </div>
                                </div>

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
                                            </div>
                                        ))}
                                        {formData.items.length > 3 && (
                                            <div className="hr-review-more-items">+ {formData.items.length - 3} more items</div>
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
                                            <span className="hr-count-bubble">{shopImages.length}</span>
                                            <span>Shop Images</span>
                                        </div>
                                        <div className="hr-images-count">
                                            <span className="hr-count-bubble">
                                                {formData.items.filter((i) => i.image).length}
                                            </span>
                                            <span>Item Images</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Images summary (unchanged) */}
                            </div>

                            <div className="hr-section-actions">
                                <button type="button" className="hr-btn hr-btn-prev" onClick={() => setActiveSection('images')}>
                                    ← Back
                                </button>
                                <button type="submit" className="hr-btn hr-btn-submit" disabled={isSubmitting}>
                                    {isSubmitting ? (<><FaSpinner className="hr-spinner" /> Registering...</>) : ('Submit Registration')}
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