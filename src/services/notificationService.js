import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { initMessaging, publicVapidKey, getToken } from '../firebase';
import { onMessage } from 'firebase/messaging';

let messaging = null;

export const initializeFCM = async () => {
  try {
    messaging = await initMessaging();
    if (!messaging) return null;

    const permission = Notification.permission;
    console.log("Current notification permission:", permission);

    if (permission === "granted") {
      return await getAndSendToken();
    }
    
    return null;
  } catch (error) {
    console.error("FCM initialization error:", error);
    return null;
  }
};

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    console.log("Permission result:", permission);
    
    if (permission === "granted") {
      return await getAndSendToken();
    }
    
    return null;
  } catch (error) {
    console.error("Permission request error:", error);
    return null;
  }
};

const getAndSendToken = async () => {
  try {
    const token = await getToken(messaging, { vapidKey: publicVapidKey });
    console.log("FCM token generated:", token);
    await sendTokenToBackend(token);
    return token;
  } catch (error) {
    console.error("Token generation error:", error);
    return null;
  }
};

const sendTokenToBackend = async (token) => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) return;

  try {
    const idToken = await user.getIdToken();
    await axios.post('https://jio-yatri-driver.onrender.com/api/driver/fcm-token', { token }, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    console.log("FCM token sent to backend");
  } catch (error) {
    console.error("Failed to send FCM token:", error);
  }
};
export const setupForegroundNotifications = async () => {
  if (!messaging) {
    messaging = await initMessaging();
    if (!messaging) return;
  }

  onMessage(messaging, (payload) => {
    console.log("📩 Foreground FCM Message:", payload);
    const { title, body } = payload.notification || {};

    if (title && body) {
      new Notification(title, {
        body,
        icon: '/logo.jpg'
      });

      const audio = new Audio('/notification.wav');
      audio.play().catch(err => console.warn("Sound blocked:", err));
    }
  });
};
