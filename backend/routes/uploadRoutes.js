const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile, getFile } = require('../controllers/uploadController');
console.log('✅ uploadRoutes.js loaded');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, or PDF allowed'));
    }
  }
});

router.post('/file', upload.single('file'), uploadFile);
router.get('/:filename', getFile);

// In uploadRoutes.js
router.post('/profile-image', verifyFirebaseToken, upload.single('file'), uploadProfileImage);
router.get('/profile-image/:userId', getProfileImage);



module.exports = router;
