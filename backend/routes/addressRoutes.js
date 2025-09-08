const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const axios = require('axios');

router.get('/autocomplete', addressController.autocomplete);



router.get('/geocode', addressController.geocode);
router.get('/reverse-geocode', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: "Latitude and longitude are required" });
        }

        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        );

        if (response.data.status !== 'OK') {
            return res.status(400).json({ 
                error: "Reverse geocoding failed",
                details: response.data.error_message || 'No results found'
            });
        }

        res.json({
            status: 'success',
            results: response.data.results
        });
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        res.status(500).json({ 
            error: "Reverse geocoding failed",
            details: error.message 
        });
    }
});


module.exports = router;
