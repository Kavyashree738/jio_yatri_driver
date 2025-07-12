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
  vehicleType: { 
    type: String, 
    enum: ['TwoWheeler', 'ThreeWheeler', 'Truck','Pickup9ft','Tata407'], 
    required: true 
  },
  vehicleNumber: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(v);
      },
      message: props => `${props.value} is not a valid vehicle number!`
    }
  },
  documents: {
    aadhar: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
    pan: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
    license: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
    rc: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
    insurance: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true }
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  ratings: {
    average: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 5
    },
    count: { 
      type: Number, 
      default: 0 
    },
    details: [{
      shipmentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Shipment' 
      },
      rating: { 
        type: Number, 
        required: true,
        min: 1,
        max: 5
      },
      feedback: String,
      userId: {
        type: String,
        required: true
      },
      createdAt: { 
        type: Date, 
        default: Date.now 
      }
    }]
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
      validate: {
        validator: function (value) {
          return value.length === 2 &&
            typeof value[0] === 'number' &&
            typeof value[1] === 'number';
        },
        message: 'Coordinates must be an array of two numbers [lng, lat]'
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    address: {
      type: String,
      default: ''
    }
  },
  isLocationActive: { type: Boolean, default: false },
  fcmToken: { type: String, default: null },
  isAvailable: { type: Boolean, default: true },
  activeShipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
  completedDeliveries: { type: Number, default: 0 },
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
