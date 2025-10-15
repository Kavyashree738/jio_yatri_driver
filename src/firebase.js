import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getDatabase } from 'firebase/database'; 

const firebaseConfig = {
  apiKey: "AIzaSyCGj9Pe7wntlvo0oRcIzGAsMdGIAlcjQG0",
  authDomain: "authentication-e6bd0.firebaseapp.com",
  projectId: "authentication-e6bd0",
  storageBucket: "authentication-e6bd0.appspot.com",
  messagingSenderId: "677308686776",
  appId: "1:677308686776:web:1b2f3d1c665328a516af4d",
  databaseURL:"https://authentication-e6bd0-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

// Services
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const storage = getStorage(app);
const db = getDatabase(app);

// FCM
let messaging = null;
const initMessaging = async () => {
  if (await isSupported()) {
    messaging = getMessaging(app);
  }
  return messaging;
};

// VAPID key from Firebase Console
const publicVapidKey = "BCIwYPyp0PXH_rwzHk-hDjM4xHFDihQ4IcoNjqNqed20DRO-gQx-7fPIg0v32n67xysIzm5QRHg23JpwgBzfzlk";


export {
  auth,
  googleProvider,
  storage,
    db,
  initMessaging,
  publicVapidKey,
  getToken,
  onMessage
};
