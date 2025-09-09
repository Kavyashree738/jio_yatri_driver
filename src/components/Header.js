
// import React, { useState } from 'react';
// import {
//     FaHome,
//     FaChartLine,
//     FaFileAlt,
//     FaShoppingCart ,
// } from 'react-icons/fa';
// import { Link, useNavigate } from 'react-router-dom';
// import logo from '../assets/images/logo.jpg';
// import { useAuth } from '../context/AuthContext';

// const Header = () => {
//     const [isMenuOpen, setIsMenuOpen] = useState(false);
//     const { user } = useAuth();
//     const navigate = useNavigate();

//     const handleProfileClick = () => {
//         navigate('/profile');
//     };
//     const handleLinkClick = () => setIsMenuOpen(false);

//     return (
//         <>
//             {/* Top Strip - Visible on all screens */}
//             <div className="top-strip">
//                 <h1>Mokshambani Tech Services PVT LTD</h1>
//             </div>

//             {/* Desktop Header - Hidden on mobile */}
//             <header className="main-header">
//                 <div className="header-container">
//                     <div className="logo">
//                         <Link to="/home" onClick={handleLinkClick}>
//                             <img src={logo} alt="Company Logo" />
//                         </Link>
//                     </div>


//                     <nav className="nav-links">
//                         <Link to="/home">Home</Link>
//                         <Link to="/orders">Dashbord</Link>
//                         <Link to="/my-documents">My-documents</Link>
//                     </nav>
//                 </div>
//             </header>

//             {/* Bottom Nav for Mobile - Only visible on mobile */}
//             <div className="mobile-bottom-nav">
//                 <Link to="/home" className="mobile-nav-link">
//                     <FaHome className="mobile-nav-icon" />
//                     <span>Home</span>
//                 </Link>
//                 <Link to="/orders" className="mobile-nav-link">
//                     <FaChartLine className="mobile-nav-icon" /> {/* or FaTachometerAlt */}
//                     <span>Dashboard</span>
//                 </Link>
//                 <Link to="/my-documents" className="mobile-nav-link">
//                     <FaFileAlt className="mobile-nav-icon" /> {/* or FaFolder */}
//                     <span>My Documents</span>
//                 </Link>
//             </div>
//         </>
//     );
// };

// export default Header;
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, NavLink } from 'react-router-dom';
import {
  FaHome,
  FaChartLine,
  FaFileAlt,   // we'll use this for "Orders"
  FaStore,
  FaUserCircle
} from 'react-icons/fa';
import logo from '../assets/images/logo.jpg';
import { useAuth } from '../context/AuthContext';
import { LuPackage2 } from "react-icons/lu";
const apiBase = 'https://jio-yatri-driver.onrender.com';

const Header = () => {
  const { user, userRole, loading, isRegistered } = useAuth();
  const [activeShopId, setActiveShopId] = useState(() => {
    // let dashboard set this ahead of time if it wants
    return localStorage.getItem('active_shop_id') || null;
  });

  // If business user and we still don't know a shopId, fetch first shop
  useEffect(() => {
    const loadShopId = async () => {
      if (!user || userRole !== 'business' || !isRegistered || activeShopId) return;
      try {
        const res = await axios.get(`${apiBase}/api/shops/owner/${user.uid}`);
        const shops = res.data?.data || [];
        if (shops.length > 0) {
          const id = shops[0]._id;
          setActiveShopId(id);
          localStorage.setItem('active_shop_id', id);
        }
      } catch (e) {
        console.error('[Header] failed to fetch owner shops:', e?.response?.data || e.message);
      }
    };
    loadShopId();
  }, [user, userRole, isRegistered, activeShopId]);

  if (loading) return null;

  // Logged-out minimal header
  if (!user) {
    return (
      <>
        <div className="top-strip">
          <h1>Mokshambani Tech Services PVT LTD</h1>
        </div>
        <header className="main-header">
          <div className="header-container">
            <div className="logo">
              <Link to="/home">
                <img src={logo} alt="Company Logo" />
              </Link>
            </div>
          </div>
        </header>
      </>
    );
  }

  const isDriver = userRole === 'driver';
  const isBusiness = userRole === 'business';

  // DRIVER links
  const DRIVER = {
    desktop: [
      { to: '/home', label: 'Home' },
      ...(isRegistered ? [
        { to: '/orders', label: 'Dashboard' },
        { to: '/my-documents', label: 'My documents' },
      ] : []),
    ],
    mobile: [
      { to: '/home', label: 'Home', icon: <FaHome className="mobile-nav-icon" /> },
      ...(isRegistered ? [
        { to: '/orders', label: 'Dashboard', icon: <FaChartLine className="mobile-nav-icon" /> },
        { to: '/my-documents', label: 'My Documents', icon: <FaFileAlt className="mobile-nav-icon" /> },
      ] : []),
    ],
  };

  // BUSINESS links (note: Orders only when activeShopId is known)
 // Header.jsx BUSINESS links
const BUSINESS = {
  desktop: [
    { to: '/home', label: 'Home' },
    { to: '/business-dashboard', label: 'Dashboard' },
    { to: '/business-orders', label: 'Orders' }, // aggregate
    { to: '/owner-documents', label: 'Documents' },
  ],
  mobile: [
    { to: '/home', label: 'Home', icon: <FaHome className="mobile-nav-icon" /> },
    { to: '/business-dashboard', label: 'Dashboard', icon: <FaStore className="mobile-nav-icon" /> },
    { to: '/business-orders', label: 'Orders', icon: <LuPackage2 className="mobile-nav-icon" /> }, // aggregate
    { to: '/owner-documents', label: 'Documents', icon: <FaFileAlt className="mobile-nav-icon" /> },
  ],
};


  const FALLBACK = {
    desktop: [{ to: '/home', label: 'Home' }],
    mobile: [{ to: '/home', label: 'Home', icon: <FaHome className="mobile-nav-icon" /> }],
  };

  const links = isDriver ? DRIVER : isBusiness ? BUSINESS : FALLBACK;

  return (
    <>
      <div className="top-strip">
        <h1>Mokshambani Tech Services PVT LTD</h1>
      </div>

      <header className="main-header">
        <div className="header-container">
          <div className="logo">
            <Link to="/home">
              <img src={logo} alt="Company Logo" />
            </Link>
          </div>

          <nav className="nav-links">
            {links.desktop.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="mobile-bottom-nav">
        {links.mobile.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `mobile-nav-link ${isActive ? 'active' : ''}`
            }
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </>
  );
};

export default Header;
