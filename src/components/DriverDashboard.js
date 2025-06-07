import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaCar, FaPhone, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
import '../styles/DriverDashboard.css';

const DriverDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [driverInfo, setDriverInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('inactive');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchDriverInfo = async () => {
            try {
                const token = await user.getIdToken();
                const response = await fetch(`http://localhost:5000/api/driver/info/${user.uid}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch driver information');
                }

                const data = await response.json();
                setDriverInfo(data.data);
                setStatus(data.data.status || 'inactive');
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
                throw new Error('Failed to update status');
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
                            <FaUser />
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
                                <span className="vehicle-type">{driverInfo.vehicleType.charAt(0).toUpperCase() + driverInfo.vehicleType.slice(1)}</span>
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
    );
};

export default DriverDashboard;