const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  // Sender details
  userId: { type: String, required: true },
  sender: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: {
      addressLine1: { type: String, required: true },
      coordinates: { type: Object }
    }
  },
  // Receiver details
  receiver: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: {
      addressLine1: { type: String, required: true },
      coordinates: { type: Object }
    }
  },
  // Shipment details
  vehicleType: { type: String, required: true },
  distance: { type: Number, required: true },
  cost: { type: Number, required: true },
  trackingNumber: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked_up', 'delivered', 'cancelled'],
    default: 'pending'
  },
  assignedDriver: {
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  userId: String,
  name: String,
  phone: String,
  vehicleNumber: String,
},

  
  driverLocation: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  }
});
const Shipment = mongoose.model('Shipment', shipmentSchema);

module.exports = Shipment;