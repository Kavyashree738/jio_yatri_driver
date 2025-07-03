import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/AvailableShipments.css';
import { initializeFCM, setupForegroundNotifications, requestNotificationPermission } from '../services/notificationService';
import LocationTracker from './LocationTracker';

function AvailableShipments() {
  const [shipments, setShipments] = useState([]);
  const [driverStatus, setDriverStatus] = useState('inactive');
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [showInstructions, setShowInstructions] = useState(false);
  const [activeShipment, setActiveShipment] = useState(null);
  const notifiedShipmentIdsRef = useRef(new Set());


  useEffect(() => {
    const setupNotificationsAndData = async () => {
      try {
        await initializeFCM();
        setupForegroundNotifications();
        await fetchData();
        const intervalId = setInterval(fetchData, 10000);
        return () => clearInterval(intervalId);
      } catch (error) {
        console.error('Initialization error:', error);
        setLoading(false);
      }
    };

    setupNotificationsAndData();
  }, []);

  const handleEnableNotifications = async () => {
    const token = await requestNotificationPermission();
    setNotificationPermission(Notification.permission);

    if (token) {
      toast.success("Notifications enabled successfully");
    } else {
      setShowInstructions(true);
    }
  };

  const openBrowserSettings = () => {
    if (navigator.userAgent.includes('Chrome')) {
      window.open('chrome://settings/content/notifications');
    } else if (navigator.userAgent.includes('Firefox')) {
      window.open('about:preferences#privacy');
    } else if (navigator.userAgent.includes('Safari')) {
      window.open('x-apple.systempreferences:com.apple.preference.notifications');
    }
  };

  const fetchData = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        toast.warning("Please log in to view shipments");
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();

      const statusResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/driver/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newStatus = statusResponse.data.data.status;
      setDriverStatus(newStatus);

      if (newStatus === 'active') {
        await fetchAvailableShipments(token);
      } else {
        setShipments([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableShipments = async (token) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/shipments/matching`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newShipments = response.data.shipments || [];
      const notifiedSet = notifiedShipmentIdsRef.current;

      // Notify only for new shipments that haven't been notified yet
      newShipments.forEach(shipment => {
        if (!notifiedSet.has(shipment._id)) {
          // 🔔 Show notification only once
          new Notification('🚚 New Shipment Available!', {
            body: `From: ${shipment.sender.address.addressLine1} ➡ To: ${shipment.receiver.address.addressLine1}`,
            icon: '/logo.jpg'
          });
          const audio = new Audio('/notification.wav');

          audio.play().catch(err => {
            console.warn('Audio playback blocked or failed:', err);
          });
          notifiedSet.add(shipment._id); // ✅ Mark as notified
        }
      });

      // Update state
      setShipments(newShipments);

    } catch (error) {
      console.error('Error fetching shipments:', error);
      toast.error('Failed to load shipments');
    }
  };

  const handleAccept = async (shipmentId) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        toast.error('Please log in to accept shipments');
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
          }
        );
      }).catch(error => {
        console.error('Geolocation error:', error);
        toast.error('Could not get your current location');
        throw error;
      });

      const location = [
        position.coords.longitude,
        position.coords.latitude
      ];

      const token = await user.getIdToken();

      const toastId = toast.loading('Accepting shipment...');

      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/shipments/${shipmentId}/accept`,
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
      await fetchData();
    } catch (error) {
      console.error('Error accepting shipment:', error);
      toast.error(error.response?.data?.message || 'Error accepting shipment');
    }
  };

  const handleStatusUpdate = useCallback((newStatus) => {
    setActiveShipment(prev => {
      if (!prev) return null;
      return { ...prev, status: newStatus };
    });

    if (['cancelled', 'delivered'].includes(newStatus)) {
      fetchData();
    }
  }, []);

  return (
    <div className="available-shipments">
      <ToastContainer position="top-right" autoClose={5000} theme="colored" />

      <h2>Available Shipments</h2>

      {notificationPermission === "default" && (
        <div className="permission-request notification-section">
          <h3>Enable Notifications</h3>
          <p>Get real-time updates about new shipments and deliveries</p>
          <button
            onClick={handleEnableNotifications}
            className="enable-notifications-btn"
          >
            🔔 Enable Notifications
          </button>
        </div>
      )}

      {notificationPermission === "denied" && (
        <div className="permission-denied notification-section">
          <h3>Notifications Blocked</h3>
          <p>You won't receive shipment updates. To enable:</p>

          <button onClick={openBrowserSettings} className="settings-btn">
            Open Browser Settings
          </button>

          {showInstructions && (
            <div className="instructions">
              <ol>
                <li>Find this website in the list</li>
                <li>Change from "Block" to "Allow"</li>
                <li>Refresh this page</li>
              </ol>
              <button
                onClick={() => window.location.reload()}
                className="refresh-btn"
              >
                I've Enabled Notifications - Refresh
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading-message">Loading data...</div>
      ) : activeShipment ? (
        <div className="active-shipment-container">
          <LocationTracker
            key={activeShipment._id}
            shipment={activeShipment}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      ) : driverStatus !== 'active' ? (
        <div className="inactive-message">
          You must be active to view available shipments.
        </div>
      ) : shipments.length === 0 ? (
        <div className="no-shipments">
          No matching shipments available at this time.
        </div>
      ) : (
        <ul className="shipment-list">
          {shipments.map(shipment => (
            <li key={shipment._id} className="shipment-card">
              <div className="shipment-details">
                <p><strong>Tracking No:</strong> {shipment.trackingNumber}</p>
                <p><strong>From:</strong> {shipment.sender.address.addressLine1}</p>
                <p><strong>To:</strong> {shipment.receiver.address.addressLine1}</p>
                <p><strong>Vehicle Type:</strong> {shipment.vehicleType}</p>
                <p><strong>Distance:</strong> {shipment.distance.toFixed(2)} km</p>
                <p><strong>Cost:</strong> ₹{shipment.cost.toFixed(2)}</p>
              </div>
              <button
                onClick={() => {
                  // Scroll to top first (optional: smooth scrolling)
                  window.scrollTo({
                    top: 30,
                    behavior: "smooth", // Optional: Adds smooth scrolling
                  });
                  // Then handle order acceptance
                  handleAccept(shipment._id);
                }}
                className="accept-button"
              >
                Accept Order
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AvailableShipments;
