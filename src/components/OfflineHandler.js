import React, { useEffect, useState } from "react";
import "../styles/OfflineHandler.css";

function OfflineHandler({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
// const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Create floating elements
    const createFloatingElements = () => {
      const container = document.querySelector('.floating-elements');
      if (!container || isOnline) return;
      
      container.innerHTML = '';
      
      for (let i = 0; i < 15; i++) {
        const element = document.createElement('div');
        element.classList.add('floating-element');
        
        const size = Math.random() * 20 + 10;
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        
        element.style.left = `${Math.random() * 100}vw`;
        element.style.top = `${Math.random() * 100 + 100}vh`;
        
        element.style.animationDuration = `${Math.random() * 10 + 15}s`;
        element.style.animationDelay = `${Math.random() * 5}s`;
        
        container.appendChild(element);
      }
    };

    if (!isOnline) {
      setTimeout(createFloatingElements, 100);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div className="offline-container">
        <div className="floating-elements"></div>
        <div className="offline-card">
          <div className="wifi-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" className="wifi-line" stroke="#6c5ce7" strokeWidth="2"/>
              <path d="M8.00005 16C8.00005 16 9.99999 14 12 14C14 14 16 16 16 16" className="wifi-line" stroke="#6c5ce7" strokeWidth="2" strokeLinecap="round"/>
              <path d="M5 13C5 13 8 10 12 10C16 10 19 13 19 13" className="wifi-line" stroke="#6c5ce7" strokeWidth="2" strokeLinecap="round"/>
              <path d="M1.99998 9.99999C1.99998 9.99999 5.99998 6 12 6C18 6 22 10 22 10" className="wifi-line" stroke="#6c5ce7" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          
          <h2 className="offline-title">
            <span className="connection-status"></span>
            You're Offline
          </h2>
          <p className="offline-message">
            It looks like your internet connection is turned off.
            <br />
            Please connect to the internet to continue using the app.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default OfflineHandler;