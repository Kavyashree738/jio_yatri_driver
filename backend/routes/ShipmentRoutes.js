const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/ShipmentController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');

// Debugging check
console.log('[Debug] Middleware type:', typeof verifyFirebaseToken);
console.log('[Debug] Controller methods:', {
  calculateDistance: typeof shipmentController.calculateDistance,
  createShipment: typeof shipmentController.createShipment,
  getUserShipments: typeof shipmentController.getUserShipments
});

// Routes
router.post('/calculate-distance', shipmentController.calculateDistance);
router.post('/', verifyFirebaseToken, shipmentController.createShipment);
router.get('/my-shipments', verifyFirebaseToken, shipmentController.getUserShipments);
router.put('/:id/accept', verifyFirebaseToken, shipmentController.acceptShipment);

router.get('/:orderId/status', verifyFirebaseToken, shipmentController.getOrderStatus);

router.get('/matching',verifyFirebaseToken , shipmentController.getMatchingShipments);




module.exports = router;