import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaLocationArrow, FaMapMarkerAlt, FaExclamationTriangle, FaSync, FaInfoCircle, FaBatteryThreeQuarters } from 'react-icons/fa';

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

  const API_BASE_URL ='https://jio-yatri-driver.onrender.com';

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
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 18,
        mapTypeId: 'hybrid',
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: false
      });

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map,
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
          map,
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
          map
        });
        headingLineRef.current = headingLine;
      }

      map.panTo({ lat, lng });

      return () => {
        if (markerRef.current) markerRef.current.setMap(null);
        if (accuracyCircleRef.current) accuracyCircleRef.current.setMap(null);
        if (headingLineRef.current) headingLineRef.current.setMap(null);
      };
    }, [coordinates, accuracy, heading, mapsLoaded]);

    return (
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '350px',
          borderRadius: '8px',
          marginTop: '10px',
          border: '1px solid #ddd'
        }}
      >
        {!mapsLoaded && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            backgroundColor: '#f5f5f5',
            color: '#666'
          }}>
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
      setError(err.message);
      console.error('Location update failed:', err);
      setIsTracking(false);
    } finally {
      setIsLoading(false);
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
    } catch (err) {
      setError(err.message);
      setIsTracking(false);
    }
  };

  const handleToggle = (e) => {
    e.preventDefault();
    isTracking ? stopTracking() : startTracking();
  };

  const handleManualRefresh = async () => {
    if (isTracking) {
      try {
        const pos = await getCurrentLocation();
        await updateLocationToServer(pos.coords);
      } catch (err) {
        setError(err.message);
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
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {isTracking && (
            <button 
              onClick={handleManualRefresh}
              style={{
                backgroundColor: '#34A853',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              disabled={isLoading || !isOnline}
            >
              <FaSync /> Refresh
            </button>
          )}
          
          <button
            onClick={handleToggle}
            disabled={isLoading || !isOnline}
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
              opacity: !isOnline ? 0.6 : 1
            }}
          >
            <FaLocationArrow />
            {isLoading ? 'Processing...' : isTracking ? 'Stop Sharing' : 'Share Location'}
          </button>
        </div>
      </div>

      {!isOnline && (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          padding: '10px 15px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <FaExclamationTriangle style={{ marginRight: '10px' }} />
          <span>Offline - Updates will resume when connection is restored</span>
        </div>
      )}

      {error && (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 15px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <FaExclamationTriangle style={{ marginRight: '10px' }} />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#c62828',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {batteryLevel !== null && batteryLevel < 30 && (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          padding: '10px 15px',
          backgroundColor: '#fff8e1',
          color: '#e65100',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <FaBatteryThreeQuarters style={{ marginRight: '10px' }} />
          <span>Low battery - Location updates may be less frequent</span>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {location ? (
          <div>
            <LiveMap coordinates={location} />
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginTop: '15px'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ 
                  fontSize: '0.8rem',
                  color: '#666',
                  marginBottom: '5px'
                }}>Latitude</div>
                <div style={{ 
                  fontSize: '1.2rem',
                  fontWeight: '500'
                }}>{location[1]?.toFixed(6)}</div>
              </div>
              
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ 
                  fontSize: '0.8rem',
                  color: '#666',
                  marginBottom: '5px'
                }}>Longitude</div>
                <div style={{ 
                  fontSize: '1.2rem',
                  fontWeight: '500'
                }}>{location[0]?.toFixed(6)}</div>
              </div>
              
              <div style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ 
                  fontSize: '0.8rem',
                  color: '#666',
                  marginBottom: '5px'
                }}>Accuracy</div>
                <div style={{ 
                  fontSize: '1.2rem',
                  fontWeight: '500',
                  color: accuracy > 50 ? 'orange' : 'green'
                }}>
                  ~{Math.round(accuracy)} meters
                </div>
              </div>
              
              {heading && (
                <div style={{
                  backgroundColor: 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '5px'
                  }}>Heading</div>
                  <div style={{ 
                    fontSize: '1.2rem',
                    fontWeight: '500'
                  }}>{Math.round(heading)}°</div>
                </div>
              )}
              
              {speed && (
                <div style={{
                  backgroundColor: 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '0.8rem',
                    color: '#666',
                    marginBottom: '5px'
                  }}>Speed</div>
                  <div style={{ 
                    fontSize: '1.2rem',
                    fontWeight: '500'
                  }}>{Math.round(speed * 3.6)} km/h</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            color: '#666'
          }}>
            {isTracking ? 'Acquiring precise location...' : 'Enable tracking to view location'}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationTracker;
