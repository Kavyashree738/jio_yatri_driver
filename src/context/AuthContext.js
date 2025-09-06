// import { createContext, useContext, useState, useEffect } from 'react';
// import { auth } from '../firebase';

// const AuthContext = createContext();


// export function AuthProvider({ children }) {
//     const [user, setUser] = useState(null);
//     const [token, setToken] = useState(null);
//     const [message, setMessage] = useState({ text: '', isError: false });
//     const [loading, setLoading] = useState(true);

//     const login = (userData, authToken) => {
//         setUser(userData);
//         setToken(authToken);
//         localStorage.setItem('authToken', authToken);
//     };

//     const logout = () => {
//         setUser(null);
//         setToken(null);
//         localStorage.removeItem('authToken');
//         setMessage({ text: '', isError: false });
//     };

//     useEffect(() => {
//         const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
//             if (currentUser) {

//                 try {
//                     const idToken = await currentUser.getIdToken();
//                     setUser(currentUser);
//                     setToken(idToken);
//                     localStorage.setItem('authToken', idToken);
//                 } catch (error) {
//                     setMessage({ text: error.message, isError: true });
//                     logout();
//                 }
//             } else {
//                 logout();
//             }
//             setLoading(false);
//         });

//         return () => unsubscribe();
//     }, []);

//     const value = {
//         user,
//         token,
//         message,
//         login,
//         logout,
//         setMessage,
//         loading,
//     };

//     return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// }

// export function useAuth() {
//     const context = useContext(AuthContext);
//     if (context === undefined) {
//         throw new Error('useAuth must be used within an AuthProvider');
//     }
//     return context;
// }

// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onIdTokenChanged } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(true);

  // NEW
  const [userRole, setUserRole] = useState(null);          // 'driver' | 'business' | null
  const [isRegistered, setIsRegistered] = useState(false); // boolean
  const [softSignedOut, setSoftSignedOut] = useState(false);

  // ✅ NEW: Owner shopId
  const [shopId, setShopId] = useState(null);

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserRole(null);
    setIsRegistered(false);
    setShopId(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isRegistered');
    setMessage({ text: '', isError: false });
  };

  // Soft logout (don’t sign out Firebase, just reset app state)
  const softLogout = () => {
    setUser(null);
    setToken(null);
    setUserRole(null);
    setIsRegistered(false);
    setShopId(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isRegistered');
    setMessage({ text: '', isError: false });
    setSoftSignedOut(true);
  };

  const endSoftLogout = () => setSoftSignedOut(false);

  // Load role/registration (+ shopId if your API returns it)
  const refreshUserMeta = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(
      `https://jio-yatri-driver.onrender.com/api/user/check-registration/${firebaseUser.uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    const json = await res.json();
    if (json.success) {
      setUserRole(json.data.role);
      setIsRegistered(!!json.data.isRegistered);
      localStorage.setItem('userRole', json.data.role || '');
      localStorage.setItem('isRegistered', json.data.isRegistered ? '1' : '0');

      if (json.data?.shopId) setShopId(json.data.shopId); // ✅ capture shopId if present
    }
    return json.data; // return meta for immediate use
  };

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

          // load role + registration
          const meta = await refreshUserMeta(currentUser);

          // If shopId not returned but role is business, fetch it now
          if (!meta?.shopId && meta?.role === 'business') {
            try {
              const idToken2 = await currentUser.getIdToken();
              const res2 = await fetch(
                'https://jio-yatri-driver.onrender.com/api/shops/me',
                { headers: { Authorization: `Bearer ${idToken2}` } }
              );
              const j2 = await res2.json();
              if (j2.success && j2?.data?._id) setShopId(j2.data._id);
            } catch (e) {
              console.error('Failed to fetch shopId:', e);
            }
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

  // ✅ Send {idToken, uid, shopId} to Flutter once both are ready
  useEffect(() => {
    if (!user || !shopId) return;
    (async () => {
      try {
        const idToken = await user.getIdToken(true);
        const payload = {
          type: 'auth',
          uid: user.uid,
          idToken,
          shopId, // IMPORTANT
        };

        if (window.AuthBridge && typeof window.AuthBridge.postMessage === 'function') {
          window.AuthBridge.postMessage(JSON.stringify(payload));
          console.log('✅ Sent idToken + shopId to Flutter via AuthBridge');
        }
      } catch (e) {
        console.error('AuthBridge send (shop) failed:', e);
      }
    })();
  }, [user, shopId]);

  // Keep forwarding token updates too; include shopId when available
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) return;
      try {
        const idToken = await u.getIdToken(true);
        const payload = { type: 'auth', idToken, uid: u.uid };
        if (shopId) payload.shopId = shopId;

        if (window.AuthBridge && typeof window.AuthBridge.postMessage === 'function') {
          window.AuthBridge.postMessage(JSON.stringify(payload));
          console.log('✅ Sent ID token to Flutter via AuthBridge', payload);
        }
      } catch (err) {
        console.error('Failed to get web idToken:', err);
      }
    });

    return () => unsub();
  }, [shopId]);

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
    shopId, // optional: expose if needed elsewhere
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
