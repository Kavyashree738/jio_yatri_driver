// controllers/userController.js
const User = require('../models/UserRole');
const Driver = require('../models/Driver');
const { GridFSBucket } = require('mongodb');
const Shop = require('../models/CategoryModel');
const mongoose = require('mongoose');
exports.setUserRole = async (req, res) => {
  try {
    console.log('[setUserRole] body:', req.body);
    const { userId, role, phone } = req.body;

    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    if (!role)   return res.status(400).json({ success: false, error: 'role is required' });
    if (!phone)  return res.status(400).json({ success: false, error: 'phone is required' });

    const normalizedRole = String(role).toLowerCase();
    if (!['driver', 'business'].includes(normalizedRole)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    // IMPORTANT: set uid = userId to satisfy legacy unique index on uid_1
    const user = await User.findOneAndUpdate(
      { userId },
      {
        $set: {
          role: normalizedRole,
          phone,
          uid: userId,            // 👈 legacy field to avoid E11000 on uid_1
        },
        $setOnInsert: { userId }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('[setUserRole] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.checkRegistration = async (req, res) => {
  try {
    console.log('[checkRegistration] params:', req.params);
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId param is required' });
    }

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.json({ success: true, data: { isRegistered: false, role: null } });
    }

    // ✅ Only trust the User collection
    res.json({
  success: true,
  data: {
    role: user.role,
    driverRegistered: !!user.driverRegistered,
    businessRegistered: !!user.businessRegistered
  }
});

  } catch (error) {
    console.error('[checkRegistration] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


let gfs;
const initGridFS = () =>
  new Promise((resolve, reject) => {
    const conn = mongoose.connection;
    if (conn.readyState === 1) {
      gfs = new GridFSBucket(conn.db, { bucketName: 'shop_files' });
      return resolve(gfs);
    }
    conn.once('open', () => {
      gfs = new GridFSBucket(conn.db, { bucketName: 'shop_files' });
      resolve(gfs);
    });
    conn.on('error', reject);
  });
const gfsReady = initGridFS();

const uploadToGridFS = (file) => new Promise((resolve, reject) => {
  const uploadStream = gfs.openUploadStream(file.originalname, {
    contentType: file.mimetype,
    metadata: {
      uploadedAt: new Date(),
      originalName: file.originalname,
      type: 'user-avatar'
    }
  });
  uploadStream.on('finish', () => resolve(uploadStream.id));
  uploadStream.on('error', reject);
  uploadStream.end(file.buffer);
});

// GET /api/users/:userId/profile
// GET /api/users/:userId/profile
exports.getProfile = async (req, res) => {
  try {
    console.log('[getProfile] Request received with params:', req.params);
    const { userId } = req.params;

    // Get user info (for photo)
    console.log('[getProfile] Looking for user with userId:', userId);
    const user = await User.findOne({ userId }).lean();
    console.log('[getProfile] User found:', user);
    
    if (!user) {
      console.log('[getProfile] User not found in database');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get shop info (for name, phone, email, shopName)
    console.log('[getProfile] Looking for shops for userId:', userId);
    const shop = await Shop.findOne({ userId })
      .sort({ createdAt: 1 }) // Get the oldest shop (first registered)
      .lean();
    console.log('[getProfile] Shop found:', shop);

    const base = process.env.API_BASE_URL || 'http://localhost:5000';
    const photoUrl = user.photo ? `${base}/api/users/avatar/${user.photo}` : null;
    console.log('[getProfile] Generated photoUrl:', photoUrl);

    return res.json({
      success: true,
      data: {
        userId: user.userId,
        name: shop?.name || user.name || '', // Prefer shop name, fallback to user name
        phone: shop?.phone || user.phone || '',
        email: shop?.email || user.email || '',
        role: user.role,
        photoUrl,
        shopName: shop?.shopName || '' // From shop model
      }
    });
  } catch (err) {
    console.error('[UserController] getProfile error:', {
      message: err.message,
      stack: err.stack,
      params: req.params
    });
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
};

// PUT /api/users/:userId/profile (multipart/form-data with optional "avatar")
// PUT /api/users/:userId/profile (multipart/form-data with optional "avatar")
exports.updateProfile = async (req, res) => {
  try {
    await gfsReady;

    const { userId } = req.params;
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Only handle photo updates here
    if (req.file) {
      // Upload to GridFS
      const id = await uploadToGridFS(req.file);
      user.photo = id;
      await user.save();
    }

    const base = 'https://jio-yatri-driver.onrender.com';
    return res.json({
      success: true,
      data: {
        photoUrl: user.photo ? `${base}/api/users/avatar/${user.photo}` : null
      },
      message: 'Profile updated'
    });
  } catch (err) {
    console.error('[UserController] updateProfile error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update profile' });
  }
};

// PUT /api/users/:userId/business-info
exports.updateBusinessInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, phone, email } = req.body;

    // Update all shops belonging to this user
    await Shop.updateMany(
      { userId },
      { $set: { name, phone, email } }
    );

    res.json({
      success: true,
      message: 'Business information updated across all shops'
    });
  } catch (err) {
    console.error('[UserController] updateBusinessInfo error:', err);
    res.status(500).json({ success: false, error: 'Failed to update business info' });
  }
};

// GET /api/users/avatar/:id  -> stream the avatar
exports.getAvatar = async (req, res) => {
  try {
    await gfsReady;

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const files = await gfs.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, error: 'Avatar not found' });
    }

    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    gfs.openDownloadStream(fileId)
      .on('error', (e) => {
        console.error('[UserController] avatar stream error:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Stream error' });
      })
      .pipe(res);
  } catch (err) {
    console.error('[UserController] getAvatar error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch avatar' });
  }
};

