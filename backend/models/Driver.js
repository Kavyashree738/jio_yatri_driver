const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
    profileImage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'fs.files',
    default: null
  },
  vehicleType: { type: String, enum: ['TwoWheeler', 'ThreeWheeler', 'Truck'], required: true },
  vehicleNumber: { type: String, required: true },
   documents: {
    license: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' },
    rc:      { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  isLocationActive: { type: Boolean, default: false },
  fcmToken: { type: String, default: null }, 
  isAvailable: { type: Boolean, default: true },
  activeShipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
  earnings: { type: Number, default: 0 },
  paymentBreakdown: {
    cash: { type: Number, default: 0 },
    online: { type: Number, default: 0 }
  },
  collectedPayments: [{
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
    amount: Number,
    method: String,
    collectedAt: { type: Date, default: Date.now }
  }]
});

driverSchema.index({ location: '2dsphere' });
driverSchema.index({ earnings: 1 });

module.exports = mongoose.model('Driver', driverSchema);
