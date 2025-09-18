// const mongoose = require('mongoose');

// const driverSchema = new mongoose.Schema({
//   userId: { type: String, required: true, unique: true },
//   name: { type: String, required: true },
//   phone: { type: String, required: true },
//   profileImage: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'fs.files',
//     default: null
//   },
//   vehicleType: { 
//     type: String, 
//     enum: ['TwoWheeler', 'ThreeWheeler', 'Truck','Pickup9ft','Tata407'], 
//     required: true 
//   },
//   vehicleNumber: { 
//     type: String, 
//     required: true,
//     validate: {
//       validator: function(v) {
//         return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(v);
//       },
//       message: props => `${props.value} is not a valid vehicle number!`
//     }
//   },
//   // documents: {
//   //   aadhar: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
//   //   pan: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
//   //   license: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
//   //   rc: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
//   //   insurance: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true }
//   // },
// documents: {
//     aadhar: { 
//       type: mongoose.Schema.Types.ObjectId, 
//       ref: 'fs.files',
//       required: true 
//     },
//     pan: { 
//       type: mongoose.Schema.Types.ObjectId, 
//       ref: 'fs.files',
//       required: true 
//     },
//     license: { 
//       type: mongoose.Schema.Types.ObjectId, 
//       ref: 'fs.files',
//       required: true 
//     },
//     rc: { 
//       type: mongoose.Schema.Types.ObjectId, 
//       ref: 'fs.files',
//       required: true 
//     },
//     insurance: { 
//       type: mongoose.Schema.Types.ObjectId, 
//       ref: 'fs.files',
//       required: true 
//     }
//   },
//   // Add verification status for each document type
//   documentVerification: {
//     aadhar: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
//     pan: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
//     license: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
//     rc: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
//     insurance: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' }
//   },
//   verificationStatus: {
//     type: String,
//     enum: ['pending', 'verified', 'rejected'],
//     default: 'pending'
//   },
//   verificationNotes: {
//     type: String,
//     default: ''
//   },
//   verifiedAt: {
//     type: Date
//   },
//   verifiedBy: {
//     type: String // Admin user ID who verified
//   },
//   status: { type: String, enum: ['active', 'inactive'], default: 'active' },
//   ratings: {
//     average: { 
//       type: Number, 
//       default: 0,
//       min: 0,
//       max: 5
//     },
//     count: { 
//       type: Number, 
//       default: 0 
//     },
//     details: [{
//       shipmentId: { 
//         type: mongoose.Schema.Types.ObjectId, 
//         ref: 'Shipment' 
//       },
//       rating: { 
//         type: Number, 
//         required: true,
//         min: 1,
//         max: 5
//       },
//       feedback: String,
//       userId: {
//         type: String,
//         required: true
//       },
//       createdAt: { 
//         type: Date, 
//         default: Date.now 
//       }
//     }]
//   },
//   location: {
//     type: {
//       type: String,
//       enum: ['Point'],
//       default: 'Point'
//     },
//     coordinates: {
//       type: [Number],
//       default: [0, 0],
//       validate: {
//         validator: function (value) {
//           return value.length === 2 &&
//             typeof value[0] === 'number' &&
//             typeof value[1] === 'number';
//         },
//         message: 'Coordinates must be an array of two numbers [lng, lat]'
//       }
//     },
//     lastUpdated: {
//       type: Date,
//       default: Date.now
//     },
//     address: {
//       type: String,
//       default: ''
//     }
//   },
//   isLocationActive: { type: Boolean, default: false },
//   fcmToken: { type: String, default: null },
//   isAvailable: { type: Boolean, default: true },
//   activeShipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
//   completedDeliveries: { type: Number, default: 0 },
//   earnings: { type: Number, default: 0 },
//   paymentBreakdown: {
//     cash: { type: Number, default: 0 },
//     online: { type: Number, default: 0 }
//   },
//   collectedPayments: [{
//     shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
//     amount: Number,
//     method: String,
//     collectedAt: { type: Date, default: Date.now }
//   }]
// });

// driverSchema.index({ location: '2dsphere' });
// driverSchema.index({ earnings: 1 });

// module.exports = mongoose.model('Driver', driverSchema);

const mongoose = require('mongoose');
const moment = require('moment-timezone');
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
    enum: ['TwoWheeler', 'ThreeWheeler', 'Truck', 'Pickup9ft', 'Tata407'],
    required: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(v);
      },
      message: props => `${props.value} is not a valid vehicle number!`
    }
  },
  // documents: {
  //   aadhar: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
  //   pan: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
  //   license: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
  //   rc: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true },
  //   insurance: { type: mongoose.Schema.Types.ObjectId, ref: 'fs.files', required: true }
  // },
  documents: {
    aadhar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'fs.files',
      required: true
    },
    pan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'fs.files',
      required: true
    },
    license: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'fs.files',
      required: true
    },
    rc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'fs.files',
      required: true
    },
    insurance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'fs.files',
      required: true
    }
  },
  // Add verification status for each document type
  documentVerification: {
    aadhar: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    pan: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    license: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    rc: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    insurance: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNotes: {
    type: String,
    default: ''
  },
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: String // Admin user ID who verified
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
  lastKnownLocation: {
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
  updatedAt: { type: Date, default: Date.now }
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
  }],
  paymentSettlements: [{
    date: { type: Date, required: true, default: Date.now },
    cashCollected: { type: Number, default: 0 },
    onlineCollected: { type: Number, default: 0 },
    driverEarned: { type: Number, default: 0 },
    ownerEarned: { type: Number, default: 0 },
    driverToOwner: { type: Number, default: 0 },
    ownerToDriver: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'settled'], default: 'pending' },
    settledAt: { type: Date },

    // 🔑 Razorpay details (optional, only filled when paid online)
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String }
  }],
  currentDaySettlement: {
    cashCollected: { type: Number, default: 0 },
    onlineCollected: { type: Number, default: 0 },
    driverEarned: { type: Number, default: 0 },
    ownerEarned: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }
  , lastSettlementDate: {
    type: Date,
    default: () => moment().tz('Asia/Kolkata').subtract(1, 'day').toDate()
  }, referralCode: { 
    type: String, 
    unique: true, 
    sparse: true,
    index: true
  },
  referredBy: { 
    type: String, 
    default: null, 
    index: true 
  },
   referralRewards: [{
    amount: { type: Number, default: 20 },
    description: { type: String, default: '' },
    referredDriverId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
   totalReferrals: { type: Number, default: 0 },
   referralEarnings: { type: Number, default: 0 },
  
}, {
  timestamps: true
});

driverSchema.statics.generateReferralCode = async function(prefix = 'MG') {
  let code;
  let attempts = 0;
  const maxAttempts = 10; // Increased from 5 to 10 for better chance of success
  
  do {
    // Generate 4 random digits (1000-9999 range)
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}${randomPart}`;
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error(`Failed to generate unique referral code after ${maxAttempts} attempts`);
    }
    
    // Check if code already exists
    const exists = await this.exists({ referralCode: code });
    if (!exists) return code;
    
  } while (true);
};

// Pre-save hook to generate referral code if not exists
driverSchema.pre('save', async function() {
  if (!this.referralCode) {
    const prefix = 'MG'; // fixed prefix
    this.referralCode = await this.constructor.generateReferralCode(prefix);
  }
});

driverSchema.index({ userId: 1 });
driverSchema.index({ lastKnownLocation: '2dsphere' });
driverSchema.index({ earnings: 1 });
driverSchema.index({ 'referralRewards.createdAt': -1 });
module.exports = mongoose.model('Driver', driverSchema);
