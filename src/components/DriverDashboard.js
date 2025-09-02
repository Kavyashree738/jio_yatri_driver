import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaPhone, FaToggleOn, FaToggleOff, FaStar, FaCheck, FaTimes, FaExclamationTriangle, FaBug, FaSync, FaNetworkWired, FaCopy, FaTrashAlt, FaInfoCircle, FaYoutube } from 'react-icons/fa';
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

const API_BASE_URL = 'https://jio-yatri-driver.onrender.com';

/* ----------------------------- SAFE SHIMS ----------------------------- */

/** Install WebView-safe shims and global debug hooks */
function installSafeShims() {
  // Global debug store
  if (!window.__debug) {
    window.__debug = {
      apiCalls: [],
      console: [],
      errors: [],
      toasts: [],
      features: {},
      logsEnabled: true,
      maxKeep: 400
    };
  }

  // Feature flags
  window.__debug.features = {
    hasNotification: typeof window.Notification !== 'undefined',
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    hasVibrate: typeof navigator !== 'undefined' && 'vibrate' in navigator,
    hasShare: typeof navigator !== 'undefined' && 'share' in navigator,
    hasClipboard: typeof navigator !== 'undefined' && 'clipboard' in navigator,
    hasPromiseAllSettled: typeof Promise !== 'undefined' && typeof Promise.allSettled === 'function',
    hasGlobalThis: typeof globalThis === 'object',
  };

  // Console capture
  ['log','info','warn','error'].forEach(level => {
    const orig = console[level];
    console[level] = function(...args) {
      try {
        if (window.__debug.logsEnabled) {
          window.__debug.console.push({ level, args: args.map(a => serialize(a)), ts: Date.now() });
          if (window.__debug.console.length > window.__debug.maxKeep) window.__debug.console.shift();
        }
      } catch {}
      return orig.apply(console, args);
    };
  });

  // Error capture
  window.addEventListener('error', (e) => {
    const payload = {
      type: 'error',
      message: e?.message || 'Unknown error',
      filename: e?.filename,
      lineno: e?.lineno,
      colno: e?.colno,
      stack: e?.error?.stack || null,
      ts: Date.now(),
    };
    window.__debug.errors.push(payload);
    trim(window.__debug.errors, window.__debug.maxKeep);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason;
    const payload = {
      type: 'unhandledrejection',
      message: (reason && (reason.message || reason.toString())) || 'Unhandled promise rejection',
      stack: reason?.stack || null,
      ts: Date.now(),
    };
    window.__debug.errors.push(payload);
    trim(window.__debug.errors, window.__debug.maxKeep);
  });

  // Axios interceptors (also captures fetch below)
  if (!axios.__debugInterceptorInstalled) {
    axios.__debugInterceptorInstalled = true;

    axios.interceptors.request.use(req => {
      pushApiCall({
        url: req?.url,
        method: (req?.method || 'GET').toUpperCase(),
        phase: 'request',
        status: 'started',
      });
      return req;
    }, err => {
      pushApiCall({
        url: err?.config?.url,
        method: (err?.config?.method || 'GET').toUpperCase(),
        phase: 'request',
        status: 'error',
        error: err?.message
      });
      return Promise.reject(err);
    });

    axios.interceptors.response.use(res => {
      pushApiCall({
        url: res?.config?.url,
        method: (res?.config?.method || 'GET').toUpperCase(),
        phase: 'response',
        status: res?.status,
      });
      return res;
    }, err => {
      pushApiCall({
        url: err?.config?.url,
        method: (err?.config?.method || 'GET').toUpperCase(),
        phase: 'response',
        status: err?.response?.status || 'error',
        error: err?.message
      });
      return Promise.reject(err);
    });
  }

  // Fetch tracking (non-invasive)
  if (!window.__origFetch && typeof window.fetch === 'function') {
    window.__origFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const [url, init] = args;
      pushApiCall({
        url: typeof url === 'string' ? url : (url?.url || 'fetch'),
        method: (init?.method || 'GET').toUpperCase(),
        phase: 'request',
        status: 'started'
      });
      try {
        const res = await window.__origFetch(...args);
        pushApiCall({
          url: typeof url === 'string' ? url : (url?.url || 'fetch'),
          method: (init?.method || 'GET').toUpperCase(),
          phase: 'response',
          status: res.status
        });
        return res;
      } catch (err) {
        pushApiCall({
          url: typeof url === 'string' ? url : (url?.url || 'fetch'),
          method: (init?.method || 'GET').toUpperCase(),
          phase: 'response',
          status: 'error',
          error: err?.message
        });
        throw err;
      }
    };
  }

  // Notification shim (prevents ReferenceError in WebView)
  if (typeof window.Notification === 'undefined') {
    class ShimNotification {
      constructor(title, options = {}) {
        window.__notify(title, options);
      }
      static async requestPermission() {
        // no real permission dialog in WebView; simulate denied
        return 'denied';
      }
      static get permission() { return 'denied'; }
    }
    window.Notification = ShimNotification;
  }

  // Global notify helper (uses real Notification if permitted, else in-app toast)
  if (!window.__notify) {
    window.__notify = (title, options = {}) => {
      try {
        const canReal =
          typeof window.Notification !== 'undefined' &&
          typeof window.Notification.permission === 'string' &&
          window.Notification.permission === 'granted';

        if (canReal) {
          // Real notification
          new window.Notification(title, options);
        } else {
          // In-app toast
          const toast = {
            id: Math.random().toString(36).slice(2),
            title,
            body: options?.body || '',
            ts: Date.now()
          };
          window.__debug.toasts.push(toast);
          trim(window.__debug.toasts, 50);
          // Auto remove in 6s
          setTimeout(() => {
            window.__debug.toasts = window.__debug.toasts.filter(t => t.id !== toast.id);
          }, 6000);
        }
      } catch (e) {
        console.warn('Notify error:', e);
      }
    };
  }
}

