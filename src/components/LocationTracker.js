import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaLocationArrow, FaMapMarkerAlt, FaExclamationTriangle, FaSync, FaInfoCircle, FaBatteryThreeQuarters } from 'react-icons/fa';
import '../styles/LocationTracker.css';

const LocationTracker = ({ updateInterval = 10000 }) => {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const pollingRef = useRef(null);
  const watchIdRef = useRef(null);
  const retryCountRef = useRef(0);
  const prevLocationRef = useRef(null);

  const API_BASE_URL = 'https://jio-yatri-driver.onrender.com';

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => {
      console.error('Google Maps failed to load');
      setError('Failed to load maps. Please refresh the page.');
    };
    
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Format last updated time
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return 'Never';
    return lastUpdated.toLocaleTimeString();
  }, [lastUpdated]);

  // Calculate distance between coordinates
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // LiveMap component
  const LiveMap = ({ coordinates }) => {
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const accuracyCircleRef = useRef(null);
    const headingLineRef = useRef(null);

    const computeOffset = (lat, lng, distance, heading) => {
      const R = 6378137; // Earth's radius in meters
      const delta = distance / R;
      const theta = heading * Math.PI / 180;
      
      const phi1 = lat * Math.PI / 180;
      const lambda1 = lng * Math.PI / 180;
      
      const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + 
                 Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
      const lambda2 = lambda1 + Math.atan2(
        Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
        Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
      );
      
      return {
        lat: phi2 * 180 / Math.PI,
        lng: lambda2 * 180 / Math.PI
      };
    };

    useEffect(() => {
      if (!coordinates || !mapsLoaded || !window.google?.maps) return;

      const [lng, lat] = coordinates;
      
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(document.getElementById('map'), {
          center: { lat, lng },
          zoom: 18,
          mapTypeId: 'hybrid',
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: false
        });
      }

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
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
          map: mapRef.current,
          center: { lat, lng },
          radius: accuracy
        });
      }

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
          map: mapRef.current
        });
        headingLineRef.current = headingLine;
      }

      mapRef.current.panTo({ lat, lng });

      return () => {
        if (accuracyCircleRef.current) accuracyCircleRef.current.setMap(null);
        if (headingLineRef.current) headingLineRef.current.setMap(null);
      };
    }, [coordinates, accuracy, heading, mapsLoaded]);

    return (
      <div id="map" className="map-container">
        {!mapsLoaded && (
          <div className="map-placeholder">
            Loading map...
          </div>
        )}
      </div>
    );
  };

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
      setIsLoading(true);
      setError(null);
      
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Update failed`);
      }

      const data = await response.json();
      setLocation([coords.longitude, coords.latitude]);
      setAccuracy(coords.accuracy);
      setHeading(coords.heading || null);
      setSpeed(coords.speed || null);
      setLastUpdated(new Date());
      
      if (!isTracking) setIsTracking(true);
      
    } catch (err) {
      const userMessage = err.message.includes('Failed to fetch') 
        ? 'Network error - Please check your internet connection'
        : err.message;
      setError(userMessage);
      console.error('Location update failed:', err);
      setIsTracking(false);
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const startPolling = () => {
    stopPolling();
    
    const abortController = new AbortController();

    const fetchLocation = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/driver/location`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          signal: abortController.signal
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const data = await response.json();
        if (data.success && data.data?.location?.coordinates) {
          setLocation(data.data.location.coordinates);
          setIsTracking(data.data.isLocationActive);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Polling error:', err);
          if (err.message.includes('404')) {
            setError('Endpoint not found');
            stopPolling();
          }
        }
      }
    };

    fetchLocation();
    pollingRef.current = setInterval(fetchLocation, updateInterval);

    return () => {
      abortController.abort();
    };
  };

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
        const newLocation = [coords.longitude, coords.latitude];
        
        if (!prevLocationRef.current || 
            getDistance(prevLocationRef.current[1], prevLocationRef.current[0], coords.latitude, coords.longitude) > 10 ||
            coords.accuracy < (accuracy || Infinity)) {
          updateLocationToServer(coords);
          prevLocationRef.current = newLocation;
        }
      },
      (error) => {
        console.error('Watch position error:', error);
        setError(`Tracking error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
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
      prevLocationRef.current = null;
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
    } catch (err) {
      setError(err.message);
      setIsTracking(false);
    }
  };

  const handleToggle = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isTracking) {
        await stopTracking();
      } else {
        await startTracking();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const handleManualRefresh = async () => {
    if (isTracking) {
      try {
        setIsLoading(true);
        const pos = await getCurrentLocation();
        await updateLocationToServer(pos.coords);
      } catch (err) {
        setError(err.message);
      } finally {
        setTimeout(() => setIsLoading(false), 500);
      }
    }
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
          setBatteryLevel(null);
        }
      } else {
        setBatteryLevel(null);
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
    
    const initializeTracking = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/driver/location`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setIsTracking(data.data.isLocationActive);
            if (data.data.location?.coordinates) {
              setLocation(data.data.location.coordinates);
              setAccuracy(data.data.location.accuracy || null);
              setLastUpdated(new Date(data.data.location.timestamp));
            }
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    initializeTracking();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopPolling();
      stopWatchingPosition();
    };
  }, [user]);

  return (
    <div className="location-tracker">
      <div className="tracker-header">
        <div className="header-content">
          <div className="location-status">
            <FaMapMarkerAlt className={`status-icon ${isTracking ? 'active' : ''}`} />
            <div>
              <h3 className="status-text">{isTracking ? 'Live Tracking Active' : 'Location Offline'}</h3>
              <div className="status-meta">
                <span>Last updated: {formattedLastUpdated}</span>
                <span>Accuracy: {accuracy ? `${Math.round(accuracy)}m` : 'Unknown'}</span>
                {batteryLevel !== null && <span>Battery: {batteryLevel}%</span>}
              </div>
            </div>
          </div>
          
          <div className="button-group">
            {isTracking && (
              <button 
                onClick={handleManualRefresh}
                className={`btn btn-success ${isLoading || !isOnline ? 'disabled' : ''}`}
                disabled={isLoading || !isOnline}
                aria-label="Refresh location"
                aria-busy={isLoading}
              >
                {isLoading ? <FaSync className="loading-spinner" /> : <FaSync />} Refresh
              </button>
            )}
            
            <button
              onClick={handleToggle}
              disabled={isLoading || !isOnline}
              className={`btn ${isTracking ? 'btn-danger' : 'btn-primary'} ${!isOnline ? 'disabled' : ''}`}
              aria-label={isTracking ? 'Stop sharing location' : 'Start sharing location'}
              aria-busy={isLoading}
            >
              <FaLocationArrow />
              {isLoading ? 'Processing...' : isTracking ? 'Stop Sharing' : 'Share Location'}
            </button>
          </div>
        </div>
      </div>

      {!isOnline && (
        <div className="alert alert-error">
          <FaExclamationTriangle className="alert-icon" />
          <span>Offline - Updates will resume when connection is restored</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <FaExclamationTriangle className="alert-icon" />
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="alert-dismiss"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {batteryLevel !== null && batteryLevel < 30 && (
        <div className="alert alert-warning">
          <FaBatteryThreeQuarters className="alert-icon" />
          <span>Low battery - Location updates may be less frequent</span>
        </div>
      )}

      <div>
        {location ? (
          <div>
            <LiveMap coordinates={location} />
            
            <div className="location-info-grid">
              <div className="info-card">
                <div className="info-label">Latitude</div>
                <div className="info-value accent">{location[1]?.toFixed(6)}</div>
              </div>
              
              <div className="info-card">
                <div className="info-label">Longitude</div>
                <div className="info-value accent">{location[0]?.toFixed(6)}</div>
              </div>
              
              <div className="info-card">
                <div className="info-label">Accuracy</div>
                <div className={`info-value ${accuracy > 50 ? 'warning' : 'success'}`}>
                  ~{Math.round(accuracy)} meters
                </div>
              </div>
              
              {heading && (
                <div className="info-card">
                  <div className="info-label">Heading</div>
                  <div className="info-value">{Math.round(heading)}°</div>
                </div>
              )}
              
              {speed && (
                <div className="info-card">
                  <div className="info-label">Speed</div>
                  <div className="info-value">{Math.round(speed * 3.6)} km/h</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="map-placeholder">
            {isTracking ? 'Acquiring precise location...' : 'Enable tracking to view location'}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationTracker;
