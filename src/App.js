// import React from 'react'
// import { AuthProvider } from './context/AuthContext'
// import DriverDashboard from './components/DriverDashboard'
// import OwnerDashboard from './components/OwnerDashboard'
// import UserDocumentsViewer from './components/UserDocumentsViewer'
// import Home from './components/Home'
// import UserProfile from './components/UserProfile'
// import DeliveryHistory from './components/DeliveryHistory'
// import { Routes, Route } from 'react-router-dom';
// import SplashScreen from './components/SplashScreen'; 
// import PrivacyPolicy from './components/PrivacyPolicy';
// const App = () => {
//   return (
//     <AuthProvider>
//       <Routes>
//         <Route path="/" element={<SplashScreen />} />
//         <Route path="/home" element={<Home/>} />
//         <Route path="/orders" element={<DriverDashboard/>} />
//         <Route path="/owner-dashboard" element={<OwnerDashboard/>} />
//         <Route path='/my-documents' element={<UserDocumentsViewer/>}/>
//      <Route path="/profile" element={<UserProfile/>} />
//     <Route path="/delivery-history" element={<DeliveryHistory />} />
//      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
//       </Routes>
//     </AuthProvider>
//   )
// }

// export default App


import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import  { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import RequireAuth from './components/guards/RequireAuth';
import RoleGuard from './components/guards/RoleGuard';
import OnlyIfNotRegistered from './components/guards/OnlyIfNotRegistered';

import ScrollToTop from './components/ScrollToTop';
import SplashScreen from './components/SplashScreen';
import Home from './components/Home';

import DriverDashboard from './components/DriverDashboard';
import OwnerDashboard from './components/OwnerDashboard';
import UserDocumentsViewer from './components/UserDocumentsViewer';
import UserProfile from './components/UserProfile';
import DeliveryHistory from './components/DeliveryHistory';
import FullMapPage from './components/FullMapPage';
import DailyEarningsPage from './components/DailyEarningsPage';
import ReferralShare from './components/ReferralShare';

import BusinessDashboard from './components/BusinessDashboard';
import CategoryRegistration from './components/CategoryRegistration';
import EditShopRegistration from './components/EditShopRegistration';
import ShopDetails from './components/ShopDetails';
import ShopItemsManager from './components/AddMenu';
import ReferralShareShop from './components/ReferralShareShop';
import OwnerFCMInit from './OwnerFCMInit';
// ✅ New: Cart + Orders pages
import CartProvider from './context/CartContext';
import CartPage from './components/Cart';
import OrderConfirmation from './components/OrderConfirmation';
import BusinessOrders from './components/BusinessOrders';

import ShopMenuManager from './components/ShopMenuManager';
import KycPending from './components/KycPending';
import RequireKycVerified from './components/RequireKycVerified';
import OwnerDocumentViews from './components/OwnerDocumentViews';
import OfflineHandler from './components/OfflineHandler';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsAndConditions from './components/TermsAndConditions';


// Smart landing
function LandingRedirect() {
  const { user, userRole, isRegistered, loading } = useAuth();
  if (loading) return null;
  if (!user) return <SplashScreen />;

  if (userRole === 'business') {
    return <Navigate to={isRegistered ? '/business-dashboard' : '/register'} replace />;
  }
  // driver
  return <Navigate to={isRegistered ? '/orders' : '/owner-dashboard'} replace />;
}


// Small wrapper to read :shopId and pass to BusinessOrders
function BusinessOrdersWrapper() {
  const { shopId } = useParams();
  return <BusinessOrders shopId={shopId} />;
}

const App = () => {

  useEffect(() => {
    // ✅ Tell Flutter that the website is ready to receive push events
    if (window.WebReady && typeof window.WebReady.postMessage === "function") {
      window.WebReady.postMessage(JSON.stringify({ type: "ready" }));
      console.log("🟢 Sent WebReady to Flutter");
    }
  }, []);
  return (
    // ✅ CartProvider should wrap the whole app
    <CartProvider>
      <AuthProvider>
    <OfflineHandler>
        <OwnerFCMInit />
        <ScrollToTop />
        <Routes>
          // <Route path="/" element={<SplashScreen />} />
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/home" element={<Home />} />

          <Route path="/shop/:shopId/menu" element={<ShopMenuManager />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />

          {/* DRIVER-ONLY */}
          <Route path="/orders" element={
            <RequireAuth><RoleGuard allow="driver"><DriverDashboard /></RoleGuard></RequireAuth>
          } />
          <Route path="/owner-dashboard" element={
            <RequireAuth><RoleGuard allow="driver"><OwnerDashboard /></RoleGuard></RequireAuth>
          } />
          <Route path="/my-documents" element={
            <RequireAuth><RoleGuard allow="driver"><UserDocumentsViewer /></RoleGuard></RequireAuth>
          } />
          <Route path="/profile" element={
            <RequireAuth><RoleGuard allow="driver"><UserProfile /></RoleGuard></RequireAuth>
          } />
          <Route path="/delivery-history" element={
            <RequireAuth><RoleGuard allow="driver"><DeliveryHistory /></RoleGuard></RequireAuth>
          } />
          <Route path="/full-map" element={
            <RequireAuth><RoleGuard allow="driver"><FullMapPage /></RoleGuard></RequireAuth>
          } />
          <Route path="/driver/earnings" element={
            <RequireAuth><RoleGuard allow="driver"><DailyEarningsPage /></RoleGuard></RequireAuth>
          } />
          <Route path="/refferal" element={
            <RequireAuth><RoleGuard allow="driver"><ReferralShare /></RoleGuard></RequireAuth>
          } />

          {/* BUSINESS-ONLY */}

          <Route
            path="/kyc-pending"
            element={
              <RequireAuth>
                <RoleGuard allow="business">
                  <KycPending />
                </RoleGuard>
              </RequireAuth>
            }
          />
           <Route
            path="/business-dashboard"
            element={
              <RequireAuth>
                <RoleGuard allow="business">
                  <RequireKycVerified>
                    <BusinessDashboard />
                  </RequireKycVerified>
                </RoleGuard>
              </RequireAuth>
            }
          />
          <Route path="/edit-shop/:shopId" element={
            <RequireAuth><RoleGuard allow="business"><EditShopRegistration /></RoleGuard></RequireAuth>
          } />
          <Route path="/shop/:id" element={
            <RequireAuth><RoleGuard allow="business"><ShopDetails /></RoleGuard></RequireAuth>
          } />
          <Route path="/register-shop" element={
            <RequireAuth><RoleGuard allow="business"><CategoryRegistration /></RoleGuard></RequireAuth>
          } />
          <Route path="/shops/:shopId/share" element={
            <RequireAuth><RoleGuard allow="business"><ReferralShareShop /></RoleGuard></RequireAuth>
          } />
          <Route path="/shops/:shopId/items" element={
            <RequireAuth><RoleGuard allow="business"><ShopItemsManager /></RoleGuard></RequireAuth>
          } />
          <Route path="/register" element={
            <RequireAuth><RoleGuard allow="business"><OnlyIfNotRegistered><CategoryRegistration /></OnlyIfNotRegistered></RoleGuard></RequireAuth>
          } />

         

           <Route
            path="/owner-documents"
            element={
              <RequireAuth>
                <RoleGuard allow="business">
                  <OwnerDocumentViews />
                </RoleGuard>
              </RequireAuth>
            }
          />

          {/* ✅ NEW ROUTES (Cart & Orders) */}
          {/* Cart & confirmation are user-facing; keep them accessible without role restriction,
              or wrap with RequireAuth if you want only signed-in users to order */}
          <Route path="/cart/:shopId" element={<CartPage />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />

          {/* Shop owner’s incoming orders list */}
          <Route
            path="/business-orders"
            element={
              <RequireAuth>
                <RoleGuard allow="business">
                  <BusinessOrdersWrapper />
                </RoleGuard>
              </RequireAuth>
            }
          />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
            </OfflineHandler>
      </AuthProvider>
    </CartProvider>
  );
};

export default App;
