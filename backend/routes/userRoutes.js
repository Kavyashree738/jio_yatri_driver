const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const memStorage = multer.memoryStorage();
const KYC_TYPES = new Set(['application/pdf','image/jpeg','image/png','image/webp','image/jpg']);
const kycFileFilter = (req, file, cb) => {
  if (KYC_TYPES.has(file.mimetype)) return cb(null, true);
  cb(new Error('Only PDF or image allowed for KYC (Aadhaar/PAN)'));
};
const uploadKyc = multer({
  storage: memStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: kycFileFilter
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

router.get('/me/kyc', verifyFirebaseToken, async (req, res) => {
  try {
    const u = await User.findOne({ userId: req.user.uid }).lean();
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });

    const base = 'https://jio-yatri-driver.onrender.com';
    const k = u.kyc || {};
    // KYC files currently saved in the same GridFS bucket (shop_files), so we can reuse /api/shops/images/:id
    const aadhaarUrl = k.aadhaarFile ? `${base}/api/shops/images/${k.aadhaarFile}` : null;
    const panUrl     = k.panFile     ? `${base}/api/shops/images/${k.panFile}`     : null;

    return res.json({
      success: true,
      data: {
        status: k.status || 'none',       // none|submitted|verified|rejected
        submittedAt: k.submittedAt,
        verifiedAt:  k.verifiedAt,
        rejectedAt:  k.rejectedAt,
        notes: k.notes || '',
        aadhaarUrl,
        panUrl
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'Failed to fetch KYC' });
  }
});

router.put(
  '/me/kyc-docs',
  verifyFirebaseToken,
  uploadKyc.fields([
    { name: 'aadhaar', maxCount: 1 },
    { name: 'pan',     maxCount: 1 }
  ]),
  userController.reuploadKycDocs // ✅ make sure this exists in controllers/userController.js
);

module.exports = router;
