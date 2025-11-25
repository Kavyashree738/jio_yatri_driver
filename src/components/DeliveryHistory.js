import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/DeliveryHistory.css';
import Header from './Header';
import Footer from './Footer';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from "react-i18next";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


const DeliveryHistory = () => {
  const { user } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [error, setError] = useState('');
  const { t } = useTranslation();


   useEffect(() => {
    let intervalId;

    const fetchDriverShipments = async () => {
      if (!user?.uid) return;

      try {
        const response = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/shipments/driver/${user.uid}`
        );
        setShipments(response.data);
      } catch (err) {
        console.error('Failed to fetch driver shipments:', err);
        setError('Could not load shipments.');
      }
    };

    if (user?.uid) {
      fetchDriverShipments();
      intervalId = setInterval(fetchDriverShipments, 30000);
    }

    return () => clearInterval(intervalId);
  }, [user]);

  // 📊 Group shipments by day and sum earnings
// 📊 Filter only delivered shipments
const deliveredShipments = shipments.filter(
  (s) => s.status?.toLowerCase() === 'delivered'
);

// 🧮 Group delivered shipments by date
const earningsMap = deliveredShipments.reduce((acc, s) => {
  const date = new Date(s.createdAt).toLocaleDateString();
  const cost = Number(s.cost || 0);
  acc[date] = (acc[date] || 0) + cost;
  return acc;
}, {});

// 📅 Sort dates and keep only the last 7
const sortedDates = Object.keys(earningsMap)
  .sort((a, b) => new Date(a) - new Date(b))
  .slice(-7);

// 📊 Prepare data for Chart.js
const chartData = {
  labels: sortedDates,
  datasets: [
    {
      label: t("chart_label_earnings"),
      data: sortedDates.map((date) => earningsMap[date]),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
      borderRadius: 8,
      hoverBackgroundColor: 'rgba(54, 162, 235, 0.7)',
    },
  ],
};

// ⚙️ Chart Options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: { color: '#333', font: { size: 12 } },
    },
    title: {
      display: true,
      text: t("delivered_earnings_chart"),
      color: '#111',
      font: { size: 16, weight: 'bold' },
    },
    tooltip: {
      callbacks: {
        label: (context) => `₹${context.parsed.y.toFixed(2)}`,
      },
    },
  },
  scales: {
    x: { ticks: { color: '#444' } },
    y: {
      ticks: {
        color: '#444',
        callback: (value) => `₹${value}`,
      },
    },
  },
  animation: {
    duration: 1000,
    easing: 'easeInOutCubic',
  },
};


 

  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'dh-status-pending';
      case 'in progress': return 'dh-status-in-progress';
      case 'delivered': return 'dh-status-delivered';
      case 'cancelled': return 'dh-status-cancelled';
      case 'assigned': return 'dh-status-assigned';
      default: return '';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <>
      <Header />


      <div className="dh-container">
        <h2 className="dh-title">{t("delivery_history_title")}</h2>

        <div className="dh-chart-wrapper">
          <Bar data={chartData} options={chartOptions} />
        </div>
        {error && <p className="dh-error">{error}</p>}
        {shipments.length === 0 ? (
          <p className="dh-empty">{t("no_shipments_found")}</p>
        ) : (
          <ul className="dh-shipments-list">
            {shipments.map((shipment) => (
              <li key={shipment._id} className="dh-shipment-card">
                <div className="dh-shipment-header">
                  <span className="dh-tracking-number">{shipment.trackingNumber}</span>
                  <span className={`dh-status-badge ${getStatusClass(shipment.status)}`}>
                    {shipment.status}
                  </span>
                </div>

                <p className="dh-detail">
                  <strong>{t("created")}:</strong> {formatDateTime(shipment.createdAt)}
                </p>

                <p className="dh-detail">
                  <strong>{t("sender")}:</strong> {shipment.sender?.name} - {shipment.sender?.phone}
                </p>
                <p className="dh-detail">
                  <strong>{t("receiver")}:</strong> {shipment.receiver?.name} - {shipment.receiver?.phone}
                </p>
                <p className="dh-detail">
                  <strong>{t("cost")}:</strong> ₹{shipment.cost.toFixed(2)}
                </p>
                <p className="dh-detail">
                  <strong>{t("sender_address")}:</strong> {shipment.sender?.address?.addressLine1 || "N/A"}


                </p>
                <p className="dh-detail">
                  <strong>{t("receiver_address")}:</strong> {shipment.receiver?.address?.addressLine1 || "N/A"}

                </p>

                <div className="dh-map-container">
                  <iframe
                    title={`map-${shipment._id}`}
                    width="100%"
                    height="200"
                    style={{ border: 0, borderRadius: "8px" }}
                    loading="lazy"
                    allowFullScreen
                    src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.REACT_APP_GOOGLE_API_KEY}&origin=${encodeURIComponent(
                      shipment.sender?.address?.addressLine1 || ""
                    )}&destination=${encodeURIComponent(
                      shipment.receiver?.address?.addressLine1 || ""
                    )}&zoom=12`}
                  ></iframe>
                </div>



                <hr className="dh-divider" />

                {shipment.status.toLowerCase() !== 'cancelled' && (
                  <div className="dh-payment-section">
                    {shipment.status.toLowerCase() === 'assigned' ? (
                      <p className="dh-detail">
                        <strong>{t("payment_status")}</strong> {shipment.payment?.status || 'pending'}
                      </p>
                    ) : (
                      <>
                        <p className="dh-detail">
                          <strong>{t("payment_method")}:</strong> {shipment.payment?.method || 'N/A'}
                        </p>
                        <p className="dh-detail">
                          <strong>{t("payment_status")}</strong> {shipment.payment?.status || 'pending'}
                        </p>
                        <p className="dh-detail">
                          <strong>{t("collected_at")}:</strong> {formatDateTime(shipment.payment?.collectedAt) || 'N/A'}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </>
  );
};

export default DeliveryHistory;