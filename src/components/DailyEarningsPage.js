import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import DailyEarningsFilter from './DailyEarningsFilter';
import { useTranslation } from "react-i18next";

const DailyEarningsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
    const { t } = useTranslation();

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
        <h1>{t("daily_earnings_title")}</h1>
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