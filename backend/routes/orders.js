// routes/orders.js
const express = require('express');
const router = express.Router();
const orderCtrl = require('../controllers/orderController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
router.post('/', verifyFirebaseToken,orderCtrl.createOrder);

// put specific routes BEFORE generic ones
router.get('/owner/:ownerId', /*verifyFirebaseToken,*/ orderCtrl.getOrdersByOwner);
router.get('/shop/:shopId', /*verifyFirebaseToken,*/ orderCtrl.getOrdersByShop);

router.get('/', orderCtrl.getOrdersByUser);
router.get('/:id', orderCtrl.getOrder);

router.patch('/:id/status', /*verifyFirebaseToken,*/ orderCtrl.updateOrderStatus);
router.patch('/:id/payment', orderCtrl.updatePaymentStatus);
router.get('/earnings/owner/:ownerId',orderCtrl.getOwnerEarnings);
module.exports = router;
