import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { debounce } from 'lodash';
import '../styles/LocationTracker.css'
const useGeolocation = (options) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPosition({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading
        }
      }),
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

const LocationTracker = ({ updateInterval = 5000, shipment }) => {
  const { user } = useAuth();
  const { position: geoPosition, error: geoError } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });

  const [routeError, setRouteError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [etaToSender, setEtaToSender] = useState('');
  const [distanceToSender, setDistanceToSender] = useState('');
  const [etaToReceiver, setEtaToReceiver] = useState('');
  const [distanceToReceiver, setDistanceToReceiver] = useState('');

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markerRef = useRef(null);
  const senderMarkerRef = useRef(null);
  const receiverMarkerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const initialCentered = useRef(false);
  const googleMapsScriptRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const senderCoords = shipment?.sender?.address?.coordinates || {};
  const receiverCoords = shipment?.receiver?.address?.coordinates || {};

  const senderLatLng = useMemo(() => ({ 
    lat: senderCoords.lat, 
    lng: senderCoords.lng 
  }), [senderCoords]);

  const receiverLatLng = useMemo(() => ({
    lat: receiverCoords.lat,
    lng: receiverCoords.lng
  }), [receiverCoords]);

  const location = geoPosition?.coords ? 
    [geoPosition.coords.longitude, geoPosition.coords.latitude] : null;
  const heading = geoPosition?.coords?.heading || null;

  const defaultMapOptions = useMemo(() => ({
    zoom: 15,
    mapTypeId: 'roadmap',
    streetViewControl: false,
    fullscreenControl: true,
    mapTypeControl: false,
  }), []);

  const cleanupMap = useCallback(() => {
    if (markerRef.current) markerRef.current.setMap(null);
    if (senderMarkerRef.current) senderMarkerRef.current.setMap(null);
    if (receiverMarkerRef.current) receiverMarkerRef.current.setMap(null);
    if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
    if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
    mapRef.current = null;
  }, []);

  const initMap = useCallback(() => {
    if (!shipment || !mapContainerRef.current || mapRef.current) return;

    const center = location
      ? { lat: location[1], lng: location[0] }
      : { lat: 12.9716, lng: 77.5946 };

    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      ...defaultMapOptions,
      center
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

    // Set up resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      window.google.maps.event.trigger(mapRef.current, 'resize');
    });
    resizeObserverRef.current.observe(mapContainerRef.current);

    setMapLoaded(true);
  }, [location, shipment, defaultMapOptions]);

  const updateMap = useCallback(
    (coords) => {
      if (!mapRef.current || !window.google || !coords || !mapLoaded || !shipment) return;

      const driverLatLng = { lat: coords[1], lng: coords[0] };

      if (!driverLatLng.lat || !senderLatLng.lat || !receiverLatLng.lat) return;

      // Update or create driver marker
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
        if (heading !== null) {
          markerRef.current.setIcon({
            ...markerRef.current.getIcon(),
            rotation: heading,
          });
        }
      }

      // Calculate route
      directionsServiceRef.current.route(
        {
          origin: driverLatLng,
          destination: receiverLatLng,
          waypoints: [{ location: senderLatLng, stopover: true }],
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
        },
        (result, status) => {
          if (status === 'OK') {
            directionsRendererRef.current.setDirections(result);
            setRouteError(null);

            // Update or create sender marker
            if (!senderMarkerRef.current) {
              senderMarkerRef.current = new window.google.maps.Marker({
                position: senderLatLng,
                map: mapRef.current,
                label: { text: 'S', color: '#FFFFFF' },
                icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
              });
            }

            // Update or create receiver marker
            if (!receiverMarkerRef.current) {
              receiverMarkerRef.current = new window.google.maps.Marker({
                position: receiverLatLng,
                map: mapRef.current,
                label: { text: 'R', color: '#FFFFFF' },
                icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              });
            }

            // Update ETA and distance information
            const legs = result.routes[0].legs;
            if (legs.length === 2) {
              setDistanceToSender(legs[0].distance.text);
              setEtaToSender(legs[0].duration.text);
              setDistanceToReceiver(legs[1].distance.text);
              setEtaToReceiver(legs[1].duration.text);
            } else if (legs.length === 1) {
              setDistanceToSender('');
              setEtaToSender('');
              setDistanceToReceiver(legs[0].distance.text);
              setEtaToReceiver(legs[0].duration.text);
            }
          } else {
            setRouteError(`Route error: ${status}`);
          }
        }
      );
    },
    [heading, senderLatLng, receiverLatLng, mapLoaded, shipment]
  );

  // Debounced version of updateMap
  const debouncedUpdateMap = useMemo(
    () => debounce(updateMap, 1000),
    [updateMap]
  );

  // Load Google Maps script and initialize map
  useEffect(() => {
    if (!shipment) {
      cleanupMap();
      return;
    }

    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    if (googleMapsScriptRef.current) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initMap();
      setMapLoaded(true);
    };
    script.onerror = () => setRouteError("Failed to load Google Maps script.");
    document.body.appendChild(script);
    googleMapsScriptRef.current = script;

    return () => {
      if (googleMapsScriptRef.current) {
        document.body.removeChild(googleMapsScriptRef.current);
        googleMapsScriptRef.current = null;
      }
      cleanupMap();
    };
  }, [initMap, cleanupMap, shipment]);

  // Update map when location changes
  useEffect(() => {
    if (location) {
      debouncedUpdateMap(location);
      
      if (!initialCentered.current && mapRef.current) {
        mapRef.current.setCenter({ lat: location[1], lng: location[0] });
        initialCentered.current = true;
      }
    }
  }, [location, debouncedUpdateMap]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setRouteError(null);
    const handleOffline = () => setRouteError("Connection lost - showing cached data");

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRecenter = () => {
    if (location && mapRef.current) {
      mapRef.current.panTo({ lat: location[1], lng: location[0] });
      mapRef.current.setZoom(15);
    }
  };

  if (!shipment) {
    return (
      <div className="no-shipment-map">
        <p>No active shipment selected</p>
      </div>
    );
  }

  return (
    <div className="location-tracker-container" style={{ position: 'relative' }}>
      <div
        ref={mapContainerRef}
        role="application"
        aria-label="Interactive map showing shipment route"
        style={{
          height: '500px',
          width: '100%',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        }}
      />
      
      <button
        onClick={handleRecenter}
        className="recenter-button"
        aria-label="Center map on current location"
        title="Center on my location"
      >
        📍
      </button>

      <EtaDisplay
        etaToSender={etaToSender}
        etaToReceiver={etaToReceiver}
        distanceToSender={distanceToSender}
        distanceToReceiver={distanceToReceiver}
      />

      {(routeError || geoError) && (
        <p className="error-message">
          {routeError || geoError}
        </p>
      )}
    </div>
  );
};

export default LocationTracker;
