// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../firebase';
import { onIdTokenChanged } from 'firebase/auth';

const API_BASE = 'https://jio-yatri-driver.onrender.com';

const AuthContext = createContext(null);

// Small helpers safe for SSR
const safeLocal = {
  get: (k) => {
    try { return typeof window !== 'undefined' ? window.localStorage.getItem(k) : null; }
    catch { return null; }
  },
  set: (k, v) => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem(k, v); }
    catch {}
  },
  remove: (k) => {
    try { if (typeof window !== 'undefined') window.localStorage.removeItem(k); }
    catch {}
  }
};

export function AuthProvider({ children }) {
  // Core auth state
  const [user, setUser] = useState(null);              // Firebase user object
  const [token, setToken] = useState(null);            // Firebase ID token (string)
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', isError: false });

  // App-specific metadata
  const [userRole, setUserRole] = useState(safeLocal.get('userRole') || null);        // 'driver' | 'business' | null
  const [isRegistered, setIsRegistered] = useState(safeLocal.get('isRegistered') === '1'); // boolean
  const [softSignedOut, setSoftSignedOut] = useState(false);

  // Shops owned by the current user (for business role)
  const [shopIds, setShopIds] = useState([]);  // array of shop _ids
  const [shopId, setShopId] = useState(null);  // primary shop id (first one by default)

  // To avoid duplicate initial bridges
  const bridgedOnceRef = useRef(false);

  // Public helpers
  const login = (firebaseUser, idToken) => {
    setUser(firebaseUser || null);
    setToken(idToken || null);
    if (idToken) safeLocal.set('authToken', idToken);
  };

  const hardLogout = async () => {
    try { await auth.signOut(); } catch {}
    clearAppState();
  };

  const softLogout = () => {
    // Keep Firebase session, but reset app UI state so you can show phone verify page, etc.
    clearAppState();
    setSoftSignedOut(true);
  };

  const endSoftLogout = () => setSoftSignedOut(false);

  const clearAppState = () => {
    setUser(null);
    setToken(null);
    setUserRole(null);
    setIsRegistered(false);
    setShopIds([]);
    setShopId(null);
    safeLocal.remove('authToken');
    safeLocal.remove('userRole');
    safeLocal.remove('isRegistered');
    setMessage({ text: '', isError: false });
    bridgedOnceRef.current = false;
  };

  /**
   * Fetch role/registration (and shops for business) from backend using Firebase ID token
   */
  const refreshUserMeta = async (firebaseUser) => {
    if (!firebaseUser) return { role: null, isRegistered: false, shops: [] };
    const idToken = await firebaseUser.getIdToken();
    const uid = firebaseUser.uid;

    // 1) role + registration
    const metaRes = await fetch(`${API_BASE}/api/user/check-registration/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    const metaJson = await metaRes.json();
    if (metaJson.success) {
      const role = metaJson.data.role || null;
      const reg = !!metaJson.data.isRegistered;

      setUserRole(role);
      setIsRegistered(reg);
      safeLocal.set('userRole', role || '');
      safeLocal.set('isRegistered', reg ? '1' : '0');
    }

    // 2) shops (if business)
    let shops = [];
    if ((metaJson?.data?.role || '').toLowerCase() === 'business') {
      const shopRes = await fetch(`${API_BASE}/api/shops/owner/${uid}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const shopJson = await shopRes.json();
      if (shopJson?.success && Array.isArray(shopJson.data)) {
        shops = shopJson.data.map(s => s._id);
        setShopIds(shops);
        setShopId(shops[0] || null);
      } else {
        setShopIds([]);
        setShopId(null);
      }
    } else {
      setShopIds([]);
      setShopId(null);
    }

    return {
      role: metaJson?.data?.role || null,
      isRegistered: !!metaJson?.data?.isRegistered,
      shops
    };
  };

  /**
   * Bridge token/ids to Flutter WebView (AuthBridge)
   * Called whenever ID token changes or shopId/role becomes known.
   */
  const bridgeToFlutter = async (firebaseUser, force = false) => {
    if (typeof window === 'undefined') return;
    if (!firebaseUser) return;

    try {
      const idToken = await firebaseUser.getIdToken(true);
      const payload = {
        type: 'auth',
        idToken,
        uid: firebaseUser.uid,
        role: userRole || null,
        shopId: shopId || null
      };

      if (window.AuthBridge && typeof window.AuthBridge.postMessage === 'function') {
        window.AuthBridge.postMessage(JSON.stringify(payload));
        // You might also want to expose a second bridge only for shopId if that changes later.
        // e.g., window.ShopBridge?.postMessage(JSON.stringify({ shopId }));
        if (!bridgedOnceRef.current || force) {
          // eslint-disable-next-line no-console
          console.log('✅ Sent ID token to Flutter via AuthBridge', payload);
          bridgedOnceRef.current = true;
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('ℹ️ AuthBridge not available (normal browser)');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to bridge to Flutter:', err);
    }
  };

  /**
   * Keep auth state in sync
   */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (currentUser) => {
      try {
        if (softSignedOut) {
          setLoading(false);
          return;
        }

        if (currentUser) {
          const idToken = await currentUser.getIdToken();
          setUser(currentUser);
          setToken(idToken);
          safeLocal.set('authToken', idToken);

          // Load role/registered + shops
          await refreshUserMeta(currentUser);

          // Bridge after meta is known (so role/shopId are included)
          await bridgeToFlutter(currentUser, true);
        } else {
          clearAppState();
        }
      } catch (error) {
        setMessage({ text: error.message || 'Auth error', isError: true });
        clearAppState();
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [softSignedOut]);

  /**
   * React to ID token refresh (e.g., every hour) and bridge again
   */
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (currentUser) => {
      if (!currentUser || softSignedOut) return;

      try {
        const idToken = await currentUser.getIdToken(true);
        setToken(idToken);
        safeLocal.set('authToken', idToken);

        // keep Flutter updated if token rotated
        await bridgeToFlutter(currentUser);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('onIdTokenChanged failed:', err);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, shopId, softSignedOut]);

  /**
   * If role/shopId change later (e.g., after registration), bridge again
   */
  useEffect(() => {
    if (user) bridgeToFlutter(user, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, shopId]);

  const value = useMemo(() => ({
    // core
    user,
    token,
    loading,
    message,
    setMessage,

    // meta
    userRole,
    isRegistered,

    // shops
    shopId,
    shopIds,
    setShopId,     // allow UI to switch active shop if multiple

    // actions
    login,
    hardLogout,
    softLogout,
    endSoftLogout,
    refreshUserMeta,
  }), [user, token, loading, message, userRole, isRegistered, shopId, shopIds]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
