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
  const [debugLogs, setDebugLogs] = useState([]); // 🧠 UI console logs

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

  // 📜 Helper: Add new line in UI console
  const uiLog = (msg) => {
    setDebugLogs((prev) => [`${new Date().toLocaleTimeString()} ➤ ${msg}`, ...prev].slice(0, 50));
  };

  // 🧩 Load last shipment
  useEffect(() => {
    const savedShipment = localStorage.getItem('lastShipment');
    if (savedShipment) {
      const parsed = JSON.parse(savedShipment);
      setActiveShipment(parsed);
      uiLog(`🧩 Loaded cached shipment: ${parsed._id}`);
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
      uiLog(`🌐 FetchData triggered (${from})`);

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        uiLog(`⚠️ No Firebase user found`);
        return;
      }

      const token = await user.getIdToken();
      const statusUrl = `https://jio-yatri-driver.onrender.com/api/driver/status`;
      uiLog(`🔗 GET ${statusUrl}`);

      const statusResponse = await axios.get(statusUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newStatus = statusResponse.data.data.status;
      uiLog(`✅ Driver status: ${newStatus}`);
      setDriverStatus(newStatus);

      if (activeShipment?._id) {
        const shipmentUrl = `https://jio-yatri-driver.onrender.com/api/shipments/${activeShipment._id}`;
        uiLog(`🔗 GET ${shipmentUrl}`);

        const res = await axios.get(shipmentUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        uiLog(`✅ Shipment fetched: ${res.status} ${res.statusText}`);

        const shipmentData = res.data.shipment || res.data.data || res.data;
        if (shipmentData && ['cancelled', 'delivered'].includes(shipmentData.status)) {
          setActiveShipment(null);
          localStorage.removeItem('lastShipment');
          uiLog(`🗑 Cleared cancelled/delivered shipment`);
        } else if (shipmentData) {
          setActiveShipment(shipmentData);
          localStorage.setItem('lastShipment', JSON.stringify(shipmentData));
          uiLog(`📦 Active shipment updated: ${shipmentData._id}`);
        }
      }

      if (newStatus === 'active') {
        await fetchAvailableShipments(token);
      } else {
        setShipments([]);
        uiLog(`🚫 Driver inactive, skipping shipment fetch`);
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
      uiLog(`❌ fetchData error: ${error.message}`);
      setDebugInfo(prev => ({ ...prev, step: `fetchData_error_${from}`, error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handlePush = async (e) => {
      const data = e.detail?.data || {};
      setDebugPush(data);
      uiLog(`🔔 Push received: ${data.type || 'unknown'}`);
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
            const url = `https://jio-yatri-driver.onrender.com/api/shipments/${data.shipmentId}`;
            uiLog(`🔗 GET ${url}`);

            const res = await axios.get(url, {
              headers: { Authorization: `Bearer ${token}` },
            });
            uiLog(`✅ Push shipment fetched: ${res.status} ${res.statusText}`);

            const shipmentData = res.data.shipment || res.data.data || res.data;
            if (shipmentData) {
              setActiveShipment(shipmentData);
              localStorage.setItem('lastShipment', JSON.stringify(shipmentData));
              uiLog(`📦 Shipment accepted → ${shipmentData._id}`);
              setDebugInfo(prev => ({
                ...prev,
                activeShipmentId: shipmentData._id,
                activeShipmentStatus: shipmentData.status,
                currentView: 'LocationTracker'
              }));
              return;
            }
          }
          throw new Error("Shipment fetch failed");
        } catch (err) {
          uiLog(`⚠️ Push fetch failed — fallback used`);
          const saved = localStorage.getItem("lastShipment");
          if (saved) {
            const cached = JSON.parse(saved);
            cached.status = "assigned";
            setActiveShipment(cached);
            uiLog(`♻️ Loaded cached shipment fallback`);
          } else {
            uiLog(`❗ No cached shipment found, temp object used`);
            setActiveShipment({
              _id: data.shipmentId,
              status: "assigned",
              sender: { address: { addressLine1: "From (unknown)" } },
              receiver: { address: { addressLine1: "To (unknown)" } },
              cost: 0,
              distance: 0,
              vehicleType: "TwoWheeler"
            });
          }
        }
      } else if (data?.type === 'NEW_SHIPMENT') {
        fetchData();
      }
    };

    window.addEventListener('push', handlePush);
    return () => window.removeEventListener('push', handlePush);
  }, []);

  const fetchAvailableShipments = async (token) => {
    try {
      const url = `https://jio-yatri-driver.onrender.com/api/shipments/matching`;
      uiLog(`🔗 GET ${url}`);

      const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      uiLog(`✅ Shipments list fetched: ${response.data.shipments?.length || 0} items`);

      setShipments(response.data.shipments || []);
    } catch (error) {
      uiLog(`❌ fetchAvailableShipments error: ${error.message}`);
      toast.error('Failed to load shipments');
    }
  };

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
          maxHeight: '80vh',
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
            uiLog('🧹 Cleared localStorage manually');
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

        <div style={{ marginTop: 6 }}>
          <b>Step:</b> {debugInfo.step} | <b>View:</b> {debugInfo.currentView}
          <br />
          <b>Driver:</b> {debugInfo.driverStatus} | <b>Shipment:</b>{' '}
          {debugInfo.activeShipmentId || 'none'}
          <br />
          <b>Status:</b> {debugInfo.activeShipmentStatus || '-'} |{' '}
          <b>Shipments:</b> {debugInfo.shipmentCount}
        </div>

        {/* 🧠 UI Console */}
        <div
          style={{
            marginTop: 8,
            background: 'rgba(255,255,255,0.05)',
            color: '#0ff',
            fontSize: '11px',
            padding: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            borderTop: '1px solid #0f0',
          }}
        >
          <b>🧠 UI Console Log</b>
          <hr style={{ border: '0.5px solid #0f0' }} />
          {debugLogs.length === 0
            ? 'No logs yet...'
            : debugLogs.map((line, i) => (
                <div key={i} style={{ marginBottom: '2px' }}>
                  {line}
                </div>
              ))}
        </div>
      </div>

      <ToastContainer position={isMobile ? 'top-center' : 'top-right'} autoClose={5000} theme="colored" />

      {loading ? (
        <div className="loading-message">Loading data...</div>
      ) : activeShipment ? (
        <LocationTracker
          key={activeShipment._id}
          shipment={activeShipment}
          isMobile={isMobile}
        />
      ) : (
        <h2 style={{ marginTop: '300px' }}>Available Shipments</h2>
      )}
    </div>
  );
});

export default AvailableShipments;
