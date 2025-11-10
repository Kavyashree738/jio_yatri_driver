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
import { onIdTokenChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [message, setMessage] = useState({ text: '', isError: false });
  const [loading, setLoading] = useState(true);

  // Role/registration state
  const [userRole, setUserRole] = useState(null);          // 'driver' | 'business' | null
  const [isRegistered, setIsRegistered] = useState(false); // boolean
  const [softSignedOut, setSoftSignedOut] = useState(false);

  // 🔹 Logout clears everything
  const logout = async () => {
    try {
      const uid = auth.currentUser?.uid;
if (uid) localStorage.removeItem(`registration_${uid}`);

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
    setMessage({ text: '', isError: false });
  };

  const softLogout = async () => {
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
    setMessage({ text: '', isError: false });
    setSoftSignedOut(true);
  };

  const endSoftLogout = () => setSoftSignedOut(false);

  // 🔹 Call this after a shop is created so Flutter gets updated shopId
  const sendUpdatedShopIdToFlutter = async (firebaseUser) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const shopId = await fetchShopIdForOwner(firebaseUser);

      if (window.AuthBridge && typeof window.AuthBridge.postMessage === 'function') {
        const payload = {
          type: 'auth',
          idToken,
          uid: firebaseUser.uid,
          role: 'business',
          shopId,
          isRegistered: true, // now they have shop, so considered registered
        };
        window.AuthBridge.postMessage(JSON.stringify(payload));
        console.log("✅ Re-sent updated shopId to Flutter via AuthBridge", payload);
      }
    } catch (err) {
      console.error("❌ Failed to send updated shopId to Flutter:", err);
    }
  };


  // 🔹 Always fetch latest role/isRegistered from backend
  const refreshUserMeta = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(
      `https://jio-yatri-driver.onrender.com/api/user/check-registration/${firebaseUser.uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    const json = await res.json();

    if (json.success) {
      const role = json.data.role;
      const driverRegistered = !!json.data.driverRegistered;
      const businessRegistered = !!json.data.businessRegistered;

      setUserRole(role);
      setIsRegistered(
        role === 'driver' ? driverRegistered : businessRegistered
      );

      // ✅ Store registration data in localStorage for faster reloads
localStorage.setItem(
  `registration_${firebaseUser.uid}`,
  JSON.stringify({
    role,
    isRegistered: role === 'driver' ? driverRegistered : businessRegistered,
  })
);


      localStorage.setItem('userRole', role || '');

      return { role, driverRegistered, businessRegistered };
    }

    return {};
  };


  // 🔹 For business owners, fetch first shop _id
 // ✅ NEW: Fetch all shop IDs for a business owner
const fetchShopIdsForOwner = async (firebaseUser) => {
  const idToken = await firebaseUser.getIdToken();
  const res = await fetch(
    `https://jio-yatri-driver.onrender.com/api/shops/owner/${firebaseUser.uid}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  const json = await res.json();
  if (json?.success && Array.isArray(json.data)) {
    return json.data.map((shop) => shop._id).filter(Boolean);
  }
  return [];
};


  // 🔹 Sync Firebase auth with our app state
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

          const cached = localStorage.getItem(`registration_${currentUser.uid}`);
  if (cached) {
    const parsed = JSON.parse(cached);
    console.log('⚡ Loaded registration info from cache');
    setUserRole(parsed.role);
    setIsRegistered(parsed.isRegistered);
  }


          // Always fetch fresh meta from backend
        refreshUserMeta(currentUser);
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

  // 🔹 Forward {idToken, uid, role, shopId, isRegistered} to Flutter
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return;
      try {
        // Fresh ID token
        const idToken = await firebaseUser.getIdToken(true);

        // Always fetch backend truth
        const meta = await refreshUserMeta(firebaseUser);
        const role = meta?.role || null;
        const isRegisteredFromAPI = !!meta?.isRegistered;

        // If business, also fetch shopId
        let shopIds = [];
if (role === 'business') {
  try {
    shopIds = await fetchShopIdsForOwner(firebaseUser); // ✅ use plural version
  } catch (e) {
    console.warn('Failed to fetch shopIds for owner:', e);
  }
}




        console.log(
          `🌐 Web Auth Meta (before bridge) -> uid=${firebaseUser.uid}, role=${role}, isRegistered=${isRegisteredFromAPI}, shopId=${shopId}`
        );
        // Send to Flutter WebView via AuthBridge
        if (window.AuthBridge && typeof window.AuthBridge.postMessage === 'function') {
          const payload = {
            type: 'auth',
            idToken,
            uid: firebaseUser.uid,
            role,              // backend truth
            shopIds,            // backend truth
            driverRegistered: meta?.driverRegistered || false,
            businessRegistered: meta?.businessRegistered || false,
            isRegistered: role === 'driver'
              ? !!meta?.driverRegistered
              : !!meta?.businessRegistered, // backward compatibility
          };
          window.AuthBridge.postMessage(JSON.stringify(payload));
          console.log('✅ Sent ID token + role + shopId + isRegistered to Flutter via AuthBridge', payload);
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
    sendUpdatedShopIdToFlutter,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
