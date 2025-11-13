const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const Driver = require('../models/Driver');
require('../models/File'); // this ensures the schema is registered

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

    writeStream.on('finish', async () => {
      const fileId = writeStream.id;

      try {
        await Driver.updateOne(
          { userId: req.user.uid },
          {
            $set: {
              [`documents.${req.body.docType}`]: fileId, // ✅ only ObjectId
              [`documentVerification.${req.body.docType}`]: 'pending'
            }
          }
        );

        res.status(201).json({
          success: true,
          fileId,
          filename: writeStream.filename,
          metadata: writeStream.options.metadata
        });
      } catch (updateError) {
        console.error('Error updating driver document:', updateError);
        res.status(500).json({ error: 'File uploaded, but failed to update driver document.' });
      }
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
  console.log('--- uploadProfileImage called ---');
  
  if (!req.file) {
    console.warn('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log('File received:', req.file.originalname, req.file.mimetype, req.file.size, 'bytes');

  const session = await mongoose.startSession();
  session.startTransaction();
  console.log('MongoDB session started');

  try {
    const gfs = await gfsPromise;
    console.log('GridFS initialized:', !!gfs);

    const userId = req.user.uid;
    console.log('User ID:', userId);

    // 1. Find existing profile images
    const existingFiles = await gfs.find({
      'metadata.userId': userId,
      'metadata.docType': 'profile'
    }).toArray();
    console.log('Existing profile images found:', existingFiles.length);

    if (existingFiles.length) {
      console.log('Deleting existing files:', existingFiles.map(f => f._id));
    }

    await Promise.all([
      ...existingFiles.map(file => {
        console.log('Deleting file:', file._id);
        return gfs.delete(file._id);
      }),
      Driver.updateOne(
        { userId },
        { $unset: { profileImage: 1 } },
        { session }
      ).then(() => console.log('Driver profileImage unset'))
    ]);

    // 2. Upload new image
    const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '');
    const filename = `profile_${userId}_${Date.now()}_${sanitizedFilename}`;
    console.log('Sanitized filename:', filename);

    const uploadStream = gfs.openUploadStream(filename, {
      metadata: {
        userId,
        docType: 'profile',
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        uploadDate: new Date()
      }
    });
    console.log('Upload stream created');

    uploadStream.end(req.file.buffer);
    console.log('File buffer written to upload stream');

    // Wait for upload to complete
    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => {
        console.log('Upload finished, file ID:', uploadStream.id);
        resolve(uploadStream.id);
      });
      uploadStream.on('error', (err) => {
        console.error('Upload stream error:', err);
        reject(err);
      });
    });

    // 3. Get the uploaded file to confirm
    const fileData = await gfs.find({ _id: fileId }).toArray();
    console.log('Uploaded file retrieved:', fileData.length ? fileData[0]._id : 'None');
    if (!fileData.length) {
      throw new Error('Failed to retrieve uploaded file');
    }

    // 4. Update driver with new image reference
    const updatedDriver = await Driver.findOneAndUpdate(
      { userId },
      { profileImage: fileId },
      { session, upsert: true, new: true }
    );
    console.log('Driver updated with new profileImage:', updatedDriver.profileImage);

    await session.commitTransaction();
    console.log('Transaction committed');

    // 5. Return success
    res.status(201).json({
      success: true,
      fileId,
      filename,
      mimetype: req.file.mimetype,
      imageUrl: `https://jio-yatri-driver.onrender.com/api/upload/profile-image/${userId}?ts=${Date.now()}`
    });
    console.log('Response sent successfully');

  } catch (err) {
    await session.abortTransaction();
    console.error('Profile upload error:', err);
    res.status(500).json({ error: 'Failed to update profile image' });
  } finally {
    session.endSession();
    console.log('MongoDB session ended');
  }
};