// helpers
function serialize(x) {
  try {
    if (x instanceof Error) {
      return { __type: 'Error', message: x.message, stack: x.stack };
    }
    if (typeof x === 'object') return JSON.parse(JSON.stringify(x));
    return x;
  } catch {
    return String(x);
  }
}
function trim(arr, max) {
  while (arr.length > max) arr.shift();
}
function pushApiCall(partial) {
  const entry = { ts: Date.now(), ...partial };
  window.__debug.apiCalls.push(entry);
  trim(window.__debug.apiCalls, 200);
}

// install once
if (typeof window !== 'undefined' && !window.__safeShimsInstalled) {
  window.__safeShimsInstalled = true;
  installSafeShims();
}

/* --------------------------- ERROR BOUNDARY --------------------------- */

class DriverErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    window.__debug.errors.push({
      type: 'react-errorboundary',
      message: error?.message || String(error),
      stack: error?.stack || null,
      info: errorInfo?.componentStack || null,
      ts: Date.now()
    });
    trim(window.__debug.errors, window.__debug.maxKeep);
    if (this.props.onError) this.props.onError(error?.toString());
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20, textAlign: 'left',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: 8, margin: 20
        }}>
          <h2 style={{ color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaExclamationTriangle /> Something went wrong
          </h2>
          <p style={{ color: '#856404' }}>
            Please try refreshing the app or contact support if the problem continues.
          </p>
          <div style={{ margin: '10px 0', padding: '10px', background: '#f8d7da', borderRadius: 4 }}>
            <strong>Error Details:</strong>
            <div style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 5, whiteSpace: 'pre-wrap' }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack ? ('\n' + this.state.errorInfo.componentStack) : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.location.reload()}
              style={btnStyle('#f8d7da', '#f5c6cb', '#721c24')}>Reload App</button>
            <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              style={btnStyle('#d4edda', '#c3e6cb', '#155724')}>Try Again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
const btnStyle = (bg, border, color) => ({
  padding: '10px 16px', backgroundColor: bg, border: `1px solid ${border}`,
  borderRadius: 6, color, cursor: 'pointer'
});

