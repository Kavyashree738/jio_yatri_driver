// src/components/RequireKycVerified.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const apiBase = 'https://jio-yatri-driver.onrender.com';

export default function RequireKycVerified({ children }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [ok, setOk] = useState(null);

  useEffect(() => {
    const run = async () => {
      if (!user) return nav('/home', { replace: true });
      try {
        const token = await user.getIdToken();
        const { data } = await axios.get(`${apiBase}/api/user/me/kyc`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const s = data?.data?.status || 'none';
        if (s === 'verified') setOk(true);
        else nav('/kyc-pending', { replace: true });
      } catch {
        nav('/kyc-pending', { replace: true });
      }
    };
    run();
  }, [user, nav]);

  if (ok === null) return <div style={{ padding:16 }}>Checking KYC…</div>;
  return <>{children}</>;
}
