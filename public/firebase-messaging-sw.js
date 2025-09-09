console.log('----------------Service Worker loaded-------------------'); 
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCGj9Pe7wntlvo0oRcIzGAsMdGIAlcjQG0",
  authDomain: "authentication-e6bd0.firebaseapp.com",
  projectId: "authentication-e6bd0",
  storageBucket: "authentication-e6bd0.appspot.com",
  messagingSenderId: "677308686776",
  appId: "1:677308686776:web:1b2f3d1c665328a516af4d"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

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

  const notificationOptions = { body, icon: '/newlogo.jpg', data: payload.data };

  self.registration.showNotification(title, notificationOptions);
});


// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  // Default to home
  let url = '/';

  // Decide route based on type
  if (data.type === 'NEW_SHIPMENT') {
    url = '/orders';             // driver notification
  } else if (data.type === 'NEW_ORDER') {
    url = '/business-orders';    // business/shop notification
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});



