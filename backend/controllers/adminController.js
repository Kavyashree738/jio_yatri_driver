// controllers/adminController.js
const Shop = require('../models/CategoryModel');
const User = require('../models/UserRole'); // your User model path

const BASE = 'https://jio-yatri-driver.onrender.com';

// GET /api/admin/shops-with-kyc?status=(all|none|submitted|verified|rejected)&q=<search>
exports.adminGetAllShopsWithKyc = async (req, res) => {
  try {
    const { status = 'all', q = '' } = req.query;

    // Build $matchs
    const matchStages = [];
    const text = String(q || '').trim();
    if (text) {
      matchStages.push({
        $match: {
          $or: [
            { shopName: { $regex: text, $options: 'i' } },
            { phone: { $regex: text, $options: 'i' } }
          ]
        }
      });
    }

    const pipeline = [
      { $sort: { createdAt: -1 } },
      ...matchStages,
      {
        $lookup: {
          from: 'users',                 // collection of your User model
          localField: 'userId',
          foreignField: 'userId',
          as: 'owner'
        }
      },
      { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
      // status filter
      ...(status === 'all' ? [] :
        status === 'none'
          ? [{ $match: { $or: [{ 'owner.kyc.status': { $exists: false } }, { 'owner.kyc.status': 'none' }] } }]
          : [{ $match: { 'owner.kyc.status': status } }]
      ),
      {
        $project: {
          _id: 1,
          userId: 1,
          createdAt: 1,
          shopName: 1,
          phone: 1,
          address: 1,

          owner: {
            userId: '$owner.userId',
            name: '$owner.name',
            email: '$owner.email',
            phone: '$owner.phone',
            hasKyc: '$owner.hasKyc',
            kyc: '$owner.kyc'
          }
        }
      }
    ];

    const data = await Shop.aggregate(pipeline);

    // decorate convenient URLs for viewing docs (uses your existing /api/shops/images/:id)
    const withUrls = data.map((r) => {
      const kyc = r?.owner?.kyc || {};
      return {
        ...r,
        kyc: {
          ...kyc,
          aadhaarUrl: kyc?.aadhaarFile ? `${BASE}/api/shops/images/${kyc.aadhaarFile}` : null,
          panUrl: kyc?.panFile ? `${BASE}/api/shops/images/${kyc.panFile}` : null
        }
      };
    });

    return res.json({ success: true, data: withUrls });
  } catch (e) {
    console.error('[adminGetAllShopsWithKyc] failed:', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch shops with KYC' });
  }
};

// PATCH /api/admin/users/:userId/kyc-status { status: 'verified'|'rejected', notes?: string }
exports.adminUpdateKycStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, notes = '' } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const now = new Date();
    const update = {
      hasKyc: true,
      'kyc.status': status,
      'kyc.notes': notes,
      'kyc.verifiedAt': status === 'verified' ? now : null,
      'kyc.rejectedAt': status === 'rejected' ? now : null
    };

    const doc = await User.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true }
    );

    if (!doc) return res.status(404).json({ success: false, error: 'User not found' });

    return res.json({ success: true, data: doc });
  } catch (e) {
    console.error('[adminUpdateKycStatus] failed:', e);
    return res.status(500).json({ success: false, error: 'Failed to update KYC status' });
  }
};

