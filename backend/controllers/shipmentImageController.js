const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');

let gfs;

// Initialize GridFS
const initGridFS = () => {
    // console.log('[GridFS] Initializing GridFSBucket');
    const conn = mongoose.connection;
    gfs = new GridFSBucket(conn.db, { bucketName: 'shipment_images' });
    return gfs;
};

// Get GridFS instance
exports.getGFS = () => {
    if (!gfs) {
        // console.log('[GridFS] Initializing new GridFS instance');
        return initGridFS();
    }
    return gfs;
};

// Upload multiple images
exports.uploadShipmentImages = async (req, res) => {
    // console.log('[Image Upload] Request received');
    try {
        // Check if files exist
        if (!req.files || req.files.length === 0) {
            // console.warn('[Image Upload] No files uploaded');
            return res.status(400).json({ 
                success: false,
                error: 'No files uploaded' 
            });
        }

        // console.log('[Image Upload] Files received:', req.files.map(f => ({
        //     originalname: f.originalname,
        //     mimetype: f.mimetype,
        //     size: f.size
        // })));

        const shipmentId = req.params.shipmentId;
        const userId = req.user.uid;
        // console.log('[Image Upload] Shipment ID:', shipmentId, 'User ID:', userId);

        // Verify shipment exists and belongs to user
        const shipment = await Shipment.findOne({ _id: shipmentId, userId });
        if (!shipment) {
            // console.warn('[Image Upload] Shipment not found or unauthorized');
            return res.status(404).json({ 
                success: false,
                error: 'Shipment not found' 
            });
        }

        const gfs = exports.getGFS();
        const uploadedImages = [];

        // Process each file
        // console.log('[Image Upload] Processing', req.files.length, 'files...');
        for (const file of req.files) {
            const filename = `shipment_${shipmentId}_${Date.now()}_${file.originalname}`;
            // console.log('[Image Upload] Uploading file:', filename);

            const uploadStream = gfs.openUploadStream(filename, {
                metadata: {
                    userId,
                    shipmentId,
                    originalName: file.originalname,
                    mimetype: file.mimetype,
                    uploadedAt: new Date()
                }
            });

            uploadStream.end(file.buffer);

            // Wait for upload to complete
            await new Promise((resolve, reject) => {
                uploadStream.on('finish', () => {
                    // console.log('[Image Upload] File uploaded:', filename);
                    uploadedImages.push(uploadStream.id);
                    resolve();
                });
                uploadStream.on('error', (err) => {
                    // console.error('[Image Upload] Error uploading file:', err);
                    reject(err);
                });
            });
        }

        // Update shipment with image references
        // console.log('[Image Upload] Updating shipment with image references');
        const updatedShipment = await Shipment.findByIdAndUpdate(
            shipmentId,
            { 
                $push: { 
                    'parcel.images': { 
                        $each: uploadedImages 
                    } 
                },
                $set: { 
                    updatedAt: new Date() 
                } 
            },
            { new: true }
        );

        res.status(201).json({
            success: true,
            message: 'Images uploaded successfully',
            images: uploadedImages,
            shipment: updatedShipment
        });

    } catch (err) {
        // console.error('[Image Upload] Error:', {
        //     message: err.message,
        //     stack: err.stack
        // });
        res.status(500).json({ 
            success: false,
            error: err.message || 'Failed to upload images' 
        });
    }
};

// Get all images for a shipment
exports.getShipmentImages = async (req, res) => {
    try {
        // console.log('[Get Images] Request received for shipment:', req.params.shipmentId);
        const gfs = exports.getGFS();
        const shipment = await Shipment.findById(req.params.shipmentId);

        if (!shipment) {
            // console.warn('[Get Images] Shipment not found');
            return res.status(404).json({ 
                success: false,
                error: 'Shipment not found' 
            });
        }

        const images = [];
        
        // Get all images for this shipment
        for (const imageId of shipment.parcel.images) {
            const file = await gfs.find({ _id: imageId }).toArray();
            if (file.length > 0) {
                images.push({
                    id: imageId,
                    filename: file[0].filename,
                    contentType: file[0].metadata?.mimetype || 'image/jpeg',
                    uploadDate: file[0].uploadDate,
                    metadata: file[0].metadata
                });
            }
        }

        res.status(200).json({
            success: true,
            images
        });

    } catch (err) {
        // console.error('[Get Images] Error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message || 'Failed to get shipment images' 
        });
    }
};

// Get a specific image file
exports.getShipmentImage = async (req, res) => {
    try {
        // console.log('[Get Image] Request received for image:', req.params.imageId);
        const gfs = exports.getGFS();
        const { imageId } = req.params;

        const file = await gfs.find({ _id: new mongoose.Types.ObjectId(imageId) }).toArray();
        
        if (!file.length) {
            console.warn('[Get Image] File not found');
            return res.status(404).json({ 
                success: false,
                error: 'File not found' 
            });
        }

        res.set('Content-Type', file[0].metadata?.mimetype || 'image/jpeg');
        const readStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(imageId));
        readStream.pipe(res);

    } catch (err) {
        // console.error('[Get Image] Error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message || 'Failed to get image' 
        });
    }
};

// Delete a specific image
exports.deleteShipmentImage = async (req, res) => {
    try {
        // console.log('[Delete Image] Request received for shipment:', req.params.shipmentId, 'image:', req.params.imageId);
        const gfs = exports.getGFS();
        const { shipmentId, imageId } = req.params;
        const userId = req.user.uid;

        const shipment = await Shipment.findOne({
            _id: shipmentId,
            userId
        });

        if (!shipment) {
            // console.warn('[Delete Image] Shipment not found or unauthorized');
            return res.status(404).json({ 
                success: false,
                error: 'Shipment not found or unauthorized' 
            });
        }

        // Remove image reference from shipment
        await Shipment.findByIdAndUpdate(
            shipmentId,
            { $pull: { 'parcel.images': imageId } }
        );

        // Delete the actual file from GridFS
        await gfs.delete(new mongoose.Types.ObjectId(imageId));

        res.status(200).json({ 
            success: true,
            message: 'Image deleted successfully'
        });

    } catch (err) {
        // console.error('[Delete Image] Error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message || 'Failed to delete image' 
        });
    }
};