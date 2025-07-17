const mongoose = require('mongoose');

// This registers the fs.files collection for GridFS
const fileSchema = new mongoose.Schema({}, { strict: false, collection: 'fs.files' });

module.exports = mongoose.model('fs.files', fileSchema);
