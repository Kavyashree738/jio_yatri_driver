import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/DeliveryHistory.css';
import Header from './Header'
import Footer from './Footer'
const DeliveryHistory = () => {
  const { user } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
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

    fetchDriverShipments();
  }, [user]);

  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'status-pending';
      case 'in progress':
        return 'status-in-progress';
      case 'delivered':
        return 'status-delivered';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  return (
    <>
    <Header/>
    <div className="delivery-history-container">
      <h2 className="delivery-history-title">Your Delivery History</h2>
      {error && <p className="error-message">{error}</p>}
      {shipments.length === 0 ? (
        <p className="no-shipments">No shipments found.</p>
      ) : (
        <ul className="shipments-list">
          {shipments.map((shipment) => (
            <li key={shipment._id} className="shipment-card">
              <div className="shipment-header">
                <span className="tracking-number">{shipment.trackingNumber}</span>
                <span className={`status-badge ${getStatusClass(shipment.status)}`}>
                  {shipment.status}
                </span>
              </div>

              <p className="shipment-detail"><strong>Sender:</strong> {shipment.sender?.name} - {shipment.sender?.phone}</p>
              <p className="shipment-detail"><strong>Receiver:</strong> {shipment.receiver?.name} - {shipment.receiver?.phone}</p>

              {/* <p className="shipment-detail"><strong>Vehicle Type:</strong> {shipment.vehicleType}</p>
              <p className="shipment-detail"><strong>Distance:</strong> {shipment.distance} km</p> */}
              <p className="shipment-detail"><strong>Cost:</strong> ₹{shipment.cost.toFixed(2)}</p>

              <hr className="shipment-divider" />

              <div className="payment-section">
                <p className="shipment-detail"><strong>Payment Method:</strong> {shipment.payment?.method || 'N/A'}</p>
                <p className="shipment-detail"><strong>Payment Status:</strong> {shipment.payment?.status || 'pending'}</p>
                <p className="shipment-detail"><strong>Collected At:</strong> 
                  {shipment.payment?.collectedAt
                    ? new Date(shipment.payment.collectedAt).toLocaleString()
                    : 'N/A'}
                </p>
                {/* <p className="shipment-detail"><strong>Collected By:</strong> 
                  {shipment.payment?.collectedBy || 'N/A'}
                </p> */}
              </div>

            </li>
          ))}
        </ul>
      )}
    </div>
    <Footer/>
    </>

  );
};

export default DeliveryHistory;