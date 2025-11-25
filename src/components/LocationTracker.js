import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import debounce from 'lodash/debounce';
import '../styles/LocationTracker.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { ref, set } from "firebase/database";
import { db } from "../firebase";
import { FaPhone } from 'react-icons/fa';
import parcelImg from '../assets/images/parcel.png';
import Header from '../components/Header'
import sandTimer from "../assets/animations/sand-timer.json.json";
import Lottie from "lottie-react";
import { useTranslation } from "react-i18next";


const API_BASE_URL = 'https://jio-yatri-driver.onrender.com';

/* ------------------------------- Helpers ------------------------------- */
// Convert any shape -> {lat, lng} or null
function normalizeToLatLng(input) {
  // console.log('🔧 normalizeToLatLng called with input:', input);
  if (!input) {
    // console.log('❌ normalizeToLatLng: input is null/undefined');
    return null;
  }

  // A) already {lat,lng}
  if (Number.isFinite(input?.lat) && Number.isFinite(input?.lng)) {
    const result = { lat: Number(input.lat), lng: Number(input.lng) };
    // console.log('✅ normalizeToLatLng: case A - direct lat/lng', result);
    return result;
  }

  // B) {latitude, longitude}
  if (Number.isFinite(input?.latitude) && Number.isFinite(input?.longitude)) {
    const result = { lat: Number(input.latitude), lng: Number(input.longitude) };
    // console.log('✅ normalizeToLatLng: case B - latitude/longitude', result);
    return result;
  }

  // C) {coordinates:[lng,lat]} or nested {address:{coordinates:[lng,lat]}}
  const coords =
    (Array.isArray(input?.coordinates) && input.coordinates) ||
    (Array.isArray(input?.address?.coordinates) && input.address.coordinates);

  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const result = { lat, lng };
      // console.log('✅ normalizeToLatLng: case C - coordinates array', result);
      return result;
    }
  }

  // D) raw [lng,lat]
  if (Array.isArray(input) && input.length >= 2) {
    const lng = Number(input[0]);
    const lat = Number(input[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const result = { lat, lng };
      // console.log('✅ normalizeToLatLng: case D - raw array', result);
      return result;
    }
  }

  // E) fallback strings -> numbers
  const latNum = Number(input?.lat ?? input?.latitude);
  const lngNum = Number(input?.lng ?? input?.longitude);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
    const result = { lat: latNum, lng: lngNum };
    // console.log('✅ normalizeToLatLng: case E - fallback strings', result);
    return result;
  }

  // console.log('❌ normalizeToLatLng: no valid format found');
  return null;
}

function isValidLatLng(p) {
  const result = (
    p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
  // console.log('🔧 isValidLatLng check:', p, '->', result);
  return result;
}

const handleCall = (phone) => {
  if (!phone) return alert('Phone number not available');
  const cleaned = phone.replace(/\D/g, '');  // just remove non-digits
  window.open(`tel:${cleaned}`, '_self');
};

/* ---------------------------- Geolocation hook ---------------------------- */
const useGeolocation = (options) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // console.log('📍 useGeolocation: useEffect started');
    if (!navigator.geolocation) {
      // console.log('❌ useGeolocation: Geolocation not supported');
      setError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // console.log('📍 useGeolocation: position update received', pos.coords);
        const newPos = {
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading,
          },
        };
        setPosition(newPos);
        localStorage.setItem(
          'lastKnownLocation',
          JSON.stringify([pos.coords.longitude, pos.coords.latitude]) // [lng,lat]
        );
        // console.log('💾 useGeolocation: saved to localStorage');
      },
      (err) => {
        // console.log('❌ useGeolocation: error', err.message);
        setError(err.message);
      },
      options
    );

    // console.log('📍 useGeolocation: watchPosition started with ID', watchId);

    return () => {
      // console.log('📍 useGeolocation: cleanup - clearing watch', watchId);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [options]);

  return { position, error };
};

/* --------------------------------- UI bits -------------------------------- */
const EtaDisplay = React.memo(
  ({ etaToSender, etaToReceiver, distanceToSender, distanceToReceiver, t }) => {
    // console.log('📱 EtaDisplay rendered with:', { etaToSender, etaToReceiver, distanceToSender, distanceToReceiver });
    return (
      <div className="eta-display">
        {etaToSender && (
          <p>
            <strong>{t("to_sender")}:</strong> {distanceToSender} - {t("eta")}: {etaToSender}
          </p>
        )}
        {etaToReceiver && (
          <p>
            <strong>{t("to_receiver")}:</strong> {distanceToReceiver} - {t("eta")}: {etaToReceiver}
          </p>
        )}
      </div>
    );
  }
);

// const ShipmentDetailsCard = ({ shipment }) => {
//   // console.log('📱 ShipmentDetailsCard rendered with shipment:', shipment);
//   if (!shipment) {
//     // console.log('📱 ShipmentDetailsCard: no shipment');
//     return null;
//   }
//   return (
//     <div className="shipment-details-card">
//       <div className="shipment-header">
//         <h3>Shipment #{shipment.trackingNumber}</h3>
//         <div className="badge-row">
//           <span className={`status-badge ${shipment.status}`}>{shipment.status}</span>

//           {shipment.payment?.method === "razorpay" ? (
//             <span className="payment-badge prepaid">
//               Prepaid ₹{shipment.cost?.toFixed(2)}
//             </span>
//           ) : (
//             <span className="payment-badge cod">
//               Cash ₹{shipment.cost?.toFixed(2)}
//             </span>
//           )}
//         </div>
//         {/* <span className={`status-badge ${shipment.status}`}>{shipment.status}</span> */}
//       </div>
//       <div className="shipment-body">
//         <div className="address-sections">
//           <div className="address-card sender">
//             <h4>Sender</h4>
//             <p>
//               <strong>Name:</strong> {shipment.sender?.name}
//             </p>
//             <p>
//               <strong>Phone:</strong> {shipment.sender?.phone}
//               {shipment.sender?.phone && (
//                 <FaPhone
//                   className="call-icons"
//                   onClick={() => handleCall(shipment.sender?.phone)}
//                 />
//               )}
//             </p>
//             <p>{shipment.sender?.address?.addressLine1}</p>
//           </div>
//           <div className="address-card receiver">
//             <h4>Receiver</h4>
//             <p>
//               <strong>Name:</strong> {shipment.receiver?.name}
//             </p>
//             <p>
//               <strong>Phone:</strong> {shipment.receiver?.phone}
//               {shipment.receiver?.phone && (
//                 <FaPhone
//                   className="call-icons"
//                   onClick={() => handleCall(shipment.receiver?.phone)}
//                 />
//               )}
//             </p>
//             <p>{shipment.receiver?.address?.addressLine1}</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

