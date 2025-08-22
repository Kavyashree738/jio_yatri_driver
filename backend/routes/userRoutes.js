const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
// Set user role (driver or business)
router.post('/set-role', verifyFirebaseToken, userController.setUserRole);

// Check user registration status
router.get('/check-registration/:userId', verifyFirebaseToken, userController.checkRegistration);

// profile
router.get('/:userId/profile', userController.getProfile);
router.put('/:userId/profile', upload.single('avatar'),userController.updateProfile);
router.put('/:userId/business-info', verifyFirebaseToken, userController.updateBusinessInfo);


// avatar stream
router.get('/avatar/:id', userController.getAvatar);

module.exports = router;