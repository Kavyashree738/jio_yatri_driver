// OwnerFCMInit.jsx
import { useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './context/AuthContext';
import { initializeOwnerFCM } from './services/ownerFCM';

const apiBase = 'https://jio-yatri-driver.onrender.com';

export default function OwnerFCMInit() {
  const { user, userRole } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;
    if (userRole !== 'business') return; // only shops need these web push tokens

    (async () => {
      try {
        // Get all shops for this owner and save this browser token under each shop
        const { data } = await axios.get(`${apiBase}/api/shops/owner/${user.uid}`);
        const shops = data?.data || [];
        for (const s of shops) {
          await initializeOwnerFCM(s._id);
        }
      } catch (e) {
        console.error('[OwnerFCMInit] init error:', e);
      }
    })();
  }, [user?.uid, userRole]);

  return null;
}