/* ---------------------------- Main Component ---------------------------- */
const LocationTracker = ({ shipment, onStatusUpdate }) => {
  // console.log('🚀 LocationTracker component rendered with shipment:', shipment);
  const { user } = useAuth();
  const { t } = useTranslation();
  // console.log('👤 Auth user:', user);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const statusHandledRef = useRef(false);
  const [showPaymentPendingPopup, setShowPaymentPendingPopup] = useState(false);

  const [showReceiverOtpSection, setShowReceiverOtpSection] = useState(false);


  const [showDeliverPopup, setShowDeliverPopup] = useState(false);
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  // const [pickupVerified, setPickupVerified] = useState(
  //   localStorage.getItem('pickupVerified') === 'true'
  // );
  const [pickupVerified, setPickupVerified] = useState(
    shipment?.status === 'picked_up' ||
    localStorage.getItem('pickupVerified') === 'true'
  );

  // console.log('🔐 Pickup verified state:', pickupVerified);
  const [showReceiverOtpPopup, setShowReceiverOtpPopup] = useState(false);
  const [receiverOtp, setReceiverOtp] = useState('');

  const [isSendingReceiverOtp, setIsSendingReceiverOtp] = useState(false);
  const [receiverOtpSent, setReceiverOtpSent] = useState(
    localStorage.getItem("receiverOtpSent") === "true"
  );


  const [receiverOtpVerified, setReceiverOtpVerified] = useState(
    localStorage.getItem('receiverOtpVerified') === 'true'
  );
  // console.log('🔐 Receiver OTP verified state:', receiverOtpVerified);
  const navigate = useNavigate();

  const swipeRef = useRef(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const swipeDeliverRef = useRef(null);

  const { position: geoPosition } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });
  // console.log('📍 Geolocation position:', geoPosition);

  const [localShipment, setLocalShipment] = useState(() => {
    const saved = localStorage.getItem('lastShipment');
    // console.log('💾 Loading localShipment from localStorage:', saved);
    return saved ? JSON.parse(saved) : null;
  });
  const activeShipment = localShipment || shipment;
  // console.log('📦 Active shipment:', activeShipment);

  const [loadingMap, setLoadingMap] = useState(true);
  // console.log('🗺️ Loading map state:', loadingMap);

  /* ------------------------------ Persist state ------------------------------ */
  useEffect(() => {
    // console.log('💾 Persist state effect - shipment:', shipment);
    if (shipment) {
      localStorage.setItem('lastShipment', JSON.stringify(shipment));
      localStorage.removeItem('pickupVerified');
      localStorage.removeItem("receiverOtpSent");
      localStorage.removeItem('receiverOtpVerified');
      setLocalShipment(shipment);
      // console.log('💾 Saved shipment to localStorage');
    }
  }, [shipment]);

  useEffect(() => {
    if (isUnlocked) {
      const timer = setTimeout(() => setIsUnlocked(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked]);


  useEffect(() => {
    // console.log('🔄 Shipment status effect - shipment:', shipment);
    if (shipment && ['cancelled'].includes(shipment.status)) {
      // console.log('🗑️ Removing shipment from localStorage - status:', shipment.status);
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate(shipment.status);
    }
  }, [shipment, onStatusUpdate]);

  useEffect(() => {
    if (activeShipment?._id && activeShipment?.status) {
      console.log(`🚚 Shipment Status Update → ${activeShipment.status}`);
    }
  }, [activeShipment?.status]);

  useEffect(() => {
    if (!activeShipment?._id) return;

    const interval = setInterval(async () => {
      try {
        const token = await user.getIdToken();
        const res = await axios.get(
          `${API_BASE_URL}/api/shipments/${activeShipment._id}/status-only`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const latestStatus = res.data.status;
        console.log(`♻️ Shipment status polled → ${latestStatus}`);

        // ✅ Update pickupVerified and receiverOtpVerified
        if (latestStatus === "picked_up") {
          console.log("✅ Backend says picked_up — updating pickupVerified");
          setPickupVerified(true);
          localStorage.setItem("pickupVerified", "true");
        } else if (latestStatus === "delivered") {
          setReceiverOtpVerified(true);
          localStorage.setItem("receiverOtpVerified", "true");
        }

        // ✅ Handle cancellation or delivery cleanup
        if (
          !statusHandledRef.current &&
          ["cancelled", "delivered"].includes(latestStatus)
        ) {
          statusHandledRef.current = true;

          localStorage.removeItem("lastShipment");
          localStorage.removeItem("pickupVerified");
          localStorage.removeItem("receiverOtpVerified");
          setLocalShipment(null);

          if (onStatusUpdate) onStatusUpdate(latestStatus);
          // toast.info(`Shipment ${latestStatus}`);
        }
      } catch (err) {
        console.error("⚠️ Error fetching shipment status:", err.message);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeShipment?._id, user]);




  // 🔁 Poll payment status every 5 seconds
  useEffect(() => {
    if (!activeShipment?._id) return;

    const interval = setInterval(async () => {
      try {
        const token = await user.getIdToken();
        const res = await axios.get(
          `${API_BASE_URL}/api/shipments/${activeShipment._id}/payment-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const latestPaymentStatus = res.data.payment?.status;

        if (!latestPaymentStatus) return;

        // 💾 Update payment status locally + persist to localStorage
        setLocalShipment((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            payment: {
              ...prev.payment,
              status: latestPaymentStatus,
            },
          };
          localStorage.setItem('lastShipment', JSON.stringify(updated));
          return updated;
        });

        console.log(`💰 Payment status updated → ${latestPaymentStatus}`);
      } catch (err) {
        console.error("⚠️ Error fetching payment status:", err.message);
      }
    }, 5000); // every 5 seconds

    return () => clearInterval(interval);
  }, [activeShipment?._id, user]);





  /* ------------------------------ Driver point ------------------------------ */
  const location = useMemo(() => {
    // console.log('📍 Calculating location from geoPosition:', geoPosition);
    if (geoPosition?.coords) {
      const result = [
        Number(geoPosition.coords.longitude),
        Number(geoPosition.coords.latitude),
      ];
      // console.log('📍 Location from geoPosition:', result);
      return result;
    }
    const stored = localStorage.getItem('lastKnownLocation');
    // console.log('💾 Stored location from localStorage:', stored);
    if (!stored) return null;
    try {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr) && arr.length >= 2) {
        const lng = Number(arr[0]);
        const lat = Number(arr[1]);
        const result = Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
        // console.log('📍 Location from localStorage:', result);
        return result;
      }
    } catch (err) {
      // console.log('❌ Error parsing stored location:', err);
    }
    return null;
  }, [geoPosition]);
  /* ----------------------- Send location to backend ----------------------- */
  useEffect(() => {
    if (!user) return;

    // 🔁 Send driver's current location every 5 seconds (MongoDB + Firebase)
    const interval = setInterval(async () => {
      try {
        const stored = localStorage.getItem('lastKnownLocation');
        if (!stored) return;

        const [lng, lat] = JSON.parse(stored);
        if (typeof lng !== 'number' || typeof lat !== 'number') return;

        const token = await user.getIdToken();

        // 1️⃣ Update in MongoDB (your existing backend)
        await axios.put(
          'https://jio-yatri-driver.onrender.com/api/driver/location',
          {
            coordinates: [lng, lat],
            isLocationActive: true
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        // 2️⃣ Update in Firebase (for instant real-time updates)
        await set(ref(db, `driver_locations/${user.uid}`), {
          lat,
          lng,
          updatedAt: Date.now(),
        });

        console.log('📡 Driver location updated (MongoDB + Firebase) →', [lng, lat]);
      } catch (err) {
        console.error('⚠️ Failed to update driver location:', err.message);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user]);



  // const verifyPickupOtp = async () => {
  //   // console.log('🔐 verifyPickupOtp called with OTP:', enteredOtp);
  //   try {
  //     const token = await user.getIdToken();
  //     // console.log('🔐 Making API call to verify pickup OTP');

  //     const res = await axios.post(
  //       `${API_BASE_URL}/api/shipments/${activeShipment._id}/verify-pickup`,
  //       { otp: enteredOtp },
  //       { headers: { Authorization: `Bearer ${token}` } }
  //     );

  //     const updatedShipment = res.data.shipment;
  //     // console.log('✅ OTP verified — updated shipment from backend:', updatedShipment);

  //     // 🔄 Update state and localStorage so UI refreshes to show “picked_up”
  //     setLocalShipment(updatedShipment);
  //     localStorage.setItem('lastShipment', JSON.stringify(updatedShipment));

  //     toast.success('Pickup verified successfully');
  //     setShowOtpPopup(false);
  //     setPickupVerified(true);
  //     localStorage.setItem('pickupVerified', 'true');
  //     // console.log('✅ Pickup verified and local shipment updated');
  //   } catch (err) {
  //     // console.error('❌ OTP verification failed:', err);
  //     toast.error(err.response?.data?.message || 'Invalid OTP');
  //   }
  // };

  const handleSwipeStart = (startEvent, isDelivery = false) => {
    const handle = isDelivery ? swipeDeliverRef.current : swipeRef.current;
    if (!handle) return;

    const track = handle.parentElement;
    const maxMove = track.offsetWidth - handle.offsetWidth;
    const startX = startEvent.clientX;
    let currentX = 0;

    const onMove = (moveEvent) => {
      currentX = moveEvent.clientX - startX;
      if (currentX < 0) currentX = 0;
      if (currentX > maxMove) currentX = maxMove;
      handle.style.left = `${currentX}px`;
    };

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);

      if (currentX >= maxMove - 10) {
        if (isDelivery) {
          handleDeliverShipment(); // ✅ Swipe to complete delivery
        } else {
          setIsUnlocked(true);
          sendReceiverOtp();
          setShowReceiverOtpSection(true);
        }
        handle.style.left = `${maxMove}px`;
      } else {
        handle.style.left = '0px';
      }


    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', (e) => onMove(e.touches[0]));
    document.addEventListener('touchend', onEnd);
  };

  const verifyPickupOtp = async (otpValue = enteredOtp) => {
    try {
      console.log("🚀 [verifyPickupOtp] called");
      console.log("🔢 Entered OTP:", otpValue);

      const token = await user.getIdToken();
      console.log("🪪 Firebase Token (first 20 chars):", token?.substring(0, 20), "...");

      const payload = { otp: otpValue };
      console.log("📤 Sending payload:", payload);

      const res = await axios.post(
        `${API_BASE_URL}/api/shipments/${activeShipment._id}/verify-pickup`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("✅ Backend Response:", res.data);

      const updatedShipment = res.data.shipment;
      setLocalShipment(updatedShipment);
      localStorage.setItem("lastShipment", JSON.stringify(updatedShipment));

      toast.success(t("pickup_verified_success"));
      setShowOtpPopup(false);
      setPickupVerified(true);
      localStorage.setItem("pickupVerified", "true");

    } catch (err) {
      console.error("❌ [verifyPickupOtp] Error:", err);
      console.error("📄 Error Response:", err.response?.data);
      toast.error(err.response?.data?.message || t("invalid_otp"));
    }
  };



  const sendReceiverOtp = async () => {
    try {
      setIsSendingReceiverOtp(true);
      const token = await user.getIdToken();
      await axios.post(
        `${API_BASE_URL}/api/auth/${activeShipment._id}/send-receiver-otp`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t("receiver_otp_sent"));
      setReceiverOtpSent(true);
      localStorage.setItem("receiverOtpSent", "true");
      setShowReceiverOtpPopup(true); // open your existing popup
    } catch (error) {
      toast.error(error.response?.data?.message || t("receiver_otp_failed"));
    } finally {
      setIsSendingReceiverOtp(false);
    }
  };



  const heading = Number.isFinite(geoPosition?.coords?.heading)
    ? geoPosition.coords.heading
    : 0;
  // console.log('🧭 Heading:', heading);
  // 
  /* ----------------------------- Sender/Receiver ---------------------------- */
  useEffect(() => {
    if (activeShipment) {
      // console.log('[RAW] sender.address', activeShipment.sender?.address);
      // console.log('[RAW] receiver.address', activeShipment.receiver?.address);
    }
  }, [activeShipment]);

  const senderLatLng = useMemo(() => {
    const p = normalizeToLatLng(
      activeShipment?.sender?.address?.coordinates ??
      activeShipment?.sender?.address ??
      activeShipment?.sender
    );
    // console.log('[NORMALIZED] senderLatLng', p);
    return p;
  }, [activeShipment]);

  const receiverLatLng = useMemo(() => {
    const p = normalizeToLatLng(
      activeShipment?.receiver?.address?.coordinates ??
      activeShipment?.receiver?.address ??
      activeShipment?.receiver
    );
    // console.log('[NORMALIZED] receiverLatLng', p);
    return p;
  }, [activeShipment]);

  /* --------------------------------- Map refs -------------------------------- */
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markerRef = useRef(null);
  const senderMarkerRef = useRef(null);
  const receiverMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const googleMapsScriptRef = useRef(null);

  // console.log('🗺️ Map refs:', {
  //   mapRef: mapRef.current,
  //   markerRef: markerRef.current,
  //   senderMarkerRef: senderMarkerRef.current,
  //   receiverMarkerRef: receiverMarkerRef.current
  // });

  /* ------------------------------ Fullscreen nav ----------------------------- */
  const handleViewFullMap = () => {
    // console.log('🗺️ Navigating to full map with location:', location);
    navigate('/full-map', {
      state: {
        currentLocation: location,
        heading,
        senderLatLng,
        receiverLatLng,
      },
    });
  };

  /* --------------------------------- Map init -------------------------------- */
  const initMap = useCallback(() => {
    // console.log('🗺️ initMap called with activeShipment:', activeShipment);
    if (!activeShipment || !mapContainerRef.current || mapRef.current) {
      // console.log('❌ initMap: conditions not met', {
      //   activeShipment: !!activeShipment,
      //   mapContainerRef: !!mapContainerRef.current,
      //   mapRef: !!mapRef.current
      // });
      return;
    }

    const cObj = normalizeToLatLng(location);
    const center = isValidLatLng(cObj) ? cObj : { lat: 12.9716, lng: 77.5946 };
    // console.log('🗺️ Map center set to:', center);

    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      zoom: 15,
      center,
      mapTypeId: 'roadmap',
      gestureHandling: 'greedy', // allow all gestures (drag, zoom, rotate)
      tilt: 45,                  // enable tilt
      heading: 0,                // optional initial heading
      rotateControl: true        // optional rotation control
    });



    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: '#4285F4',
        strokeWeight: 6,
        strokeOpacity: 0.8,
      },
    });

    directionsRendererRef.current.setMap(mapRef.current);
    directionsServiceRef.current = new window.google.maps.DirectionsService();
    setLoadingMap(false);
    // console.log('🗺️ Directions services initialized, loadingMap set to false');
  }, [location, activeShipment]);


  // 🔄 Rotate map based on device orientation (optional)
  useEffect(() => {
    if (!mapRef.current || !window.DeviceOrientationEvent) return;

    // Ask for permission on iOS devices
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then((response) => {
        if (response === 'granted') {
          window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        }
      });
    } else {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    }

    function handleOrientation(event) {
      const compassHeading = event.alpha;
      if (Number.isFinite(compassHeading)) {
        mapRef.current.setHeading(compassHeading);
      }
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
    };
  }, []);


  /* -------------------------------- Map update ------------------------------- */
  const [etaToSender, setEtaToSender] = useState('');
  const [distanceToSender, setDistanceToSender] = useState('');
  const [etaToReceiver, setEtaToReceiver] = useState('');
  const [distanceToReceiver, setDistanceToReceiver] = useState('');
  const [routeError, setRouteError] = useState(null);

  function animateMarker(marker, newLatLng, duration = 1000) {
    if (!marker || !window.google) return;

    const startLatLng = marker.getPosition();
    if (!startLatLng) return;

    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const lat = startLatLng.lat() + (newLatLng.lat - startLatLng.lat()) * progress;
      const lng = startLatLng.lng() + (newLatLng.lng - startLatLng.lng()) * progress;

      marker.setPosition(new window.google.maps.LatLng(lat, lng));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }

  const updateMap = useCallback(() => {
    // console.log('🗺️ updateMap called');
    if (!mapRef.current || !activeShipment || !window.google) {
      // console.log('❌ updateMap: conditions not met', {
      //   mapRef: !!mapRef.current,
      //   activeShipment: !!activeShipment,
      //   google: !!window.google
      // });
      return;
    }

    const driverLatLng = normalizeToLatLng(location);
    // console.log('🗺️ Driver location:', driverLatLng);
    if (!isValidLatLng(driverLatLng)) {
      // console.log('❌ updateMap: invalid driver location');
      return;
    }
    if (!isValidLatLng(senderLatLng) || !isValidLatLng(receiverLatLng)) {
      // console.log('❌ updateMap: invalid sender/receiver locations', {
      //   sender: senderLatLng,
      //   receiver: receiverLatLng
      // });
      return;
    }

    // DRIVER marker update
    if (!markerRef.current) {
      // console.log('📍 Creating new driver marker');
      markerRef.current = new window.google.maps.Marker({
        position: driverLatLng,
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          rotation: Number.isFinite(heading) ? heading : 0,
          fillColor: '#EA4335',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        title: 'Your Location',
      });
    } else {
      // console.log('📍 Updating existing driver marker');
      animateMarker(markerRef.current, driverLatLng, 1000);
    }

    // Sender + Receiver markers (only create once)
    if (!senderMarkerRef.current) {
      // console.log('📍 Creating sender marker');
      senderMarkerRef.current = new window.google.maps.Marker({
        position: senderLatLng,
        map: mapRef.current,
        icon: { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' },
        label: { text: 'S', color: '#ffffff', fontWeight: '700' },
        title: 'Sender',
      });
    }

    if (!receiverMarkerRef.current) {
      // console.log('📍 Creating receiver marker');
      receiverMarkerRef.current = new window.google.maps.Marker({
        position: receiverLatLng,
        map: mapRef.current,
        icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
        label: { text: 'R', color: '#ffffff', fontWeight: '700' },
        title: 'Receiver',
      });
    }

    // ✅ Route update and ETA calculation (same as user website)
    // console.log('🔄 Calculating route...');
    directionsServiceRef.current.route(
      {
        origin: driverLatLng,
        destination: receiverLatLng,
        waypoints: [{ location: senderLatLng, stopover: true }],
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        // console.log('🔄 Route calculation status:', status);
        if (status === 'OK') {
          directionsRendererRef.current.setDirections(result);
          setRouteError(null);
          // console.log('✅ Route calculated successfully');

          // 🟢 Extract ETA & Distance directly from route legs
          const route = result.routes[0];
          if (route && route.legs && route.legs.length > 0) {
            // console.log('📊 Route legs:', route.legs);
            if (route.legs.length === 2) {
              // Two segments: driver → sender, sender → receiver
              setDistanceToSender(route.legs[0].distance.text);
              setEtaToSender(route.legs[0].duration.text);
              setDistanceToReceiver(route.legs[1].distance.text);
              setEtaToReceiver(route.legs[1].duration.text);
              // console.log('📊 ETA updated - 2 legs');
            } else if (route.legs.length === 1) {
              // Only one segment (e.g. direct driver → receiver)
              setDistanceToReceiver(route.legs[0].distance.text);
              setEtaToReceiver(route.legs[0].duration.text);
              setDistanceToSender('');
              setEtaToSender('');
              // console.log('📊 ETA updated - 1 leg');
            }
          }
        } else {
          // console.log('❌ Route calculation failed:', status);
          setRouteError(`Failed to fetch route: ${status}`);
        }
      }
    );
  }, [location, heading, activeShipment, senderLatLng, receiverLatLng]);

  /* --------------------------- Load Maps JS once --------------------------- */
  // ✅ Improved Google Maps Loader — waits for location before init
  useEffect(() => {
    if (!activeShipment) {
      mapRef.current = null;
      return;
    }

    // ✅ Wait for valid driver location before initializing map
    const driverLatLng = normalizeToLatLng(location);
    if (!isValidLatLng(driverLatLng)) {
      return;
    }


    if (window.google && window.google.maps) {
      initMap();
    } else if (!googleMapsScriptRef.current) {
      console.log("📜 Loading Google Maps script...");
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initMap();
      };
      document.body.appendChild(script);
      googleMapsScriptRef.current = script;
    }
  }, [activeShipment, location, initMap]);


  useEffect(() => {
    // console.log('🗺️ Map update effect - loadingMap:', loadingMap, 'location:', location);
    if (!loadingMap && location) {
      updateMap();
    }
  }, [location, loadingMap, updateMap]);

  // ✅ Fix scroll after exiting fullscreen mode
  useEffect(() => {
    // console.log('📜 Fullscreen change listener added');
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && mapContainerRef.current) {
        // console.log('📜 Exited fullscreen, scrolling map into view');
        mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      // console.log('📜 Fullscreen change listener removed');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /* ------------------------ Send driver location (API) ------------------------ */
  useEffect(() => {
    // console.log('📍 Driver location update effect - user:', user, 'activeShipment:', activeShipment?._id);
    if (!user || !activeShipment?._id) {
      // console.log('❌ Location update: missing user or activeShipment');
      return;
    }

    const interval = setInterval(async () => {
      if (!location) {
        // console.log('❌ Location update: no location data');
        return;
      }

      try {
        // console.log('📍 Sending driver location update:', location);
        const token = await user.getIdToken();

        // Update driver profile
        await axios.put(
          `${API_BASE_URL}/api/driver/location`,
          { coordinates: location, isLocationActive: true },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Update active shipment
        await axios.put(
          `${API_BASE_URL}/api/shipments/${activeShipment._id}/driver-location`,
          { coordinates: location },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // console.log("✅ Driver location updated:", location);
      } catch (err) {
        // console.error("❌ Failed to update driver location:", err);
      }
    }, 5000); // send every 5 seconds no matter what

    // console.log('📍 Started location update interval');

    return () => {
      // console.log('📍 Clearing location update interval');
      clearInterval(interval);
    };
  }, [user, activeShipment, location]);

  /* ------------------------------ UI Handlers ------------------------------ */
  const handleRecenter = () => {
    // console.log('📍 Recenter button clicked');
    const p = normalizeToLatLng(location);
    if (mapRef.current && isValidLatLng(p)) {
      mapRef.current.panTo(p);
      // console.log('🗺️ Map recentered to:', p);
      // } else {
      //   console.log('❌ Recenter failed - invalid location or map');
    }
  };
  // 🔐 Verify Receiver OTP with strong debugging
  const verifyReceiverOtp = async (otpValue = receiverOtp) => {
    try {
      // ⬇️ Deep debug logs
      console.log("🚀 [verifyReceiverOtp] called");
      console.log("📦 activeShipmentId:", activeShipment?._id);
      console.log("🔢 otpValue:", otpValue, "| length:", otpValue?.length);
      if (!otpValue || otpValue.length !== 4) {
        console.warn("⚠️ OTP not 4 digits yet, aborting verify");
        return;
      }

      const token = await user.getIdToken();
      console.log("🪪 Firebase Token (first 20):", token?.slice(0, 20), "...");

      const url = `${API_BASE_URL}/api/auth/${activeShipment._id}/verify-receiver-otp`;
      const payload = { otp: otpValue };
      console.log("🌐 POST", url, "payload:", payload);

      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("✅ Backend Response:", res?.data);
      toast.success(t("receiver_otp_verified_success"));
      setReceiverOtpVerified(true);
      localStorage.setItem("receiverOtpVerified", "true");
    } catch (error) {
      // 🔎 Full error introspection
      console.error("❌ [verifyReceiverOtp] Error:", error);
      console.log("📡 status:", error?.response?.status);
      console.log("📄 data:", error?.response?.data);
      console.log("📬 headers:", error?.response?.headers);

      toast.error(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Invalid OTP"
      );
    }
  };


  const handleCancelShipment = async () => {
    // console.log('❌ Cancel shipment called for:', activeShipment?._id);
    try {
      const token = await user.getIdToken();
      // console.log('[API] cancel shipment', activeShipment?._id);
      await axios.put(
        `${API_BASE_URL}/api/shipments/${activeShipment._id}/cancel`,
        { reason: 'Driver cancelled the shipment' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.removeItem('lastShipment');
      localStorage.removeItem('pickupVerified');
      localStorage.removeItem('receiverOtpVerified');
      localStorage.removeItem("receiverOtpSent");

      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate('cancelled');
      mapRef.current = null;
      toast.success(t("shipment_cancelled"));
      // console.log('✅ Shipment cancelled successfully');
    } catch (error) {
      // console.error('[API] cancel failed', error);
      toast.error(error.response?.data?.message || t("cancel_shipment_failed"));
    }
  };

  const handleDeliverShipment = async () => {
    // console.log('✅ Deliver shipment called for:', activeShipment?._id);
    try {
      const token = await user.getIdToken();
      // console.log('[API] deliver shipment', activeShipment?._id);
      await axios.put(
        `${API_BASE_URL}/api/shipments/${activeShipment._id}/deliver`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.removeItem('lastShipment');
      localStorage.removeItem('pickupVerified');
      localStorage.removeItem('receiverOtpVerified');
      localStorage.removeItem("receiverOtpSent");

      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate('delivered');
      mapRef.current = null;
      toast.success(t("shipment_delivered_success"));
      // console.log('✅ Shipment delivered successfully');
    } catch (error) {
      // console.error('[API] deliver failed', error);
      toast.error(error.response?.data?.message || t("deliver_shipment_failed"));
    }
  };

  /* --------------------------------- Render --------------------------------- */
  // console.log('🎨 Rendering LocationTracker - activeShipment:', activeShipment);

  if (!activeShipment || ['cancelled', 'delivered'].includes(activeShipment.status)) {
    // console.log('📦 No active shipment or completed shipment');
    return (
      <div className="no-shipment">
        {activeShipment ? `Shipment ${activeShipment.status}` : 'No active shipment'}
      </div>
    );
  }

  // ✅ Show Payment Waiting Screen
  if (!activeShipment?.isShopOrder && activeShipment?.payment?.status !== "paid") {
    return (
      // <div className="payment-processing-overlays">
      //   <div className="payment-processing-screen" role="status" aria-live="polite">
      //     <svg className="clock" viewBox="0 0 120 120" aria-hidden="true">
      //       {/* Outer rotating ring */}
      //       <circle
      //         cx="60"
      //         cy="60"
      //         r="54"
      //         fill="none"
      //         stroke="#007bff"
      //         strokeWidth="6"
      //         strokeDasharray="15 10"
      //         className="ring"
      //       />
      //       {/* Clock face */}
      //       <circle
      //         cx="60"
      //         cy="60"
      //         r="40"
      //         fill="none"
      //         stroke="#007bff"
      //         strokeOpacity="0.3"
      //         strokeWidth="2"
      //       />
      //       {/* Hour ticks */}
      //       <g stroke="#007bff" strokeOpacity="0.6" strokeWidth="2">
      //         <line x1="60" y1="20" x2="60" y2="26" />
      //         <line x1="60" y1="94" x2="60" y2="100" />
      //         <line x1="20" y1="60" x2="26" y2="60" />
      //         <line x1="94" y1="60" x2="100" y2="60" />
      //       </g>
      //       {/* Rotating hand */}
      //       <g className="hand-rotate">
      //         <line
      //           x1="60"
      //           y1="60"
      //           x2="60"
      //           y2="28"
      //           stroke="#007bff"
      //           strokeWidth="3"
      //           strokeLinecap="round"
      //         />
      //         <circle cx="60" cy="60" r="3" fill="#007bff" />
      //       </g>
      //     </svg>

      //     <h2>User is processing payment</h2>
      //     <p>Please wait...</p>
      //   </div>
      // </div>
      <div className="payment-processing">
        <Lottie animationData={sandTimer} loop={true} style={{ width: 180, height: 180 }} />
        <h2 className="status-text">{t("user_processing_payment")}</h2>
        <p className="sub-text">{t("please_wait")}</p>
      </div>
    );
  }


  // console.log('🎨 Rendering main component UI');
  return (
    <div className="location-tracker-container">
      {/* <ShipmentDetailsCard shipment={activeShipment} /> */}

      <div className="map-sections">
        <div
          ref={mapContainerRef}
          className="map-container"
          style={{ height: '400px', width: '100%' }}
        />
        <button onClick={handleRecenter} className="recenter-button">
          📍
        </button>
      </div>

      {/* <EtaDisplay
        etaToSender={etaToSender}
        etaToReceiver={etaToReceiver}
        distanceToSender={distanceToSender}
        distanceToReceiver={distanceToReceiver}
        t={t}
      /> */}
      {routeError && <p className="error-message">{routeError}</p>}

      <div className="shipment-actions">
        {(
          activeShipment?.status !== 'picked_up' // hide when picked_up
        ) && (
            <button
              onClick={() => {
                // console.log('❌ Cancel shipment button clicked');
                setShowCancelPopup(true);
              }}
              className="cancelll-buttons"
            >
              {t("cancel_shipment")}
            </button>
          )}

        {(
          (activeShipment?.isShopOrder && pickupVerified) ||   // only after OTP verified for shop orders
          (activeShipment?.status === 'picked_up' && receiverOtpVerified)  // normal shipments
        ) && (
            <button
              onClick={() => {
                const paymentStatus = activeShipment?.payment?.status;

                if (!paymentStatus) {

                  return;
                }

                if (paymentStatus === "pending") {
                  setShowPaymentPendingPopup(true);
                } else if (paymentStatus === "paid") {
                  setShowDeliverPopup(true);
                } else {
                  // toast.info(`Payment status: ${paymentStatus}`);
                }
              }}
              className="deliver-button"
            >
              {t("mark_as_delivered")}
            </button>


          )}

        {activeShipment?.status === 'assigned' && !pickupVerified && (
          <button onClick={() => {
            // console.log('🔐 Verify pickup OTP button clicked');
            setShowOtpPopup(true);
          }} className="verify-btn">
            {activeShipment?.isShopOrder
              ? t("verify_delivery_otp")
              : t("verify_pickup_otp")}
          </button>
        )}

        {/* {!activeShipment?.isShopOrder &&
          activeShipment?.status === 'picked_up' &&
          !receiverOtpVerified && (
            <button
              onClick={async () => {
                // console.log('🔐 Verify receiver OTP button clicked');
                try {
                  const token = await user.getIdToken();
                  // console.log('📱 Sending receiver OTP...');
                  await axios.post(
                    `${API_BASE_URL}/api/auth/${activeShipment._id}/send-receiver-otp`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  // toast.success('Receiver OTP sent successfully!');
                  setShowReceiverOtpPopup(true);
                  // console.log('✅ Receiver OTP sent');
                } catch (error) {
                  // console.log('❌ Failed to send receiver OTP:', error);
                  toast.error(error.response?.data?.message || 'Failed to send receiver OTP');
                }
              }}
              className="verify-btn"
            >
              Verify Receiver (OTP)
            </button>
          )} */}


      </div>

      {showOtpPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>{t("pickup_verification")}</h3>
            <p>{t("enter_otp_sender")}</p>

            <div className="otp-input-container">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  value={enteredOtp[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const otpArray = enteredOtp.split('');

                    otpArray[index] = val;
                    setEnteredOtp(otpArray.join(''));

                    if (val && index < 3) {
                      // Move to next box
                      document.getElementById(`otp-${index + 1}`).focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !enteredOtp[index] && index > 0) {
                      // Move back on delete
                      document.getElementById(`otp-${index - 1}`).focus();
                    }
                  }}
                  id={`otp-${index}`}
                  className="otp-box"
                />
              ))}
            </div>

            <div className="popup-buttons">
              <button onClick={verifyPickupOtp} className="yes-button">Verify</button>
              <button onClick={() => {
                // console.log('❌ OTP verification cancelled');
                setShowOtpPopup(false);
              }} className="no-button">{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Shipment Popup */}
      {showCancelPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>{t("cancel_shipment")}</h3>
            <p>{t("confirm_cancel_shipment")}</p>
            <div className="popup-buttons">
              <button
                onClick={() => {
                  // console.log('✅ Confirm cancellation');
                  handleCancelShipment();
                  setShowCancelPopup(false);
                }}
                className="yes-button"
              >
                {t("yes_cancel")}
              </button>
              <button
                onClick={() => {
                  // console.log('❌ Cancellation cancelled');
                  setShowCancelPopup(false);
                }}
                className="no-button"
              >
                {t("no")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* {showReceiverOtpPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>Receiver Verification</h3>
            <p>Enter the OTP sent to receiver's phone number.</p>
            <div className="otp-input-container">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  value={receiverOtp[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const otpArray = receiverOtp.split('');
                    otpArray[index] = val;
                    setReceiverOtp(otpArray.join(''));
                    if (val && index < 3) {
                      document.getElementById(`receiver-otp-${index + 1}`).focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !receiverOtp[index] && index > 0) {
                      document.getElementById(`receiver-otp-${index - 1}`).focus();
                    }
                  }}
                  id={`receiver-otp-${index}`}
                  className="otp-box"
                />
              ))}
            </div>

            <div className="popup-buttons">
              <button
                onClick={async () => {
                  // console.log('🔐 Verifying receiver OTP:', receiverOtp);
                  try {
                    const token = await user.getIdToken();
                    await axios.post(
                      `${API_BASE_URL}/api/auth/${activeShipment._id}/verify-receiver-otp`,
                      { otp: receiverOtp },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    // toast.success('Receiver OTP verified!');
                    setReceiverOtpVerified(true);
                    localStorage.setItem('receiverOtpVerified', 'true');
                    setShowReceiverOtpPopup(false);
                    // console.log('✅ Receiver OTP verified successfully');
                  } catch (error) {
                    // console.log('❌ Receiver OTP verification failed:', error);
                    toast.error(error.response?.data?.message || 'Invalid OTP');
                  }
                }}
                className="yes-button"
              >
                Verify
              </button>
              <button onClick={() => {
                // console.log('❌ Receiver OTP verification cancelled');
                setShowReceiverOtpPopup(false);
              }} className="no-button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )} */}
      {showPaymentPendingPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>{t("payment_pending")}</h3>
            <p>
              {t("payment_pending_message")}
            </p>
            <div className="popup-buttons">
              <button
                onClick={() => setShowPaymentPendingPopup(false)}
                className="no-button"
              >
                {t("okay")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Delivered Popup */}
      {showDeliverPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>{t("mark_as_delivered")}</h3>

            <p>{t("confirm_delivery_question")}</p>

            <div className="popup-buttons">
              <button
                onClick={() => {
                  handleDeliverShipment();
                  setShowDeliverPopup(false);
                }}
                className="yes-button"
              >
                {t("yes_mark_as_delivered")}
              </button>

              <button
                onClick={() => setShowDeliverPopup(false)}
                className="no-button"
              >
                {t("no")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bottom-panel">
        {!showReceiverOtpSection && !activeShipment?.isShopOrder && (
          <h3 className="otp-title">
            {(!pickupVerified && t("enter_pickup_otp")) ||
              (receiverOtpSent && !receiverOtpVerified && t("enter_receiver_otp"))}
            {!pickupVerified ? (
              <>
                <span>{distanceToSender || '12.5 km'}</span>
                <span>{etaToSender || '25 min'}</span>
              </>
            ) : (
              <>
                <span>{distanceToReceiver || '8.4 km'}</span>
                <span>{etaToReceiver || '20 min'}</span>
                <span className="amount">₹{activeShipment?.cost || '60'}</span>
              </>
            )}
          </h3>
        )}


        {/* 1️⃣ Before Pickup Verification */}
        {/* {!pickupVerified && (
          <>
            <div className="otp-input-container">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  value={enteredOtp[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const otpArray = enteredOtp.split('');
                    otpArray[index] = val;
                    const newOtp = otpArray.join('');
                    setEnteredOtp(newOtp);

                    if (val && index < 3) document.getElementById(`otp-${index + 1}`).focus();

                    if (newOtp.length === 4 && newOtp.split('').every(Boolean)) {
                      verifyPickupOtp(newOtp); // ✅ fixed
                    }
                  }}

                  onKeyDown={(e) => {
                    if (e.key === 'Backspace') {
                      e.preventDefault();
                      const otpArray = enteredOtp.split('');
                      if (otpArray[index]) otpArray[index] = '';
                      else if (index > 0) document.getElementById(`otp-${index - 1}`).focus();
                      setEnteredOtp(otpArray.join(''));
                    }
                  }}
                  id={`otp-${index}`}
                  className="otp-box"
                />
              ))}
              <span>₹{activeShipment?.cost || '60'}</span>
            </div>
          </>
        )} */}

        {/* 1️⃣ Before Pickup Verification */}
        {/* Shop Order Flow */}
        {activeShipment?.isShopOrder && (
          <>
            {/* ✅ Show Receiver OTP input even when awaiting_payment */}
            {!pickupVerified ? (
              <>
                <h3 className="otp-title tracking-view-status">{t("enter_receiver_otp")}</h3>
                <div className="otp-input-container">
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={enteredOtp[index] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const otpArray = enteredOtp.split('');
                        otpArray[index] = val;
                        const newOtp = otpArray.join('');
                        setEnteredOtp(newOtp);

                        if (val && index < 3)
                          document.getElementById(`otp-${index + 1}`).focus();

                        // ✅ Verify when full OTP entered
                        if (newOtp.length === 4 && newOtp.split('').every(Boolean)) {
                          verifyPickupOtp(newOtp);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace') {
                          e.preventDefault();
                          const otpArray = enteredOtp.split('');
                          if (otpArray[index]) otpArray[index] = '';
                          else if (index > 0)
                            document.getElementById(`otp-${index - 1}`).focus();
                          setEnteredOtp(otpArray.join(''));
                        }
                      }}
                      id={`otp-${index}`}
                      className="otp-box"
                    />
                  ))}
                  <span>₹{activeShipment?.cost || '60'}</span>
                </div>
              </>
            ) : (
              // ✅ After OTP verified — show swipe to mark as delivered
              <div className="swipe-track green"
                onMouseDown={(e) => handleSwipeStart(e, true)}
                onTouchStart={(e) => handleSwipeStart(e.touches[0], true)}
              >
                <span className="swipe-text">{t("swipe_mark_delivered")}</span>

                <div className="swipe-handle green-handle" ref={swipeDeliverRef}>
                  ➜
                </div>
              </div>

            )}
          </>
        )}

        {/* ✅ Regular Shipment OTP Input (when not picked up yet) */}
        {!activeShipment?.isShopOrder && !pickupVerified && (
          <>
            {/* <h3 className="otp-title tracking-view-status">Enter Pickup OTP</h3> */}
            <div className="otp-input-container">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  value={enteredOtp[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const otpArray = enteredOtp.split('');
                    otpArray[index] = val;
                    const newOtp = otpArray.join('');
                    setEnteredOtp(newOtp);

                    if (val && index < 3)
                      document.getElementById(`otp-${index + 1}`).focus();

                    // ✅ Verify OTP when 4 digits entered
                    if (newOtp.length === 4 && newOtp.split('').every(Boolean)) {
                      verifyPickupOtp(newOtp);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace') {
                      e.preventDefault();
                      const otpArray = enteredOtp.split('');
                      if (otpArray[index]) otpArray[index] = '';
                      else if (index > 0)
                        document.getElementById(`otp-${index - 1}`).focus();
                      setEnteredOtp(otpArray.join(''));
                    }
                  }}
                  id={`otp-${index}`}
                  className="otp-box"
                />
              ))}
              {/* 💰 Show amount for driver reference */}
              <span>₹{activeShipment?.cost || '60'}</span>
            </div>
          </>
        )}






        {/* 2️⃣ After Pickup Verified → Swipe to Send Receiver OTP */}

        {/* 3️⃣ After Receiver OTP Sent → Show Receiver OTP Boxes + Deliver */}
        {showReceiverOtpSection && !receiverOtpVerified && !activeShipment?.isShopOrder && (
          <>
            <h3 className="otp-title">{t("enter_receiver_otp")}</h3>
            <div className="otp-input-container otp-with-amount">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  value={receiverOtp[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const otpArray = receiverOtp.split('');
                    otpArray[index] = val;
                    const newOtp = otpArray.join('');
                    setReceiverOtp(newOtp);

                    console.log(`➡️ Index: ${index}, Entered: ${val}`);
                    console.log("🔢 Current OTP:", newOtp);


                    if (val && index < 3) {
                      document.getElementById(`receiver-otp-${index + 1}`).focus();
                    }

                    // ✅ Use the fresh value so we don't read stale state
                    if (newOtp.length === 4 && newOtp.split('').every(Boolean)) {
                      verifyReceiverOtp(newOtp);
                    }
                  }}

                  onKeyDown={(e) => {
                    if (e.key === 'Backspace') {
                      e.preventDefault();
                      const otpArray = receiverOtp.split('');
                      if (otpArray[index]) otpArray[index] = '';
                      else if (index > 0)
                        document.getElementById(`receiver-otp-${index - 1}`).focus();
                      setReceiverOtp(otpArray.join(''));
                    }
                  }}
                  id={`receiver-otp-${index}`}
                  className="otp-box"
                />
              ))}
              <span className="amount">₹{activeShipment?.cost || '60'}</span>
            </div>
          </>
        )}

        <div className="route-address">
          <div className="route-point">
            {/* <div className="point-dot pickup"></div> */}
            <div className="point-info">
              <span className="point-label">{t("pickup")}</span>
              <div className="point-address">
                {activeShipment?.sender?.address?.addressLine1 || t("pickup_address_missing")}
              </div>
            </div>
          </div>

          {/* <div className="route-line"></div> */}

          <div className="route-point">
            {/* <div className="point-dot drop"></div> */}
            <div className="point-info">
              <span className="point-label">{t("drop_at")}</span>
              <div className="point-address">
                {activeShipment?.receiver?.address?.addressLine1 || t("drop_address_missing")}
              </div>
            </div>
          </div>
        </div>



        {/* 👥 Sender + Receiver Contacts */}
        <div className="contact-section">
          <div className="contact-card">
            <div>
              <div className="contact-name">
                {activeShipment?.sender?.name || 'Sender Name'}
              </div>
              <div className="contact-phone">
                {activeShipment?.sender?.phone || '+91 9876543210'}
              </div>

            </div>
            <FaPhone
              className="call-icons"
              onClick={() => handleCall(activeShipment?.sender?.phone)}
            />
          </div>

          <div className="contact-card">
            <div>
              <div className="contact-name">
                {activeShipment?.receiver?.name || 'Receiver Name'}
              </div>
              <div className="contact-phone">
                {activeShipment?.receiver?.phone || '+91 9123456780'}
              </div>
            </div>
            <FaPhone
              className="call-icons"
              onClick={() => handleCall(activeShipment?.receiver?.phone)}
            />
          </div>
          <div className="parcel-info">
            <img
              src={
                activeShipment?.parcel?.images?.length
                  ? `${API_BASE_URL}/api/shipment-images/image/${activeShipment.parcel.images[0]}`
                  : parcelImg
              }
              alt="Parcel"
              className="parcel-image"
            />
            <div className="parcel-description">
              {activeShipment?.parcel?.description || 'No description available'}
            </div>
          </div>

          {/* ✅ Swipe to Complete Delivery – Sticky Green Slider */}
          {receiverOtpVerified && (
            <div className="swipe-complete-container">
              <div
                className="swipe-track green"
                onMouseDown={(e) => handleSwipeStart(e, true)}
                onTouchStart={(e) => handleSwipeStart(e.touches[0], true)}
              >

                <span className="swipe-text">{t("swipe_mark_delivered")}</span>
                <div className="swipe-handle green-handle" ref={swipeDeliverRef}>
                  ➜
                </div>

              </div>
            </div>
          )}


          {/* 🚚 Dynamic bottom actions */}
          {!pickupVerified ? (
            // Before pickup verified → show Cancel button
            <button className="cancelll-button" onClick={() => setShowCancelPopup(true)}>
              {t("cancel")}
            </button>
          ) : (
            // After pickup verified → show Swipe Next button
            !receiverOtpSent && !activeShipment?.isShopOrder && (
              <>
                {/* ✅ New Swipe to Send Receiver OTP Slider */}
                <div className="swipe-container">
                  <div
                    className="swipe-track"
                    onMouseDown={(e) => handleSwipeStart(e)}
                    onTouchStart={(e) => handleSwipeStart(e.touches[0])}
                  >
                    <span className="swipe-text">
                      {isSendingReceiverOtp ? t("sending_otp") : t("swipe_receiver_otp")}

                    </span>
                    <div
                      className={`swipe-handle ${isUnlocked ? 'unlocked' : ''}`}
                      ref={swipeRef}
                    >
                      ➜
                    </div>
                    {/* 
                    <button className="cancelll-button" onClick={() => setShowCancelPopup(true)}>
                      Cancel
                    </button> */}


                  </div>
                </div>
              </>
            )
          )}

        </div>

        {/* ✅ Deliver Button (only visible after receiver OTP verified) */}
        {/* {receiverOtpVerified && (
          <button className="deliver-button" onClick={handleDeliverShipment}>
            Mark as Delivered
          </button>
        )} */}
      </div>
    </div>
  );
};

export default LocationTracker;
