import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import debounce from 'lodash/debounce';
import '../styles/LocationTracker.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'https://jio-yatri-driver.onrender.com';

/* ------------------------------- Helpers ------------------------------- */
// Convert any shape -> {lat, lng} or null
function normalizeToLatLng(input) {
  if (!input) return null;

  // A) already {lat,lng}
  if (Number.isFinite(input?.lat) && Number.isFinite(input?.lng)) {
    return { lat: Number(input.lat), lng: Number(input.lng) };
  }

  // B) {latitude, longitude}
  if (Number.isFinite(input?.latitude) && Number.isFinite(input?.longitude)) {
    return { lat: Number(input.latitude), lng: Number(input.longitude) };
  }

  // C) {coordinates:[lng,lat]} or nested {address:{coordinates:[lng,lat]}}
  const coords =
    (Array.isArray(input?.coordinates) && input.coordinates) ||
    (Array.isArray(input?.address?.coordinates) && input.address.coordinates);

  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // D) raw [lng,lat]
  if (Array.isArray(input) && input.length >= 2) {
    const lng = Number(input[0]);
    const lat = Number(input[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // E) fallback strings -> numbers
  const latNum = Number(input?.lat ?? input?.latitude);
  const lngNum = Number(input?.lng ?? input?.longitude);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
    return { lat: latNum, lng: lngNum };
  }

  return null;
}

function isValidLatLng(p) {
  return (
    p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

/* ---------------------------- Geolocation hook ---------------------------- */
const useGeolocation = (options) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
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
      },
      (err) => setError(err.message),
      options
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [options]);

  return { position, error };
};

/* --------------------------------- UI bits -------------------------------- */
const EtaDisplay = React.memo(
  ({ etaToSender, etaToReceiver, distanceToSender, distanceToReceiver }) => (
    <div className="eta-display">
      {etaToSender && (
        <p>
          <strong>To Sender:</strong> {distanceToSender} - ETA: {etaToSender}
        </p>
      )}
      {etaToReceiver && (
        <p>
          <strong>To Receiver:</strong> {distanceToReceiver} - ETA: {etaToReceiver}
        </p>
      )}
    </div>
  )
);

const ShipmentDetailsCard = ({ shipment }) => {
  if (!shipment) return null;
  return (
    <div className="shipment-details-card">
      <div className="shipment-header">
        <h3>Shipment #{shipment.trackingNumber}</h3>
        <span className={`status-badge ${shipment.status}`}>{shipment.status}</span>
      </div>
      <div className="shipment-body">
        <div className="address-sections">
          <div className="address-card sender">
            <h4>Sender</h4>
            <p>
              <strong>Name:</strong> {shipment.sender?.name}
            </p>
            <p>
              <strong>Phone:</strong> {shipment.sender?.phone}
            </p>
            <p>{shipment.sender?.address?.addressLine1}</p>
          </div>
          <div className="address-card receiver">
            <h4>Receiver</h4>
            <p>
              <strong>Name:</strong> {shipment.receiver?.name}
            </p>
            <p>
              <strong>Phone:</strong> {shipment.receiver?.phone}
            </p>
            <p>{shipment.receiver?.address?.addressLine1}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------- Main Component ---------------------------- */
const LocationTracker = ({ shipment, onStatusUpdate }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { position: geoPosition } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });

  const [localShipment, setLocalShipment] = useState(() => {
    const saved = localStorage.getItem('lastShipment');
    return saved ? JSON.parse(saved) : null;
  });
  const activeShipment = shipment || localShipment;

  const [loadingMap, setLoadingMap] = useState(true);

  /* ------------------------------ Persist state ------------------------------ */
  useEffect(() => {
    if (shipment) {
      localStorage.setItem('lastShipment', JSON.stringify(shipment));
      setLocalShipment(shipment);
    }
  }, [shipment]);

  useEffect(() => {
  if (shipment && ['cancelled', 'delivered'].includes(shipment.status)) {
    localStorage.removeItem('lastShipment');
    setLocalShipment(null);
    if (onStatusUpdate) onStatusUpdate(shipment.status);
  }
}, [shipment, onStatusUpdate]);


  /* ------------------------------ Driver point ------------------------------ */
  const location = useMemo(() => {
    if (geoPosition?.coords) {
      return [
        Number(geoPosition.coords.longitude),
        Number(geoPosition.coords.latitude),
      ];
    }
    const stored = localStorage.getItem('lastKnownLocation');
    if (!stored) return null;
    try {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr) && arr.length >= 2) {
        const lng = Number(arr[0]);
        const lat = Number(arr[1]);
        return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
      }
    } catch {}
    return null;
  }, [geoPosition]);

  const heading = Number.isFinite(geoPosition?.coords?.heading)
    ? geoPosition.coords.heading
    : 0;

  /* ----------------------------- Sender/Receiver ---------------------------- */
  // Debug raw shapes from backend
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

  /* ------------------------------ Fullscreen nav ----------------------------- */
  const handleViewFullMap = () => {
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
    if (!activeShipment || !mapContainerRef.current || mapRef.current) return;

    const cObj = normalizeToLatLng(location);
    const center = isValidLatLng(cObj) ? cObj : { lat: 12.9716, lng: 77.5946 };

    // console.log('[MAP] init center', center);

    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      zoom: 15,
      center,
      mapTypeId: 'roadmap',
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
  }, [location, activeShipment]);

  /* -------------------------------- Map update ------------------------------- */
  const [etaToSender, setEtaToSender] = useState('');
  const [distanceToSender, setDistanceToSender] = useState('');
  const [etaToReceiver, setEtaToReceiver] = useState('');
  const [distanceToReceiver, setDistanceToReceiver] = useState('');
  const [routeError, setRouteError] = useState(null);

