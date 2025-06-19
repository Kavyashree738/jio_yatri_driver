import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaLocationArrow, FaMapMarkerAlt, FaExclamationTriangle, FaSync, FaBatteryThreeQuarters } from 'react-icons/fa';

const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.onload = resolve;
      existingScript.onerror = reject;
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

const LiveMap = ({ coordinates, heading, accuracy }) => {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const headingLineRef = useRef(null);

  useEffect(() => {
    if (!coordinates || !window.google) return;

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

  }, [coordinates, accuracy, heading]);

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
    />
  );
};

const LocationTracker = (props) => {
  const { location, accuracy, heading, isTracking, isLoading, isOnline, error, batteryLevel, lastUpdated, handleManualRefresh, handleToggle } = props;
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return 'Never';
    return lastUpdated.toLocaleTimeString();
  }, [lastUpdated]);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => console.log("Google Maps API loaded"))
      .catch((err) => {
        console.error("Google Maps API failed to load:", err);
      });
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
        <div className="status-alert offline">
          <FaExclamationTriangle />
          <span>Offline - Updates will resume when connection is restored</span>
        </div>
      )}

      {error && (
        <div className="status-alert error">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button onClick={() => props.setError(null)}>Dismiss</button>
        </div>
      )}

      {batteryLevel !== null && batteryLevel < 30 && (
        <div className="status-alert warning">
          <FaBatteryThreeQuarters />
          <span>Low battery - Location updates may be less frequent</span>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {location ? (
          <div>
            <LiveMap coordinates={location} heading={heading} accuracy={accuracy} />
          </div>
        ) : (
          <div className="empty-state">
            {isTracking ? 'Acquiring precise location...' : 'Enable tracking to view location'}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationTracker;
