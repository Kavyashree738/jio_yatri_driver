// models/User.js
const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  aadhaarFile: { type: mongoose.Schema.Types.ObjectId, default: null }, // GridFS (kyc_files)
  panFile: { type: mongoose.Schema.Types.ObjectId, default: null }, // GridFS (kyc_files)
  status: { type: String, enum: ['none', 'submitted', 'verified', 'rejected'], default: 'none' },
  submittedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  notes: { type: String, default: '' }
}, { _id: false });


const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  uid: { type: String, default: null }, // legacy alias

  // NEW
  name: { type: String, trim: true, default: '' },

  phone: { type: String },
  email: { type: String },
  role: {
    type: String,
    enum: ['driver', 'business'],
    default: 'driver',
    required: true
  },
  driverRegistered: { type: Boolean, default: false },
  businessRegistered: { type: Boolean, default: false },

  // NEW: avatar photo stored in GridFS
  photo: { type: mongoose.Schema.Types.ObjectId, default: null },

  hasKyc: { type: Boolean, default: false },
  kyc: { type: kycSchema, default: () => ({}) },


  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.index({ userId: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });

// Virtual URL for the photo
userSchema.virtual('photoUrl').get(function () {
  if (!this.photo) return null;
  const base = process.env.API_BASE_URL || 'http://localhost:5000';
  return `${base}/api/users/avatar/${this.photo}`;
});

module.exports = mongoose.model('User', userSchema);
