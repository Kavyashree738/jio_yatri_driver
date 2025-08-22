// components/DailyEarningsPage.js
import React from 'react';
import { useAuth } from '../context/AuthContext';
import Header from './Header';
import Footer from './Footer';
import DailyEarningsFilter from './DailyEarningsFilter';

const DailyEarningsPage = () => {
  const { user } = useAuth();
  const [paymentSettlements, setPaymentSettlements] = React.useState([]);
  const [registrationDate, setRegistrationDate] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await user.getIdToken();
        const [driverRes, settlementsRes] = await Promise.all([
          fetch(`https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`https://jio-yatri-driver.onrender.com/api/settlement/history/${user.uid}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const driverData = await driverRes.json();
        const settlementsData = await settlementsRes.json();

        setRegistrationDate(driverData.data?.createdAt);
        setPaymentSettlements(settlementsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Header />
      <div className="earnings-page-container">
        <h1>Your Earnings History</h1>
        <DailyEarningsFilter 
          paymentSettlements={paymentSettlements}
          registrationDate={registrationDate}
          onFilter={(filtered) => console.log(filtered)}
        />
      </div>
      <Footer />
    </>
  );
};

export default DailyEarningsPage;