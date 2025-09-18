const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
console.log('---------------------')
router.post('/record', verifyFirebaseToken, settlementController.recordPayment);
router.get('/driver/:userId', verifyFirebaseToken, settlementController.getDriverSettlement);
router.post('/complete/:userId', verifyFirebaseToken, settlementController.completeSettlement);
router.post('/daily', settlementController.dailySettlement); // Should be protected in production
router.get('/check-settlement/:userId', verifyFirebaseToken, settlementController.checkSettlement);
router.post('/initiate-payment', verifyFirebaseToken,settlementController.initiateSettlementPayment);
router.post('/verify-payment', verifyFirebaseToken,settlementController.verifySettlementPayment);


module.exports = router;
