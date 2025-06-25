const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleType: { type: String, enum: ['TwoWheeler', 'ThreeWheeler', 'Truck'], required: true },
  vehicleNumber: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
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
