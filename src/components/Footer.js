import React from 'react';
import '../styles/Footer.css';
import logo from '../assets/images/footer-logo-image.png'
import { FaFacebookF, FaInstagram, FaTwitter, FaLinkedin } from 'react-icons/fa';
import qr from '../assets/images/qr-code.png'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-top">
        {/* Logo */}
        <div className="footer-logo">
          <img src={logo} alt="Company Logo" />
          <p>Your trusted delivery partner.</p>
        </div>

        {/* Social Media */}
        <div className="footer-social">
          <h4>Follow us</h4>
          <div className="social-icons">
            <a href="#"><FaFacebookF /></a>
            <a href="#"><FaInstagram /></a>
            <a href="#"><FaTwitter /></a>
            <a href="#"><FaLinkedin /></a>
          </div>
        </div>

        {/* App Download */}
        <div className="footer-app">
          <h4>Download Our App</h4>
          <img src={qr} alt="QR Code" className="qr-code" />
          
          <p>Scan to install on your phone</p>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="footer-bottom">
         <p>CIN:U62020KA2025PTC197886</p>
         <h3>Mokshambani Tech Services PVT LTD</h3>
        <div className="footer-links">
          <a href="#">About Us</a>
          <a href="#">Careers</a>
          <a href="#">Contact</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms & Conditions</a>
        </div>
        <p>© {new Date().getFullYear()}Copyright JIOYATRI Reserved By AMBANITECH..</p>
      </div>
    </footer>
  );
};

export default Footer;