// Get profile image
exports.getProfileImage = async (req, res) => {
  console.log('--- getProfileImage called ---');
  console.log('Request params:', req.params);

  try {
    const gfs = await gfsPromise;
    console.log('GridFS initialized:', !!gfs);

    const driver = await Driver.findOne({ userId: req.params.userId });
    

    if (!driver) {
      console.warn('Driver not found for userId:', req.params.userId);
      return res.status(404).json({ error: 'Driver not found' });
    }

    if (!driver.profileImage) {
      console.warn('Driver has no profileImage:', driver._id);
      return res.status(404).json({ error: 'Profile image not found' });
    }

    
    const files = await gfs.find({ _id: driver.profileImage }).toArray();
 

    if (!files.length) {
      console.warn('No file found in GridFS with _id:', driver.profileImage);
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];
    console.log('File metadata:', file.metadata);

    res.set('Content-Type', file.metadata?.mimetype || 'image/jpeg');
    console.log('Streaming file to response...');
    const readStream = gfs.openDownloadStream(driver.profileImage);

    readStream.on('error', (err) => {
      console.error('Error while streaming file:', err);
      res.status(500).json({ error: 'Error streaming file' });
    });

    readStream.on('end', () => {
      console.log('File streaming finished.');
    });

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

const { Types } = require('mongoose');

exports.getAllDriversWithDocuments = async (req, res) => {
  try {
    const gfs = await gfsPromise;

    const drivers = await Driver.find({}).lean();

    const formattedDrivers = await Promise.all(drivers.map(async (driver) => {
      const docs = driver.documents || {};

      const fetchFileMeta = async (fileId) => {
        if (!fileId || !Types.ObjectId.isValid(fileId)) return { uploaded: false };

        const files = await gfs.find({ _id: new Types.ObjectId(fileId) }).toArray();
        if (!files || files.length === 0) return { uploaded: false };

        return {
          id: files[0]._id,
          uploaded: true,
          mimetype: files[0].metadata?.mimetype || null
        };
      };

      const profileImageMeta = await fetchFileMeta(driver.profileImage);

      const aadharMeta = await fetchFileMeta(docs.aadhar);
      const panMeta = await fetchFileMeta(docs.pan);
      const licenseMeta = await fetchFileMeta(docs.license);
      const rcMeta = await fetchFileMeta(docs.rc);
      const insuranceMeta = await fetchFileMeta(docs.insurance);
      const selfieMeta = await fetchFileMeta(docs.selfie);

      return {
        id: driver.userId,
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        vehicleNumber: driver.vehicleNumber,
        status: driver.status,
        profileImage: profileImageMeta,
        documents: {
          aadhar: aadharMeta,
          pan: panMeta,
          license: licenseMeta,
          rc: rcMeta,
          insurance: insuranceMeta,
          selfie: selfieMeta,
        },
        documentVerification: driver.documentVerification || {},
        locationActive: driver.isLocationActive,
        lastUpdated: driver.lastUpdated,
        completedDeliveries: driver.completedDeliveries || 0,
        earnings: driver.earnings || 0,
        fcmToken: driver.fcmToken || null
      };
    }));

    res.status(200).json({
      success: true,
      data: formattedDrivers
    });
  } catch (err) {
    console.error('Error in getAllDriversWithDocuments:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drivers data'
    });
  }
};
// Add to uploadController.js
// uploadController.js

// In your uploadController.js
exports.getFileInfo = async (req, res) => {
  try {
    // console.log('getFileInfo called with fileId:', req.params.fileId);

    const gfs = await gfsPromise;
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      // console.error('Invalid file ID format:', fileId);
      return res.status(400).json({ error: 'Invalid file ID format' });
    }

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    // console.log('Files found:', files.length);

    if (!files || files.length === 0) {
      // console.error('No files found for ID:', fileId);
      return res.status(404).json({ error: 'File not found in GridFS' });
    }

    // console.log('Returning file info for:', files[0].filename);
    res.status(200).json({
      id: files[0]._id,
      filename: files[0].filename,
      metadata: files[0].metadata,
      uploadDate: files[0].uploadDate,
      length: files[0].length,
      contentType: files[0].metadata?.mimetype || files[0].contentType || 'unknown'
    });

  } catch (err) {
    console.error('Error in getFileInfo:', {
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ error: err.message });
  }
};

exports.getFileAsAdmin = async (req, res) => {
  try {
    const gfs = await gfsPromise;
    const filename = req.params.filename;

    const files = await gfs.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // ✅ Skip ownership check for admins
    res.set('Content-Type', files[0].metadata?.mimetype || 'application/octet-stream');
    gfs.openDownloadStreamByName(filename).pipe(res);

  } catch (err) {
    console.error('Admin file fetch error:', err);
    res.status(500).json({ error: err.message });
  }
};
