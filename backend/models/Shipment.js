const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['razorpay', 'cash', 'phonepe', null],
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  collectedAt: Date,
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  }
});

const shipmentSchema = new mongoose.Schema({
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
  receiver: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: {
      addressLine1: { type: String, required: true },
      coordinates: { type: Object }
    }
  },
  vehicleType: { type: String, required: true },
  distance: { type: Number, required: true },
  cost: { type: Number, required: true },
  trackingNumber: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
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
  },
  payment: {
    type: paymentSchema,
    default: () => ({ status: 'pending', method: null })
  },
  paymentDue: {
    type: Number,
    default: function () { return this.cost; }
  },
  paymentHistory: [{
    amount: Number,
    method: String,
    transactionId: String,
    date: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

shipmentSchema.index({ 'payment.status': 1 });
shipmentSchema.index({ 'payment.method': 1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
