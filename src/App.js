import React from 'react'
import { AuthProvider } from './context/AuthContext'
import DriverDashboard from './components/DriverDashboard'
import OwnerDashboard from './components/OwnerDashboard'
import UserDocumentsViewer from './components/UserDocumentsViewer'
import Home from './components/Home'
import UserProfile from './components/UserProfile'
import { Routes, Route } from 'react-router-dom';

const App = () => {


  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/orders" element={<DriverDashboard/>} />
        <Route path="/owner-dashboard" element={<OwnerDashboard/>} />
        <Route path='/my-documents' element={<UserDocumentsViewer/>}/>
     <Route path="/profile" element={<UserProfile/>} />
      </Routes>
    </AuthProvider>
  )
}

export default App
