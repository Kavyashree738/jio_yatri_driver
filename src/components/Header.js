
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
  FaUserCircle,
  FaClipboardList
} from 'react-icons/fa';
import logo from '../assets/images/logo.jpg';
import { useAuth } from '../context/AuthContext';
import { LuPackage2 } from "react-icons/lu";
import { CgProfile } from "react-icons/cg";
import { useTranslation } from "react-i18next";
import DriverSidebar from './DriverSidebar';
import BusinessSidebar from './BusinessSidebar';

const apiBase = 'https://jio-yatri-driver.onrender.com';

const Header = () => {
  const { user, userRole, loading, isRegistered } = useAuth();
  const { t, i18n } = useTranslation();

  const [showSidebar, setShowSidebar] = useState(false);

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
          <h1>{t("company_name")}</h1>
          {/* <div className="lang-options">
            <span onClick={() => i18n.changeLanguage("en")}>EN</span>
            <span onClick={() => i18n.changeLanguage("kn")}>KN</span>
            <span onClick={() => i18n.changeLanguage("hi")}>HI</span>
            <span onClick={() => i18n.changeLanguage("te")}>TE</span>
          </div> */}

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
      { to: '/home', label: t("nav_home") },
      ...(isRegistered ? [
        { to: '/orders', label: t("nav_orders") },
        { to: '/profile', label: t("nav_profile") },
        { to: '/my-documents', label: t("nav_documents") },
      ] : []),
    ],
    mobile: [
      { to: '/home', label: t("nav_home"), icon: <FaHome className="mobile-nav-icon" /> },
      ...(isRegistered ? [
        { to: '/orders', label: t("nav_orders"), icon: <FaChartLine className="mobile-nav-icon" /> },
        { to: '/profile', label: t("nav_profile"), icon: <CgProfile className="mobile-nav-icon" /> },
        { to: '/my-documents', label: t("nav_documents"), icon: <FaFileAlt className="mobile-nav-icon" /> },
      ] : []),
    ],
  };

  // BUSINESS links (note: Orders only when activeShopId is known)
  // Header.jsx BUSINESS links
  const BUSINESS = {
    desktop: [
      { to: '/home', label: t("nav_home") },
      { to: '/business-dashboard', label: t("nav_dashboard") },
      { to: '/business-orders', label: t("nav_orders") }, // aggregate
      { to: '/shop-dashboard', label: t("shop_history") },
      { to: '/owner-documents', label: t("nav_documents") },
    ],
    mobile: [
      { to: '/home', label: t("nav_home"), icon: <FaHome className="mobile-nav-icon" /> },
      { to: '/business-dashboard', label: t("nav_dashboard"), icon: <FaStore className="mobile-nav-icon" /> },
      { to: '/business-orders', label: t("nav_orders"), icon: <LuPackage2 className="mobile-nav-icon" /> }, // aggregate
      { to: '/shop-dashboard', label: t("shop_history"), icon: <FaClipboardList className="mobile-nav-icon" /> },
      { to: '/owner-documents', label: t("nav_documents"), icon: <FaFileAlt className="mobile-nav-icon" /> },
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
        <div className="menu-btn" onClick={() => setShowSidebar(true)}>
          ☰
        </div>

        <h1 className="app-title">{t("company_name")}</h1>

        {/* <div className="lang-options">
          <span onClick={() => i18n.changeLanguage("en")}>EN</span>
          <span onClick={() => i18n.changeLanguage("kn")}>KN</span>
          <span onClick={() => i18n.changeLanguage("hi")}>HI</span>
          <span onClick={() => i18n.changeLanguage("te")}>TE</span>
        </div> */}
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
      {userRole === "driver" && (
        <DriverSidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
      )}

      {userRole === "business" && (
  <BusinessSidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} />
)}
      


    </>
  );
};

export default Header;