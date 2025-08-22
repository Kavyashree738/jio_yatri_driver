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

import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';

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
  // 👇 Soft logout: keep Firebase session, but reset app state and show phone verify UI
  const softLogout = () => {
    // wipe app state, but DON'T call auth.signOut()
    setUser(null);
    setToken(null);
    setUserRole(null);
    setIsRegistered(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isRegistered');
    setMessage({ text: '', isError: false });
    setSoftSignedOut(true); // gate the auth listener
  };

   const endSoftLogout = () => setSoftSignedOut(false);
  // Helper to (re)load role + registration from API
  // in AuthProvider
  const refreshUserMeta = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch(`http://localhost:5000/api/user/check-registration/${firebaseUser.uid}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    const json = await res.json();
    if (json.success) {
      setUserRole(json.data.role);
      setIsRegistered(!!json.data.isRegistered);
      localStorage.setItem('userRole', json.data.role || '');
      localStorage.setItem('isRegistered', json.data.isRegistered ? '1' : '0');
    }
    return json.data; // <-- ✅ so callers can immediately use it
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
  }, [softSignedOut]);

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
    endSoftLogout
    // expose this
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
