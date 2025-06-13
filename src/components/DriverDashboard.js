import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaCar, FaPhone, FaToggleOn, FaToggleOff, FaFileAlt } from 'react-icons/fa';
import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
import '../styles/DriverDashboard.css';
import Header from './Header';
import Footer from './Footer';

const DriverDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [driverInfo, setDriverInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('inactive');
    const [isUpdating, setIsUpdating] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [customImage, setCustomImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Get Firebase profile image
    useEffect(() => {
        if (user?.photoURL) {
            setProfileImage(user.photoURL);
        }
    }, [user]);

    // Fetch driver info and custom profile image
    useEffect(() => {
        if (!user) {
            navigate('/orders');
            return;
        }

        const fetchDriverInfo = async () => {
            try {
                const token = await user.getIdToken(true);
                const driverResponse = await fetch(`https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!driverResponse.ok) {
                    throw new Error('Failed to fetch driver information');
                }

                const driverData = await driverResponse.json();
                setDriverInfo(driverData.data);
                setStatus(driverData.data?.status || 'inactive');

                if (driverData.data?.profileImage) {
                    setCustomImage(`https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}?ts=${Date.now()}`);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDriverInfo();
    }, [user, navigate, customImage]);

    const toggleStatus = async () => {
        const newStatus = status === 'active' ? 'inactive' : 'active';

        if (newStatus === 'active' && !window.confirm('Are you sure you want to go online and accept deliveries?')) {
            return;
        }

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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status');
            }

            const result = await response.json();
            setStatus(newStatus);
            setDriverInfo(prev => ({
                ...prev,
                status: newStatus,
                lastUpdated: result.data.lastUpdated
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
            // Create preview URL for immediate display
            const previewUrl = URL.createObjectURL(file);
            setCustomImage(previewUrl);

            const formData = new FormData();
            formData.append('file', file);

            const token = await user.getIdToken(true);
            const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/profile-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            setDriverInfo(prev => ({
                ...prev,
                profileImage: data.fileId
            }));

            // Force refresh from server after 1 second
            setTimeout(() => {
                setCustomImage(`https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}?ts=${Date.now()}`);
                URL.revokeObjectURL(previewUrl); // Clean up memory
            }, 1000);

        } catch (err) {
            setCustomImage(null);
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const getVehicleIcon = () => {
        switch (driverInfo?.vehicleType) {
            case 'bike': return <MdDirectionsBike className="vehicle-icon" />;
            case 'van': return <MdDirectionsCar className="vehicle-icon" />;
            case 'truck': return <MdLocalShipping className="vehicle-icon" />;
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
                                {(customImage || profileImage) ? (
                                    <>
                                        <img 
                                            src={customImage || profileImage} 
                                            alt="Profile" 
                                            className="profile-image"
                                            onError={() => setCustomImage(null)}
                                        />
                                        <div className="upload-overlay">
                                            <label htmlFor="profile-upload">
                                                {isUploading ? 'Uploading...' : 'Change Photo'}
                                            </label>
                                            <input
                                                id="profile-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={isUploading}
                                                style={{ display: 'none' }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <FaUser className="default-avatar" />
                                        <div className="upload-overlay">
                                            <label htmlFor="profile-upload">
                                                {isUploading ? 'Uploading...' : 'Upload Photo'}
                                            </label>
                                            <input
                                                id="profile-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={isUploading}
                                                style={{ display: 'none' }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                            <h2>{driverInfo.name}</h2>
                        </div>

                        <div className="profile-details">
                            <div className="detail-item">
                                <FaPhone className="detail-icon" />
                                <span>{driverInfo.phone}</span>
                            </div>

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
                    {/* <button 
                        className="action-btn"
                        onClick={() => navigate('/edit-profile')}
                    >
                        Edit Profile
                    </button> */}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default DriverDashboard;