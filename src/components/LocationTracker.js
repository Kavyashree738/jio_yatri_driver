import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaLocationArrow, FaMapMarkerAlt, FaExclamationTriangle, FaBatteryThreeQuarters } from 'react-icons/fa';

const LocationTracker = ({ updateInterval = 5000 }) => {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(null);
  
  const pollingRef = useRef(null);
  const watchIdRef = useRef(null);
  const retryCountRef = useRef(0);
  const googleMapsScriptRef = useRef(null);
  const mapsLoadedRef = useRef(false);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const headingLineRef = useRef(null);
  const prevCoordinatesRef = useRef(null);
  const zoomLevelRef = useRef(18);
  const lastPollTimeRef = useRef(0);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://jio-yatri-driver.onrender.com';

  // Format last updated time
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return 'Never';
    return lastUpdated.toLocaleTimeString();
  }, [lastUpdated]);

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
      mapsLoadedRef.current = true;
      return;
    }

    if (googleMapsScriptRef.current) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      mapsLoadedRef.current = true;
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

  // Initialize and update map
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
        mapTypeId: 'hybrid',
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: false
      });

      window.google.maps.event.addListener(mapInstanceRef.current, 'zoom_changed', () => {
        zoomLevelRef.current = mapInstanceRef.current.getZoom();
      });
    } else {
      const currentCenter = mapInstanceRef.current.getCenter();
      const currentLat = currentCenter.lat();
      const currentLng = currentCenter.lng();
      
      if (Math.abs(currentLat - lat) > 0.0001 || Math.abs(currentLng - lng) > 0.0001) {
        mapInstanceRef.current.panTo({ lat, lng });
      }
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
  }, []);

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

      const errorHandler = (error) => {
        let message;
        switch(error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied. Please enable permissions in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable. Try moving to an open area.";
            break;
          case error.TIMEOUT:
            if (retryCountRef.current < 2) {
              retryCountRef.current++;
              navigator.geolocation.getCurrentPosition(resolve, errorHandler, options);
              return;
            }
            message = "Location request timed out. Please try again.";
            break;
          default:
            message = "Unknown error occurred while getting location.";
        }
        reject(new Error(message));
      };

      retryCountRef.current = 0;
      navigator.geolocation.getCurrentPosition(resolve, errorHandler, options);
    });
  };

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

      setLocation([coords.longitude, coords.latitude]);
      setAccuracy(coords.accuracy);
      setHeading(coords.heading || null);
      setSpeed(coords.speed || null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    }
  };

  const startPolling = useCallback(() => {
    stopPolling();
    
    const fetchLocation = async () => {
      const now = Date.now();
      if (now - lastPollTimeRef.current < updateInterval) return;
      lastPollTimeRef.current = now;

      try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/driver/location`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const data = await response.json();
        if (data.success && data.data?.location?.coordinates) {
          const newCoords = data.data.location.coordinates;
          
          setLocation(prev => {
            if (!prev || prev[0] !== newCoords[0] || prev[1] !== newCoords[1]) {
              return newCoords;
            }
            return prev;
          });
          
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // Initial fetch
    fetchLocation();
    
    // Set up interval with strict timing
    pollingRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastPollTimeRef.current >= updateInterval) {
        fetchLocation();
      }
    }, 1000); // Check every second but only execute if interval passed
  }, [user, updateInterval, API_BASE_URL]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startWatchingPosition = () => {
    stopWatchingPosition();
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        if (!accuracy || coords.accuracy < accuracy * 1.2 || Date.now() - lastUpdated?.getTime() > 30000) {
          updateLocationToServer(coords);
        }
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

  const stopWatchingPosition = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

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
      
      stopPolling();
      stopWatchingPosition();
      setIsTracking(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const startTracking = async () => {
    try {
      if (batteryLevel !== null && batteryLevel < 20) {
        setError('Battery level too low for continuous tracking');
        return;
      }

      const pos = await getCurrentLocation();
      await updateLocationToServer(pos.coords);
      startWatchingPosition();
      startPolling();
      setIsTracking(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = (e) => {
    e.preventDefault();
    isTracking ? stopTracking() : startTracking();
  };

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
      stopPolling();
      stopWatchingPosition();
    };
  }, []);

  useEffect(() => {
    if (isTracking) {
      startPolling();
    }
    return () => {
      stopPolling();
    };
  }, [isTracking, startPolling]);

  // Update map when location changes
  useEffect(() => {
    if (location && accuracy && heading) {
      updateMap(location, accuracy, heading);
    }
  }, [location, accuracy, heading, updateMap]);

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
        
        {location && (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginTop: '15px'
          }}>
            <div className="data-card">
              <div className="data-label">Latitude</div>
              <div className="data-value">{location[1]?.toFixed(6)}</div>
            </div>
            
            <div className="data-card">
              <div className="data-label">Longitude</div>
              <div className="data-value">{location[0]?.toFixed(6)}</div>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationTracker;
