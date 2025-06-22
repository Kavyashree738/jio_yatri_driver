import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { debounce } from 'lodash';
import '../styles/LocationTracker.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const calculateDistance = (coord1, coord2) => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371e3;
  const ϕ1 = lat1 * Math.PI / 180;
  const ϕ2 = lat2 * Math.PI / 180;
  const Δϕ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δϕ / 2) * Math.sin(Δϕ / 2) +
    Math.cos(ϕ1) * Math.cos(ϕ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

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

  useEffect(() => {
    if (shipment) {
      localStorage.setItem("lastShipment", JSON.stringify(shipment));
      setLocalShipment(shipment);
    }
  }, [shipment]);

  const activeShipment = shipment || localShipment;

  const location = useMemo(() => {
    if (geoPosition?.coords) {
      return [geoPosition.coords.longitude, geoPosition.coords.latitude];
    }
    const stored = localStorage.getItem('lastKnownLocation');
    return stored ? JSON.parse(stored) : null;
  }, [geoPosition]);

  const heading = geoPosition?.coords?.heading || 0;

  const [mapLoaded, setMapLoaded] = useState(false);
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

  const senderLatLng = {
    lat: activeShipment?.sender?.address?.coordinates?.lat,
    lng: activeShipment?.sender?.address?.coordinates?.lng,
  };

  const receiverLatLng = {
    lat: activeShipment?.receiver?.address?.coordinates?.lat,
    lng: activeShipment?.receiver?.address?.coordinates?.lng,
  };

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
    setMapLoaded(true);
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
          rotation: heading,
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
  }, [location, heading, activeShipment]);

  useEffect(() => {
    if (!activeShipment || ['cancelled', 'delivered'].includes(activeShipment.status)) {
      mapRef.current = null;
      localStorage.removeItem('lastShipment');
      return;
    }

    if (window.google && window.google.maps) {
      initMap();
    } else if (!googleMapsScriptRef.current) {
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
  }, [activeShipment, initMap]);

  useEffect(() => {
    if (mapLoaded && location) {
      updateMap();
    }
  }, [location, mapLoaded, updateMap]);

  const handleRecenter = () => {
    if (mapRef.current && location) {
      mapRef.current.panTo({ lat: location[1], lng: location[0] });
    }
  };

  // Updated handleCancelShipment and handleDeliverShipment functions
  const handleCancelShipment = async () => {
    try {
      const token = await user.getIdToken();
      await axios.put(
        `http://localhost:5000/api/shipments/${activeShipment._id}/cancel`,
        { reason: "Driver cancelled the shipment" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Clear local storage and state
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);

      if (onStatusUpdate) {
        onStatusUpdate('cancelled');
      }

      // Clean up map resources
      if (mapRef.current) {
        mapRef.current = null;
      }

      toast.success("Shipment cancelled successfully");
    } catch (error) {
      console.error('Error cancelling shipment:', error);
      toast.error(error.response?.data?.message || 'Error cancelling shipment');
    }
  };

  const handleDeliverShipment = async () => {
    try {
      const token = await user.getIdToken();
      await axios.put(
        `http://localhost:5000/api/shipments/${activeShipment._id}/deliver`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Clear local storage and state
      localStorage.removeItem('lastShipment');
      setLocalShipment(null);

      if (onStatusUpdate) {
        onStatusUpdate('delivered');
      }

      // Clean up map resources
      if (mapRef.current) {
        mapRef.current = null;
      }

      toast.success("Shipment delivered successfully!");
    } catch (error) {
      console.error('Error delivering shipment:', error);
      toast.error(error.response?.data?.message || 'Error delivering shipment');
    }
  };

  // Update the conditional rendering at the bottom
  if (!activeShipment ||
    (activeShipment.status && ['cancelled', 'delivered'].includes(activeShipment.status))) {
    return <p>No active shipment</p>;
  }

  return (
    <div className="location-tracker-container">
      <div
        ref={mapContainerRef}
        className="map-container"
        style={{ height: '500px', width: '100%' }}
      />
      <button
        onClick={handleRecenter}
        className="recenter-button"
        title="Recenter Map"
      >
        📍
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
          onClick={handleCancelShipment}
          className="cancel-button"
        >
          Cancel Shipment
        </button>
        <button
          onClick={handleDeliverShipment}
          className="deliver-button"
        >
          Mark as Delivered
        </button>
      </div>
    </div>
  );
};

export default LocationTracker;
