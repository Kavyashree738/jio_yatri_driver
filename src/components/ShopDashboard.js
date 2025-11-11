import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/ShopDashboard.css";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { FaSearch } from "react-icons/fa";

const ShopDashboard = () => {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const API_BASE_URL =
    "https://jio-yatri-driver.onrender.com";

  useEffect(() => {
    if (user?.uid) fetchOwnerDashboard(user.uid);
  }, [user]);

  const fetchOwnerDashboard = async (ownerId) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/dashboard/owner/${ownerId}`);
      if (res.data.success) setShops(res.data.data || []);
    } catch (err) {
      console.error("Error fetching dashboard:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = shops.filter((shop) =>
    shop.shopName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading)
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        {/* <p>Loading dashboard...</p> */}
      </div>
    );


  // ---------------------------
  // PAGE 1 – SHOP LIST
  // ---------------------------
  if (!selectedShop)
    return (
      <>
        <Header />
        <div className="shop-dashboard contain">
          <h2 className="dashboard-title">Shop Dashboard</h2>

          <div className="dashboard-stats">
            <div className="stat-card">
              <h3>{shops.length}</h3>
              <p>Shops</p>
            </div>
            <div className="stat-card">
              <h3>{shops.reduce((acc, s) => acc + s.totalOrders, 0)}</h3>
              <p>Orders</p>
            </div>
          </div>

          <div className="search-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="shop-list">
            {filteredShops.map((shop) => (
              <div
                key={shop.shopId}
                className="shop-card"
                onClick={() => setSelectedShop(shop)}
              >
                <img
                  src={
                    shop.shopImageUrls?.[0] ||
                    "https://via.placeholder.com/80x80?text=Shop"
                  }
                  alt={shop.shopName}
                  className="shop-img"
                />
                <div className="shop-details">
                  <h3>{shop.shopName}</h3>
                  <p className="category">{shop.category}</p>
                  <div className="shop-stats-small">
                    <span>Orders: {shop.totalOrders}</span>
                    <span>Completed: {shop.completedOrders}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Footer />
      </>
    );

  // ---------------------------
  // PAGE 2 – RECENT ORDERS
  // ---------------------------
  return (
    <>
      <Header />
      <div className="shop-orders-page contain">
        <button className="back-btns" onClick={() => setSelectedShop(null)}>
          ← Back
        </button>

        <div className="shop-banner">
          <img
            src={
              selectedShop.shopImageUrls?.[0] ||
              "https://via.placeholder.com/100x100?text=Shop"
            }
            alt={selectedShop.shopName}
          />
          <div>
            <h2>{selectedShop.shopName}</h2>
            <p className="category">{selectedShop.category}</p>
          </div>
        </div>



        <div className="orders-list">

          <div className="search-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search orders by name, code or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {selectedShop.recentOrders
            ?.filter((order) => {
              const q = searchQuery.toLowerCase();
              return (
                order.customer?.name?.toLowerCase().includes(q) ||
                order.orderCode?.toLowerCase().includes(q) ||
                order.status?.toLowerCase().includes(q)
              );
            })
            .map((order, i) => (
              <div key={i} className="order-card">
                <div className="order-header">
                  <span className="order-code">#{order.orderCode}</span>
                  <span className={`status ${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                </div>
                <p className="customer">
                  <strong>{order.customer?.name || "Unknown"}</strong>
                </p>
                <div className="order-meta">
                  <span>₹{order.total}</span>
                  <span>{order.items?.length || 0} items</span>
                </div>
              </div>
            ))}
          {(!selectedShop.recentOrders ||
            selectedShop.recentOrders.length === 0) && (
              <p>No recent orders found.</p>
            )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ShopDashboard;
