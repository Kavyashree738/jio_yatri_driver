// src/hooks/useDriverHeartbeat.js
import { useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * Sends driver's current [lng, lat] to /api/driver/heartbeat
 * - runs once on mount (when enabled)
 * - repeats every `intervalMs` while enabled
 *
 * @param {object|null} user - Firebase user
 * @param {boolean} enabled - heartbeat active (e.g., status === 'active')
 * @param {number} intervalMs - repeat interval (default 90s)
 */
export default function useDriverHeartbeat(user, enabled, intervalMs = 90_000) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user || !enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const sendHeartbeat = async () => {
      try {
        // Get browser location
        const coords = await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
          );
        });

        if (!coords) return; // user blocked or unavailable

        const idToken = await user.getIdToken();
        await axios.post(
          'http://localhost:5000/api/driver/heartbeat',
          { coords }, // [lng, lat]
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
      } catch (err) {
        // Silent fail to avoid UI spam; keep heartbeat running
        // console.warn('heartbeat failed', err?.message || err);
      }
    };

    // fire once immediately
    sendHeartbeat();

    // then repeat
    timerRef.current = setInterval(sendHeartbeat, intervalMs);

    // cleanup
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, enabled, intervalMs]);
}
