const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
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

// Upload a document
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const gfs = await gfsPromise;
    const filename = `${req.user.uid}_${req.body.docType}_${Date.now()}_${req.file.originalname}`;

    const writeStream = gfs.openUploadStream(filename, {
      metadata: {
        userId: req.user.uid,
        docType: req.body.docType,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype
      }
    });

    writeStream.end(req.file.buffer);

    writeStream.on('finish', () => {
      res.status(201).json({
        fileId: writeStream.id,
        filename: writeStream.filename,
        metadata: writeStream.options.metadata
      });
    });

    writeStream.on('error', (err) => {
      console.error('GridFS upload error:', err);
      res.status(500).json({ error: 'Upload failed' });
    });

  } catch (err) {
    console.error('Upload controller error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Secure file fetch
exports.getFile = async (req, res) => {
  try {
    const gfs = await gfsPromise;
    const filename = req.params.filename;

    const files = await gfs.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (files[0].metadata?.userId !== req.user?.uid) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const readStream = gfs.openDownloadStreamByName(filename);

    if (files[0].metadata?.mimetype) {
      res.set('Content-Type', files[0].metadata.mimetype);
    }

    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('GridFS download error:', err);
      res.status(500).json({ error: 'File stream error' });
    });

  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadProfileImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const gfs = await gfsPromise;
    const userId = req.user.uid;

    // 1. Find and delete all existing profile images
    const existingFiles = await gfs.find({
      'metadata.userId': userId,
      'metadata.docType': 'profile'
    }).toArray();

    await Promise.all([
      ...existingFiles.map(file => gfs.delete(file._id)),
      Driver.updateOne(
        { userId },
        { $unset: { profileImage: 1 } },
        { session }
      )
    ]);

    // 2. Upload new image
    const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '');
    const filename = `profile_${userId}_${Date.now()}_${sanitizedFilename}`;
    
    const uploadStream = gfs.openUploadStream(filename, {
      metadata: {
        userId,
        docType: 'profile',
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        uploadDate: new Date()
      }
    });

    uploadStream.end(req.file.buffer);

    // Wait for upload to complete
    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    // 3. Get the uploaded file to include in response
    const fileData = await gfs.find({ _id: fileId }).toArray();
    if (!fileData.length) {
      throw new Error('Failed to retrieve uploaded file');
    }

    // 4. Update driver with new image reference
    await Driver.findOneAndUpdate(
      { userId },
      { profileImage: fileId },
      { session, upsert: true, new: true }
    );

    await session.commitTransaction();
    
    // 5. Return both the file info and the image URL
    res.status(201).json({
      success: true,
      fileId,
      filename,
      mimetype: req.file.mimetype,
      imageUrl: `/api/upload/profile-image/${userId}?ts=${Date.now()}`
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('Profile upload error:', err);
    res.status(500).json({ error: 'Failed to update profile image' });
  } finally {
    session.endSession();
  }
};

// Get profile image
exports.getProfileImage = async (req, res) => {
  try {
    const gfs = await gfsPromise;
    const driver = await Driver.findOne({ userId: req.params.userId });

    if (!driver?.profileImage) {
      return res.status(404).json({ error: 'Profile image not found' });
    }

    const file = await gfs.find({ _id: driver.profileImage }).toArray();
    if (!file.length) return res.status(404).json({ error: 'File not found' });

    res.set('Content-Type', file[0].metadata?.mimetype || 'image/jpeg');
    const readStream = gfs.openDownloadStream(driver.profileImage);
    readStream.pipe(res);

  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAllProfileImages = async (userId) => {
  const gfs = await gfsPromise;
  const files = await gfs.find({
    'metadata.userId': userId,
    'metadata.docType': 'profile'
  }).toArray();

  await Promise.all(files.map(file => gfs.delete(file._id)));
};

// Get all documents uploaded by user
exports.getUserDocuments = async (req, res) => {
  try {
    // Verify the requesting user matches the requested userId
    if (req.params.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const gfs = await gfsPromise;
    const files = await gfs.find({ 'metadata.userId': req.params.userId }).toArray();

    if (!files || files.length === 0) {
      return res.status(200).json([]);
    }

    const transformedFiles = files.map(file => ({
      id: file._id,
      filename: file.filename,
      originalName: file.metadata?.originalName || file.filename,
      docType: file.metadata?.docType || 'unknown',
      uploadDate: file.uploadDate,
      size: file.length,
      mimetype: file.metadata?.mimetype || file.contentType
    }));

    res.status(200).json(transformedFiles);

  } catch (err) {
    console.error('Error in getUserDocuments:', err);
    res.status(500).json({
      error: 'Failed to fetch documents',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get all drivers with their documents
exports.getAllDriversWithDocuments = async (req, res) => {
  try {
    const drivers = await Driver.find({})
      .populate('profileImage')
      .populate('documents.license')
      .populate('documents.rc')
      .lean();

    const formattedDrivers = drivers.map(driver => ({
      id: driver.userId,
      name: driver.name,
      phone: driver.phone,
      vehicleType: driver.vehicleType,
      vehicleNumber: driver.vehicleNumber,
      status: driver.status,
      profileImage: driver.profileImage ? {
        id: driver.profileImage._id,
        mimetype: driver.profileImage.metadata?.mimetype
      } : null,
      documents: {
        license: driver.documents.license ? {
          id: driver.documents.license._id,
          uploaded: true,
          mimetype: driver.documents.license.metadata?.mimetype
        } : { uploaded: false },
        rc: driver.documents.rc ? {
          id: driver.documents.rc._id,
          uploaded: true,
          mimetype: driver.documents.rc.metadata?.mimetype
        } : { uploaded: false }
      },
      locationActive: driver.isLocationActive,
      lastUpdated: driver.lastUpdated
    }));

    res.status(200).json({
      success: true,
      data: formattedDrivers
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drivers data'
    });
  }
};
