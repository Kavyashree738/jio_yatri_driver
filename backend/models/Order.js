// models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  imageUrl: { type: String, default: null },
  veg: { type: Boolean, default: null },
  category: { type: String, default: null }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  shop: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    phone: { type: String },
    phonePeNumber: { type: String },
    category: { type: String, enum: ['grocery', 'vegetable', 'provision', 'medical', 'hotel'], required: true }
  },
  customer: {
    userId: { type: String, default: null },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: {
      line: { type: String, required: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    }
  },
  vehicleType: {
    type: String,
    enum: ['TwoWheeler', 'ThreeWheeler', 'Truck', 'Pickup9ft', 'Tata407'],
    default: 'TwoWheeler'
  },
  items: { type: [orderItemSchema], required: true },
  shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },

  // ⬇⬇⬇ Pricing WITHOUT tax
  pricing: {
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true, default: 0 },
    discount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true } // exact final total
  },

  notes: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'],
    default: 'pending'
  },

  payment: {
    method: { type: String, enum: ['cod', 'online'], default: 'cod' },
    status: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    provider: { type: String, default: '' },
    txnId: { type: String, default: '' }
  },

  orderCode: { type: String, index: true },
}, { timestamps: true });

orderSchema.statics.generateCode = function (prefix = 'JY') {
  const rnd = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${rnd}`;
};

orderSchema.pre('save', function (next) {
  if (!this.orderCode) this.orderCode = this.constructor.generateCode();
  next();
});

module.exports = mongoose.model('Order', orderSchema);
