// routes/admin.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const adminController = require('../controllers/adminController');

// ✅ Anyone who is authenticated can hit these endpoints
router.get(
  '/shops-with-kyc',
  verifyFirebaseToken,
  adminController.adminGetAllShopsWithKyc
);

router.patch(
  '/users/:userId/kyc-status',
  verifyFirebaseToken,
  adminController.adminUpdateKycStatus
);

module.exports = router;
