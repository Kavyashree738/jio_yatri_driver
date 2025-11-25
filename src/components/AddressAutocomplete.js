import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaMapMarkerAlt } from 'react-icons/fa';
import '../styles/components.css';
import { useTranslation } from "react-i18next";

function AddressAutocomplete({ onSelect, initialValue = '' }) {
    const { t } = useTranslation();

    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    // Sync with initial prop
    useEffect(() => {
        setQuery(initialValue);
    }, [initialValue]);

    // Autocomplete search
    useEffect(() => {
        if (query.length > 2) {
            const timer = setTimeout(() => {
                axios.get('https://jio-yatri-driver.onrender.com/api/address/autocomplete', {
                    params: {
                        input: query,
                        country: 'in'
                    }
                })
                    .then(res => {
                        setSuggestions(res.data.predictions || []);
                        setShowDropdown(true);
                    })
                    .catch(err => console.error('Autocomplete error:', err));
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setSuggestions([]);
            setShowDropdown(false);
        }
    }, [query]);

    // Get current location
    const getCurrentLocation = () => {
        setIsGettingLocation(true);

        if (!navigator.geolocation) {
            alert(t("geo_not_supported"));
            setIsGettingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await axios.get('https://jio-yatri-driver.onrender.com/api/address/reverse-geocode', {
                        params: { lat: latitude, lng: longitude }
                    });

                    const address = response.data.results[0]?.formatted_address;
                    if (address) {
                        setQuery(address);
                        onSelect({
                            address: address,
                            coordinates: { lat: latitude, lng: longitude }
                        });
                        setSuggestions([]);
                        setShowDropdown(false);
                    }
                } catch (error) {
                    console.error("Reverse geocoding failed:", error);
                    alert(t("reverse_failed"));
                } finally {
                    setIsGettingLocation(false);
                }
            },
            (error) => {
                alert(t("location_error") + ": " + error.message);
                setIsGettingLocation(false);
            }
        );
    };

    const handleSelect = async (suggestion) => {
        setQuery(suggestion.description);
        setShowDropdown(false);

        try {
            const response = await axios.get('https://jio-yatri-driver.onrender.com/api/address/geocode', {
                params: { place_id: suggestion.place_id }
            });

            const location = response.data.result?.geometry?.location;
            if (location) {
                const addressData = {
                    address: suggestion.description,
                    coordinates: { lat: location.lat, lng: location.lng }
                };
                onSelect(addressData);
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
        }
    };

    return (
        <div className="address-autocomplete-container">
            <div className="search-header">
                <div className="address-autocomplete">
                    {/* 🔍 Input Field */}
                    <div className="input-with-icon">
                        <FaMapMarkerAlt className="location-icon" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("enter_address")}
                            required
                            autoComplete="off"
                        />
                    </div>

                    {/* 📍 Current Location */}
                    <div
                        className="current-location-row"
                        onClick={getCurrentLocation}
                    >
                        <FaMapMarkerAlt className={`current-location-icon ${isGettingLocation ? "spin-icon" : ""}`} />
                        <span className="current-location-text">
                            {isGettingLocation ? t("detecting_location") : t("use_current_location")}
                        </span>
                    </div>

                    {/* 🔽 Suggestions Dropdown */}
                    {showDropdown && suggestions.length > 0 && (
                        <div className="suggestions-dropdown-container">
                            <ul className="suggestions-dropdown">
                                {suggestions.map((suggestion, index) => (
                                    <li
                                        key={index}
                                        className="suggestion-item"
                                        onClick={() => handleSelect(suggestion)}
                                    >
                                        <FaMapMarkerAlt className="suggestion-icon" />
                                        <span>{suggestion.description}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AddressAutocomplete;
