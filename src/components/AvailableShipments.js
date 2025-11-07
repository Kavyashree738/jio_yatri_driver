import React, { useEffect, useState, useCallback, useRef, forwardRef } from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/AvailableShipments.css';
import LocationTracker from './LocationTracker';

const AvailableShipments = forwardRef((props, ref) => {
  const [shipments, setShipments] = useState([]);
  const [driverStatus, setDriverStatus] = useState('inactive');
  const [loading, setLoading] = useState(true);
  const [activeShipment, setActiveShipment] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [debugPush, setDebugPush] = useState(null);
  const [showFullPush, setShowFullPush] = useState(false);

  const [debugInfo, setDebugInfo] = useState({
    step: 'initializing',
    driverStatus: 'unknown',
    activeShipmentId: null,
    activeShipmentStatus: null,
    shipmentCount: 0,
    loading: true,
    currentView: 'initial',
    lastPushType: null,
  });

  const sectionRef = useRef(null);
  const notifiedShipmentIdsRef = useRef(new Set());

  // 🧩 Load last shipment
  useEffect(() => {
    const savedShipment = localStorage.getItem('lastShipment');
    if (savedShipment) {
      const parsed = JSON.parse(savedShipment);
      setActiveShipment(parsed);
      setDebugInfo(prev => ({
        ...prev,
        step: 'loadCachedShipment',
        activeShipmentId: parsed._id,
        activeShipmentStatus: parsed.status,
      }));
    }
  }, []);

  // 🧩 Fetch data
  const fetchData = async (from = 'auto') => {
    try {
      setDebugInfo(prev => ({ ...prev, step: `fetchData_${from}` }));
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();

      const statusResponse = await axios.get(
        `https://jio-yatri-driver.onrender.com/api/driver/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newStatus = statusResponse.data.data.status;
      setDriverStatus(newStatus);

      // validate active shipment
      if (activeShipment?._id) {
        const res = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/shipments/${activeShipment._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const shipmentData = res.data.shipment || res.data.data || res.data;
        if (shipmentData && ['cancelled', 'delivered'].includes(shipmentData.status)) {
          setActiveShipment(null);
          localStorage.removeItem('lastShipment');
        } else if (shipmentData) {
          setActiveShipment(shipmentData);
          localStorage.setItem('lastShipment', JSON.stringify(shipmentData));
        }
      }

      // fetch available shipments
      if (newStatus === 'active') {
        await fetchAvailableShipments(token);
      } else {
        setShipments([]);
      }

      setDebugInfo(prev => ({
        ...prev,
        step: `fetchData_done_${from}`,
        driverStatus: newStatus,
        activeShipmentId: activeShipment?._id || null,
        activeShipmentStatus: activeShipment?.status || null,
        shipmentCount: shipments.length,
        loading: false,
        currentView: activeShipment ? 'LocationTracker' : 'AvailableShipments',
      }));
    } catch (error) {
      toast.error('Failed to load data');
      setDebugInfo(prev => ({ ...prev, step: `fetchData_error_${from}`, error: error.message }));
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  const handlePush = async (e) => {
    const data = e.detail?.data || {};
    setDebugPush(data);
    setDebugInfo(prev => ({
      ...prev,
      lastPushType: data.type || 'unknown',
      currentView: 'pushReceived'
    }));

    if (data?.type === 'SHIPMENT_ACCEPTED') {
      const auth = getAuth();
      const user = auth.currentUser;

      try {
        if (user && data.shipmentId) {
          const token = await user.getIdToken();
          const res = await axios.get(
            `https://jio-yatri-driver.onrender.com/api/shipments/${data.shipmentId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const shipmentData = res.data.shipment || res.data.data || res.data;
          if (shipmentData) {
            setActiveShipment(shipmentData);
            localStorage.setItem('lastShipment', JSON.stringify(shipmentData));
            setDebugInfo(prev => ({
              ...prev,
              activeShipmentId: shipmentData._id,
              activeShipmentStatus: shipmentData.status,
              currentView: 'LocationTracker'
            }));
            return;
          }
        }

        // 🧩 If fetch fails, fallback
        throw new Error("Shipment fetch failed");
      } catch (err) {
        console.warn("⚠️ Push fetch failed — using fallback cache", err);

        // ✅ fallback: open last shipment from cache
        const saved = localStorage.getItem("lastShipment");
        if (saved) {
          const cached = JSON.parse(saved);
          cached.status = "assigned"; // force active
          setActiveShipment(cached);
          setDebugInfo(prev => ({
            ...prev,
            activeShipmentId: cached._id,
            activeShipmentStatus: cached.status,
            currentView: 'LocationTracker (fallback)',
          }));
        } else {
          // if no cache, create a temporary minimal object
          setActiveShipment({
            _id: data.shipmentId,
            status: "assigned",
            sender: { address: { addressLine1: "From (unknown)" } },
            receiver: { address: { addressLine1: "To (unknown)" } },
            cost: 0,
            distance: 0,
            vehicleType: "TwoWheeler"
          });
          setDebugInfo(prev => ({
            ...prev,
            activeShipmentId: data.shipmentId,
            activeShipmentStatus: 'assigned',
            currentView: 'LocationTracker (temp)',
          }));
        }
      }
    }

    else if (data?.type === 'NEW_SHIPMENT') {
      fetchData();
    }
  };

  window.addEventListener('push', handlePush);
  return () => window.removeEventListener('push', handlePush);
}, []);


  // 🧩 Fetch available shipments
  const fetchAvailableShipments = async (token) => {
    try {
      const response = await axios.get(
        `https://jio-yatri-driver.onrender.com/api/shipments/matching`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newShipments = response.data.shipments || [];
      const notifiedSet = notifiedShipmentIdsRef.current;
      newShipments.forEach(shipment => {
        if (!notifiedSet.has(shipment._id)) {
          try {
            const audio = new Audio('/notification.wav');
            audio.play().catch(() => {});
          } catch {}
          notifiedSet.add(shipment._id);
        }
      });
      setShipments(newShipments);
      setDebugInfo(prev => ({
        ...prev,
        step: 'fetchAvailable_done',
        shipmentCount: newShipments.length,
      }));
    } catch (error) {
      toast.error('Failed to load shipments');
      setDebugInfo(prev => ({ ...prev, step: 'fetchAvailable_error', error: error.message }));
    }
  };

  // 🧩 Handle accept
  const handleAccept = async (shipmentId) => {
    try {
      setDebugInfo(prev => ({ ...prev, step: `accepting_${shipmentId}` }));
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please log in to accept shipments');
        return;
      }

      const position = await new Promise((resolve, reject) => {
        const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

      const location = [position.coords.longitude, position.coords.latitude];
      const token = await user.getIdToken();
      const toastId = toast.loading('Accepting shipment...');
      const response = await axios.put(
        `https://jio-yatri-driver.onrender.com/api/shipments/${shipmentId}/accept`,
        { location },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.update(toastId, {
        render: 'Order accepted successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 3000,
      });

      setActiveShipment(response.data.shipment);
      fetchData('manualAccept');

      window.dispatchEvent(new CustomEvent('push', {
        detail: { data: { type: 'SHIPMENT_ACCEPTED', shipmentId } },
      }));

      setDebugInfo(prev => ({
        ...prev,
        step: 'accept_done',
        currentView: 'LocationTracker',
        activeShipmentId: response?.data?.shipment?._id,
        activeShipmentStatus: response?.data?.shipment?.status,
        lastPushType: 'MANUAL_ACCEPT',
      }));
    } catch (error) {
      toast.error('Error accepting shipment');
      setDebugInfo(prev => ({ ...prev, step: 'accept_error', error: error.message }));
    }
  };

  const handleStatusUpdate = useCallback((newStatus) => {
    setActiveShipment(prev => {
      if (!prev) return null;
      if (['cancelled', 'delivered'].includes(newStatus)) return null;
      return { ...prev, status: newStatus };
    });
    if (['cancelled', 'delivered'].includes(newStatus)) fetchData('statusUpdate');
  }, []);

  // 🧩 Detect mobile
  useEffect(() => {
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    };
    setIsMobile(checkIfMobile());
  }, []);

  // 🧩 Polling
  useEffect(() => {
    fetchData('initial');
    const intervalId = setInterval(() => fetchData('polling'), 10000);
    return () => clearInterval(intervalId);
  }, []);

  // 🧠 Render
  return (
    <div ref={ref} className="available-shipments">
      {/* 🧭 DEBUG PANEL */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          background: 'rgba(0,0,0,0.9)',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '6px',
          zIndex: 9999,
          lineHeight: '1.4',
          maxHeight: showFullPush ? '80vh' : '180px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        <b>🧭 DEBUG PANEL</b>
        <button
          onClick={() => {
            localStorage.removeItem('lastShipment');
            setActiveShipment(null);
            toast.info('🧹 Cleared lastShipment cache');
          }}
          style={{
            marginLeft: 10,
            padding: '2px 6px',
            fontSize: '11px',
            color: '#fff',
            background: 'red',
            border: 'none',
            borderRadius: 3,
          }}
        >
          Clear Cache
        </button>
        <button
          onClick={() => setShowFullPush(!showFullPush)}
          style={{
            marginLeft: 6,
            padding: '2px 6px',
            fontSize: '11px',
            color: '#fff',
            background: 'blue',
            border: 'none',
            borderRadius: 3,
          }}
        >
          {showFullPush ? 'Hide Full Push' : 'Show Full Push'}
        </button>
        <br />Step: {debugInfo.step}
        <br />Driver Status: {debugInfo.driverStatus}
        <br />Loading: {debugInfo.loading ? 'true' : 'false'}
        <br />Active Shipment ID: {debugInfo.activeShipmentId || 'none'}
        <br />Shipment Status: {debugInfo.activeShipmentStatus || '-'}
        <br />Shipments Count: {debugInfo.shipmentCount}
        <br />Last Push: {debugInfo.lastPushType || 'none'}
        <br />Current View: {debugInfo.currentView}
        <br />Push Data:
        {debugPush ? (
          <div style={{ marginTop: 4, color: '#0f0' }}>
            {showFullPush
              ? JSON.stringify(debugPush, null, 2)
              : JSON.stringify(debugPush).slice(0, 120) + '...'}
          </div>
        ) : (
          'no push event'
        )}
      </div>

      <ToastContainer
        position={isMobile ? 'top-center' : 'top-right'}
        autoClose={5000}
        theme="colored"
        pauseOnFocusLoss={false}
      />

      {!activeShipment && <h2>Available Shipments</h2>}

      {loading ? (
        <div className="loading-message">Loading data...</div>
      ) : activeShipment ? (
        <div className="active-shipment-container">
          <LocationTracker
            key={activeShipment._id}
            shipment={activeShipment}
            onStatusUpdate={handleStatusUpdate}
            isMobile={isMobile}
          />
        </div>
      ) : driverStatus !== 'active' ? (
        <div className="inactive-message">You must be active to view available shipments.</div>
      ) : shipments.length === 0 ? (
        !activeShipment && <div className="no-shipments">No matching shipments available at this time.</div>
      ) : (
        <ul className={`shipment-list ${isMobile ? 'mobile-view' : ''}`}>
          {shipments.map((shipment) => (
            <li key={shipment._id} className="shipment-card">
              <div className="shipment-details">
                <p><strong>Tracking No:</strong> {shipment.trackingNumber}</p>
                <p><strong>From:</strong> {shipment.sender.address.addressLine1}</p>
                <p><strong>To:</strong> {shipment.receiver.address.addressLine1}</p>
                <p><strong>Vehicle Type:</strong> {shipment.vehicleType}</p>
                <p><strong>Distance:</strong> {shipment.distance.toFixed(2)} km</p>
                <p><strong>Cost:</strong> ₹{shipment.cost.toFixed(2)}</p>
                <p>
                  <strong>Payment Type:</strong>{' '}
                  {shipment.payment?.method === 'razorpay'
                    ? <span className="prepaid-label">Prepaid</span>
                    : <span className="cod-label">Cash on Delivery</span>}
                </p>
              </div>
              <button onClick={() => handleAccept(shipment._id)} className="accept-button">
                Accept Order
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default AvailableShipments;

