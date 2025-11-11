import React, { useState } from "react";
import { FaPhone } from "react-icons/fa";
import "../styles/HelplineButton.css";


const HelplineButton = () => {
    const [showPopup, setShowPopup] = useState(false);
    const helplineNumber = "+919876543210"; // 🔁 change to your actual number

    return (
        <>
            {/* Floating Call Button */}
            <div className="helpline-floating-btn" onClick={() => setShowPopup(true)}>
                <FaPhone className="helpline-icon" />
            </div>

            {/* Popup */}
            {showPopup && (
                <div className="helpline-popup-overlay" onClick={() => setShowPopup(false)}>
                    <div
                        className="helpline-popup-card"
                        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
                    >
                        <button
                            className="helpline-close-btn"
                            onClick={() => setShowPopup(false)}
                        >
                            ✕
                        </button>

                        <div className="call-icon-button">
                            <FaPhone className="call-icon" />
                        </div>



                        <h3>Mokshambani Tech Services Pvt. Ltd.</h3>
                        <p>Need assistance? We're here to help you.</p>
                        <a href={`tel:${helplineNumber}`} className="helpline-callnow-btn">
                            Call Now
                        </a>
                    </div>
                </div>
            )}

        </>
    );
};

export default HelplineButton;
