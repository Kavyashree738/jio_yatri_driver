import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/SplashScreen.css';
import ownerImage from '../assets/images/splash-screen-image.jpg';

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/home');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-container">
      <div className="splash-content">
        
        {/* Owner image with nice styling */}
        <div className="owner-container">
          <img
            src={ownerImage}
            alt="Owner"
            className="owner-image"
          />
        </div>

        {/* Welcome text and company name */}
        <div className="welcome-containers">
          <h1 className="welcome-texts">
            <span className="highlight-words">Welcome</span> to JioYatri
          </h1>

          <h3 className="company-name">
            Mokshambani Tech Service PVT LTD
          </h3>
        </div>

        {/* Tagline (optional) */}
        {/* <p className="tagline">
          Your trusted delivery partner
        </p> */}

        {/* Loading indicator (optional) */}
        {/* <div className="loading-indicator"></div> */}
      </div>
    </div>
  );
};

export default SplashScreen;



