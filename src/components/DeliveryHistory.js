import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/DeliveryHistory.css';
import Header from './Header';
import Footer from './Footer';

const DeliveryHistory = () => {
  const { user } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let intervalId;

    const fetchDriverShipments = async () => {
      if (!user?.uid) return;

      try {
        const response = await axios.get(
          `http://localhost:5000/api/shipments/driver/${user.uid}`
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
        <h2 className="dh-title">Your Delivery History</h2>
        {error && <p className="dh-error">{error}</p>}
        {shipments.length === 0 ? (
          <p className="dh-empty">No shipments found.</p>
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
                  <strong>Created:</strong> {formatDateTime(shipment.createdAt)}
                </p>

                <p className="dh-detail">
                  <strong>Sender:</strong> {shipment.sender?.name} - {shipment.sender?.phone}
                </p>
                <p className="dh-detail">
                  <strong>Receiver:</strong> {shipment.receiver?.name} - {shipment.receiver?.phone}
                </p>
                <p className="dh-detail">
                  <strong>Cost:</strong> ₹{shipment.cost.toFixed(2)}
                </p>

                <hr className="dh-divider" />

                {shipment.status.toLowerCase() !== 'cancelled' && (
                  <div className="dh-payment-section">
                    {shipment.status.toLowerCase() === 'assigned' ? (
                      <p className="dh-detail">
                        <strong>Payment Status:</strong> {shipment.payment?.status || 'pending'}
                      </p>
                    ) : (
                      <>
                        <p className="dh-detail">
                          <strong>Payment Method:</strong> {shipment.payment?.method || 'N/A'}
                        </p>
                        <p className="dh-detail">
                          <strong>Payment Status:</strong> {shipment.payment?.status || 'pending'}
                        </p>
                        <p className="dh-detail">
                          <strong>Collected At:</strong> {formatDateTime(shipment.payment?.collectedAt) || 'N/A'}
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
