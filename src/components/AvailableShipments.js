import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/AvailableShipments.css';
import LocationTracker from './LocationTracker';

function AvailableShipments() {
  const [shipments, setShipments] = useState([]);
  const [driverStatus, setDriverStatus] = useState('inactive');
  const [loading, setLoading] = useState(true);
  const [activeShipment, setActiveShipment] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const notifiedShipmentIdsRef = useRef(new Set());

  useEffect(() => {
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    };
    setIsMobile(checkIfMobile());
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchData = async () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    const token = await user.getIdToken();

    // 1. Get driver status
    const statusResponse = await axios.get(`https://jio-yatri-driver.onrender.com/api/driver/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const newStatus = statusResponse.data.data.status;
    setDriverStatus(newStatus);

    // 2. 🔥 Check if activeShipment still valid
    if (activeShipment?._id) {
      const res = await axios.get(
        `https://jio-yatri-driver.onrender.com/api/shipments/${activeShipment._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // If cancelled/delivered -> remove from dashboard
// unwrap shipment correctly (backend may wrap it in data or shipment)
const shipmentData = res.data.shipment || res.data.data || res.data;

if (shipmentData && ['cancelled', 'delivered'].includes(shipmentData.status)) {
  console.log("Clearing shipment, status:", shipmentData.status);
  setActiveShipment(null);
  localStorage.removeItem("lastShipment");  // 🔥 clear storage
} else if (shipmentData) {
  setActiveShipment(shipmentData);
  localStorage.setItem("lastShipment", JSON.stringify(shipmentData));
}


    }

    // 3. Fetch available shipments if driver is active
    if (newStatus === 'active') {
      await fetchAvailableShipments(token);
    } else {
      setShipments([]);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    setLoading(false);
  }
};


  const fetchAvailableShipments = async (token) => {
    try {
      const response = await axios.get(`https://jio-yatri-driver.onrender.com/api/shipments/matching`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newShipments = response.data.shipments || [];
      const notifiedSet = notifiedShipmentIdsRef.current;

      newShipments.forEach(shipment => {
        if (!notifiedSet.has(shipment._id)) {
          // Browser notifications will still work if permission is granted
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('🚚 New Shipment Available!', {
                body: `From: ${shipment.sender.address.addressLine1} ➡ To: ${shipment.receiver.address.addressLine1}`,
                icon: '/logo.jpg'
              });
            } catch (e) {
              console.warn("Notification error:", e);
            }
          }

          try {
            const audio = new Audio('/notification.wav');
            audio.play().catch(err => {
              console.warn("Audio playback prevented:", err);
            });
          } catch (err) {
            console.warn("Audio error:", err);
          }

          notifiedSet.add(shipment._id);
        }
      });

      setShipments(newShipments);
    } catch (error) {
      console.error('Error fetching shipments:', error);
      toast.error('Failed to load shipment');
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
        const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      }).catch(error => {
        console.error("Geolocation error:", error);
        throw error;
      });

      const location = [
        position.coords.longitude,
        position.coords.latitude
      ];

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
      fetchData();
    } catch (error) {
      console.error('Error accepting shipment:', error);
    }
  };

const handleStatusUpdate = useCallback((newStatus) => {
  setActiveShipment(prev => {
    if (!prev) return null;

    if (['cancelled', 'delivered'].includes(newStatus)) {
      return null;  // ❌ remove from dashboard
    }
    return { ...prev, status: newStatus };
  });

  if (['cancelled', 'delivered'].includes(newStatus)) {
    fetchData(); // refresh shipments list
  }
}, []);


  return (
    <div className="available-shipments">
      <ToastContainer 
        position={isMobile ? "top-center" : "top-right"}
        autoClose={5000} 
        theme="colored" 
        pauseOnFocusLoss={false} 
      />

      <h2>Available Shipments</h2>

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
        <div className="inactive-message">
          You must be active to view available shipments.
        </div>
      ) : shipments.length === 0 ? (
        <div className="no-shipments">
          No matching shipments available at this time.
        </div>
      ) : (
        <ul className={`shipment-list ${isMobile ? 'mobile-view' : ''}`}>
          {shipments.map(shipment => (
            <li key={shipment._id} className="shipment-card">
              <div className="shipment-details">
                <p><strong>Tracking No:</strong> {shipment.trackingNumber}</p>
                <p><strong>From:</strong> {shipment.sender.address.addressLine1}</p>
                <p><strong>To:</strong> {shipment.receiver.address.addressLine1}</p>
                <p><strong>Vehicle Type:</strong> {shipment.vehicleType}</p>
                <p><strong>Distance:</strong> {shipment.distance.toFixed(2)} km</p>
                <p><strong>Cost:</strong> ₹{shipment.cost.toFixed(2)}</p>
                {shipment?.parcel?.description && (
                  <p><strong>Description:</strong> {shipment.parcel.description}</p>
                )}

                {shipment?.parcel?.images?.length > 0 && (
                  <div className="parcel-images">
                    <strong>Images:</strong>
                    <div className="image-gallery">
                      {shipment.parcel.images.map((id) => {
                        const imgUrl = `https://jio-yatri-driver.onrender.com/api/shipment-images/image/${id}`;
                        return (
                          <img
                            key={id}
                            src={imgUrl}
                            alt="Parcel"
                            style={{
                              width: "100px",
                              height: "100px",
                              objectFit: "cover",
                              margin: "5px",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                
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
}

export default AvailableShipments;




