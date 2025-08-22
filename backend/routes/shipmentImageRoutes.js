const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    uploadShipmentImages,
    getShipmentImages,
    getShipmentImage,
    deleteShipmentImage
} = require('../controllers/shipmentImageController');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');

// Configure Multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 5 // Maximum 5 files
    },
    fileFilter: (req, file, cb) => {
        console.log('[Multer] Processing file:', file.originalname);
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            console.warn('[Multer] Rejected non-image file:', file.originalname);
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Upload multiple images to a shipment
router.post(
    '/:shipmentId/multiple',
    verifyFirebaseToken,
    upload.array('images', 5), // Field name must be 'images' to match frontend
    (req, res, next) => {
        console.log('[Route] Multer processed files:', req.files);
        next();
    },
    uploadShipmentImages
);

// Get all images for a shipment
router.get(
    '/:shipmentId/images',
    verifyFirebaseToken,
    getShipmentImages
);

// Get a specific image file
router.get(
    '/image/:imageId',
    getShipmentImage
);

// Delete a specific image
router.delete(
    '/:shipmentId/image/:imageId',
    verifyFirebaseToken,
    deleteShipmentImage
);

module.exports = router;