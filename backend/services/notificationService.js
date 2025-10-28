// // backend/services/notificationService.js
// const admin = require('firebase-admin');

// // Initialize Firebase Admin SDK
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(
//       JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
//     ),
//   });
// }


// /**
//  * Send FCM notification to a driver
//  * @param {string} driverId - Firebase UID of the driver
//  * @param {string} title - Notification title
//  * @param {string} body - Notification message
//  * @param {object} data - Additional data (e.g., shipment details)
//  */
// const sendNotificationToDriver = async (driverId, title, body, data = {}) => {
//   try {
//     console.log('[SEND] Looking up driver in DB:', driverId);

//     // Fetch driver's FCM token from DB
//     const driver = await Driver.findOne({ userId: driverId });

//     if (!driver) {
//       console.log('[SEND] Driver not found:', driverId);
//       return;
//     }

//     if (!driver.fcmToken) {
//       console.log('[SEND] No FCM token for driver:', driverId);
//       return;
//     }

//     console.log('[SEND] FCM token found:', driver.fcmToken);

//     const message = {
//       notification: { title, body },
//       data: {
//         ...data,
//         click_action: 'FLUTTER_NOTIFICATION_CLICK'
//       },
//       token: driver.fcmToken,
//     };

//     console.log('[SEND] Sending message via FCM:', JSON.stringify(message, null, 2));

//     const response = await admin.messaging().send(message);

//     console.log('[SEND] Notification sent successfully. FCM Response:', response);
//     return response;
//   } catch (error) {
//     console.error('[SEND] Error sending FCM:', error.message);
//     if (error.errorInfo) {
//       console.error('[SEND] Firebase error info:', error.errorInfo);
//     }
//     throw error;
//   }
// };

// /**
//  * Notify driver when a new shipment is available
//  */
// const notifyNewShipment = async (driverId, shipment) => {
//   console.log('[NOTIFY] notifyNewShipment called');
//   console.log('[NOTIFY] Driver ID:', driverId);
//   console.log('[NOTIFY] Shipment Info:', {
//     id: shipment._id,
//     vehicleType: shipment.vehicleType
//   });

//   const title = '🚚 New Shipment Available!';
//   const body = `A ${shipment.vehicleType} shipment is ready for pickup.`;

//   try {
//     const result = await sendNotificationToDriver(driverId, title, body, {
//       shipmentId: shipment._id.toString(),
//       type: 'NEW_SHIPMENT',
//       icon: '/logo.jpg', 
//     });

//     console.log('[NOTIFY] Notification result:', result);
//     return result;
//   } catch (err) {
//     console.error('[NOTIFY] Error while notifying driver:', err.message);
//     throw err;
//   }
// };

// module.exports = {
//   sendNotificationToDriver,
//   notifyNewShipment
// };

const admin = require('firebase-admin');
const Driver = require('../models/Driver');
const Shop=require('../models/CategoryModel')
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  console.log('[INIT] Initializing Firebase Admin SDK...');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('[INIT] Firebase Admin initialized');
} else {
  console.log('[INIT] Firebase Admin already initialized');
}
// ⬇️ REPLACE your sendToToken with this version
const sendToToken = async (token, { title, body, data = {} }) => {
  // Ensure data values are strings
  const dataStr = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  const message = {
    token,

    // ✅ ANDROID APP (native FCM in WebView)
    // This is what makes msg.notification non-null in your Dart code
   
    android: {
      priority: 'high',
      // Optional: uncomment if you want to force the same channel as Dart
      // notification: { channelId: 'driver_general' },
    },

    // ✅ WEBSITE (Service Worker)
    webpush: {
      notification: {
        title,
        body,
        icon: '/logo.jpg',
      },
      fcmOptions: {
        link: '/business-orders',
      },
    },

    // ✅ SHARED DATA (must be strings)
     data: {
      ...dataStr,
      title,   // 👈 now also added here
      body,    // 👈 now also added here
      link: '/business-orders',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
  };

  try {
    const resp = await admin.messaging().send(message);
    console.log('[FCM] sent ok ->', token.slice(0, 12), '…', resp);
    return { ok: true, resp };
  } catch (err) {
    console.error('[FCM] send error ->', token.slice(0, 12), '…', err.code || err.errorInfo?.code, err.message);
    return { ok: false, err };
  }
};

// Update to only use the array approach
const sendToManyTokens = async (tokens, payload, shopId) => {
  if (!tokens || tokens.length === 0) return;

  const results = await Promise.all(tokens.map(t => sendToToken(t, payload)));

  // Clean up invalid tokens
  const badTokens = [];
  results.forEach((result, index) => {
    if (!result.ok) {
      const errorCode = result.err?.errorInfo?.code;
      if (errorCode === 'messaging/invalid-registration-token' || 
          errorCode === 'messaging/registration-token-not-registered') {
        badTokens.push(tokens[index]);
      }
    }
  });

  if (badTokens.length > 0) {
    await Shop.updateOne(
      { _id: shopId }, 
      { $pull: { fcmTokens: { $in: badTokens } } }
    );
    console.log(`[FCM] Removed ${badTokens.length} invalid tokens`);
  }
};
/**
 * Send FCM notification to a driver
 * @param {string} driverId - Firebase UID of the driver
 * @param {string} title - Notification title
 * @param {string} body - Notification message
 * @param {object} data - Additional data (e.g., shipment details)
 */
const sendNotificationToDriver = async (driverId, title, body, data = {}) => {
  try {
    console.log('[SEND] Looking up driver in DB:', driverId);

    // Fetch driver's FCM token from DB
    const driver = await Driver.findOne({ userId: driverId });

    if (!driver) {
      console.log('[SEND] Driver not found:', driverId);
      return;
    }

    if (!driver.fcmToken) {
      console.log('[SEND] No FCM token for driver:', driverId);
      return;
    }

    console.log('[SEND] FCM token found:', driver.fcmToken);

    const message = {
  token: driver.fcmToken,
  android: { priority: 'high' },
  data: {
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])), // make sure values are strings
    title,
    body,
    link: '/orders?scrollTo=shipments',
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
  },
};


    console.log('[SEND] Sending message via FCM:', JSON.stringify(message, null, 2));

    const response = await admin.messaging().send(message);

    console.log('[SEND] Notification sent successfully. FCM Response:', response);
    return response;
  } catch (error) {
    console.error('[SEND] Error sending FCM:', error.message);
    if (error.errorInfo) {
      console.error('[SEND] Firebase error info:', error.errorInfo);
    }
    throw error;
  }
};

