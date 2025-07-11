import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { debounce } from 'lodash';
import '../styles/LocationTracker.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = 'https://jio-yatri-driver.onrender.com';

const useGeolocation = (options) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = {
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading
          }
        };
        setPosition(newPos);
        localStorage.setItem("lastKnownLocation", JSON.stringify([pos.coords.longitude, pos.coords.latitude]));
      },
      (err) => setError(err.message),
      options
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [options]);

  return { position, error };
};

const EtaDisplay = React.memo(({ etaToSender, etaToReceiver, distanceToSender, distanceToReceiver }) => (
  <div className="eta-display">
    {etaToSender && (
      <p><strong>To Sender:</strong> {distanceToSender} - ETA: {etaToSender}</p>
    )}
    {etaToReceiver && (
      <p><strong>To Receiver:</strong> {distanceToReceiver} - ETA: {etaToReceiver}</p>
    )}
  </div>
));

const ShipmentDetailsCard = ({ shipment }) => {
  if (!shipment) return null;
  return (
    <div className="shipment-details-card">
      <div className="shipment-header">
        <h3>Shipment #{shipment.trackingNumber}</h3>
        <span className={`status-badge ${shipment.status}`}>{shipment.status}</span>
      </div>
      <div className="shipment-body">
        <div className="address-section">
          <div className="address-card sender">
            <h4>Sender</h4>
            <p><strong>Name:</strong> {shipment.sender?.name}</p>
            <p><strong>Phone:</strong> {shipment.sender?.phone}</p>
            <p>{shipment.sender?.address?.addressLine1}</p>
          </div>
          <div className="address-card receiver">
            <h4>Receiver</h4>
            <p><strong>Name:</strong> {shipment.receiver?.name}</p>
            <p><strong>Phone:</strong> {shipment.receiver?.phone}</p>
            <p>{shipment.receiver?.address?.addressLine1}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const LocationTracker = ({ shipment, onStatusUpdate }) => {
  const { user } = useAuth();
  const { position: geoPosition } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });

  const [localShipment, setLocalShipment] = useState(() => {
    const saved = localStorage.getItem('lastShipment');
    return saved ? JSON.parse(saved) : null;
  });

  const [loadingMap, setLoadingMap] = useState(true);
  const activeShipment = shipment || localShipment;

  useEffect(() => {
    if (shipment) {
      localStorage.setItem("lastShipment", JSON.stringify(shipment));
      setLocalShipment(shipment);
    }
  }, [shipment]);

  useEffect(() => {
    if (
      !shipment &&
      localShipment &&
      ['cancelled', 'delivered'].includes(localShipment.status)
    ) {
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate(localShipment.status);
    }
  }, [shipment, localShipment, onStatusUpdate]);

  const location = useMemo(() => {
    if (geoPosition?.coords) {
      return [geoPosition.coords.longitude, geoPosition.coords.latitude];
    }
    const stored = localStorage.getItem('lastKnownLocation');
    return stored ? JSON.parse(stored) : null;
  }, [geoPosition]);

  const heading = geoPosition?.coords?.heading || 0;

  const [etaToSender, setEtaToSender] = useState('');
  const [distanceToSender, setDistanceToSender] = useState('');
  const [etaToReceiver, setEtaToReceiver] = useState('');
  const [distanceToReceiver, setDistanceToReceiver] = useState('');
  const [routeError, setRouteError] = useState(null);

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markerRef = useRef(null);
  const senderMarkerRef = useRef(null);
  const receiverMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const googleMapsScriptRef = useRef(null);

  const senderLatLng = useMemo(() => ({
    lat: activeShipment?.sender?.address?.coordinates?.lat,
    lng: activeShipment?.sender?.address?.coordinates?.lng,
  }), [activeShipment]);

  const receiverLatLng = useMemo(() => ({
    lat: activeShipment?.receiver?.address?.coordinates?.lat,
    lng: activeShipment?.receiver?.address?.coordinates?.lng,
  }), [activeShipment]);

  const initMap = useCallback(() => {
    if (!activeShipment || !mapContainerRef.current || mapRef.current) return;

    const center = location
      ? { lat: location[1], lng: location[0] }
      : { lat: 12.9716, lng: 77.5946 };

    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      zoom: 15,
      center,
      mapTypeId: 'roadmap'
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

  const updateMap = useCallback(() => {
    if (!mapRef.current || !location || !activeShipment || !window.google) return;

    const driverLatLng = { lat: location[1], lng: location[0] };

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: driverLatLng,
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          rotation: heading || 0,
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

    if (!senderMarkerRef.current) {
      senderMarkerRef.current = new window.google.maps.Marker({
        position: senderLatLng,
        map: mapRef.current,
        label: { text: 'S', color: '#FFFFFF' },
        icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
      });
    }

    if (!receiverMarkerRef.current) {
      receiverMarkerRef.current = new window.google.maps.Marker({
        position: receiverLatLng,
        map: mapRef.current,
        label: { text: 'R', color: '#FFFFFF' },
        icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      });
    }

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
          setRouteError(null);
          const legs = result.routes[0].legs;
          if (legs.length === 2) {
            setDistanceToSender(legs[0].distance.text);
            setEtaToSender(legs[0].duration.text);
            setDistanceToReceiver(legs[1].distance.text);
            setEtaToReceiver(legs[1].duration.text);
          }
        } else {
          setRouteError(`Route error: ${status}`);
        }
      }
    );
  }, [location, heading, activeShipment, senderLatLng, receiverLatLng]);

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
    }
  }, [activeShipment, initMap]);

  useEffect(() => {
    if (!loadingMap && location) {
      updateMap();
    }
  }, [location, loadingMap, updateMap]);

  const debouncedSendLocation = useCallback(
    debounce(async (coords) => {
      if (!coords || !user) return;

      try {
        const token = await user.getIdToken();

        await axios.put(`${API_BASE_URL}/api/driver/location`, {
          coordinates: coords,
          isLocationActive: true
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (activeShipment?._id) {
          await axios.put(
            `${API_BASE_URL}/api/shipments/${activeShipment._id}/driver-location`,
            {
              coordinates: coords,
              // status: 'in_transit'
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (err) {
        toast.error("Failed to update your location");
      }
    }, 5000),
    [user, activeShipment]
  );

  useEffect(() => {
    if (location && user) {
      debouncedSendLocation(location);
    }
  }, [location, user, debouncedSendLocation]);

  const handleRecenter = () => {
    if (mapRef.current && location) {
      mapRef.current.panTo({ lat: location[1], lng: location[0] });
    }
  };

  const handleCancelShipment = async () => {
    try {
      const token = await user.getIdToken();
      await axios.put(
        `${API_BASE_URL}/api/shipments/${activeShipment._id}/cancel`,
        { reason: "Driver cancelled the shipment" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate('cancelled');
      mapRef.current = null;
      toast.success("Shipment cancelled successfully");
      
      // Reload the page after 2 seconds to show updated shipments
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error cancelling shipment');
    }
  };

  const handleDeliverShipment = async () => {
    try {
      const token = await user.getIdToken();
      await axios.put(
        `${API_BASE_URL}/api/shipments/${activeShipment._id}/deliver`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);
      if (onStatusUpdate) onStatusUpdate('delivered');
      mapRef.current = null;
      toast.success("Shipment delivered successfully!");
      
      // Reload the page after 2 seconds to show updated shipments
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error delivering shipment');
    }
  };

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

      <div className="map-section">
        <div
          ref={mapContainerRef}
          className="map-container"
          style={{ height: '500px', width: '100%' }}
        />
        <button onClick={handleRecenter} className="recenter-button">📍</button>
      </div>

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
            window.scrollTo({ top: 0, behavior: "smooth" });
            handleCancelShipment();
          }}
          className="cancel-button"
        >
          Cancel Shipment
        </button>

        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
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
