import React, { useState, useEffect } from 'react';
import axios from 'axios';


const DriverList = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDriver, setExpandedDriver] = useState(null);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const res = await axios.get('https://jio-yatri-driver.onrender.com/api/driver');
        console.log(res)
        setDrivers(res.data.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch drivers');
        setLoading(false);
      }
    };

    fetchDrivers();
  }, []);

  const toggleDriverDetails = (driverId) => {
    setExpandedDriver(expandedDriver === driverId ? null : driverId);
  };

  if (loading) return <div className="loading">Loading drivers...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (drivers.length === 0) return <div className="no-drivers">No drivers found</div>;

  return (
    <div className="driver-list">
      <h1>Driver Management</h1>
      <div className="summary-stats">
        <div className="stat-card">
          <h3>Total Drivers</h3>
          <p>{drivers.length}</p>
        </div>
        <div className="stat-card">
          <h3>Active</h3>
          <p>{drivers.filter(d => d.status === 'active').length}</p>
        </div>
        <div className="stat-card">
          <h3>Inactive</h3>
          <p>{drivers.filter(d => d.status === 'inactive').length}</p>
        </div>
      </div>

      <div className="drivers-container">
        {drivers.map(driver => (
          <div key={driver._id} className="driver-card">
            <div 
              className="driver-summary"
              onClick={() => toggleDriverDetails(driver._id)}
            >
              <div className="driver-avatar">
                {driver.profileImage ? (
                  <img 
                    src={`/api/upload/profile-image/${driver.userId}`} 
                    alt="Profile" 
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/50';
                    }}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {driver.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="driver-info">
                <h3>{driver.name}</h3>
                <p>{driver.vehicleType} • {driver.vehicleNumber}</p>
                <span className={`status-badge ${driver.status}`}>
                  {driver.status}
                </span>
              </div>
              <div className="driver-actions">
                <button className="toggle-details">
                  {expandedDriver === driver._id ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {expandedDriver === driver._id && (
              <div className="driver-details">
                <div className="detail-section">
                  <h4>Contact Information</h4>
                  <p><strong>Phone:</strong> {driver.phone}</p>
                  <p><strong>User ID:</strong> {driver.userId}</p>
                </div>

                <div className="detail-section">
                  <h4>Vehicle Details</h4>
                  <p><strong>Type:</strong> {driver.vehicleType}</p>
                  <p><strong>Number:</strong> {driver.vehicleNumber}</p>
                </div>

                <div className="detail-section">
                  <h4>Location</h4>
                  {driver.isLocationActive ? (
                    <>
                      <p><strong>Coordinates:</strong> {driver.location.coordinates.join(', ')}</p>
                      <p><strong>Address:</strong> {driver.location.address || 'Not specified'}</p>
                      <p><strong>Last Updated:</strong> {new Date(driver.location.lastUpdated).toLocaleString()}</p>
                    </>
                  ) : (
                    <p>Location not active</p>
                  )}
                </div>

                <div className="detail-section documents-section">
                  <h4>Documents</h4>
                  <div className="documents-grid">
                    <div className="document">
                      <h5>Driver License</h5>
                      {driver.documents?.license ? (
                        <a 
                          href={`/api/upload/${driver.documents.license}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          View License
                        </a>
                      ) : (
                        <p className="no-document">Not uploaded</p>
                      )}
                    </div>
                    <div className="document">
                      <h5>Vehicle RC</h5>
                      {driver.documents?.rc ? (
                        <a 
                          href={`/api/upload/${driver.documents.rc}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          View RC
                        </a>
                      ) : (
                        <p className="no-document">Not uploaded</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="meta-info">
                  <p><small>Last updated: {new Date(driver.lastUpdated).toLocaleString()}</small></p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriverList;