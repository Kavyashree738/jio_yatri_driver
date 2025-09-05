// DriverDashboard.js
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaPhone, FaToggleOn, FaToggleOff, FaYoutube, FaStar, FaCheck, FaTimes } from 'react-icons/fa';
import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
import Header from './Header';
import Footer from './Footer';
import LocationTracker from './LocationTracker';
import AvailableShipments from './AvailableShipments';
import '../styles/DriverDashboard.css';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import moment from 'moment';
import 'moment/locale/en-in';
import DailyEarningsFilter from './DailyEarningsFilter';

moment.locale('en-in');

/* -------------------- WebView-safe guard --------------------
   Prevents crashes in WebView if some dependency touches Notification.
   Does NOT request permission or show any UI.
---------------------------------------------------------------- */
if (typeof window !== 'undefined' && typeof window.Notification === 'undefined') {
  window.Notification = class {
    constructor() {}
    static async requestPermission() { return 'denied'; }
    static get permission() { return 'denied'; }
  };
}

const DriverDashboard = () => {
  const { user, setMessage } = useAuth();
  const navigate = useNavigate();

  const [driverInfo, setDriverInfo] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [settlement, setSettlement] = useState({
    today: { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
    pending: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('inactive');
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [isRegistered, setIsRegistered] = useState(true);
  const [marqueeActive, setMarqueeActive] = useState(false);
  const [marqueeText] = useState('Earn ₹10 Cashback');
  const [fatal, setFatal] = useState(null);

  const fetchDriverInfo = useCallback(async () => {
    try {
      const token = await user.getIdToken();

      // Optional health check
      const settlementCheckRes = await fetch(
        `https://jio-yatri-driver.onrender.com/api/settlement/check-settlement/${user.uid}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!settlementCheckRes.ok) {
        console.warn('Settlement check failed');
      }

      const [driverRes, imageRes, settlementRes] = await Promise.all([
        fetch(`https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`https://jio-yatri-driver.onrender.com/api/settlement/driver/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (driverRes.status === 404) {
        setIsRegistered(false);
        setLoading(false);
        return;
      }
      if (!driverRes.ok) throw new Error('Failed to fetch driver info');

      const driverData = await driverRes.json();
      const settlementData = settlementRes.ok ? await settlementRes.json() : { currentDaySettlement: null, pending: [] };

      setDriverInfo(driverData.data);
      setStatus(driverData.data?.status || 'inactive');
      setSettlement({
        today: settlementData.currentDaySettlement || {
          cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0
        },
        pending: settlementData.pending || []
      });

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
        const token = await user.getIdToken();
        const res = await axios.get(`https://jio-yatri-driver.onrender.com/api/shipments/driver/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setShipments(res.data || []);
      } catch (err) {
        console.error('Error fetching shipments:', err.message);
      }
    };
    fetchShipments();
  }, [user, fetchDriverInfo]);

  // Global runtime traps (prevent silent crashes)
  useEffect(() => {
    const onErr = (e) => {
      const msg = e?.message || e?.error?.message || String(e);
      const file = e?.filename ? ` @ ${e.filename}:${e.lineno || ''}:${e.colno || ''}` : '';
      setFatal(`${msg}${file}`);
    };
    const onRej = (e) => {
      const reason = e?.reason;
      const msg = (reason && (reason.message || reason.toString())) || 'Unhandled promise rejection';
      const stack = reason?.stack ? `\n${reason.stack}` : '';
      setFatal(`${msg}${stack}`);
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setMarqueeActive(prev => !prev), 8000);
    return () => clearInterval(interval);
  }, []);

  const allDocumentsVerified = useMemo(() => {
    if (!driverInfo?.documentVerification) return false;
    return Object.values(driverInfo.documentVerification).every(
      status => String(status).toLowerCase() === 'verified'
    );
  }, [driverInfo]);

  const completedDeliveries = useMemo(() => {
    return shipments.filter(s => (s.status || '').toLowerCase() === 'delivered').length;
  }, [shipments]);

  const toggleStatus = async () => {
    const newStatus = status === 'active' ? 'inactive' : 'active';
    setIsUpdating(true);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch('https://jio-yatri-driver.onrender.com/api/driver/status', {
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
      setMessage?.({ text: 'Status updated', isError: false });
    } catch (err) {
      setMessage?.({ text: err.message, isError: true });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShareClick = async () => {
    try {
      const token = await user.getIdToken();
      navigate('/refferal', { state: { token } });
    } catch {
      navigate('/refferal');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.match('image.*')) { setError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image size should be < 5MB'); return; }

    setIsUploading(true);
    setError(null);

    try {
      const previewUrl = URL.createObjectURL(file);
      setProfileImage(previewUrl);

      const formData = new FormData();
      formData.append('file', file);

      const token = await user.getIdToken(true);
      const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/profile-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

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
    } finally {
      setMessage?.({ text: 'Logged out', isError: false });
      navigate('/');
    }
  };

  const handleYoutubeClick = () => {
    window.open('https://youtube.com/@ambaninewstv?si=PBGWaPOKXdjV-Oa4', '_blank');
  };

  const handleSettlePayment = async (settlementId, amount, direction) => {
    try {
      const token = await user.getIdToken();
      await axios.post(`https://jio-yatri-driver.onrender.com/api/settlement/complete/${user.uid}`, {
        settlementId, amount, direction
      }, { headers: { Authorization: `Bearer ${token}` } });

      const res = await axios.get(`https://jio-yatri-driver.onrender.com/api/settlement/driver/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSettlement({
        today: res.data.currentDaySettlement || { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
        pending: res.data.pending || []
      });

      setMessage?.({ text: 'Payment settled successfully', isError: false });
    } catch (err) {
      setMessage?.({ text: err.message, isError: true });
    }
  };

  const getVehicleIcon = () => {
    if (!driverInfo?.vehicleType) return <MdDirectionsCar />;
    switch ((driverInfo.vehicleType || '').toLowerCase()) {
      case 'twowheeler': return <MdDirectionsBike />;
      case 'threewheeler': return <span role="img" aria-label="Three Wheeler">🛺</span>;
      case 'truck': return <MdLocalShipping />;
      case 'pickup9ft': return <span role="img" aria-label="Pickup">🛻</span>;
      case 'tata407': return <span role="img" aria-label="Truck">🚛</span>;
      default: return <MdDirectionsCar />;
    }
  };

  const renderRatingStars = () => {
    const rating = driverInfo?.ratings?.average || 0;
    return (
      <div className="dd-rating-stars">
        {[...Array(5)].map((_, i) => (
          <FaStar key={i} className={`dd-star ${i < Math.floor(rating) ? 'dd-filled' : ''}`} />
        ))}
        <span className="dd-rating-text">{rating > 0 ? `${rating.toFixed(1)}/5` : 'Not rated yet'}</span>
      </div>
    );
  };

  const renderDocumentStatus = () => {
    if (!driverInfo?.documentVerification) return null;
    return (
      <div className="dd-document-status">
        <h3>Document Verification Status</h3>
        {Object.entries(driverInfo.documentVerification).map(([docType, status]) => (
          <div key={docType} className={`dd-doc-item ${status}`}>
            <span>{docType.replace(/([A-Z])/g, ' $1').trim()}:</span>
            <span>
              {status === 'verified' ? <FaCheck className="dd-verified" /> : <FaTimes className="dd-pending" />}
              {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // FATAL RUNTIME
  if (fatal) {
    return (
      <>
        <Header />
        <div style={{
          padding: 16, background: '#fff3cd', color: '#664d03',
          border: '1px solid #ffecb5', borderRadius: 8, margin: 16,
          whiteSpace: 'pre-wrap', fontFamily: 'monospace'
        }}>
          <strong>Runtime Error:</strong>{'\n'}{fatal}
        </div>
        <Footer />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Header />
        <div className="dd-auth-required">
          <div className="dd-auth-card">
            <h2>You are not logged in</h2>
            <p>Please log in to access your dashboard.</p>
            <button className="dd-auth-login-btn" onClick={() => navigate('/home')}>Go to Login</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (loading) {
    return (
      <div className="dd-loading">
        <div className="dd-spinner-container">
          <div className="dd-beautiful-spinner"></div>
          <p className="dd-loading-text">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <>
        <Header />
        <div className="registration-required">
          <h2>Complete Your Registration</h2>
          <p>You need to complete the registration process before accessing the dashboard.</p>
          <button onClick={() => navigate('/home')}>Complete Registration</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
        <Footer />
      </>
    );
  }

  if (error) return <div className="dd-error">Error: {error}</div>;

  if (!allDocumentsVerified) {
    return (
      <>
        <Header />
        <div className="verify-container">
          <div className="verify-card">
            <h2 className="verify-title">Documents Verification Required</h2>
            <p className="verify-message">
              Your documents are under review. You'll get full access once all documents are verified by our team.
            </p>
            {renderDocumentStatus()}
            <button className="verify-logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="dd-container">
        <div className="dd-header">
          <h1>Driver Dashboard</h1>
          <div className='buttons'>
            <button className="dd-share-btn" onClick={handleShareClick}>
              <div className="dd-marquee-container">
                {marqueeActive ? (
                  <div className="dd-marquee-content">
                    <span className="dd-marquee-text">{marqueeText}</span>
                  </div>
                ) : (
                  <div className="dd-static-text">Share</div>
                )}
              </div>
            </button>
            <button className="dd-youtube-btn" onClick={handleYoutubeClick}>
              <FaYoutube className='dd-youtube-icon' />
            </button>
          </div>
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
                    alt="Profile"
                    onClick={() => fileInputRef.current.click()}
                    style={{ cursor: 'pointer' }}
                  />
                ) : (
                  <FaUser
                    className="dd-default-avatar"
                    onClick={() => fileInputRef.current.click()}
                    style={{ cursor: 'pointer' }}
                  />
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

              <h2>{driverInfo?.name || 'Driver'}</h2>
              {renderRatingStars()}
            </div>

            <div className="dd-profile-details">
              <div><FaPhone /> {driverInfo?.phone || 'N/A'}</div>
              <div>{getVehicleIcon()} {driverInfo?.vehicleType || 'N/A'} - {driverInfo?.vehicleNumber || 'N/A'}</div>
              <div className='buttons'>
                <button className="dd-logout-btn" onClick={handleLogout}>Logout</button>
              </div>
            </div>
          </div>

          <div className="dd-stats">
            <div className="dd-stat-card">
              <h3>Completed Deliveries</h3>
              <p>{completedDeliveries}</p>
            </div>
            <div className="dd-stat-card">
              <h3>Earnings</h3>
              <p>₹{(driverInfo?.earnings || 0).toFixed(2)}</p>
            </div>
            <div className="dd-stat-card">
              <h3>Rating</h3>
              <p>{(driverInfo?.ratings?.average || 0).toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="settlement-card">
          <h3>Today's Earnings</h3>
          {!settlement?.today ? (
            <p>No rides today</p>
          ) : (
            <>
              <div className="settlement-row">
                <span>Cash Collected:</span>
                <span>₹{(settlement.today.cashCollected || 0).toFixed(2)}</span>
              </div>
              <div className="settlement-row">
                <span>Online Payments:</span>
                <span>₹{(settlement.today.onlineCollected || 0).toFixed(2)}</span>
              </div>
              <div className="settlement-row highlight">
                <span>You owe Owner (20%):</span>
                <span className="negative">
                  ₹{((settlement.today.cashCollected || 0) * 0.2).toFixed(2)}
                </span>
              </div>
              <div className="settlement-row highlight">
                <span>Owner owes You (80%):</span>
                <span className="positive">
                  ₹{((settlement.today.onlineCollected || 0) * 0.8).toFixed(2)}
                </span>
              </div>
            </>
          )}

          {settlement?.pending?.length > 0 && (
            <div className="pending-settlements">
              <h4>Pending Settlements</h4>
              {settlement.pending.map(item => (
                <div key={item._id} className="pending-item">
                  <span>{moment(item.date).format('MMM D')}: </span>
                  {item.driverToOwner > 0 && (
                    <button
                      className="settle-btn"
                      onClick={() => handleSettlePayment(item._id, item.driverToOwner, 'driverToOwner')}
                    >
                      Pay Owner: ₹{(item.driverToOwner || 0).toFixed(2)}
                    </button>
                  )}
                  {item.ownerToDriver > 0 && (
                    <span className="positive">
                      Receive: ₹{(item.ownerToDriver || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {driverInfo && (
          <DailyEarningsFilter
            paymentSettlements={driverInfo.paymentSettlements || []}
            registrationDate={driverInfo.createdAt}
            onFilter={(filtered) => console.log(filtered)}
          />
        )}

        <div className="dd-actions">
          <button className="dd-history-btn" onClick={() => navigate('/delivery-history')}>
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
