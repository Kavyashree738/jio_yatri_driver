// routes/catalog.routes.js
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const CatalogItem = require('../models/CatalogItem');

const router = express.Router();

// ----- GridFS init (reuses your "shop_files" bucket) -----
let gfs;
const ready = new Promise((resolve, reject) => {
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

const uploadToGridFs = (file) => new Promise((resolve, reject) => {
  const stream = gfs.openUploadStream(file.originalname, {
    contentType: file.mimetype,
    metadata: { uploadedAt: new Date(), from: 'catalog' }
  });
  stream.on('finish', () => resolve(stream.id));
  stream.on('error', reject);
  stream.end(file.buffer);
});

// ----- Multer (memory + image-only) -----
const storage = multer.memoryStorage();
const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp','image/jpg','image/gif']);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files allowed'));
  }
});

// ===== PUBLIC endpoints (no admin guard) =====

// Create catalog item (name + image + category)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    await ready;
    const { name, category } = req.body;
    if (!name || !category) {
      return res.status(400).json({ success: false, error: 'name and category are required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'image file is required' });
    }

    const imageFileId = await uploadToGridFs(req.file);
    const doc = await CatalogItem.create({ name: name.trim(), category, imageFileId });

    const base = 'https://jio-yatri-driver.onrender.com';
    res.status(201).json({
      success: true,
      data: {
        _id: doc._id,
        name: doc.name,
        category: doc.category,
        imageId: String(doc.imageFileId),
        imageUrl: `${base}/api/shops/images/${doc.imageFileId}`
      }
    });
  } catch (e) {
    console.error('[catalog.create] failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// List by query (?category=hotel) — used by admin form list
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.category) q.category = req.query.category;
    const items = await CatalogItem.find(q).sort({ createdAt: -1 }).lean();
    const base = 'https://jio-yatri-driver.onrender.com';
    res.json({
      success: true,
      data: items.map(i => ({
        _id: i._id,
        name: i.name,
        category: i.category,
        imageId: String(i.imageFileId),
        imageUrl: `${base}/api/shops/images/${i.imageFileId}`
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// List by category (clean URL) — used by owner picker
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const allowed = ['grocery','vegetable','provision','medical','hotel','bakery','cafe'];
    if (!allowed.includes(category)) {
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }
    const items = await CatalogItem.find({ category }).sort({ name: 1 }).lean();
    const base = 'https://jio-yatri-driver.onrender.com';
    res.json({
      success: true,
      data: items.map(i => ({
        _id: i._id,
        name: i.name,
        imageId: String(i.imageFileId),
        imageUrl: `${base}/api/shops/images/${i.imageFileId}`,
        category
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Optional delete (keep if you want a clean-up button in admin UI)
router.delete('/:id', async (req, res) => {
  try {
    const doc = await CatalogItem.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    // Optional: also remove image from GridFS (comment out if referenced elsewhere)
    try { await gfs.delete(new mongoose.Types.ObjectId(doc.imageFileId)); } catch (_) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
