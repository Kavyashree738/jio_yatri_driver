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

      // register service worker
      let swReg = await navigator.serviceWorker.getRegistration('/');
      if (!swReg) {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      }

      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }

      messagingReady = true;

      // ✅ bind onMessage once
      if (!onMessageBound) {
        onMessageBound = true;

        onMessage(messagingInstance, (payload) => {
          console.log('📩 Owner Foreground FCM:', payload);

          let title = 'New Notification';
          let body  = 'You have a new update';

          if (payload.notification) {
            title = payload.notification.title;
            body  = payload.notification.body;
          } else if (payload.data) {
            switch (payload.data.type) {
              case 'NEW_ORDER':
                title = 'New Order Received';
                body  = `Order #${payload.data.orderCode || payload.data.orderId}`;
                break;
              default:
                title = 'Update';
                body  = 'You have a new update';
            }
          }

          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/logo.jpg' });
          }

          new Audio('/notification.wav').play().catch(() => {});
        });
      }
    }

    // ✅ ensure token is posted for this shop
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

