const express = require('express');
const router = express.Router();
const passbookController = require('../controllers/passbookController');
const verifyToken = require('../middleware/verifyFirebaseToken');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload passbook
router.post(
  '/upload-passbook',
  verifyToken,
  upload.single('file'),
  passbookController.uploadPassbook
);

// Get passbook
router.get(
  '/:userId',
  verifyToken,
  passbookController.getPassbook
);

module.exports = router;
