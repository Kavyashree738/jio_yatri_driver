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
    // Fetch driver's FCM token from DB
    const driver = await Driver.findOne({ userId: driverId });
    
    if (!driver || !driver.fcmToken) {
      console.log('Driver not found or no FCM token');
      return;
    }

    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' }, // For handling clicks
      token: driver.fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('Notification sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending FCM:', error);
    throw error;
  }
};

/**
 * Notify driver when a new shipment is available
 */
const notifyNewShipment = async (driverId, shipment) => {
  const title = '🚚 New Shipment Available!';
  const body = `A ${shipment.vehicleType} shipment is ready for pickup.`;

  return sendNotificationToDriver(driverId, title, body, {
    shipmentId: shipment._id.toString(),
    type: 'NEW_SHIPMENT',
  });
};


module.exports = { sendNotificationToDriver, notifyNewShipment };
