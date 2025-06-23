import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaPhone, FaToggleOn, FaToggleOff, FaCar } from 'react-icons/fa';
import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
import Header from './Header';
import Footer from './Footer';
import LocationTracker from './LocationTracker';
import AvailableShipments from './AvailableShipments';
import '../styles/DriverDashboard.css';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
const DriverDashboard = () => {
    const { user ,setMessage } = useAuth();
    const navigate = useNavigate();
    const [driverInfo, setDriverInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('inactive');
    const [isUpdating, setIsUpdating] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setMessage({ text: 'Logged out successfully.', isError: false });
            navigate('/');
        } catch (error) {
            setMessage({ text: 'Logout failed: ' + error.message, isError: true });
        }
    };

    // Fetch driver info
    const fetchDriverInfo = useCallback(async () => {
        try {
            const token = await user.getIdToken();
            const [driverResponse, imageResponse] = await Promise.all([
                fetch(`https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!driverResponse.ok) throw new Error('Failed to fetch driver info');
            
            const driverData = await driverResponse.json();
            setDriverInfo(driverData.data);
            setStatus(driverData.data?.status || 'inactive');
            
            if (imageResponse.ok) {
                const blob = await imageResponse.blob();
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
        if (!user) {
            navigate('/orders');
            return;
        }
        fetchDriverInfo();
    }, [user, navigate, fetchDriverInfo]);

    const toggleStatus = async () => {
        const newStatus = status === 'active' ? 'inactive' : 'active';
        setIsUpdating(true);

        try {
            const token = await user.getIdToken(true);
            const response = await fetch('https://jio-yatri-driver.onrender.com/api/driver/status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error('Failed to update status');
            
            setStatus(newStatus);
            setDriverInfo(prev => ({
                ...prev,
                status: newStatus,
                lastUpdated: new Date().toISOString()
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        // Validate file
        if (!file.type.match('image.*')) {
            setError('Please select an image file (JPEG, PNG, etc.)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image size should be less than 5MB');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            // Create preview URL
            const previewUrl = URL.createObjectURL(file);
            setProfileImage(previewUrl);

            const formData = new FormData();
            formData.append('file', file);

            const token = await user.getIdToken(true);
            const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/profile-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await response.json();
            
            // Update the image with the new URL from server
            const newImageResponse = await fetch(data.imageUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (newImageResponse.ok) {
                const newImageBlob = await newImageResponse.blob();
                const newImageUrl = URL.createObjectURL(newImageBlob);
                setProfileImage(newImageUrl);
            }

            // Update driver info
            await fetchDriverInfo();
        } catch (err) {
            console.error('Upload error:', err);
            setProfileImage(prev => prev || user.photoURL || null);
            setError(err.message || 'Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteImage = async () => {
        if (!window.confirm('Are you sure you want to delete your profile image?')) return;

        try {
            const token = await user.getIdToken(true);
            const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/profile-image', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete image');

            setProfileImage(user.photoURL || null);
            await fetchDriverInfo();
        } catch (err) {
            setError(err.message || 'Failed to delete image');
        }
    };

    const getVehicleIcon = () => {
        if (!driverInfo?.vehicleType) return <FaCar className="vehicle-icon" />;
        
        switch (driverInfo.vehicleType.toLowerCase()) {
            case 'Twowheeler': return <MdDirectionsBike className="vehicle-icon" />;
            case 'Threewheeler': return <MdDirectionsCar className="vehicle-icon" />;
            case 'Truck': return <MdLocalShipping className="vehicle-icon" />;
            default: return <MdDirectionsCar className="vehicle-icon" />;
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading your driver information...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <p>Error: {error}</p>
                <button onClick={() => window.location.reload()}>Try Again</button>
            </div>
        );
    }

    if (!driverInfo) {
        return (
            <div className="dashboard-no-info">
                <p>No driver information found.</p>
                <button onClick={() => navigate('/driver-register')}>Complete Registration</button>
            </div>
        );
    }

    return (
        <>
            <Header />
            <div className="driver-dashboard">
                <div className="dashboard-header">
                    <h1>Driver Dashboard</h1>
                    <div className="status-toggle">
                        <span>Status: {status === 'active' ? 'Active' : 'Inactive'}</span>
                        <button
                            onClick={toggleStatus}
                            disabled={isUpdating}
                            className={`toggle-btn ${status === 'active' ? 'active' : 'inactive'}`}
                        >
                            {status === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                            {isUpdating ? 'Updating...' : status === 'active' ? 'Go Offline' : 'Go Online'}
                        </button>
                    </div>
                </div>

                <div className="driver-profile">
                    <div className="profile-card">
                        <div className="profile-header">
                            <div className="avatar">
                                {isUploading ? (
                                    <div className="image-loading">
                                        <div className="spinner-small"></div>
                                    </div>
                                ) : profileImage ? (
                                    <img
                                        src={profileImage}
                                        alt="Profile"
                                        className="profile-image"
                                        onError={() => setProfileImage(user.photoURL || null)}
                                    />
                                ) : (
                                    <FaUser className="default-avatar" />
                                )}
                                <div className="upload-overlay">
                                    <label htmlFor="profile-upload">
                                        {isUploading ? 'Uploading...' : 'Change Photo'}
                                    </label>
                                    <input
                                        id="profile-upload"
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            </div>
                            <h2>{driverInfo.name}</h2>
                        </div>

                        <div className="profile-details">
                            <div className="detail-item">
                                <FaPhone className="detail-icon" />
                                <span>{driverInfo.phone}</span>
                            </div>
                              <button onClick={handleLogout} className="logout-button">
                                    Logout
                                </button> 
                            <div className="detail-item">
                                {getVehicleIcon()}
                                <div className="vehicle-info">
                                    <span className="vehicle-type">
                                        {driverInfo.vehicleType?.charAt(0).toUpperCase() + driverInfo.vehicleType?.slice(1)}
                                    </span>
                                    <span className="vehicle-number">{driverInfo.vehicleNumber}</span>
                                </div>
                            </div>

                            <div className="detail-item">
                                <span className="detail-label">Last Updated:</span>
                                <span>{new Date(driverInfo.lastUpdated).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-stats">
                        <div className="stat-card">
                            <h3>Completed Deliveries</h3>
                            <p>{driverInfo.completedDeliveries || 0}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Earnings</h3>
                            <p>₹{driverInfo.earnings?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Rating</h3>
                            <p>{driverInfo.rating || 'Not rated yet'}</p>
                        </div>

                    </div>
                </div>

                <div className="dashboard-actions">
                    <button
                        className="action-btn"
                        onClick={() => navigate('/available-deliveries')}
                    >
                        View Available Deliveries
                    </button>
                    <button
                        className="action-btn"
                        onClick={() => navigate('/delivery-history')}
                    >
                        Delivery History
                    </button>
                </div>
            </div>
            <LocationTracker />
            <AvailableShipments />
            <Footer />
        </>
    );
};

export default DriverDashboard;
