// src/context/AuthContext.js
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../firebase';
import { onIdTokenChanged } from 'firebase/auth';

const AuthContext = createContext();

// 👉 If this build is only for one role, you can force it here:
// const CURRENT_APP_ROLE = 'business'; // or 'driver'
const CURRENT_APP_ROLE = null; // leave null to use backend-returned role

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(true);

  // App meta
  const [userRole, setUserRole] = useState(null);          // 'driver' | 'business' | null
  const [isRegistered, setIsRegistered] = useState(false); // boolean
  const [softSignedOut, setSoftSignedOut] = useState(false);

  // Keep last payload we sent to Flutter to prevent duplicates
  const lastBridgePayloadRef = useRef('');

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

    // Tell Flutter we’re “logged out” at app level
    trySendToFlutter({
      type: 'auth',
      idToken: null,
      uid: null,
      role: null,
      isRegistered: false,
      shopId: null,
    });
  };
  const endSoftLogout = () => setSoftSignedOut(false);

  // ---------- helpers ----------

  const trySendToFlutter = (obj) => {
    const json = JSON.stringify(obj);
    if (json === lastBridgePayloadRef.current) return; // avoid repeating same payload
    lastBridgePayloadRef.current = json;

    if (window?.AuthBridge?.postMessage) {
      window.AuthBridge.postMessage(json);
      console.log('➡️  AuthBridge payload →', obj);
    } else {
      console.log('ℹ️ AuthBridge not available (normal browser). Payload:', obj);
    }

    // Optional: surface in WebView via Toaster channel too
    try {
      if (window?.Toaster?.postMessage) {
        const roleTxt = obj.role ?? 'null';
        const shopTxt = obj.shopId ?? 'null';
        window.Toaster.postMessage(`AuthBridge: role=${roleTxt} shopId=${shopTxt}`);
      }
    } catch {}
  };

  const refreshUserMeta = async (firebaseUser) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch(
        `https://jio-yatri-driver.onrender.com/api/user/check-registration/${firebaseUser.uid}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      const json = await res.json();
      console.log('[check-registration] RESPONSE:', json);

      const raw = json?.data ?? {};
      // Use backend role unless CURRENT_APP_ROLE is set
      const role = CURRENT_APP_ROLE ?? (raw.role ?? null);
      const registered = !!raw.isRegistered;
      const shopId = raw.shopId ?? null; // backend should set for business

      setUserRole(role);
      setIsRegistered(registered);
      localStorage.setItem('userRole', role || '');
      localStorage.setItem('isRegistered', registered ? '1' : '0');

      return { role, isRegistered: registered, shopId };
    } catch (err) {
      console.error('[check-registration] FAILED:', err);
      // Keep state safe defaults
      setUserRole(null);
      setIsRegistered(false);
      localStorage.setItem('userRole', '');
      localStorage.setItem('isRegistered', '0');
      return { role: CURRENT_APP_ROLE ?? null, isRegistered: false, shopId: null };
    }
  };

  const buildBridgePayload = (firebaseUser, idToken, meta) => ({
    type: 'auth',
    idToken: idToken || null,
    uid: firebaseUser?.uid || null,
    role: CURRENT_APP_ROLE ?? (meta?.role ?? null),
    isRegistered: !!meta?.isRegistered,
    shopId: meta?.shopId ?? null,
  });

  const syncAuthToFlutter = async (firebaseUser) => {
    if (!firebaseUser) {
      trySendToFlutter({
        type: 'auth',
        idToken: null,
        uid: null,
        role: null,
        isRegistered: false,
        shopId: null,
      });
      return;
    }

    // 1) Token
    const idToken = await firebaseUser.getIdToken(true);
    setToken(idToken);
    localStorage.setItem('authToken', idToken);

    // 2) Meta (role, registered, shopId)
    const meta = await refreshUserMeta(firebaseUser);

    // 3) Send one combined message to Flutter
    const payload = buildBridgePayload(firebaseUser, idToken, meta);
    trySendToFlutter(payload);
  };

  // ---------- listeners ----------

  // Primary auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      try {
        if (softSignedOut) {
          setLoading(false);
          return;
        }

        if (currentUser) {
          setUser(currentUser);
          await syncAuthToFlutter(currentUser);
        } else {
          logout();
          await syncAuthToFlutter(null);
        }
      } catch (error) {
        console.error('[onAuthStateChanged] error:', error);
        setMessage({ text: error.message, isError: true });
        logout();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [softSignedOut]);

  // Keep Flutter in sync when the Firebase ID token refreshes
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (fbUser) => {
      if (!fbUser || softSignedOut) return;
      try {
        await syncAuthToFlutter(fbUser);
      } catch (err) {
        console.error('Failed to forward idToken/meta:', err);
      }
    });
    return () => unsub();
  }, [softSignedOut]);

  const value = useMemo(() => ({
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
  }), [
    user, token, message, loading, userRole, isRegistered, softSignedOut
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
