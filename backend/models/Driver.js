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
  vehicleType: { type: String, enum: ['bike', 'van', 'truck'], required: true },
  vehicleNumber: { 
    type: String, 
    required: true,
    validate: {
      validator: (v) => /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(v),
      message: props => `${props.value} is not a valid vehicle number!`
    }
  },
  documents: {
    license: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' },
    rc: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files' }
  },
   status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive'
  },
   lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Driver', driverSchema);