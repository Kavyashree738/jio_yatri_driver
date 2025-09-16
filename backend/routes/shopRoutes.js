const express = require('express');
const router = express.Router();
const Shop = require('../models/CategoryModel');  
const shopController = require('../controllers/shopController');
const multer = require('multer');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const storage = multer.memoryStorage();


const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'
]);
const KYC_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'
]);

const fileFilter = (req, file, cb) => {
  const isKyc = file.fieldname === 'aadhaar' || file.fieldname === 'pan';
  const ok = isKyc ? KYC_TYPES.has(file.mimetype) : IMAGE_TYPES.has(file.mimetype);
  if (ok) return cb(null, true);
  cb(new Error(isKyc
    ? 'Only PDF or image allowed for KYC (Aadhaar/PAN)'
    : 'Only image files allowed for shop/item images'
  ));
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

router.post('/apply-referral', verifyFirebaseToken, shopController.applyShopReferral);
router.get('/:shopId/referral-code', verifyFirebaseToken, shopController.getShopReferralCode);
router.get('/:shopId/referral-stats', verifyFirebaseToken, shopController.getShopReferralStats);
router.get('/referrals/leaderboard', verifyFirebaseToken, shopController.getShopReferralLeaderboard);

// Register shop
router.post(
  '/register',
  upload.fields([
    { name: 'shopImages' },
    { name: 'itemImages' },
    { name: 'roomImages' }, // For hotel rooms
    { name: 'aadhaar', maxCount: 1 },
    { name: 'pan',     maxCount: 1 }

  ]),
  shopController.registerShop
);
router.get('/images/:id', shopController.getImage);
// Get shops by category
router.get('/category/:category', shopController.getShopsByCategory);

// Get single shop
router.get('/:id', shopController.getShopById);

// Get image


// Update shop
router.put(
  '/:id',
  upload.fields([
    { name: 'shopImages' },
    { name: 'itemImages' },
    { name: 'roomImages' }
  ]),
  shopController.updateShop
);

// Delete shop
router.delete('/:id', shopController.deleteShop);

router.put('/:id/add-item', upload.any(), shopController.addItemToShop);

router.get('/owner/:ownerId', shopController.getShopsByOwner);

// MUST be defined near the top of routes/shops.js
const mask = (s = '') => (typeof s === 'string' ? `${s.slice(0, 12)}...len=${s.length}` : 'null');

// routes/shops.js
// Update the token handling to be more consistent
router.post('/:shopId/fcm-token', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { token } = req.body;
    
    if (!token) return res.status(400).json({ success: false, error: 'token required' });

    // Only use the array approach
    const shop = await Shop.findByIdAndUpdate(
      shopId,
      { $addToSet: { fcmTokens: token } },
      { new: true }
    ).select('_id userId shopName');

    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    // console.log(`[shop fcm] saved token for shop ${shopId}`);
    res.json({ success: true });
  } catch (e) {
    console.error('[shop fcm] error:', e);
    res.status(500).json({ success: false, error: 'failed to save token' });
  }
});

module.exports = router;
