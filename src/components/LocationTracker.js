import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  const abortControllerRef = useRef(new AbortController());
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const headingLineRef = useRef(null);

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
  const getDistance = useCallback((lat1, lon1, lat2, lon2) => {
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
  }, []);

  const computeOffset = useCallback((lat, lng, distance, heading) => {
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
  }, []);

  // Optimized location update function
  const updateLocation = useCallback((newLocation, newAccuracy, newHeading, newSpeed) => {
    setLocation(prev => {
      if (!prev || getDistance(prev[1], prev[0], newLocation[1], newLocation[0]) > 5) {
        return newLocation;
      }
      return prev;
    });
    
    setAccuracy(prev => Math.abs(prev - newAccuracy) > 5 ? newAccuracy : prev);
    setHeading(newHeading);
    setSpeed(newSpeed);
    setLastUpdated(new Date());
  }, [getDistance]);

  const getCurrentLocation = useCallback(() => {
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
  }, []);

  const updateLocationToServer = useCallback(async (coords) => {
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
      updateLocation(
        [coords.longitude, coords.latitude],
        coords.accuracy,
        coords.heading || null,
        coords.speed || null
      );
      
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
  }, [user, batteryLevel, isTracking, updateLocation]);

  const fetchLocation = useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/driver/location`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      
      const data = await response.json();
      if (data.success && data.data?.location?.coordinates) {
        updateLocation(
          data.data.location.coordinates,
          data.data.location.accuracy || accuracy,
          data.data.location.heading || heading,
          data.data.location.speed || speed
        );
        setIsTracking(data.data.isLocationActive);
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
  }, [user, accuracy, heading, speed, updateLocation]);

  const startPolling = useCallback(() => {
    stopPolling();
    
    abortControllerRef.current = new AbortController();

    fetchLocation();
    pollingRef.current = setInterval(fetchLocation, updateInterval);

    return () => {
      abortControllerRef.current.abort();
    };
  }, [fetchLocation, updateInterval]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    abortControllerRef.current.abort();
  }, []);

  const startWatchingPosition = useCallback(() => {
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
  }, [accuracy, getDistance, updateLocationToServer]);

  const stopWatchingPosition = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const stopTracking = useCallback(async () => {
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
  }, [user, stopPolling, stopWatchingPosition]);

  const startTracking = useCallback(async () => {
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
  }, [batteryLevel, getCurrentLocation, updateLocationToServer, startWatchingPosition, startPolling]);

  const handleToggle = useCallback(async (e) => {
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
  }, [isTracking, startTracking, stopTracking]);

  const handleManualRefresh = useCallback(async () => {
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
  }, [isTracking, getCurrentLocation, updateLocationToServer]);

  // Initialize map and markers when maps are loaded and location is available
  useEffect(() => {
    if (!mapsLoaded || !location) return;

    const [lng, lat] = location;
    
    // Initialize map only once
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

    // Initialize marker only once
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
    }

    // Initialize accuracy circle only once
    if (accuracy && !accuracyCircleRef.current) {
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

    // Initialize heading line only once
    if (heading && !headingLineRef.current) {
      const endPoint = computeOffset(lat, lng, 20, heading);
      headingLineRef.current = new window.google.maps.Polyline({
        path: [
          { lat, lng },
          endPoint
        ],
        geodesic: true,
        strokeColor: '#EA4335',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: mapRef.current
      });
    }

    return () => {
      // Cleanup when component unmounts
      if (mapRef.current) {
        mapRef.current = null;
      }
    };
  }, [mapsLoaded, location, accuracy, heading, computeOffset]);

  // Update map elements when location changes
  useEffect(() => {
    if (!mapsLoaded || !location || !mapRef.current || !markerRef.current) return;

    const [lng, lat] = location;
    
    // Smooth marker transition
    if (prevLocationRef.current) {
      const [prevLng, prevLat] = prevLocationRef.current;
      const steps = 10;
      let step = 0;
      
      const animateMarker = () => {
        step++;
        const progress = step / steps;
        const newLat = prevLat + (lat - prevLat) * progress;
        const newLng = prevLng + (lng - prevLng) * progress;
        
        markerRef.current.setPosition({ lat: newLat, lng: newLng });
        markerRef.current.setIcon({
          ...markerRef.current.getIcon(),
          rotation: heading || 0
        });
        
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setCenter({ lat: newLat, lng: newLng });
        }
        
        if (headingLineRef.current && heading) {
          const endPoint = computeOffset(newLat, newLng, 20, heading);
          headingLineRef.current.setPath([
            { lat: newLat, lng: newLng },
            endPoint
          ]);
        }

        if (step < steps) {
          requestAnimationFrame(animateMarker);
        } else {
          mapRef.current.panTo({ lat, lng });
        }
      };
      
      requestAnimationFrame(animateMarker);
    } else {
      // Immediate update if no previous position
      markerRef.current.setPosition({ lat, lng });
      markerRef.current.setIcon({
        ...markerRef.current.getIcon(),
        rotation: heading || 0
      });
      
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setCenter({ lat, lng });
      }
      
      if (headingLineRef.current && heading) {
        const endPoint = computeOffset(lat, lng, 20, heading);
        headingLineRef.current.setPath([
          { lat, lng },
          endPoint
        ]);
      }
      
      mapRef.current.panTo({ lat, lng });
    }

    prevLocationRef.current = location;
  }, [location, accuracy, heading, mapsLoaded, computeOffset]);

  // Network status and battery level monitoring
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
              updateLocation(
                data.data.location.coordinates,
                data.data.location.accuracy || null,
                data.data.location.heading || null,
                data.data.location.speed || null
              );
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
  }, [user, updateLocation]);

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
            <div id="map" className="map-container" />
            
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
