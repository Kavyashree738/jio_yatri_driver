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

// import { createContext, useContext, useState, useEffect } from 'react';
// import { auth } from '../firebase';
// import { onIdTokenChanged } from 'firebase/auth';

// const AuthContext = createContext();

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(null);
//   const [token, setToken] = useState(null);
//   const [message, setMessage] = useState({ text: '', isError: false });
//   const [loading, setLoading] = useState(true);

//   // NEW
//   const [userRole, setUserRole] = useState(null);          // 'driver' | 'business' | null
//   const [isRegistered, setIsRegistered] = useState(false); // boolean
//   const [softSignedOut, setSoftSignedOut] = useState(false);
//   const logout = () => {
//     setUser(null);
//     setToken(null);
//     setUserRole(null);
//     setIsRegistered(false);
//     localStorage.removeItem('authToken');
//     localStorage.removeItem('userRole');
//     localStorage.removeItem('isRegistered');
//     setMessage({ text: '', isError: false });
//   };
//   // 👇 Soft logout: keep Firebase session, but reset app state and show phone verify UI
//   const softLogout = () => {
//     // wipe app state, but DON'T call auth.signOut()
//     setUser(null);
//     setToken(null);
//     setUserRole(null);
//     setIsRegistered(false);
//     localStorage.removeItem('authToken');
//     localStorage.removeItem('userRole');
//     localStorage.removeItem('isRegistered');
//     setMessage({ text: '', isError: false });
//     setSoftSignedOut(true); // gate the auth listener
//   };

//    const endSoftLogout = () => setSoftSignedOut(false);
//   // Helper to (re)load role + registration from API
//   // in AuthProvider
//   const refreshUserMeta = async (firebaseUser) => {
//     const idToken = await firebaseUser.getIdToken();
//     const res = await fetch(`https://jio-yatri-driver.onrender.com/api/user/check-registration/${firebaseUser.uid}`, {
//       headers: { Authorization: `Bearer ${idToken}` }
//     });
//     const json = await res.json();
//     if (json.success) {
//       setUserRole(json.data.role);
//       setIsRegistered(!!json.data.isRegistered);
//       localStorage.setItem('userRole', json.data.role || '');
//       localStorage.setItem('isRegistered', json.data.isRegistered ? '1' : '0');
//     }
//     return json.data; // <-- ✅ so callers can immediately use it
//   };


//   useEffect(() => {
//     const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
//       try {
//         if (softSignedOut) {
//           setLoading(false);
//           return;
//         }

//         if (currentUser) {
//           const idToken = await currentUser.getIdToken();
//           setUser(currentUser);
//           setToken(idToken);
//           localStorage.setItem('authToken', idToken);

//           // load role + registration
//           await refreshUserMeta(currentUser);
//         } else {
//           logout();
//         }
//       } catch (error) {
//         setMessage({ text: error.message, isError: true });
//         logout();
//       } finally {
//         setLoading(false);
//       }
//     });

//     return () => unsubscribe();
//   }, [softSignedOut]);

//   useEffect(() => {
//   // Forward Firebase ID token to Flutter (only works in WebView)
//   const unsub = onIdTokenChanged(auth, async (user) => {
//     if (!user) return;
//     try {
//       const idToken = await user.getIdToken(true);
//       const payload = JSON.stringify({ type: 'auth', idToken, uid: user.uid });

//       if (window.AuthBridge && typeof window.AuthBridge.postMessage === 'function') {
//         window.AuthBridge.postMessage(payload);
//         console.log('✅ Sent ID token to Flutter via AuthBridge');
//       } else {
//         console.log('ℹ️ AuthBridge not available (normal browser)');
//       }
//     } catch (err) {
//       console.error('Failed to get web idToken:', err);
//     }
//   });

//   return () => unsub();
// }, []);


//   const value = {
//     user,
//     token,
//     message,
//     setMessage,
//     loading,
//     userRole,
//     isRegistered,
//     refreshUserMeta,
//     softSignedOut,
//     softLogout,
//     endSoftLogout
//     // expose this
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
//   return ctx;
// }


// src/context/AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onIdTokenChanged,signOut } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(true);

  // Role/registration state (as you had)
  const [userRole, setUserRole] = useState(null);          // 'driver' | 'business' | null
  const [isRegistered, setIsRegistered] = useState(false); // boolean
  const [softSignedOut, setSoftSignedOut] = useState(false);

  const logout =async () => {
    try {
    await signOut(auth);
  } catch (err) {
    console.error("Error signing out:", err);
  }
    setUser(null);
    setToken(null);
    setUserRole(null);
    setIsRegistered(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isRegistered');
    setMessage({ text: '', isError: false });
  };


  const softLogout =async () => {
     try {
     await signOut(auth);
  } catch (err) {
     console.error("Error signing out:", err);
  }
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

  // -----------------------------
  // Load role + registration (NO change to your API)
  // -----------------------------
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
    }
    return json.data; // { role, isRegistered, ... }
  };

  // -----------------------------
  // Get first shop _id for business owner (NO API change)
  // -----------------------------
  const fetchShopIdForOwner = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(
      `https://jio-yatri-driver.onrender.com/api/shops/owner/${firebaseUser.uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    const json = await res.json();
    // Expecting: { success: true, data: [ { _id, ... }, ... ] }
    if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data[0]?._id || null; // Use the Shop document’s _id as shopId
    }
    return null;
  };

  // -----------------------------
  // Keep app state in sync with Firebase
  // -----------------------------
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
          await refreshUserMeta(currentUser);
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
  }, [softSignedOut]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------
  // Send {idToken, uid, role, shopId} to Flutter WebView via AuthBridge
  // -----------------------------
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return;
      try {
        // 1) Fresh ID token
        const idToken = await firebaseUser.getIdToken(true);

        // 2) Get role/isRegistered (no API change)
        const meta = await refreshUserMeta(firebaseUser);
        const role = meta?.role || null;

        // 3) If business, fetch first shop _id as shopId
        let shopId = null;
        if (role === 'business') {
          try {
            shopId = await fetchShopIdForOwner(firebaseUser);
          } catch (e) {
            console.warn('Failed to fetch shopId for owner:', e);
          }
        }

        // 4) Post to Flutter (AuthBridge)
        if (window.AuthBridge && typeof window.AuthBridge.postMessage === 'function') {
          const payload = {
            type: 'auth',
            idToken,
            uid: firebaseUser.uid,
            role,   // 'driver' | 'business' | null
            shopId, // null for driver; Shop _id for business
             isRegistered: meta?.isRegistered || false, 
          };
          window.AuthBridge.postMessage(JSON.stringify(payload));
          console.log('✅ Sent ID token + role + shopId to Flutter via AuthBridge', payload);
        } else {
          console.log('ℹ️ AuthBridge not available (normal browser)');
        }
      } catch (err) {
        console.error('Failed to forward ID token to Flutter:', err);
      }
    });

    return () => unsub();
  }, []); // run once

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
