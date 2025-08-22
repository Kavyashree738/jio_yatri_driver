import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/LocationTracker.css';

const FullMapPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const directionsRendererRef = useRef(null);

    const {
        currentLocation,
        heading,
        senderLatLng,
        receiverLatLng
    } = location.state || {};

    useEffect(() => {
        if (!mapContainerRef.current || !currentLocation) return;

        const center = { lat: currentLocation[1], lng: currentLocation[0] };

        mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
            zoom: 15,
            center,
            mapTypeId: 'roadmap',
            fullscreenControl: false
        });

        // Add driver marker
        markerRef.current = new window.google.maps.Marker({
            position: center,
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

        // Add sender and receiver markers
        new window.google.maps.Marker({
            position: senderLatLng,
            map: mapRef.current,
            label: { text: 'S', color: '#FFFFFF' },
            icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
        });

        new window.google.maps.Marker({
            position: receiverLatLng,
            map: mapRef.current,
            label: { text: 'R', color: '#FFFFFF' },
            icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        });

        // Add route
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#4285F4',
                strokeWeight: 6,
                strokeOpacity: 0.8,
            },
        });

        directionsRendererRef.current.setMap(mapRef.current);

        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
            {
                origin: center,
                destination: receiverLatLng,
                waypoints: [{ location: senderLatLng, stopover: true }],
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === 'OK') {
                    directionsRendererRef.current.setDirections(result);
                }
            }
        );

        return () => {
            if (mapRef.current) {
                directionsRendererRef.current.setMap(null);
            }
        };
    }, [currentLocation, heading, senderLatLng, receiverLatLng]);

    return (
        <div className="full-map-page">
            <div ref={mapContainerRef} className="full-map-container" />
            <button
                onClick={() => navigate(-1)}
                className="close-fullscreen-button"
                aria-label="Close fullscreen map"
            >
                &times;
            </button>
        </div>
    );
};

export default FullMapPage;