/**
 * Notify driver when a new shipment is available
 */
const notifyNewShipment = async (driverId, shipment) => {
  console.log('[NOTIFY] notifyNewShipment called');
  console.log('[NOTIFY] Driver ID:', driverId);
  console.log('[NOTIFY] Shipment Info:', {
    id: shipment._id,
    vehicleType: shipment.vehicleType
  });

  const title = 'JioYatri Driver — New shipment';
  const body = `Shipment ${shipment.orderCode || shipment._id.toString().slice(-6)} ready for pickup`;

  try {
    const result = await sendNotificationToDriver(driverId, title, body, {
      shipmentId: shipment._id.toString(),
      type: 'NEW_SHIPMENT',
       icon: '/logo.jpg', // Add this line
    });

    console.log('[NOTIFY] Notification result:', result);
    return result;
  } catch (err) {
    console.error('[NOTIFY] Error while notifying driver:', err.message);
    throw err;
  }
};
const notifyShopNewOrder = async (shopId, orderDoc) => {
  const shop = await Shop.findById(shopId).lean();
  if (!shop) return;

  const title = 'New Order Received';
  const body  = `${orderDoc.customer?.name || 'Customer'} placed order ${orderDoc.orderCode}`;
  const data = {
    type: 'NEW_ORDER',
    orderId: String(orderDoc._id),
    orderCode: orderDoc.orderCode || '',
    shopId: String(shopId),
  };

  const tokens = Array.isArray(shop.fcmTokens) ? shop.fcmTokens.filter(Boolean) : [];
  if (tokens.length) {
    await sendToManyTokens(tokens, { title, body, data }, shopId);
  } else if (shop.fcmToken) {
    await sendToToken(shop.fcmToken, { title, body, data });
  } else {
    console.warn('[FCM] no tokens for shop', String(shopId));
  }
};

module.exports = {
  sendNotificationToDriver,
  notifyNewShipment,
  notifyShopNewOrder, 
};










