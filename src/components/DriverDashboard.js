import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaPhone, FaToggleOn, FaToggleOff, FaCar, FaYoutube, FaStar, FaCheck, FaTimes, FaExclamationTriangle, FaBug, FaSync, FaNetworkWired } from 'react-icons/fa';
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

// API Base URL
const API_BASE_URL = 'https://jio-yatri-driver.onrender.com';

// Error Boundary Component
class DriverErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Send error to debug state if available
    if (this.props.onError) {
      this.props.onError(error.toString());
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '5px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#856404' }}>Something went wrong</h2>
          <p style={{ color: '#856404' }}>
            Please try refreshing the app or contact support if the problem continues.
          </p>
          <div style={{ margin: '10px 0', padding: '10px', background: '#f8d7da', borderRadius: '4px' }}>
            <strong>Error Details:</strong>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', marginTop: '5px' }}>
              {this.state.error?.toString()}
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
              cursor: 'pointer',
              margin: '5px'
            }}
          >
            Reload App
          </button>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '10px 20px',
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
              color: '#155724',
              cursor: 'pointer',
              margin: '5px'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
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
    
    // Advanced Debug state
    const [debugInfo, setDebugInfo] = useState({
        stage: 'initializing',
        driverInfo: null,
        documentsVerified: false,
        isRegistered: false,
        hasUser: false,
        error: null,
        apiCalls: [],
        networkStatus: 'unknown',
        webviewType: 'unknown',
        jsCompatIssues: []
    });

    // Webview detection
    const [isWebView, setIsWebView] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [debugExpanded, setDebugExpanded] = useState(false);

    // Detect webview and browser capabilities
    useEffect(() => {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isWebViewEnv = /(WebView|Android|iPhone|iPad).*Version\/[.0-9]*\s+Safari/.test(userAgent) || 
                            userAgent.includes('wv');
        
        setIsWebView(isWebViewEnv);
        
        // Detect specific webview types
        let webviewType = 'unknown';
        if (userAgent.includes('Android')) webviewType = 'Android WebView';
        if (userAgent.includes('iPhone') || userAgent.includes('iPad')) webviewType = 'iOS WKWebView';
        if (userAgent.includes('; wv)')) webviewType = 'Android System WebView';
        
        // Check JavaScript compatibility
        const compatIssues = [];
        if (typeof Promise.allSettled !== 'function') compatIssues.push('Promise.allSettled not supported');
        if (typeof globalThis !== 'object') compatIssues.push('globalThis not supported');
        if (!('optional' in document.createElement('input'))) compatIssues.push('HTML5 input features limited');
        
        setDebugInfo(prev => ({
            ...prev, 
            isWebView: isWebViewEnv,
            webviewType,
            jsCompatIssues: compatIssues,
            networkStatus: navigator.onLine ? 'online' : 'offline'
        }));
        
        // Show debug info in webview by default
        if (isWebViewEnv) {
            setShowDebug(true);
        }
        
        // Network status listener
        const handleOnline = () => setDebugInfo(prev => ({...prev, networkStatus: 'online'}));
        const handleOffline = () => setDebugInfo(prev => ({...prev, networkStatus: 'offline'}));
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Track API calls for debugging
    const trackApiCall = (url, method, status, error = null) => {
        setDebugInfo(prev => ({
            ...prev,
            apiCalls: [...prev.apiCalls, {
                url,
                method,
                status,
                error,
                timestamp: new Date().toISOString()
            }].slice(-10) // Keep only last 10 calls
        }));
    };

    const fetchDriverInfo = useCallback(async () => {
        try {
            setDebugInfo(prev => ({...prev, stage: 'fetching_driver_info'}));
            const token = await user.getIdToken();

            // Track this API call
            trackApiCall(`${API_BASE_URL}/api/driver/info/${user.uid}`, 'GET', 'started');

            const driverRes = await fetch(`${API_BASE_URL}/api/driver/info/${user.uid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            trackApiCall(`${API_BASE_URL}/api/driver/info/${user.uid}`, 'GET', driverRes.status);

            if (driverRes.status === 404) {
                setIsRegistered(false);
                setLoading(false);
                setDebugInfo(prev => ({...prev, stage: 'not_registered', isRegistered: false}));
                return;
            }

            if (!driverRes.ok) throw new Error('Failed to fetch driver info');

            const driverData = await driverRes.json();
            setDriverInfo(driverData.data);
            setStatus(driverData.data?.status || 'inactive');

            // Try to get profile image
            try {
                trackApiCall(`${API_BASE_URL}/api/upload/profile-image/${user.uid}`, 'GET', 'started');
                const imageRes = await fetch(`${API_BASE_URL}/api/upload/profile-image/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                trackApiCall(`${API_BASE_URL}/api/upload/profile-image/${user.uid}`, 'GET', imageRes.status);
                
                if (imageRes.ok) {
                    const blob = await imageRes.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    setProfileImage(imageUrl);
                } else if (user.photoURL) {
                    setProfileImage(user.photoURL);
                }
            } catch (imageError) {
                trackApiCall(`${API_BASE_URL}/api/upload/profile-image/${user.uid}`, 'GET', 'error', imageError.message);
                console.log('Profile image fetch failed, continuing without it');
            }

            // Try to get settlement data
            try {
                trackApiCall(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, 'GET', 'started');
                const settlementRes = await fetch(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                trackApiCall(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, 'GET', settlementRes.status);
                
                if (settlementRes.ok) {
                    const settlementData = await settlementRes.json();
                    setSettlement({
                        today: settlementData.currentDaySettlement || {
                            cashCollected: 0,
                            onlineCollected: 0,
                            driverEarned: 0,
                            ownerEarned: 0
                        },
                        pending: settlementData.pending || []
                    });
                }
            } catch (settlementError) {
                trackApiCall(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, 'GET', 'error', settlementError.message);
                console.log('Settlement data fetch failed, continuing without it');
            }

            // Check document verification status
            const docsVerified = checkDocumentsVerified(driverData.data);
            
            setDebugInfo(prev => ({
                ...prev, 
                stage: docsVerified ? 'ready_for_dashboard' : 'documents_pending',
                driverInfo: !!driverData.data,
                documentsVerified: docsVerified,
                isRegistered: true
            }));
        } catch (err) {
            setError(err.message);
            setDebugInfo(prev => ({...prev, stage: 'error', error: err.message}));
            trackApiCall(`${API_BASE_URL}/api/driver/info/${user.uid}`, 'GET', 'error', err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Helper function to check document verification
    const checkDocumentsVerified = (driverData) => {
        if (!driverData?.documentVerification) return false;
        
        // Use traditional for loop for webview compatibility
        const statuses = Object.values(driverData.documentVerification);
        for (let i = 0; i < statuses.length; i++) {
            if (statuses[i] !== 'verified') {
                return false;
            }
        }
        return true;
    };

    useEffect(() => {
        setDebugInfo(prev => ({...prev, hasUser: !!user, stage: user ? 'checking_user' : 'no_user'}));
        if (!user) return;

        fetchDriverInfo();

        // Fetch shipments separately with error handling
        const fetchShipments = async () => {
            try {
                const token = await user.getIdToken();
                trackApiCall(`${API_BASE_URL}/api/shipments/driver/${user.uid}`, 'GET', 'started');
                const res = await axios.get(`${API_BASE_URL}/api/shipments/driver/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                trackApiCall(`${API_BASE_URL}/api/shipments/driver/${user.uid}`, 'GET', res.status);
                setShipments(res.data || []);
            } catch (err) {
                trackApiCall(`${API_BASE_URL}/api/shipments/driver/${user.uid}`, 'GET', 'error', err.message);
                console.log('Error fetching shipments, continuing without them');
            }
        };

        fetchShipments();
    }, [user, fetchDriverInfo]);

    useEffect(() => {
        const onErr = (e) => {
            const msg = e?.message || e?.error?.message || String(e);
            const file = e?.filename ? ` @ ${e.filename}:${e.lineno || ''}:${e.colno || ''}` : '';
            setFatal(`${msg}${file}`);
            setDebugInfo(prev => ({...prev, stage: 'fatal_error', error: msg}));
        };

        const onRej = (e) => {
            const reason = e?.reason;
            const msg = (reason && (reason.message || reason.toString())) || 'Unhandled promise rejection';
            const stack = reason?.stack ? `\n${reason.stack}` : '';
            setFatal(`${msg}${stack}`);
            setDebugInfo(prev => ({...prev, stage: 'fatal_error', error: msg}));
        };

        window.addEventListener('error', onErr);
        window.addEventListener('unhandledrejection', onRej);

        return () => {
            window.removeEventListener('error', onErr);
            window.removeEventListener('unhandledrejection', onRej);
        };
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setMarqueeActive(prev => !prev);
        }, 8000);

        return () => clearInterval(interval);
    }, []);

    const allDocumentsVerified = useMemo(() => {
        if (!driverInfo?.documentVerification) return false;
        return Object.entries(driverInfo.documentVerification)
            .filter(([key]) => !['verificationStatus', 'verificationNotes'].includes(key))
            .every(([_, status]) => status.trim().toLowerCase() === 'verified');
    }, [driverInfo]);

    const completedDeliveries = useMemo(() => {
        return shipments.filter(s => s.status?.toLowerCase() === 'delivered').length;
    }, [shipments]);

    const toggleStatus = async () => {
        const newStatus = status === 'active' ? 'inactive' : 'active';
        setIsUpdating(true);
        try {
            const token = await user.getIdToken(true);
            trackApiCall(`${API_BASE_URL}/api/driver/status`, 'PUT', 'started');
            const res = await fetch(`${API_BASE_URL}/api/driver/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            trackApiCall(`${API_BASE_URL}/api/driver/status`, 'PUT', res.status);

            if (!res.ok) throw new Error('Failed to update status');
            setStatus(newStatus);
            setDriverInfo(prev => ({
                ...prev,
                status: newStatus,
                lastUpdated: new Date().toISOString()
            }));
            setMessage({ text: 'Status updated', isError: false });
        } catch (err) {
            trackApiCall(`${API_BASE_URL}/api/driver/status`, 'PUT', 'error', err.message);
            setMessage({ text: err.message, isError: true });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleShareClick = async () => {
        try {
            const token = await user.getIdToken();
            navigate('/refferal', {
                state: {
                    token
                }
            });
        } catch (error) {
            console.error('Error getting token:', error);
            navigate('/refferal');
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
            trackApiCall(`${API_BASE_URL}/api/upload/profile-image`, 'POST', 'started');
            const response = await fetch(`${API_BASE_URL}/api/upload/profile-image`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            trackApiCall(`${API_BASE_URL}/api/upload/profile-image`, 'POST', response.status);

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            await fetchDriverInfo();
        } catch (err) {
            trackApiCall(`${API_BASE_URL}/api/upload/profile-image`, 'POST', 'error', err.message);
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

    const handleYoutubeClick = () => {
        window.open('https://youtube.com/@ambaninewstv?si=PBGWaPOKXdjV-Oa4', '_blank');
    };

    const handleSettlePayment = async (settlementId, amount, direction) => {
        try {
            const token = await user.getIdToken();
            trackApiCall(`${API_BASE_URL}/api/settlement/complete/${user.uid}`, 'POST', 'started');
            await axios.post(`${API_BASE_URL}/api/settlement/complete/${user.uid}`, {
                settlementId,
                amount,
                direction
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            trackApiCall(`${API_BASE_URL}/api/settlement/complete/${user.uid}`, 'POST', 'success');

            trackApiCall(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, 'GET', 'started');
            const res = await axios.get(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            trackApiCall(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, 'GET', res.status);

            setSettlement({
                today: res.data.currentDaySettlement || { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
                pending: res.data.pending || []
            });

            setMessage({ text: 'Payment settled successfully', isError: false });
        } catch (err) {
            trackApiCall(`${API_BASE_URL}/api/settlement/complete/${user.uid}`, 'POST', 'error', err.message);
            setMessage({ text: err.message, isError: true });
        }
    };

    const getVehicleIcon = () => {
        if (!driverInfo?.vehicleType) return <MdDirectionsCar />;

        switch (driverInfo.vehicleType.toLowerCase()) {
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
                            {status === 'verified' ? (
                                <FaCheck className="dd-verified" />
                            ) : (
                                <FaTimes className="dd-pending" />
                            )}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    // Advanced Debug overlay with detailed information
    const DebugOverlay = () => (
        <div style={{
            position: 'fixed',
            top: 10,
            right: 10,
            background: 'rgba(0,0,0,0.9)',
            color: 'white',
            padding: '10px',
            zIndex: 9999,
            fontSize: '12px',
            borderRadius: '5px',
            maxWidth: debugExpanded ? '500px' : '300px',
            border: '2px solid red',
            display: showDebug ? 'block' : 'none',
            maxHeight: debugExpanded ? '80vh' : 'auto',
            overflowY: debugExpanded ? 'auto' : 'visible'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong>DEBUG INFO {isWebView ? '(WEBVIEW)' : '(BROWSER)'}</strong>
                <div>
                    <button 
                        onClick={() => setDebugExpanded(!debugExpanded)}
                        style={{
                            padding: '2px 5px',
                            fontSize: '10px',
                            background: debugExpanded ? '#4CAF50' : '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            marginRight: '5px'
                        }}
                    >
                        {debugExpanded ? '▲' : '▼'}
                    </button>
                    <button 
                        onClick={() => setShowDebug(false)}
                        style={{
                            padding: '2px 5px',
                            fontSize: '10px',
                            background: '#ff6b6b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        ×
                    </button>
                </div>
            </div>
            
            <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#FFD700' }}>Stage:</span> {debugInfo.stage}
            </div>
            <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#FFD700' }}>Network:</span> 
                <span style={{ color: debugInfo.networkStatus === 'online' ? '#4CAF50' : '#ff6b6b' }}>
                    {debugInfo.networkStatus.toUpperCase()}
                </span>
            </div>
            <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#FFD700' }}>Has User:</span> {debugInfo.hasUser ? '✅' : '❌'}
            </div>
            <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#FFD700' }}>Driver Info:</span> {debugInfo.driverInfo ? '✅' : '❌'}
            </div>
            <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#FFD700' }}>Docs Verified:</span> {debugInfo.documentsVerified ? '✅' : '❌'}
            </div>
            <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#FFD700' }}>Registered:</span> {debugInfo.isRegistered ? '✅' : '❌'}
            </div>
            <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#FFD700' }}>Loading:</span> {loading ? '⏳' : '✅'}
            </div>
            
            {debugExpanded && (
                <>
                    <hr style={{ margin: '8px 0', borderColor: '#444' }} />
                    <div><strong>Environment Details:</strong></div>
                    <div>WebView Type: {debugInfo.webviewType}</div>
                    <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
                    
                    {debugInfo.jsCompatIssues.length > 0 && (
                        <div style={{ color: '#ff6b6b', marginTop: '5px' }}>
                            <div>JS Issues: {debugInfo.jsCompatIssues.join(', ')}</div>
                        </div>
                    )}
                    
                    <hr style={{ margin: '8px 0', borderColor: '#444' }} />
                    <div><strong>API Calls:</strong></div>
                    {debugInfo.apiCalls.slice().reverse().map((call, index) => (
                        <div key={index} style={{ 
                            fontSize: '10px', 
                            padding: '2px',
                            color: call.status === 'error' ? '#ff6b6b' : 
                                  call.status === 'success' ? '#4CAF50' : '#FFF'
                        }}>
                            {call.method} {call.url.split('/').pop()}: {call.status}
                            {call.error && ` - ${call.error}`}
                        </div>
                    ))}
                    
                    {debugInfo.error && (
                        <>
                            <hr style={{ margin: '8px 0', borderColor: '#444' }} />
                            <div style={{ color: '#ff6b6b' }}>
                                <strong>Error:</strong> {debugInfo.error}
                            </div>
                        </>
                    )}
                </>
            )}
            
            {!debugExpanded && debugInfo.error && (
                <div style={{ color: '#ff6b6b', marginTop: '5px', fontSize: '10px' }}>
                    Error: {debugInfo.error.substring(0, 50)}...
                </div>
            )}
        </div>
    );

    // Webview compatibility check with more options
    const WebviewCompatibilityNotice = () => (
        <div style={{
            position: 'fixed',
            bottom: 10,
            left: 10,
            background: '#ff6b6b',
            color: 'white',
            padding: '10px',
            zIndex: 9998,
            fontSize: '12px',
            borderRadius: '5px',
            maxWidth: '350px'
        }}>
            <FaExclamationTriangle /> WebView Detected: {debugInfo.webviewType}
            <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
                <button 
                    onClick={() => setShowDebug(true)}
                    style={{
                        padding: '2px 5px',
                        fontSize: '10px',
                        background: 'white',
                        color: '#ff6b6b',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                    }}
                >
                    <FaBug /> Debug
                </button>
                <button 
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '2px 5px',
                        fontSize: '10px',
                        background: 'white',
                        color: '#ff6b6b',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                    }}
                >
                    <FaSync /> Reload
                </button>
                <button 
                    onClick={() => {
                        setDebugInfo(prev => ({...prev, apiCalls: []}));
                        setError(null);
                        setFatal(null);
                    }}
                    style={{
                        padding: '2px 5px',
                        fontSize: '10px',
                        background: 'white',
                        color: '#ff6b6b',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                    }}
                >
                    <FaNetworkWired /> Clear Logs
                </button>
            </div>
        </div>
    );

    if (fatal) {
        return (
            <>
                <Header />
                <div style={{
                    padding: 16,
                    background: '#fff3cd',
                    color: '#664d03',
                    border: '1px solid #ffecb5',
                    borderRadius: 8,
                    margin: 16,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace'
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
                <DebugOverlay />
                <div className="dd-auth-required">
                    <div className="dd-auth-card">
                        <h2>You are not logged in</h2>
                        <p>Please log in to access your dashboard.</p>
                        <button
                            className="dd-auth-login-btn"
                            onClick={() => navigate('/home')}
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    if (loading) return (
        <div className="dd-loading">
            <DebugOverlay />
            {isWebView && <WebviewCompatibilityNotice />}
            <div className="dd-spinner-container">
                <div className="dd-beautiful-spinner"></div>
                <p className="dd-loading-text">Loading Dashboard...</p>
                {debugInfo.stage === 'error' && (
                    <p style={{ color: '#ff6b6b', marginTop: '10px' }}>
                        Having issues? Check the debug panel for details.
                    </p>
                )}
            </div>
        </div>
    );

    if (!isRegistered) return (
        <>
            <Header />
            <DebugOverlay />
            {isWebView && <WebviewCompatibilityNotice />}
            <div className="registration-required">
                <h2>Complete Your Registration</h2>
                <p>You need to complete the registration process before accessing the dashboard.</p>
                <button onClick={() => navigate('/home')}>
                    Complete Registration
                </button>
                <button onClick={handleLogout}>Logout</button>
            </div>
            <Footer />
        </>
    );

    if (error) return (
        <>
            <Header />
            <DebugOverlay />
            {isWebView && <WebviewCompatibilityNotice />}
            <div className="dd-error">
                <h3>Error Loading Dashboard</h3>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="dd-retry-btn">
                    Retry
                </button>
                <button onClick={handleLogout} className="dd-logout-btn">
                    Logout
                </button>
            </div>
            <Footer />
        </>
    );

    if (!allDocumentsVerified) return (
        <>
            <Header />
            <DebugOverlay />
            {isWebView && <WebviewCompatibilityNotice />}
            <div className="verify-container">
                <div className="verify-card">
                    <h2 className="verify-title">Documents Verification Required</h2>
                    <p className="verify-message">
                        Your documents are under review. You'll get full access once all documents are verified by our team.
                    </p>
                    {renderDocumentStatus()}
                    <button className="verify-logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>
            <Footer />
        </>
    );

    return (
        <DriverErrorBoundary onError={(error) => setDebugInfo(prev => ({...prev, error}))}>
            <>
                <Header />
                <DebugOverlay />
                {isWebView && <WebviewCompatibilityNotice />}
                
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
        </DriverErrorBoundary>
    );
};

export default DriverDashboard;
