import React, { useEffect, useState, useCallback, useRef,forwardRef } from 'react';
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
  const sectionRef = useRef(null);

  const notifiedShipmentIdsRef = useRef(new Set());

  // 🧩 Simple visual UI debug function
// const uiDebug = (msg, type = "info") => {
//   const opts = { position: "top-center", autoClose: 4000, theme: "colored" };
//   if (type === "success") toast.success(`✅ ${msg}`, opts);
//   else if (type === "error") toast.error(`❌ ${msg}`, opts);
//   else if (type === "warn") toast.warn(`⚠️ ${msg}`, opts);
//   else toast.info(`💬 ${msg}`, opts);
// };


   useEffect(() => {
    const savedShipment = localStorage.getItem("lastShipment");
    if (savedShipment) {
      setActiveShipment(JSON.parse(savedShipment));
    }
  }, []);

  useEffect(() => {
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    };
    setIsMobile(checkIfMobile());
  }, []);

 useEffect(() => {
  const tryScrollToShipments = () => {
    const params = new URLSearchParams(window.location.search);
    const scrollTo = params.get("scrollTo");

    if (scrollTo === "shipments" && sectionRef.current) {
      // console.log("📦 Scrolling to shipments...");
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  };

  // Retry scroll until content fully loads (up to 5s)
  let attempts = 0;
  const interval = setInterval(() => {
    const done = tryScrollToShipments();
    attempts++;
    if (done || attempts > 10) clearInterval(interval);
  }, 500);

  // Trigger again when returning from background
  window.addEventListener("focus", tryScrollToShipments);

  return () => {
    clearInterval(interval);
    window.removeEventListener("focus", tryScrollToShipments);
  };
}, [loading, shipments.length]);


useEffect(() => {
  const handlePush = (event) => {
    const data = event.detail?.data;
    // uiDebug("📩 PUSH RECEIVED from Flutter WebView!", "success");

    if (!data) {
      // uiDebug("⚠️ No data found in push payload", "warn");
      return;
    }

    // uiDebug(`🧾 Payload: ${JSON.stringify(data)}`);

    // ✅ Handle only shipment accepted push
    if (data?.type === "SHIPMENT_ACCEPTED" && data?.shipmentId) {
      const shipmentId = data.shipmentId;
      // uiDebug(`🚚 Driver accepted shipment (ID: ${shipmentId}) — starting auto load...`, "info");

      // 🔁 Retry until Firebase user is available
      const tryAutoLoad = async (attempt = 1) => {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          // uiDebug(`⏳ Firebase not ready (attempt ${attempt})`, "warn");
          if (attempt < 6) {
            setTimeout(() => tryAutoLoad(attempt + 1), 700);
          } else {
            // uiDebug("❌ Firebase user not ready after 6 attempts", "error");
          }
          return;
        }

        try {
          // uiDebug("🔑 Getting Firebase ID token...");
          const token = await user.getIdToken();
          if (!token) {
            // uiDebug("⚠️ Failed to retrieve token", "error");
            return;
          }

          // uiDebug("🌐 Fetching shipment details from backend...");
          const res = await axios.get(
            `https://jio-yatri-driver.onrender.com/api/shipments/${shipmentId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const shipment = res.data.shipment || res.data.data;
          if (shipment) {
            // uiDebug(`✅ Shipment ${shipmentId} loaded successfully`, "success");
            setActiveShipment(shipment);
            localStorage.setItem("lastShipment", JSON.stringify(shipment));
          } else {
            // uiDebug("❌ Shipment not found in API response", "error");
          }
        } catch (error) {
          // uiDebug(`🔥 Error auto-loading shipment: ${error.message}`, "error");
        }
      };

      tryAutoLoad();
    } else {
      // uiDebug("📦 Push received but not SHIPMENT_ACCEPTED type — ignoring", "warn");
    }
  };

  window.addEventListener("push", handlePush);
  // uiDebug("🟢 React is now listening for PUSH events...");
  return () => window.removeEventListener("push", handlePush);
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
      // toast.warn("⚠️ No Firebase user found — skipping fetch");
      setLoading(false);
      return;
    }

    const token = await user.getIdToken();

    // 1️⃣ Get driver status
    // toast.info("🔍 Checking driver status...");
    const statusResponse = await axios.get(
      `https://jio-yatri-driver.onrender.com/api/driver/status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const newStatus = statusResponse.data.data.status;
    // toast.success(`🟢 Driver status: ${newStatus}`);
    setDriverStatus(newStatus);

    // 2️⃣ If driver inactive → stop early
    if (newStatus !== "active") {
      // toast.warn("⏸️ Driver inactive — skipping shipment fetch");
      setShipments([]);
      setLoading(false);
      return;
    }

    // 3️⃣ Check current activeShipment validity
    if (activeShipment?._id) {
      // toast.info(`📦 Checking active shipment ${activeShipment._id} status...`);
      const res = await axios.get(
        `https://jio-yatri-driver.onrender.com/api/shipments/${activeShipment._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const shipmentData = res.data.shipment || res.data.data || res.data;

      if (shipmentData && ["cancelled", "delivered"].includes(shipmentData.status)) {
        // toast.warn(`🚨 Shipment ${shipmentData._id} ${shipmentData.status} — clearing...`);
        setActiveShipment(null);
        localStorage.removeItem("lastShipment");
        return; // stop further actions
      }

      if (shipmentData) {
        // toast.info(`✅ Keeping active shipment ${shipmentData._id} (${shipmentData.status})`);
        setActiveShipment(shipmentData);
        localStorage.setItem("lastShipment", JSON.stringify(shipmentData));
      }
    }

    // 4️⃣ Fetch available shipments
    // toast.info("📦 Fetching available shipments...");
    const response = await axios.get(
      `https://jio-yatri-driver.onrender.com/api/shipments/matching`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const shipmentsList = response.data.shipments || [];
    setShipments(shipmentsList);
    // toast.info(`🧾 ${shipmentsList.length} shipments found.`);

    // 5️⃣ Check backend for assigned shipment (not in matching list)
    // toast.info("🔎 Checking backend for active/assigned shipment...");
    try {
      const activeRes = await axios.get(
        `https://jio-yatri-driver.onrender.com/api/shipments/active`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const assignedShipment = activeRes.data.shipment || activeRes.data.data;

      if (assignedShipment && assignedShipment.status === "assigned") {
        // Prevent reloading same one repeatedly
        if (!activeShipment || activeShipment._id !== assignedShipment._id) {
          // toast.success(`🚚 Assigned shipment ${assignedShipment._id} found — activating...`);
          setActiveShipment(assignedShipment);
          localStorage.setItem("lastShipment", JSON.stringify(assignedShipment));
        } else {
          // toast.info(`🟢 Shipment ${assignedShipment._id} already active — skipping duplicate`);
        }
      } else {
        // toast.info("📭 No assigned shipment found from backend.");
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // toast.warn("❌ No active shipment endpoint (404) — none assigned currently.");
      } else {
        // toast.error(`🔥 Error checking assigned shipment: ${err.message}`);
      }
    }

    // toast.info("🔄 Poll cycle complete ✅");

  } catch (error) {
    console.error("Error fetching data:", error);

    if (error.response?.status === 404) {
      // toast.warn("❌ No shipments found (404)");
    } else {
      // toast.error(`🔥 Fetch error: ${error.message}`);
    }
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
              // console.warn("Audio playback prevented:", err);
            });
          } catch (err) {
            // console.warn("Audio error:", err);
          }

          notifiedSet.add(shipment._id);
        }
      });

      setShipments(newShipments);
    } catch (error) {
      // console.error('Error fetching shipments:', error);
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
        // console.error("Geolocation error:", error);
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
  <div ref={ref} className="available-shipments">
    <ToastContainer 
      position={isMobile ? "top-center" : "top-right"}
      autoClose={5000} 
      theme="colored" 
      pauseOnFocusLoss={false} 
    />

    {/* ✅ Hide heading when driver has an active shipment */}
    {!activeShipment && <h2>Available Shipments</h2>}

    {loading ? (
      <div className="loading-message">Loading data...</div>
    ) : activeShipment ? (
      // ✅ Show only the active shipment tracker
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
      // ✅ Hide this "No matching..." message if driver has an active shipment
      !activeShipment && (
        <div className="no-shipments">
          No matching shipments available at this time.
        </div>
      )
    ) : (
      // ✅ Show shipments only if available
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

                          <p>
                  <strong>Payment Type:</strong>{" "}
                  {shipment.payment?.method === "razorpay" ? (
                    <span className="prepaid-label">Prepaid</span>
                  ) : (
                    <span className="cod-label">Cash on Delivery</span>
                  )}
                </p>

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

            <button
              onClick={() => handleAccept(shipment._id)}
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
});

export default AvailableShipments;






















