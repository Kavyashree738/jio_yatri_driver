// backend/services/notificationService.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}


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
      notification: { title, body },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      token: driver.fcmToken,
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

  const title = '🚚 New Shipment Available!';
  const body = `A ${shipment.vehicleType} shipment is ready for pickup.`;

  try {
    const result = await sendNotificationToDriver(driverId, title, body, {
      shipmentId: shipment._id.toString(),
      type: 'NEW_SHIPMENT',
    });

    console.log('[NOTIFY] Notification result:', result);
    return result;
  } catch (err) {
    console.error('[NOTIFY] Error while notifying driver:', err.message);
    throw err;
  }
};

module.exports = {
  sendNotificationToDriver,
  notifyNewShipment
};


