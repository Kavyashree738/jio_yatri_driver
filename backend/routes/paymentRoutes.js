const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');

router.post('/:id/initiate', verifyFirebaseToken, paymentController.initiatePayment);
router.post('/verify', paymentController.verifyPayment);
router.post('/:id/cash', verifyFirebaseToken, paymentController.markCashPaid);

module.exports = router;