const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

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

// Initialize immediately
const gfsPromise = initGridFS();

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const gfs = await gfsPromise;
    const filename = `${req.body.userId}_${req.body.docType}_${Date.now()}_${req.file.originalname}`;

    const writeStream = gfs.openUploadStream(filename, {
      metadata: {
        userId: req.body.userId,
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


exports.getFile = async (req, res) => {
  try {
    const gfs = await gfsPromise;
    const filename = req.params.filename;
    
    const files = await gfs.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const readStream = gfs.openDownloadStreamByName(filename);
    
    // Set proper content type
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