const updateMap = useCallback(() => {
  if (!mapRef.current || !activeShipment || !window.google) return;

  const driverLatLng = normalizeToLatLng(location);

  if (!isValidLatLng(driverLatLng)) return;
  if (!isValidLatLng(senderLatLng) || !isValidLatLng(receiverLatLng)) return;

  // DRIVER marker update
  if (!markerRef.current) {
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
    markerRef.current.setPosition(driverLatLng);
  }

  // Sender + Receiver markers (only create once)
  if (!senderMarkerRef.current) {
    senderMarkerRef.current = new window.google.maps.Marker({
      position: senderLatLng,
      map: mapRef.current,
      icon: { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' },
      label: { text: 'S', color: '#ffffff', fontWeight: '700' },
      title: 'Sender',
    });
  }
  if (!receiverMarkerRef.current) {
    receiverMarkerRef.current = new window.google.maps.Marker({
      position: receiverLatLng,
      map: mapRef.current,
      icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
      label: { text: 'R', color: '#ffffff', fontWeight: '700' },
      title: 'Receiver',
    });
  }

  // Route update
  directionsServiceRef.current.route(
    {
      origin: driverLatLng,
      destination: receiverLatLng,
      waypoints: [{ location: senderLatLng, stopover: true }],
      travelMode: window.google.maps.TravelMode.DRIVING,
    },
    (result, status) => {
      if (status === 'OK') {
        directionsRendererRef.current.setDirections(result);
      }
    }
  );
}, [location, heading, activeShipment, senderLatLng, receiverLatLng]);


  /* --------------------------- Load Maps JS once --------------------------- */
  useEffect(() => {
    if (!activeShipment) {
      mapRef.current = null;
      return;
    }

    if (window.google && window.google.maps) {
      initMap();
    } else if (!googleMapsScriptRef.current) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => initMap();
      document.body.appendChild(script);
      googleMapsScriptRef.current = script;
      // console.log('[MAP] Google Maps script injected');
    }
  }, [activeShipment, initMap]);

  useEffect(() => {
    if (!loadingMap && location) {
      // console.log('[MAP] update requested');
      updateMap();
    }
  }, [location, loadingMap, updateMap]);

  /* ------------------------ Send driver location (API) ------------------------ */
 useEffect(() => {
  if (!user || !activeShipment?._id) return;

  const interval = setInterval(async () => {
    if (!location) return; // location = [lng, lat]

    try {
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

      console.log("✅ Driver location updated:", location);
    } catch (err) {
      console.error("❌ Failed to update driver location:", err);
    }
  }, 5000); // send every 5 seconds no matter what

  return () => clearInterval(interval);
}, [user, activeShipment, location]);

  /* ------------------------------ UI Handlers ------------------------------ */
  const handleRecenter = () => {
    const p = normalizeToLatLng(location);
    if (mapRef.current && isValidLatLng(p)) {
      mapRef.current.panTo(p);
      // console.log('[MAP] recenter to', p);
    }
  };

  const handleCancelShipment = async () => {
    try {
      const token = await user.getIdToken();
      // console.log('[API] cancel shipment', activeShipment?._id);
      await axios.put(
        `${API_BASE_URL}/api/shipments/${activeShipment._id}/cancel`,
        { reason: 'Driver cancelled the shipment' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate('cancelled');
      mapRef.current = null;
      toast.success('Shipment cancelled successfully');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      // console.error('[API] cancel failed', error);
      toast.error(error.response?.data?.message || 'Error cancelling shipment');
    }
  };

  const handleDeliverShipment = async () => {
    try {
      const token = await user.getIdToken();
      // console.log('[API] deliver shipment', activeShipment?._id);
      await axios.put(
        `${API_BASE_URL}/api/shipments/${activeShipment._id}/deliver`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate('delivered');
      mapRef.current = null;
      toast.success('Shipment delivered successfully!');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      // console.error('[API] deliver failed', error);
      toast.error(error.response?.data?.message || 'Error delivering shipment');
    }
  };

  /* --------------------------------- Render --------------------------------- */
  if (!activeShipment || ['cancelled', 'delivered'].includes(activeShipment.status)) {
    return (
      <div className="no-shipment">
        {activeShipment ? `Shipment ${activeShipment.status}` : 'No active shipment'}
      </div>
    );
  }

  return (
    <div className="location-tracker-container">
      <ShipmentDetailsCard shipment={activeShipment} />

      <div className="map-sections">
        <div
          ref={mapContainerRef}
          className="map-container"
          style={{ height: '500px', width: '100%' }}
        />
        <button onClick={handleRecenter} className="recenter-button">
          📍
        </button>
      </div>

      <button onClick={handleViewFullMap} className="fullscreen-button" aria-label="View full screen map">
        <span className="button-icon">🗺️</span> View Full Map
      </button>

      <EtaDisplay
        etaToSender={etaToSender}
        etaToReceiver={etaToReceiver}
        distanceToSender={distanceToSender}
        distanceToReceiver={distanceToReceiver}
      />
      {routeError && <p className="error-message">{routeError}</p>}

      <div className="shipment-actions">
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            handleCancelShipment();
          }}
          className="cancel-buttons"
        >
          Cancel Shipment
        </button>

        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            handleDeliverShipment();
          }}
          className="deliver-button"
        >
          Mark as Delivered
        </button>
      </div>
    </div>
  );
};

export default LocationTracker;
