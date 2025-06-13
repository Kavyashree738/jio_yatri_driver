import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaLocationArrow, FaMapMarkerAlt, FaExclamationTriangle, FaSync } from 'react-icons/fa';

const LocationTracker = ({ updateInterval = 10000 }) => {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const pollingRef = useRef(null);

  // LiveMap component (now embedded)
  const LiveMap = ({ coordinates }) => {
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
      if (!coordinates || !window.google) return;

      const [lng, lat] = coordinates;
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 15,
        mapTypeId: 'roadmap',
        streetViewControl: false,
        mapTypeControl: false
      });

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#FF0000',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF'
          }
        });
      } else {
        markerRef.current.setPosition({ lat, lng });
      }

      map.panTo({ lat, lng });

    }, [coordinates]);

    return (
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '300px',
          borderRadius: '8px',
          marginTop: '10px'
        }} 
      />
    );
  };

  // Get current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000
      });
    });
  };

  // Update location to server
  const updateLocationToServer = async (coords) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await user.getIdToken();
      const response = await fetch('https://jio-yatri-driver.onrender.com/api/driver/location', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coordinates: [coords.longitude, coords.latitude],
          isLocationActive: true
        })
      });

      if (!response.ok) throw new Error('Update failed');
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Update failed');

      setLocation([coords.longitude, coords.latitude]);
      startPolling();
    } catch (err) {
      setError(err.message);
      setIsTracking(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Polling logic
  const startPolling = () => {
    stopPolling();
    
    const fetchLocation = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('https://jio-yatri-driver.onrender.com/api/driver/location', {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const data = await response.json();
        if (data.success && data.data?.location?.coordinates) {
          setLocation(data.data.location.coordinates);
          setIsTracking(data.data.isLocationActive);
        }
      } catch (err) {
        console.error('Polling error:', err);
        if (err.message.includes('404')) {
          setError('Endpoint not found');
          stopPolling();
        }
      }
    };

    fetchLocation();
    pollingRef.current = setInterval(fetchLocation, updateInterval);
  };

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  // Control functions
  const stopTracking = async () => {
    try {
      const token = await user.getIdToken();
      await fetch('https://jio-yatri-driver.onrender.com/api/driver/location', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isLocationActive: false })
      });
      stopPolling();
      setIsTracking(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const startTracking = async () => {
    try {
      const pos = await getCurrentLocation();
      await updateLocationToServer(pos.coords);
      setIsTracking(true);
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

  // Cleanup
  useEffect(() => {
    return () => stopPolling();
  }, []);

  return (
    <div className="location-tracker" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FaMapMarkerAlt 
            style={{ 
              color: isTracking ? '#00C853' : '#757575', 
              marginRight: '8px',
              fontSize: '20px'
            }} 
          />
          <span>{isTracking ? 'Live Tracking Active' : 'Location Offline'}</span>
        </div>
        <div>
          <button
            onClick={handleToggle}
            disabled={isLoading}
            style={{
              backgroundColor: isTracking ? '#ff4444' : '#4285F4',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginRight: '10px'
            }}
          >
            <FaLocationArrow style={{ marginRight: '8px' }} />
            {isLoading ? 'Processing...' : isTracking ? 'Stop Sharing' : 'Share Location'}
          </button>
          {isTracking && (
            <button 
              onClick={handleManualRefresh}
              style={{
                backgroundColor: '#34A853',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              disabled={isLoading}
            >
              <FaSync />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#FFEBEE', 
          color: '#C62828',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <FaExclamationTriangle style={{ marginRight: '8px' }} />
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#C62828',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {location ? (
        <div>
          <LiveMap coordinates={location} />
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: '20px',
            marginTop: '10px',
            color: '#555'
          }}>
            <span>Lat: {location[1]?.toFixed(6)}</span>
            <span>Lng: {location[0]?.toFixed(6)}</span>
          </div>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: '#f5f5f5',
          padding: '40px',
          textAlign: 'center',
          borderRadius: '8px',
          color: '#757575'
        }}>
          {isTracking ? 'Acquiring location...' : 'Enable tracking to view location'}
        </div>
      )}
    </div>
  );
};

export default LocationTracker;