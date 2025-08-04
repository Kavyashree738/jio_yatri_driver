import React from 'react'
import { AuthProvider } from './context/AuthContext'
import DriverDashboard from './components/DriverDashboard'
import OwnerDashboard from './components/OwnerDashboard'
import UserDocumentsViewer from './components/UserDocumentsViewer'
import Home from './components/Home'
import UserProfile from './components/UserProfile'
import DeliveryHistory from './components/DeliveryHistory'
import { Routes, Route } from 'react-router-dom';
import SplashScreen from './components/SplashScreen'; 
import PrivacyPolicy from './components/PrivacyPolicy';
const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/home" element={<Home/>} />
        <Route path="/orders" element={<DriverDashboard/>} />
        <Route path="/owner-dashboard" element={<OwnerDashboard/>} />
        <Route path='/my-documents' element={<UserDocumentsViewer/>}/>
     <Route path="/profile" element={<UserProfile/>} />
    <Route path="/delivery-history" element={<DeliveryHistory />} />
     <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
