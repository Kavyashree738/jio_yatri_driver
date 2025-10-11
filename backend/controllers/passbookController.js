const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const Driver = require('../models/Driver');

let gfs;
const initGridFS = () => {
  return new Promise((resolve, reject) => {
    const conn = mongoose.connection;
    if (conn.readyState === 1) {
      gfs = new GridFSBucket(conn.db, { bucketName: 'driver_docs' });
      return resolve(gfs);
    }

    conn.once('open', () => {
      gfs = new GridFSBucket(conn.db, { bucketName: 'driver_docs' });
      resolve(gfs);
    });

    conn.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      reject(err);
    });
  });
};

const gfsPromise = initGridFS();

/* ===================================================
   📤 Upload Driver Passbook
   =================================================== */
exports.uploadPassbook = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const gfs = await gfsPromise;
    const userId = req.user.uid;

    // Generate a clean file name
    const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '');
    const filename = `passbook_${userId}_${Date.now()}_${sanitizedFilename}`;

    // Upload to GridFS
    const uploadStream = gfs.openUploadStream(filename, {
      metadata: {
        userId,
        docType: 'passbook',
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        uploadDate: new Date()
      }
    });

    uploadStream.end(req.file.buffer);

    // Wait for upload to finish
    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    // Update Driver document
    await Driver.findOneAndUpdate(
      { userId },
      { passbook: fileId },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Passbook uploaded successfully',
      fileId,
      filename,
      mimetype: req.file.mimetype,
      imageUrl: `/api/passbook/${userId}?ts=${Date.now()}`
    });
  } catch (err) {
    console.error('Error uploading passbook:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ===================================================
   📥 Get Driver Passbook
   =================================================== */
exports.getPassbook = async (req, res) => {
  try {
    const gfs = await gfsPromise;
    const userId = req.params.userId;

    const driver = await Driver.findOne({ userId });
    if (!driver?.passbook) {
      return res.status(404).json({ error: 'No passbook uploaded' });
    }

    const file = await gfs.find({ _id: driver.passbook }).toArray();
    if (!file.length) {
      return res.status(404).json({ error: 'File not found in GridFS' });
    }

    res.set('Content-Type', file[0].metadata?.mimetype || 'application/pdf');
    const readStream = gfs.openDownloadStream(driver.passbook);
    readStream.pipe(res);
  } catch (err) {
    console.error('Error fetching passbook:', err);
    res.status(500).json({ error: err.message });
  }
};
