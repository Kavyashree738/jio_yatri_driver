import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/SplashScreen.css';
import ownerImage from '../assets/images/splash-screen-image.jpg';
import { useAuth } from '../context/AuthContext'; // 👈 import your context

const SplashScreen = () => {
  const navigate = useNavigate();
  const { user, userRole, isRegistered, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // wait for Firebase to load user state

    const timer = setTimeout(() => {
      if (!user) {
        // Not logged in
        navigate('/home');
      } else if (!isRegistered) {
        // Logged in but not completed registration
        navigate('/home');
      } else if (userRole === 'driver') {
        navigate('/orders');
      } else if (userRole === 'business') {
        navigate('/business-orders'); // or "/orders" if you merged routes
      } else {
        navigate('/home');
      }
    }, 2500); // ⏱ splash duration

    return () => clearTimeout(timer);
  }, [navigate, user, userRole, isRegistered, loading]);

  return (
    <div className="splash-container">
      <div className="splash-content">
        <div className="owner-container">
          <img src={ownerImage} alt="Owner" className="owner-image" />
        </div>

        <div className="welcome-containers">
          <h1 className="welcome-texts">
            <span className="highlight-words">Welcome</span> to JioYatri
          </h1>

          <h3 className="company-name">
            Mokshambani Tech Service PVT LTD
          </h3>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
