// src/services/ownerFCM.js (or utils/ownerFCM.js)
import axios from 'axios';
import { initMessaging, publicVapidKey, getToken, onMessage } from '../firebase';

const apiBase = 'https://jio-yatri-driver.onrender.com';

let messagingInstance = null;
let messagingReady = false;
const postedForShop = new Set();        // ✅ per-shop tracking
let onMessageBound = false;

export const initializeOwnerFCM = async (shopId) => {
  try {
    if (!messagingReady) {
      if (!messagingInstance) {
        messagingInstance = await initMessaging();
        if (!messagingInstance) return;
      }
      // make sure SW is registered at root
      let swReg = await navigator.serviceWorker.getRegistration('/');
      if (!swReg) {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      }

      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }
      messagingReady = true;

      // bind once
      if (!onMessageBound) {
        onMessageBound = true;
        onMessage(messagingInstance, (payload) => {
          console.log('📩 Owner Foreground FCM:', payload);
          if (payload.notification) {
            const { title, body } = payload.notification;
            new Notification(title, { body, icon: '/logo.jpg' });
          }
          new Audio('/notification.wav').play().catch(() => {});
        });
      }
    }

    // ✅ Always ensure the token is saved for THIS shop
    if (!postedForShop.has(shopId)) {
      const swReg = await navigator.serviceWorker.getRegistration('/');
      const token = await getToken(messagingInstance, {
        vapidKey: publicVapidKey,
        serviceWorkerRegistration: swReg,
      });
      if (!token) {
        console.warn('[OwnerFCM] no token returned');
        return;
      }
      await axios.post(`${apiBase}/api/shops/${shopId}/fcm-token`, { token });
      console.log('[OwnerFCM] token saved for shop', shopId);
      postedForShop.add(shopId);
    }
  } catch (e) {
    console.error('[OwnerFCM] init error:', e);
  }
};
