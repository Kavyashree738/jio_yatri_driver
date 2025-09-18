import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import DailyEarningsFilter from './DailyEarningsFilter';

const DailyEarningsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { driverInfo } = location.state || {};

  if (!driverInfo) {
    return (
      <div>
        <h2>No driver data available</h2>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const paymentSettlements = driverInfo.paymentSettlements || [];
  const registrationDate = driverInfo.createdAt;

  return (
    <>
      <Header />
      <div className="earnings-page-container">
        <h1>Your Daily Earnings</h1>
        <DailyEarningsFilter
          paymentSettlements={paymentSettlements}
          registrationDate={registrationDate}
          onFilter={() => {}}
        />
      </div>
      <Footer />
    </>
  );
};

export default DailyEarningsPage;
