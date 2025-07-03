import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaPhone, FaToggleOn, FaToggleOff, FaCar, FaStar } from 'react-icons/fa';
import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
import Header from './Header';
import Footer from './Footer';
import LocationTracker from './LocationTracker';
import AvailableShipments from './AvailableShipments';
import '../styles/DriverDashboard.css';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';

const DriverDashboard = () => {
    const { user, setMessage } = useAuth();
    const navigate = useNavigate();
    const [driverInfo, setDriverInfo] = useState(null);
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('inactive');
    const [isUpdating, setIsUpdating] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const fetchDriverInfo = useCallback(async () => {
        try {
            const token = await user.getIdToken();
            const [driverRes, imageRes] = await Promise.all([
                fetch(`http://localhost:5000/api/driver/info/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`http://localhost:5000/api/upload/profile-image/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (!driverRes.ok) throw new Error('Failed to fetch driver info');

            const driverData = await driverRes.json();
            setDriverInfo(driverData.data);
            setStatus(driverData.data?.status || 'inactive');

            if (imageRes.ok) {
                const blob = await imageRes.blob();
                const imageUrl = URL.createObjectURL(blob);
                setProfileImage(imageUrl);
            } else if (user.photoURL) {
                setProfileImage(user.photoURL);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;

        fetchDriverInfo();

        const fetchShipments = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/shipments/driver/${user.uid}`);
                setShipments(res.data);
            } catch (err) {
                console.error('Error fetching shipments:', err.message);
            }
        };

        fetchShipments();
    }, [user, fetchDriverInfo]);

    const completedDeliveries = useMemo(() => {
        return shipments.filter(s => s.status?.toLowerCase() === 'delivered').length;
    }, [shipments]);

    const toggleStatus = async () => {
        const newStatus = status === 'active' ? 'inactive' : 'active';
        setIsUpdating(true);
        try {
            const token = await user.getIdToken(true);
            const res = await fetch('http://localhost:5000/api/driver/status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error('Failed to update status');
            setStatus(newStatus);
            setDriverInfo(prev => ({
                ...prev,
                status: newStatus,
                lastUpdated: new Date().toISOString()
            }));
            setMessage({ text: 'Status updated', isError: false });
        } catch (err) {
            setMessage({ text: err.message, isError: true });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        if (!file.type.match('image.*')) {
            setError('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image size should be < 5MB');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const previewUrl = URL.createObjectURL(file);
            setProfileImage(previewUrl);

            const formData = new FormData();
            formData.append('file', file);

            const token = await user.getIdToken(true);
            await fetch('http://localhost:5000/api/upload/profile-image', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            await fetchDriverInfo();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setMessage({ text: 'Logged out', isError: false });
            navigate('/');
        } catch (error) {
            setMessage({ text: error.message, isError: true });
        }
    };

    const getVehicleIcon = () => {
        switch (driverInfo?.vehicleType?.toLowerCase()) {
            case 'twowheeler':
                return <span role="img" aria-label="Two Wheeler">🛵</span>;
            case 'threewheeler':
                return <span role="img" aria-label="Three Wheeler">🛺</span>;
            case 'truck':
                return <span role="img" aria-label="Truck">🚚</span>;
            default:
                return <span role="img" aria-label="Car">🚗</span>;
        }
    };

    const renderRatingStars = () => {
        const rating = driverInfo?.ratings?.average || 0;
        return (
            <div className="dd-rating-stars">
                {[...Array(5)].map((_, i) => (
                    <FaStar key={i} className={`dd-star ${i < rating ? 'dd-filled' : ''}`} />
                ))}
                <span className="dd-rating-text">{rating > 0 ? `${rating.toFixed(1)}/5` : 'Not rated yet'}</span>
            </div>
        );
    };

    if (loading) return (
        <div className="dd-loading">
            <div className="dd-spinner-container">
                <div className="dd-beautiful-spinner"></div>
                <p className="dd-loading-text">Loading Dashboard...</p>
            </div>
        </div>
    );

    if (error) return <div className="dd-error">Error: {error}</div>;

    return (
        <>
            <Header />
            <div className="dd-container">
                <div className="dd-header">
                    <h1>Driver Dashboard</h1>
                    <div className="dd-status-toggle">
                        <span>Status: {status}</span>
                        <button
                            onClick={toggleStatus}
                            disabled={isUpdating}
                            className={`dd-toggle-btn ${status === 'active' ? 'dd-active' : 'dd-inactive'}`}
                        >
                            {status === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                            {isUpdating ? 'Updating...' : status === 'active' ? 'Go Offline' : 'Go Online'}
                        </button>
                    </div>
                </div>

                <div className="dd-profile">
                    <div className="dd-profile-card">
                        <div className="dd-profile-header">
                            <div className="dd-avatar">
                                {isUploading ? (
                                    <div className="dd-spinner"></div>
                                ) : profileImage ? (
                                    <img
                                        src={profileImage}
                                        className="dd-profile-image"
                                        onClick={() => fileInputRef.current.click()}
                                    />
                                ) : (
                                    <FaUser className="dd-default-avatar" />
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleImageUpload}
                                    disabled={isUploading}
                                />
                            </div>
                            <h2>{driverInfo.name}</h2>
                            {renderRatingStars()}
                        </div>
                        <div className="dd-profile-details">
                            <div><FaPhone /> {driverInfo.phone}</div>
                            <div>{getVehicleIcon()} {driverInfo.vehicleType} - {driverInfo.vehicleNumber}</div>
                            <button className="dd-logout-btn" onClick={handleLogout}>Logout</button>
                        </div>
                    </div>

                    <div className="dd-stats">
                        <div className="dd-stat-card">
                            <h3>Completed Deliveries</h3>
                            <p>{completedDeliveries}</p>
                        </div>
                        <div className="dd-stat-card">
                            <h3>Earnings</h3>
                            <p>₹{driverInfo.earnings?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div className="dd-stat-card">
                            <h3>Rating</h3>
                            <p>{driverInfo.ratings?.average?.toFixed(1) || 'Not rated yet'}</p>
                        </div>
                    </div>
                </div>

                <div className="dd-actions">
                    <button className="dd-history-btn" onClick={() => navigate('/delivery-history')}>Delivery History</button>
                </div>
            </div>
            <LocationTracker />
            <AvailableShipments />
            <Footer />
        </>
    );
};

export default DriverDashboard;
