import React from 'react'
import { AuthProvider } from './context/AuthContext'
import DriverDashboard from './components/DriverDashboard'
import Home from './components/Home'
import { Routes, Route } from 'react-router-dom';
const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/orders" element={<DriverDashboard/>} />
      </Routes>
    </AuthProvider>
  )
}

export default App
