import React from 'react';
import '../styles/PrivacyPolicy.css';
import Header from './Header';
import Footer from './Footer';
import privacy from '../assets/images/privacy.png'
import { useNavigate } from "react-router-dom";
const PrivacyPolicy = () => {
  const navigate = useNavigate();
  return (
    <>
      <Header />

      <div className="privacy-back">
        <button
        onClick={() => {
          navigate("/home"); // 👈 Go directly to /home instead of reloading
        }}
        className="back-btn"
      >
        ← Back
      </button>
      </div>


      <div className="privacy-container">
        <div className="privacy-banner">
          <img
            src={privacy} // 🔹 place your 3D banner image here
            alt="JioYatri Privacy Policy Banner"
            className="privacy-image"
          />
        </div>
        <section className="privacy-section">
          <h2>Overview</h2>
          <p>
            This privacy policy explains how JioYatri uses and protects the information you provide when using our
            website <a href="https://driver.jioyatri.com">https://driver.jioyatri.com</a> or mobile apps.
            Your privacy is important to us, and we are committed to protecting your personal information.
          </p>
          <p>
            This Policy describes how we collect, use, disclose, and secure your data across our platform,
            whether you are a user, driver, or business owner.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Information We Collect</h2>
          <ul className="info-list">
            <li><strong>Personal Information:</strong> Name, phone, email, address</li>
            <li><strong>Service Data:</strong> Pickup & delivery details, payments</li>
            <li><strong>Business Data:</strong> Shop details, items, and UPI info</li>
            <li><strong>Location Data:</strong> Live tracking for delivery accuracy</li>
            <li><strong>Driver Data:</strong> Vehicle details, license, insurance</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>How We Use Your Information</h2>
          <div className="usage-grid">
            <div className="usage-card">
              <h3>Service Delivery</h3>
              <p>To provide smooth pickup, delivery, and order tracking.</p>
            </div>
            <div className="usage-card">
              <h3>Payments</h3>
              <p>To facilitate secure user, shop, and driver payments.</p>
            </div>
            <div className="usage-card">
              <h3>Communication</h3>
              <p>To send updates, alerts, and promotional messages.</p>
            </div>
            <div className="usage-card">
              <h3>Improvement</h3>
              <p>To enhance app performance and customer satisfaction.</p>
            </div>
          </div>
        </section>

        <section className="privacy-section">
          <h2>Data Security</h2>
          <p>
            We apply encryption, access control, and secure hosting to safeguard your data.
            However, no system can guarantee complete security over the Internet.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Your Rights</h2>
          <ul className="info-list">
            <li>Access or correct your personal information</li>
            <li>Request deletion of your account or data</li>
            <li>Withdraw consent for processing at any time</li>
            <li>Opt-out of non-essential communications</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>Contact Us</h2>
          <div className="contact-info">
            <h3>Mokshambani Tech Services Pvt. Ltd.</h3>
            <p><a href="https://driver.jioyatri.com">https://driver.jioyatri.com</a></p>
            <p>Email: <a href="mailto:helpjioyatri@gmail.com">helpjioyatri@gmail.com</a></p>
            <p>Phone: 9844559599</p>
            <p>Address: Ward No.10, Opp. Ramamandira Choultry, N R Extension, Chintamani-563125, Chickkaballapur Dist.</p>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
};

export default PrivacyPolicy;
