const express = require('express');
const router = express.Router();
const { registerDriver, getDriver, updateDriverStatus,getDriverStatus } = require('../controllers/driverController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');

router.post('/register', verifyFirebaseToken, registerDriver);
router.get('/info/:userId', verifyFirebaseToken, getDriver);
router.get('/status', verifyFirebaseToken, getDriverStatus);
router.put('/status', verifyFirebaseToken, updateDriverStatus);
module.exports = router;