exports.reuploadKycDocs = async (req, res) => {
  try {
    await gfsReady;

    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const user = await User.findOne({ userId: uid });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const hasAadhaar = Array.isArray(req.files?.aadhaar) && req.files.aadhaar.length > 0;
    const hasPan = Array.isArray(req.files?.pan) && req.files.pan.length > 0;

    if (!hasAadhaar && !hasPan) {
      return res.status(400).json({ success: false, error: 'Provide aadhaar and/or pan file' });
    }

    const updates = {
      hasKyc: true,
      'kyc.status': 'submitted',
      'kyc.submittedAt': new Date(),
      'kyc.rejectedAt': null,
      'kyc.verifiedAt': null,
    };

    // Replace Aadhaar file if provided
    if (hasAadhaar) {
      const newAadhaarId = await uploadToGridFS(req.files.aadhaar[0]);
      // Optional cleanup of old file to save space
      const old = user.kyc?.aadhaarFile;
      if (old) {
        try { await gfs.delete(new mongoose.Types.ObjectId(old)); } catch (_) { }
      }
      updates['kyc.aadhaarFile'] = newAadhaarId;
    }

    // Replace PAN file if provided
    if (hasPan) {
      const newPanId = await uploadToGridFS(req.files.pan[0]);
      const old = user.kyc?.panFile;
      if (old) {
        try { await gfs.delete(new mongoose.Types.ObjectId(old)); } catch (_) { }
      }
      updates['kyc.panFile'] = newPanId;
    }

    // Clear any admin notes on resubmission (optional)
    if (user.kyc?.notes) updates['kyc.notes'] = '';

    if (user.photo === '') user.photo = null;
    // user.set(updates);
    // await user.save();
    await User.updateOne({ _id: user._id }, { $set: updates });

    const base = 'https://jio-yatri-driver.onrender.com';
    return res.json({
      success: true,
      data: {
        status: user.kyc.status,
        submittedAt: user.kyc.submittedAt,
        verifiedAt: user.kyc.verifiedAt,
        rejectedAt: user.kyc.rejectedAt,
        notes: user.kyc.notes || '',
        aadhaarUrl: user.kyc.aadhaarFile ? `${base}/api/shops/images/${user.kyc.aadhaarFile}` : null,
        panUrl: user.kyc.panFile ? `${base}/api/shops/images/${user.kyc.panFile}` : null,
      }
    });
  } catch (e) {
    console.error('[reuploadKycDocs] error:', e);
    return res.status(500).json({ success: false, error: e.message || 'Failed to re-upload KYC' });
  }
};
