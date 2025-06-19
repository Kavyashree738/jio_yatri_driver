import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaLocationArrow, FaMapMarkerAlt, FaExclamationTriangle, FaBatteryThreeQuarters } from 'react-icons/fa';

const LocationTracker = ({ shipment }) => {
  const { user } = useAuth();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [route, setRoute] = useState(null);
  const [currentDestination, setCurrentDestination] = useState('sender');
  
  const pollingRef = useRef(null);
  const watchIdRef = useRef(null);
  const googleMapsScriptRef = useRef(null);
  const mapsLoadedRef = useRef(false);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const headingLineRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const prevCoordinatesRef = useRef(null);
  const zoomLevelRef = useRef(14);
  const lastPollTimeRef = useRef(0);

  const API_BASE_URL = 'https://jio-yatri-driver.onrender.com';

  // Format last updated time
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return 'Never';
    return lastUpdated.toLocaleTimeString();
  }, [lastUpdated]);

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
      mapsLoadedRef.current = true;
      initializeRoute();
      return;
    }

    if (googleMapsScriptRef.current) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_API_KEY}&libraries=places,directions`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      mapsLoadedRef.current = true;
      initializeRoute();
    };

    googleMapsScriptRef.current = script;
    document.body.appendChild(script);

    return () => {
      if (googleMapsScriptRef.current) {
        document.body.removeChild(googleMapsScriptRef.current);
        googleMapsScriptRef.current = null;
      }
    };
  }, []);

  // Initialize route when shipment changes
  const initializeRoute = useCallback(() => {
    if (!shipment || !mapsLoadedRef.current) return;
    
    const senderCoords = {
      lat: shipment.sender.address.coordinates.lat,
      lng: shipment.sender.address.coordinates.lng
    };
    
    const receiverCoords = {
      lat: shipment.receiver.address.coordinates.lat,
      lng: shipment.receiver.address.coordinates.lng
    };
    
    setRoute({
      sender: senderCoords,
      receiver: receiverCoords,
      currentDestination: 'sender'
    });
    
    if (currentLocation) {
      updateRoute(currentLocation, senderCoords);
    }
  }, [shipment, currentLocation]);

  // Update route on map
  const updateRoute = (origin, destination) => {
    if (!mapsLoadedRef.current || !window.google || !mapInstanceRef.current) return;
    
    const directionsService = new window.google.maps.DirectionsService();
    
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }
    
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 6
      }
    });
    
    directionsService.route(
      {
        origin: new window.google.maps.LatLng(origin[1], origin[0]),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (response, status) => {
        if (status === 'OK') {
          directionsRendererRef.current.setDirections(response);
          
          // Adjust viewport to show the entire route
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(new window.google.maps.LatLng(origin[1], origin[0]));
          bounds.extend(new window.google.maps.LatLng(destination.lat, destination.lng));
          mapInstanceRef.current.fitBounds(bounds);
        } else {
          console.error('Directions request failed:', status);
        }
      }
    );
  };

  // Update map with current location
  const updateMap = useCallback((coordinates, accuracy, heading) => {
    if (!mapsLoadedRef.current || !coordinates || !window.google) return;

    const [lng, lat] = coordinates;
    
    // Skip update if coordinates haven't changed
    if (prevCoordinatesRef.current && 
        prevCoordinatesRef.current[0] === lng && 
        prevCoordinatesRef.current[1] === lat) {
      return;
    }

    prevCoordinatesRef.current = coordinates;

    // Initialize map if not exists
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(document.getElementById('map-container'), {
        center: { lat, lng },
        zoom: zoomLevelRef.current,
        mapTypeId: 'roadmap',
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: false
      });

      window.google.maps.event.addListener(mapInstanceRef.current, 'zoom_changed', () => {
        zoomLevelRef.current = mapInstanceRef.current.getZoom();
      });
    }

    // Update marker
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          rotation: heading || 0,
          fillColor: '#EA4335',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF'
        }
      });
    } else {
      markerRef.current.setPosition({ lat, lng });
      markerRef.current.setIcon({
        ...markerRef.current.getIcon(),
        rotation: heading || 0
      });
    }

    // Update accuracy circle
    if (accuracy) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setMap(null);
      }
      
      accuracyCircleRef.current = new window.google.maps.Circle({
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#4285F4',
        fillOpacity: 0.2,
        map: mapInstanceRef.current,
        center: { lat, lng },
        radius: accuracy
      });
    }

    // Update heading line
    if (heading) {
      if (headingLineRef.current) {
        headingLineRef.current.setMap(null);
      }
      
      const headingLine = new window.google.maps.Polyline({
        path: [
          { lat, lng },
          computeOffset(lat, lng, 20, heading)
        ],
        geodesic: true,
        strokeColor: '#EA4335',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: mapInstanceRef.current
      });
      headingLineRef.current = headingLine;
    }

    // Update route if we have a destination
    if (route && currentDestination) {
      const destination = currentDestination === 'sender' ? route.sender : route.receiver;
      updateRoute(coordinates, destination);
    }
  }, [route, currentDestination]);

  // Helper function to compute offset for heading line
  function computeOffset(lat, lng, distance, heading) {
    const R = 6378137;
    const δ = distance / R;
    const θ = heading * Math.PI / 180;
    
    const φ1 = lat * Math.PI / 180;
    const λ1 = lng * Math.PI / 180;
    
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + 
             Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
                       Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    
    return {
      lat: φ2 * 180 / Math.PI,
      lng: λ2 * 180 / Math.PI
    };
  }

  // Get current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by your browser'));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  // Update location to server
  const updateLocationToServer = async (coords) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/driver/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coordinates: [coords.longitude, coords.latitude],
          accuracy: coords.accuracy,
          heading: coords.heading,
          speed: coords.speed,
          altitude: coords.altitude,
          batteryLevel,
          isLocationActive: true,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Update failed`);
      }

      const newLocation = [coords.longitude, coords.latitude];
      setCurrentLocation(newLocation);
      setAccuracy(coords.accuracy);
      setHeading(coords.heading || null);
      setSpeed(coords.speed || null);
      setLastUpdated(new Date());

      // Check if we've reached the current destination
      checkDestinationProximity(newLocation);
    } catch (err) {
      setError(err.message);
    }
  };

  // Check if we're close to the current destination
  const checkDestinationProximity = (currentCoords) => {
    if (!route || !currentDestination) return;
    
    const destination = currentDestination === 'sender' ? route.sender : route.receiver;
    const distance = calculateDistance(
      currentCoords[1], 
      currentCoords[0], 
      destination.lat, 
      destination.lng
    );
    
    // If within 100 meters of destination
    if (distance < 100) {
      if (currentDestination === 'sender') {
        setCurrentDestination('receiver');
      } else {
        // Reached final destination
        setCurrentDestination(null);
      }
    }
  };

  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Start watching position
  const startWatchingPosition = () => {
    stopWatchingPosition();
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        updateLocationToServer(coords);
      },
      (error) => {
        console.error('Watch position error:', error);
        setError(`Tracking error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 30000
      }
    );
  };

  // Stop watching position
  const stopWatchingPosition = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Start tracking
  const startTracking = async () => {
    try {
      if (batteryLevel !== null && batteryLevel < 20) {
        setError('Battery level too low for continuous tracking');
        return;
      }

      const pos = await getCurrentLocation();
      await updateLocationToServer(pos.coords);
      startWatchingPosition();
      setIsTracking(true);
    } catch (err) {
      setError(err.message);
    }
  };

  // Stop tracking
  const stopTracking = async () => {
    try {
      const token = await user.getIdToken();
      await fetch(`${API_BASE_URL}/api/driver/location`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isLocationActive: false })
      });
      
      stopWatchingPosition();
      setIsTracking(false);
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle tracking
  const handleToggle = (e) => {
    e.preventDefault();
    isTracking ? stopTracking() : startTracking();
  };

  // Initialize battery status and online status
  useEffect(() => {
    const getBatteryStatus = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
          
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        } catch (err) {
          console.error('Battery API error:', err);
        }
      }
    };
    
    getBatteryStatus();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setError('No internet connection');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopWatchingPosition();
    };
  }, []);

  // Initialize route when shipment changes
  useEffect(() => {
    if (shipment && mapsLoadedRef.current) {
      initializeRoute();
    }
  }, [shipment, initializeRoute]);

  // Update map when location or route changes
  useEffect(() => {
    if (currentLocation && accuracy && heading) {
      updateMap(currentLocation, accuracy, heading);
    }
  }, [currentLocation, accuracy, heading, updateMap]);

  return (
    <div className="location-tracker" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FaMapMarkerAlt 
            style={{ 
              color: isTracking ? '#00C853' : '#757575', 
              marginRight: '12px',
              fontSize: '24px'
            }} 
          />
          <div>
            <h3 style={{ margin: 0 }}>{isTracking ? 'Live Tracking Active' : 'Location Offline'}</h3>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              Last updated: {formattedLastUpdated} | 
              Accuracy: {accuracy ? `${Math.round(accuracy)}m` : 'Unknown'} | 
              {batteryLevel && ` Battery: ${batteryLevel}%`}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={!isOnline}
          style={{
            backgroundColor: isTracking ? '#ff4444' : '#4285F4',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: !isOnline ? 0.6 : 1,
            minWidth: '140px'
          }}
        >
          <FaLocationArrow />
          {isTracking ? 'Stop Sharing' : 'Share Location'}
        </button>
      </div>

      {!isOnline && (
        <div className="status-alert offline">
          <FaExclamationTriangle />
          <span>Offline - Updates will resume when connection is restored</span>
        </div>
      )}

      {error && (
        <div className="status-alert error">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {batteryLevel !== null && batteryLevel < 30 && (
        <div className="status-alert warning">
          <FaBatteryThreeQuarters />
          <span>Low battery - Location updates may be less frequent</span>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <div 
          id="map-container"
          style={{ 
            width: '100%', 
            height: '350px',
            borderRadius: '8px',
            marginTop: '10px',
            border: '1px solid #ddd'
          }} 
        />
        
        {currentLocation && (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginTop: '15px'
          }}>
            <div className="data-card">
              <div className="data-label">Latitude</div>
              <div className="data-value">{currentLocation[1]?.toFixed(6)}</div>
            </div>
            
            <div className="data-card">
              <div className="data-label">Longitude</div>
              <div className="data-value">{currentLocation[0]?.toFixed(6)}</div>
            </div>
            
            <div className="data-card">
              <div className="data-label">Accuracy</div>
              <div className="data-value" style={{ 
                color: accuracy > 50 ? 'orange' : 'green',
                fontWeight: 'bold'
              }}>
                ~{Math.round(accuracy)} meters
              </div>
            </div>
            
            {heading && (
              <div className="data-card">
                <div className="data-label">Heading</div>
                <div className="data-value">{Math.round(heading)}°</div>
              </div>
            )}
            
            {speed && (
              <div className="data-card">
                <div className="data-label">Speed</div>
                <div className="data-value">{Math.round(speed * 3.6)} km/h</div>
              </div>
            )}
            
            {currentDestination && (
              <div className="data-card">
                <div className="data-label">Destination</div>
                <div className="data-value">
                  {currentDestination === 'sender' ? 'Pickup Location' : 'Delivery Location'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationTracker;
