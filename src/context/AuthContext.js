// src/context/AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onIdTokenChanged } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(true);

  // App meta
  const [userRole, setUserRole] = useState(null);          // 'driver' | 'business' | null
  const [isRegistered, setIsRegistered] = useState(false); // boolean
  const [softSignedOut, setSoftSignedOut] = useState(false);

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserRole(null);
    setIsRegistered(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isRegistered');
    setMessage({ text: '', isError: false });
  };

  // Soft logout (keep Firebase session, but reset app state)
  const softLogout = () => {
    setUser(null);
    setToken(null);
    setUserRole(null);
    setIsRegistered(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isRegistered');
    setMessage({ text: '', isError: false });
    setSoftSignedOut(true);
  };
  const endSoftLogout = () => setSoftSignedOut(false);

  // Load role/registration (and optionally shopId) from your API
  const refreshUserMeta = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(
      `https://jio-yatri-driver.onrender.com/api/user/check-registration/${firebaseUser.uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    const json = await res.json();
    if (json.success) {
      setUserRole(json.data.role || null);
      setIsRegistered(!!json.data.isRegistered);
      localStorage.setItem('userRole', json.data.role || '');
      localStorage.setItem('isRegistered', json.data.isRegistered ? '1' : '0');
    }
    return json.data; // may include shopId if your backend returns it
  };

  // Primary auth listener (keeps website logged in, stores token)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      try {
        if (softSignedOut) {
          setLoading(false);
          return;
        }
        if (currentUser) {
          const idToken = await currentUser.getIdToken();
          setUser(currentUser);
          setToken(idToken);
          localStorage.setItem('authToken', idToken);

          // Fetch role/registration (and maybe shopId)
          const meta = await refreshUserMeta(currentUser);

          // ✅ Send a single enriched message to Flutter with auth + meta
          if (window.AuthBridge?.postMessage) {
            const payload = JSON.stringify({
              type: 'auth',
              idToken,
              uid: currentUser.uid,
              role: meta?.role || null,
              isRegistered: !!meta?.isRegistered,
              shopId: meta?.shopId || null, // include if your API returns it
            });
            window.AuthBridge.postMessage(payload);
            console.log('✅ Sent auth+meta to Flutter via AuthBridge');
          } else {
            console.log('ℹ️ AuthBridge not available (normal browser)');
          }
        } else {
          logout();
        }
      } catch (error) {
        setMessage({ text: error.message, isError: true });
        logout();
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [softSignedOut]);

  // Also keep sending when the ID token refreshes
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        const idToken = await fbUser.getIdToken(true);
        const meta = await refreshUserMeta(fbUser);
        if (window.AuthBridge?.postMessage) {
          const payload = JSON.stringify({
            type: 'auth',
            idToken,
            uid: fbUser.uid,
            role: meta?.role || null,
            isRegistered: !!meta?.isRegistered,
            shopId: meta?.shopId || null,
          });
          window.AuthBridge.postMessage(payload);
          console.log('🔄 Re-sent auth+meta to Flutter via AuthBridge');
        }
      } catch (err) {
        console.error('Failed to forward idToken:', err);
      }
    });
    return () => unsub();
  }, []);

  const value = {
    user,
    token,
    message,
    setMessage,
    loading,
    userRole,
    isRegistered,
    refreshUserMeta,
    softSignedOut,
    softLogout,
    endSoftLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
