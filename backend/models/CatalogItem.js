// models/CatalogItem.js
const mongoose = require('mongoose');

const catalogItemSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['grocery', 'vegetable', 'provision', 'medical', 'hotel','bakery','cafe'],
    required: true
  },
  name: { type: String, required: true, trim: true },
  // GridFS file id (ObjectId) for the catalog image you pre-upload
  imageFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true });

module.exports = mongoose.model('CatalogItem', catalogItemSchema);
