const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
  uploadFile, 
  getFile,
  uploadProfileImage, 
  getProfileImage,
  getUserDocuments,
  getAllDriversWithDocuments,
  getFileInfo,
  getFileAsAdmin
  
} = require('../controllers/uploadController');
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

// File upload and retrieval
router.post('/file', verifyFirebaseToken, upload.single('file'), (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}, uploadFile);

router.get('/file/:filename', verifyFirebaseToken, getFile);

// Profile image routes
router.post('/profile-image', 
  verifyFirebaseToken, 
  upload.single('file'),
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  }, 
  uploadProfileImage
);

router.get('/profile-image/:userId', verifyFirebaseToken, getProfileImage);

// User documents
router.get('/user-documents/:userId', verifyFirebaseToken, (req, res, next) => {
  console.log('Route hit!', req.params.userId);
  next();
}, getUserDocuments);

router.get('/all',  getAllDriversWithDocuments);
// Add this to your existing routes
// Add to uploadRoutes.js
router.get('/file-info/:fileId', verifyFirebaseToken, getFileInfo);
// Route: GET /api/admin/file/:filename
router.get('/admin/file/:filename', verifyFirebaseToken, getFileAsAdmin);

module.exports = router;
