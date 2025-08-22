import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdDashboard,
  MdStore,
  MdRestaurantMenu,
  MdReceipt,
  MdAnalytics,
  MdAccountCircle,
  MdSettings,
  MdPeople
} from 'react-icons/md';

const BusinessLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="business-layout">
      {/* Sidebar Navigation */}
      <nav className="business-sidebar">
        <div className="sidebar-header">
          <h3>Business Portal</h3>
          <p>{user?.phone || user?.email}</p>
        </div>
        
        <ul className="nav-links">
          <li>
            <Link to="/business/dashboard">
              <MdDashboard className="icon" />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link to="/business/shop">
              <MdStore className="icon" />
              <span>My Shop</span>
            </Link>
          </li>
          <li>
            <Link to="/business/menu">
              <MdRestaurantMenu className="icon" />
              <span>Menu Management</span>
            </Link>
          </li>
          <li>
            <Link to="/business/orders">
              <MdReceipt className="icon" />
              <span>Orders</span>
            </Link>
          </li>
          <li>
            <Link to="/business/analytics">
              <MdAnalytics className="icon" />
              <span>Analytics</span>
            </Link>
          </li>
          <li>
            <Link to="/business/drivers">
              <MdPeople className="icon" />
              <span>Drivers</span>
            </Link>
          </li>
          <li>
            <Link to="/business/settings">
              <MdSettings className="icon" />
              <span>Settings</span>
            </Link>
          </li>
          <li>
            <Link to="/business/profile">
              <MdAccountCircle className="icon" />
              <span>Profile</span>
            </Link>
          </li>
        </ul>

        <button onClick={logout} className="logout-btn">
          Log Out
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="business-content">
        <Outlet />
      </main>
    </div>
  );
};

export default BusinessLayout;