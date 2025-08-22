const express = require('express');
const router = express.Router();
const { registerDriver, checkDriverExists, getDriver, updateDriverStatus, getDriverStatus, updateDriverLocation, getDriverLocation, getAvailableShipments, registerFCMToken, incrementCompletedDeliveries, getAllDriversWithDocuments, verifyDriver,getDocumentStatus } = require('../controllers/driverController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');

router.get('/check/:userId', verifyFirebaseToken, checkDriverExists);
router.post('/register', verifyFirebaseToken, registerDriver);
router.get('/info/:userId', verifyFirebaseToken, getDriver);
router.get('/status', verifyFirebaseToken, getDriverStatus);
router.put('/status', verifyFirebaseToken, updateDriverStatus);

// Location endpoints
router.get('/location', verifyFirebaseToken, getDriverLocation);
router.put('/location', verifyFirebaseToken, updateDriverLocation);

router.put('/completed-deliveries', verifyFirebaseToken, incrementCompletedDeliveries);

// backend/routes/driverRoutes.js
router.post('/fcm-token', verifyFirebaseToken, registerFCMToken);

router.put('/drivers/:driverId/verify',
    verifyFirebaseToken,
    verifyDriver
);
router.get('/:userId/documents-status', verifyFirebaseToken, getDocumentStatus);

router.get('/owner-dashboard', getOwnerDashboard);

router.get('/daily-summary',getDailySummary);

router.post('/settle-payment/:driverId', verifyFirebaseToken,settlePayment);


router.post('/:driverId/bulk-settle-payments', verifyFirebaseToken, bulkSettlePayments);

router.post('/apply-referral', verifyFirebaseToken, applyReferral);

// Get a drive
// r's referral code and share link
router.get('/:driverId/referral-code', verifyFirebaseToken, getReferralCode);

// Get referral statistics for a driver
router.get('/:driverId/referral-stats', verifyFirebaseToken, getReferralStats);

// Get referral leaderboard (top referrers)
router.get('/referrals/leaderboard', verifyFirebaseToken, getReferralLeaderboard);


// In your driverRoutes.js
router.put('/location/regular', verifyFirebaseToken, updateDriverLocationRegular);

// In your driverRoutes.js - ADD THESE ROUTE
router.get('/location/status', verifyFirebaseToken,getLocationStatus);
module.exports = router;