/* --------------------------- MAIN COMPONENT --------------------------- */

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

  const [debugInfo, setDebugInfo] = useState({
    stage: 'initializing',
    driverInfo: null,
    documentsVerified: false,
    isRegistered: false,
    hasUser: false,
    error: null,
    apiCalls: [],
    networkStatus: navigator.onLine ? 'online' : 'offline',
    webviewType: 'unknown',
    jsCompatIssues: []
  });

  const [isWebView, setIsWebView] = useState(false);
  const [showDebug, setShowDebug] = useState(true); // show by default in WebView
  const [debugExpanded, setDebugExpanded] = useState(false);

  // Detect WebView + JS feature checks
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isWV = /\bwv\b|Android.*Version\/\d+\.\d+.*Safari/.test(ua) || /; wv\)/.test(ua);
    setIsWebView(isWV);

    let wvType = 'unknown';
    if (/Android/.test(ua) && /; wv\)/.test(ua)) wvType = 'Android System WebView';
    else if (/Android/.test(ua)) wvType = 'Android WebView';
    else if (/iPhone|iPad/.test(ua)) wvType = 'iOS WKWebView';

    const compatIssues = [];
    if (!window.__debug.features.hasPromiseAllSettled) compatIssues.push('Promise.allSettled not supported');
    if (!window.__debug.features.hasGlobalThis) compatIssues.push('globalThis not supported');

    setDebugInfo(prev => ({
      ...prev,
      isWebView: isWV,
      webviewType: wvType,
      jsCompatIssues: compatIssues,
      stage: 'bootstrapped'
    }));

    const onOnline = () => setDebugInfo(p => ({ ...p, networkStatus: 'online' }));
    const onOffline = () => setDebugInfo(p => ({ ...p, networkStatus: 'offline' }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Mirror global debug arrays into local state (for overlay)
  useEffect(() => {
    const t = setInterval(() => {
      setDebugInfo(prev => ({
        ...prev,
        apiCalls: [...window.__debug.apiCalls],
        // keep errors concise on the overlay; full stacks in expandable
        error: window.__debug.errors.length ? window.__debug.errors[window.__debug.errors.length - 1].message : prev.error,
      }));
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Global runtime traps
  useEffect(() => {
    const onErr = (e) => {
      const msg = e?.message || e?.error?.message || String(e);
      const file = e?.filename ? ` @ ${e.filename}:${e.lineno || ''}:${e.colno || ''}` : '';
      setFatal(`${msg}${file}`);
      setDebugInfo(prev => ({ ...prev, stage: 'fatal_error', error: msg }));
    };
    const onRej = (e) => {
      const r = e?.reason;
      const msg = (r && (r.message || r.toString())) || 'Unhandled promise rejection';
      const stack = r?.stack ? `\n${r.stack}` : '';
      setFatal(`${msg}${stack}`);
      setDebugInfo(prev => ({ ...prev, stage: 'fatal_error', error: msg }));
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  // Marquee toggle
  useEffect(() => {
    const interval = setInterval(() => setMarqueeActive(p => !p), 8000);
    return () => clearInterval(interval);
  }, []);

  const trackApiCall = (url, method, status, error = null) => {
    pushApiCall({ url, method, phase: 'manual', status, error });
    setDebugInfo(prev => ({ ...prev, apiCalls: [...window.__debug.apiCalls] }));
  };

  const checkDocumentsVerified = (data) => {
    if (!data?.documentVerification) return false;
    const statuses = Object.values(data.documentVerification);
    for (let i = 0; i < statuses.length; i++) {
      if ((statuses[i] || '').toString().toLowerCase() !== 'verified') return false;
    }
    return true;
  };

  const fetchDriverInfo = useCallback(async () => {
    if (!user) return;
    try {
      setDebugInfo(prev => ({ ...prev, stage: 'fetching_driver_info' }));
      const token = await user.getIdToken();

      trackApiCall(`${API_BASE_URL}/api/driver/info/${user.uid}`, 'GET', 'started');

      const driverRes = await fetch(`${API_BASE_URL}/api/driver/info/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      trackApiCall(`${API_BASE_URL}/api/driver/info/${user.uid}`, 'GET', driverRes.status);

      if (driverRes.status === 404) {
        setIsRegistered(false);
        setLoading(false);
        setDebugInfo(prev => ({ ...prev, stage: 'not_registered', isRegistered: false }));
        return;
      }

      if (!driverRes.ok) throw new Error('Failed to fetch driver info');

      const driverData = await driverRes.json();
      setDriverInfo(driverData.data);
      setStatus(driverData.data?.status || 'inactive');

      // Profile image
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

      // Settlement
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
              cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0
            },
            pending: settlementData.pending || []
          });
        }
      } catch (settlementError) {
        trackApiCall(`${API_BASE_URL}/api/settlement/driver/${user.uid}`, 'GET', 'error', settlementError.message);
        console.log('Settlement data fetch failed, continuing without it');
      }

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
      setDebugInfo(prev => ({ ...prev, stage: 'error', error: err.message }));
      trackApiCall(`${API_BASE_URL}/api/driver/info/${user.uid}`, 'GET', 'error', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial data
  useEffect(() => {
    setDebugInfo(prev => ({ ...prev, hasUser: !!user, stage: user ? 'checking_user' : 'no_user' }));
    if (!user) return;

    fetchDriverInfo();

    (async () => {
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
    })();
  }, [user, fetchDriverInfo]);

  const allDocumentsVerified = useMemo(() =>
    !!driverInfo?.documentVerification &&
    Object.entries(driverInfo.documentVerification)
      .filter(([k]) => !['verificationStatus', 'verificationNotes'].includes(k))
      .every(([_, s]) => (s || '').toString().trim().toLowerCase() === 'verified')
  , [driverInfo]);

  const completedDeliveries = useMemo(() =>
    shipments.filter(s => (s.status || '').toLowerCase() === 'delivered').length
  , [shipments]);

  const toggleStatus = async () => {
    const newStatus = status === 'active' ? 'inactive' : 'active';
    setIsUpdating(true);
    try {
      const token = await user.getIdToken(true);
      trackApiCall(`${API_BASE_URL}/api/driver/status`, 'PUT', 'started');
      const res = await fetch(`${API_BASE_URL}/api/driver/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      trackApiCall(`${API_BASE_URL}/api/driver/status`, 'PUT', res.status);
      if (!res.ok) throw new Error('Failed to update status');
      setStatus(newStatus);
      setDriverInfo(prev => ({ ...prev, status: newStatus, lastUpdated: new Date().toISOString() }));
      setMessage?.({ text: 'Status updated', isError: false });
      window.__notify('Status updated', { body: `You are now ${newStatus}` });
    } catch (err) {
      trackApiCall(`${API_BASE_URL}/api/driver/status`, 'PUT', 'error', err.message);
      setMessage?.({ text: err.message, isError: true });
      window.__notify('Update failed', { body: err.message });
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

    setIsUploading(true); setError(null);
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
      if (!response.ok) throw new Error('Upload failed');

      await fetchDriverInfo();
      window.__notify('Profile updated', { body: 'Your profile image was saved.' });
    } catch (err) {
      trackApiCall(`${API_BASE_URL}/api/upload/profile-image`, 'POST', 'error', err.message);
      setError(err.message);
      window.__notify('Upload failed', { body: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSettlePayment = async (settlementId, amount, direction) => {
    try {
      const token = await user.getIdToken();
      trackApiCall(`${API_BASE_URL}/api/settlement/complete/${user.uid}`, 'POST', 'started');
      await axios.post(`${API_BASE_URL}/api/settlement/complete/${user.uid}`, { settlementId, amount, direction }, {
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
      setMessage?.({ text: 'Payment settled successfully', isError: false });
      window.__notify('Settlement updated', { body: 'Settlement recorded successfully.' });
    } catch (err) {
      trackApiCall(`${API_BASE_URL}/api/settlement/complete/${user.uid}`, 'POST', 'error', err.message);
      setMessage?.({ text: err.message, isError: true });
      window.__notify('Settlement failed', { body: err.message });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage?.({ text: 'Logged out', isError: false });
      navigate('/');
    } catch (error) {
      setMessage?.({ text: error.message, isError: true });
    }
  };

  const handleYoutubeClick = () => {
    window.open('https://youtube.com/@ambaninewstv?si=PBGWaPOKXdjV-Oa4', '_blank');
  };

  /* ----------------------------- UI STATES ----------------------------- */

  if (fatal) {
    return (
      <>
        <Header />
        <DebugDock
          show={showDebug} setShow={setShowDebug}
          expanded={debugExpanded} setExpanded={setDebugExpanded}
          isWebView={isWebView} debugInfo={debugInfo}
        />
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
        <DebugDock show={showDebug} setShow={setShowDebug} expanded={debugExpanded} setExpanded={setDebugExpanded}
          isWebView={isWebView} debugInfo={{ ...debugInfo, stage: 'no_user' }} />
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
        <DebugDock show={showDebug} setShow={setShowDebug} expanded={debugExpanded} setExpanded={setDebugExpanded}
          isWebView={isWebView} debugInfo={debugInfo} />
        <div className="dd-spinner-container">
          <div className="dd-beautiful-spinner"></div>
          <p className="dd-loading-text">Loading Dashboard...</p>
          {debugInfo.stage === 'error' && (
            <p style={{ color: '#ff6b6b', marginTop: 10 }}>
              Having issues? Check the debug panel for details.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <>
        <Header />
        <DebugDock show={showDebug} setShow={setShowDebug} expanded={debugExpanded} setExpanded={setDebugExpanded}
          isWebView={isWebView} debugInfo={{ ...debugInfo, stage: 'not_registered' }} />
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

  if (error) {
    return (
      <>
        <Header />
        <DebugDock show={showDebug} setShow={setShowDebug} expanded={debugExpanded} setExpanded={setDebugExpanded}
          isWebView={isWebView} debugInfo={{ ...debugInfo, stage: 'error' }} />
        <div className="dd-error">
          <h3>Error Loading Dashboard</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="dd-retry-btn">Retry</button>
          <button onClick={handleLogout} className="dd-logout-btn">Logout</button>
        </div>
        <Footer />
      </>
    );
  }

  if (!allDocumentsVerified) {
    return (
      <>
        <Header />
        <DebugDock show={showDebug} setShow={setShowDebug} expanded={debugExpanded} setExpanded={setDebugExpanded}
          isWebView={isWebView} debugInfo={{ ...debugInfo, stage: 'documents_pending' }} />
        <div className="verify-container">
          <div className="verify-card">
            <h2 className="verify-title">Documents Verification Required</h2>
            <p className="verify-message">
              Your documents are under review. You'll get full access once all documents are verified by our team.
            </p>
            {renderDocumentStatus(driverInfo)}
            <button className="verify-logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <DriverErrorBoundary onError={(e) => setDebugInfo(prev => ({ ...prev, error: e }))}>
      <>
        <Header />
        <DebugDock show={showDebug} setShow={setShowDebug} expanded={debugExpanded} setExpanded={setDebugExpanded}
          isWebView={isWebView} debugInfo={debugInfo} />
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
                {renderRatingStars(driverInfo)}
              </div>

              <div className="dd-profile-details">
                <div><FaPhone /> {driverInfo?.phone || 'N/A'}</div>
                <div>{getVehicleIcon(driverInfo)} {driverInfo?.vehicleType || 'N/A'} - {driverInfo?.vehicleNumber || 'N/A'}</div>
                <div className='buttons'>
                  <button className="dd-logout-btn" onClick={handleLogout}>Logout</button>
                </div>
              </div>
            </div>

            <div className="dd-stats">
              <div className="dd-stat-card"><h3>Completed Deliveries</h3><p>{completedDeliveries}</p></div>
              <div className="dd-stat-card"><h3>Earnings</h3><p>₹{(driverInfo?.earnings || 0).toFixed(2)}</p></div>
              <div className="dd-stat-card"><h3>Rating</h3><p>{(driverInfo?.ratings?.average || 0).toFixed(1)}</p></div>
            </div>
          </div>

          <div className="settlement-card">
            <h3>Today's Earnings</h3>
            {!settlement?.today ? (
              <p>No rides today</p>
            ) : (
              <>
                <div className="settlement-row"><span>Cash Collected:</span><span>₹{(settlement.today.cashCollected || 0).toFixed(2)}</span></div>
                <div className="settlement-row"><span>Online Payments:</span><span>₹{(settlement.today.onlineCollected || 0).toFixed(2)}</span></div>
                <div className="settlement-row highlight"><span>You owe Owner (20%):</span><span className="negative">₹{((settlement.today.cashCollected || 0) * 0.2).toFixed(2)}</span></div>
                <div className="settlement-row highlight"><span>Owner owes You (80%):</span><span className="positive">₹{((settlement.today.onlineCollected || 0) * 0.8).toFixed(2)}</span></div>
              </>
            )}

            {settlement?.pending?.length > 0 && (
              <div className="pending-settlements">
                <h4>Pending Settlements</h4>
                {settlement.pending.map(item => (
                  <div key={item._id} className="pending-item">
                    <span>{moment(item.date).format('MMM D')}: </span>
                    {item.driverToOwner > 0 && (
                      <button className="settle-btn" onClick={() => handleSettlePayment(item._id, item.driverToOwner, 'driverToOwner')}>
                        Pay Owner: ₹{(item.driverToOwner || 0).toFixed(2)}
                      </button>
                    )}
                    {item.ownerToDriver > 0 && (<span className="positive">Receive: ₹{(item.ownerToDriver || 0).toFixed(2)}</span>)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {driverInfo && (
            <DailyEarningsFilter
              paymentSettlements={driverInfo.paymentSettlements || []}
              registrationDate={driverInfo.createdAt}
              onFilter={(filtered) => console.log('[DailyEarningsFilter] rows:', filtered?.length)}
            />
          )}

          <div className="dd-actions">
            <button className="dd-history-btn" onClick={() => navigate('/delivery-history')}>
              Delivery History
            </button>
          </div>
        </div>

        {/* Keep existing children */}
        <LocationTracker />
        <AvailableShipments />
        <Footer />

        {/* In-app Toasts (from __notify) */}
        <ToastStack />
      </>
    </DriverErrorBoundary>
  );
};

/* ---------------------------- SMALL HELPERS --------------------------- */

const getVehicleIcon = (driverInfo) => {
  const t = (driverInfo?.vehicleType || '').toLowerCase();
  switch (t) {
    case 'twowheeler': return <MdDirectionsBike />;
    case 'threewheeler': return <span role="img" aria-label="Three Wheeler">🛺</span>;
    case 'truck': return <MdLocalShipping />;
    case 'pickup9ft': return <span role="img" aria-label="Pickup">🛻</span>;
    case 'tata407': return <span role="img" aria-label="Truck">🚛</span>;
    default: return <MdDirectionsCar />;
  }
};

const renderRatingStars = (driverInfo) => {
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

const renderDocumentStatus = (driverInfo) => {
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

/* ---------------------------- TOASTS WIDGET --------------------------- */

const ToastStack = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 400);
    return () => clearInterval(t);
  }, []);
  const toasts = (window.__debug?.toasts || []).slice(-4);
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column',
      gap: 8, zIndex: 99999
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 12px',
          borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', minWidth: 240
        }}>
          <div style={{ fontWeight: 600 }}>{t.title}</div>
          {t.body ? <div style={{ fontSize: 12, opacity: 0.9 }}>{t.body}</div> : null}
        </div>
      ))}
    </div>
  );
};

/* ---------------------------- DEBUG OVERLAY --------------------------- */

const DebugDock = ({ show, setShow, expanded, setExpanded, isWebView, debugInfo }) => {
  const [tab, setTab] = useState('overview');
  const [_, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  const api = (window.__debug?.apiCalls || []).slice().reverse().slice(0, 60);
  const logs = (window.__debug?.console || []).slice().reverse().slice(0, 120);
  const errs = (window.__debug?.errors || []).slice().reverse().slice(0, 40);
  const feats = window.__debug?.features || {};

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 10, right: 10,
      background: 'rgba(0,0,0,0.92)',
      color: '#fff', padding: 10,
      zIndex: 99999, fontSize: 12, borderRadius: 8,
      width: expanded ? 520 : 320, maxHeight: expanded ? '80vh' : 'auto', overflowY: expanded ? 'auto' : 'visible',
      border: '2px solid #ff5252'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>DEBUG {isWebView ? '(WEBVIEW)' : '(BROWSER)'} • {debugInfo.stage}</strong>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setExpanded(!expanded)} style={chip(expanded ? '#4CAF50' : '#2196F3')}>
            {expanded ? 'Collapse ▲' : 'Expand ▼'}
          </button>
          <button onClick={() => setShow(false)} style={chip('#ff6b6b')}>Close ×</button>
        </div>
      </div>

      {/* tabs */}
      {expanded && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {['overview','api','console','errors','env'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={chip(tab === t ? '#ffa000' : '#555')}>{t}</button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => { window.__debug.apiCalls = []; window.__debug.console = []; window.__debug.errors = []; }}
              style={chip('#9c27b0')} title="Clear all"><FaTrashAlt /> Clear</button>
            <button onClick={() => {
              const dump = JSON.stringify({
                apiCalls: window.__debug.apiCalls,
                console: window.__debug.console,
                errors: window.__debug.errors,
                features: window.__debug.features
              }, null, 2);
              if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(dump);
            }} style={chip('#00bcd4')} title="Copy JSON"><FaCopy /> Copy</button>
          </div>
        </div>
      )}

      {/* compact summary */}
      {!expanded && (
        <>
          <div><span style={{ color: '#FFD700' }}>Network:</span> <span style={{ color: debugInfo.networkStatus === 'online' ? '#4CAF50' : '#ff6b6b' }}>{debugInfo.networkStatus.toUpperCase()}</span></div>
          <div><span style={{ color: '#FFD700' }}>Has User:</span> {debugInfo.hasUser ? '✅' : '❌'}</div>
          <div><span style={{ color: '#FFD700' }}>Driver Info:</span> {debugInfo.driverInfo ? '✅' : '❌'}</div>
          <div><span style={{ color: '#FFD700' }}>Docs Verified:</span> {debugInfo.documentsVerified ? '✅' : '❌'}</div>
          <div><span style={{ color: '#FFD700' }}>Registered:</span> {debugInfo.isRegistered ? '✅' : '❌'}</div>
          <div><span style={{ color: '#FFD700' }}>Loading:</span> {debugInfo.stage === 'bootstrapped' || debugInfo.stage === 'fetching_driver_info' ? '⏳' : '✅'}</div>
          {debugInfo.error && <div style={{ color: '#ff6b6b', marginTop: 6 }}>Error: {String(debugInfo.error).slice(0, 80)}…</div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <button onClick={() => window.location.reload()} style={chip('white', '#ff6b6b', '#ff6b6b')}><FaSync /> Reload</button>
            <button onClick={() => { window.__debug.apiCalls = []; window.__debug.errors = []; window.__debug.console = []; }}
              style={chip('white', '#ff6b6b', '#ff6b6b')}><FaNetworkWired /> Clear Logs</button>
          </div>
        </>
      )}

      {/* expanded panes */}
      {expanded && tab === 'overview' && (
        <div>
          <div><span style={{ color: '#FFD700' }}>WebView Type:</span> {debugInfo.webviewType}</div>
          <div><span style={{ color: '#FFD700' }}>User Agent:</span> {navigator.userAgent}</div>
          <div style={{ marginTop: 6, color: '#ff6b6b' }}>
            {debugInfo.jsCompatIssues.length ? `JS Issues: ${debugInfo.jsCompatIssues.join(', ')}` : 'JS Issues: none'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <span><FaInfoCircle /> Logs kept: {window.__debug.maxKeep}</span>
          </div>
        </div>
      )}

      {expanded && tab === 'api' && (
        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {api.length === 0 ? 'No API logs yet.' : api.map((c, i) =>
            <div key={i} style={{ color: c.status === 'error' ? '#ff6b6b' : (String(c.status).startsWith('2') ? '#4caf50' : '#fff') }}>
              [{new Date(c.ts).toLocaleTimeString()}] {c.method} {trimUrl(c.url)} • {c.phase} • {c.status}{c.error ? ` • ${c.error}` : ''}
            </div>
          )}
        </div>
      )}

      {expanded && tab === 'console' && (
        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {logs.length === 0 ? 'No console logs.' : logs.map((l, i) =>
            <div key={i} style={{ color: l.level === 'error' ? '#ff6b6b' : (l.level === 'warn' ? '#ff9800' : '#ddd') }}>
              [{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()}: {l.args.map(a => safeString(a)).join(' ')}
            </div>
          )}
        </div>
      )}

      {expanded && tab === 'errors' && (
        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {errs.length === 0 ? 'No errors.' : errs.map((e, i) =>
            <div key={i} style={{ marginBottom: 8 }}>
              [{new Date(e.ts).toLocaleTimeString()}] {e.type}: {e.message}
              {e.stack ? `\n${e.stack}` : ''}
              {e.filename ? `\n@ ${e.filename}:${e.lineno || ''}:${e.colno || ''}` : ''}
            </div>
          )}
        </div>
      )}

      {expanded && tab === 'env' && (
        <div>
          {Object.entries(feats).map(([k, v]) => (
            <div key={k}>{k}: {v ? '✅' : '❌'}</div>
          ))}
        </div>
      )}
    </div>
  );
};

function trimUrl(u = '') {
  try {
    const s = u.toString();
    const parts = s.split('/');
    return parts.slice(0, 3).join('/') + '/…/' + parts.slice(-2).join('/');
  } catch {
    return u;
  }
}
function chip(bg, color = '#fff', borderColor) {
  return {
    padding: '2px 6px', fontSize: 11, background: bg, color,
    border: `1px solid ${borderColor || 'transparent'}`, borderRadius: 4, cursor: 'pointer'
  };
}
function safeString(v) {
  try {
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  } catch { return String(v); }
}

export default DriverDashboard;
