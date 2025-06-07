import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaCar, FaPhone, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
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
                const token = await user.getIdToken();
                
                // Fetch driver information
                const driverResponse = await fetch(`http://localhost:5000/api/driver/info/${user.uid}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!driverResponse.ok) {
                    throw new Error('Failed to fetch driver information');
                }

                const driverData = await driverResponse.json();
                setDriverInfo(driverData.data);
                setStatus(driverData.data?.status || 'inactive');

                // Fetch custom profile image if exists
                if (driverData.data?.profileImage) {
                    const imgResponse = await fetch(`http://localhost:5000/api/upload/profile-image/${user.uid}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (imgResponse.ok) {
                        const imgData = await imgResponse.json();
                        setCustomImage(imgData.url);
                    }
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDriverInfo();
    }, [user, navigate]);

    const toggleStatus = async () => {
        const newStatus = status === 'active' ? 'inactive' : 'active';
        
        if (newStatus === 'active' && !window.confirm('Are you sure you want to go online and accept deliveries?')) {
            return;
        }

        setIsUpdating(true);
        
        try {
            const token = await user.getIdToken();
            const response = await fetch('http://localhost:5000/api/driver/status', {
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

        // Validate file type and size
        if (!file.type.match('image.*')) {
            setError('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            setError('Image size should be less than 5MB');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = await user.getIdToken();
            const response = await fetch('http://localhost:5000/api/upload/profile-image', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            // Update the driver info with new image reference
            setDriverInfo(prev => ({
                ...prev,
                profileImage: data.fileId
            }));

            // Display the uploaded image immediately
            setCustomImage(URL.createObjectURL(file));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const getVehicleIcon = () => {
        switch(driverInfo?.vehicleType) {
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
            <Header/>
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
                                {customImage ? (
                                    <img src={customImage} alt="Profile" className="profile-image" />
                                ) : profileImage ? (
                                    <img src={profileImage} alt="Profile" className="profile-image" />
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
                            <p>0</p>
                        </div>
                        <div className="stat-card">
                            <h3>Earnings</h3>
                            <p>₹0.00</p>
                        </div>
                        <div className="stat-card">
                            <h3>Rating</h3>
                            <p>Not rated yet</p>
                        </div>
                    </div>
                </div>

                <div className="dashboard-actions">
                    <button className="action-btn">View Available Deliveries</button>
                    <button className="action-btn">Delivery History</button>
                    <button className="action-btn">Edit Profile</button>
                </div>
            </div>
            <Footer/>
        </>
    );
};

export default DriverDashboard;