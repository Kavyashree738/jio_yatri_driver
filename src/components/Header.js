
import React, { useState } from 'react';
import {
    FaHome,
    FaChartLine,
    FaFileAlt,
    FaShoppingCart ,
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/images/logo.jpg';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleProfileClick = () => {
        navigate('/profile');
    };
    const handleLinkClick = () => setIsMenuOpen(false);

    return (
        <>
            {/* Top Strip - Visible on all screens */}
            <div className="top-strip">
                <h1>Mokshambani Tech Services PVT LTD</h1>
            </div>

            {/* Desktop Header - Hidden on mobile */}
            <header className="main-header">
                <div className="header-container">
                    <div className="logo">
                        <Link to="/home" onClick={handleLinkClick}>
                            <img src={logo} alt="Company Logo" />
                        </Link>
                    </div>


                    <nav className="nav-links">
                        <Link to="/home">Home</Link>
                        <Link to="/orders">Dashbord</Link>
                        <Link to="/my-documents">My-documents</Link>
                    </nav>
                </div>
            </header>

            {/* Bottom Nav for Mobile - Only visible on mobile */}
            <div className="mobile-bottom-nav">
                <Link to="/home" className="mobile-nav-link">
                    <FaHome className="mobile-nav-icon" />
                    <span>Home</span>
                </Link>
                <Link to="/orders" className="mobile-nav-link">
                    <FaChartLine className="mobile-nav-icon" /> {/* or FaTachometerAlt */}
                    <span>Dashboard</span>
                </Link>
                <Link to="/my-documents" className="mobile-nav-link">
                    <FaFileAlt className="mobile-nav-icon" /> {/* or FaFolder */}
                    <span>My Documents</span>
                </Link>
            </div>
        </>
    );
};

export default Header;
