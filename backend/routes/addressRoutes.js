const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
console.log('routed')
// Route: GET /api/address/autocomplete
router.get('/autocomplete', addressController.autocomplete);

// Route: GET /api/address/geocode
router.get('/geocode', addressController.geocode);

module.exports = router;
