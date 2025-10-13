const mongoose = require('mongoose');

// 1. First register the GridFS collections schemas
mongoose.model('shop_files.files', new mongoose.Schema({}, { strict: false }));
mongoose.model('shop_files.chunks', new mongoose.Schema({}, { strict: false }));

const vpaRegex = /^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i;
// 2. Base shop schema
const baseShopSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  shopName: { type: String, required: true, trim: true },
  phone: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },

  upiId: {
    type: String,
    required: true,        // make mandatory for shops that accept UPI
    trim: true,
    set: v => (v ? String(v).trim().toLowerCase() : v),
    validate: {
      validator: v => vpaRegex.test(v || ''),
      message: p => `${p.value} is not a valid UPI ID`
    }
  },
  phonePeNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid PhonePe number!`
    }
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  fcmToken: { type: String, default: null },            // single device (optional)
  fcmTokens: { type: [String], default: [] },           // multi-device (recommended)
  address: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  geoLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat] format for MongoDB
      index: '2dsphere'
    }
  },
  openingTime: { type: String, required: true },
  closingTime: { type: String, required: true },
  shopImages: [{ type: mongoose.Schema.Types.ObjectId }], // Removed ref as we handle manually
  category: {
    type: String,
    required: true,
    enum: ['grocery', 'vegetable', 'provision', 'medical', 'hotel','bakery','cafe']
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    uppercase: true,
    trim: true
  },
  referredBy: {
    type: String,   // stores the referrer's referralCode
    default: null,
    index: true,
    uppercase: true,
    trim: true
  },
  referralRewards: [{
    amount: { type: Number, default: 20 },
    description: { type: String, default: '' },
    referredShopId: { type: String, required: true },  // Shop._id of the new shop
    createdAt: { type: Date, default: Date.now }
  }],
  totalReferrals: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 }
},

  {
    timestamps: true,
    discriminatorKey: 'category',
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  });

// Virtual for shop image URLs
baseShopSchema.virtual('shopImageUrls').get(function () {
  if (!this.shopImages || this.shopImages.length === 0) return [];
  return this.shopImages.map(img =>
    `https://jio-yatri-driver.onrender.com/api/shops/images/${img}`
  );
});

baseShopSchema.statics.generateReferralCode = async function (prefix = 'MG') {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    const randomPart = Math.floor(1000 + Math.random() * 9000); // 4 digits
    code = `${prefix}${randomPart}`;
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error(`Failed to generate unique referral code after ${maxAttempts} attempts`);
    }
  } while (await this.exists({ referralCode: code }));

  return code;
};

baseShopSchema.pre('save', function(next) {
  if (Array.isArray(this.fcmTokens)) {
    this.fcmTokens = [...new Set(this.fcmTokens.filter(Boolean))];
  }
  next();
});


baseShopSchema.pre('save', async function () {
  if (!this.referralCode) {
    this.referralCode = await this.constructor.generateReferralCode('MG'); // SB = Shop/Business
  }
});

baseShopSchema.index({ geoLocation: "2dsphere" });


// Create base Shop model
const Shop = mongoose.model('Shop', baseShopSchema);

// 3. Category-specific schemas with their own virtuals

// Grocery schema
const grocerySchema = new mongoose.Schema({
  items: [{
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId } ,// Removed ref
    weight: { type: String },  // ✅ add this
    brand: { type: String },   // ✅ add this
    quantity: { type: Number, default: 1, min: 0 } 
  }]
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


grocerySchema.virtual('itemsWithUrls').get(function () {
  if (!this.items) return [];
  return this.items.map(item => ({
    ...item.toObject(),
    imageUrl: item.image ?
      `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}` :
      null
  }));
});

// Vegetable schema
const vegetableSchema = new mongoose.Schema({
  items: [{
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    organic: { type: Boolean, default: false },
    image: { type: mongoose.Schema.Types.ObjectId }
  }]
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

vegetableSchema.virtual('itemsWithUrls').get(function () {
  if (!this.items) return [];
  return this.items.map(item => ({
    ...item.toObject(),
    imageUrl: item.image ?
      `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}` :
      null
  }));
});

// Provision schema
const provisionSchema = new mongoose.Schema({
  items: [{
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    weight: { type: String },
    brand: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId },
    quantity: { type: Number, default: 1, min: 0 } 
  }]
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

provisionSchema.virtual('itemsWithUrls').get(function () {
  if (!this.items) return [];
  return this.items.map(item => ({
    ...item.toObject(),
    imageUrl: item.image ?
      `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}` :
      null
  }));
});

// Medical schema
const medicalSchema = new mongoose.Schema({
  items: [{
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    prescriptionRequired: { type: Boolean, default: false },
    image: { type: mongoose.Schema.Types.ObjectId }
  }],
  hasPharmacy: { type: Boolean, default: false }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

medicalSchema.virtual('itemsWithUrls').get(function () {
  if (!this.items) return [];
  return this.items.map(item => ({
    ...item.toObject(),
    imageUrl: item.image ?
      `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}` :
      null
  }));
});

// Hotel schema
// const hotelSchema = new mongoose.Schema({
//   rooms: [{
//     type: { type: String, required: true, enum: ['single', 'double', 'suite'] },
//     pricePerNight: { type: Number, required: true, min: 0 },
//     amenities: [{ type: String }],
//     images: [{ type: mongoose.Schema.Types.ObjectId }]
//   }],
//   cuisineTypes: [{ type: String }],
//   hasRestaurant: { type: Boolean, default: false }
// }, {
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// hotelSchema.virtual('roomsWithUrls').get(function() {
//   if (!this.rooms) return [];
//   return this.rooms.map(room => ({
//     ...room.toObject(),
//     imageUrls: room.images ? 
//       room.images.map(img => 
//         `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/shops/images/${img}`
//       ) : []
//   }));
// });

const hotelSchema = new mongoose.Schema({
  items: [{
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [1, 'Price must be at least 1']
    },
    veg: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      maxlength: [100, 'Description cannot exceed 100 characters']
    },
    category: {
      type: String,
      enum: ['main', 'breakfast', 'lunch', 'dinner', 'snacks', 'beverages'],
      required: true
    },
    image: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Image is required for each item']  // Enforce image for every item
    },
    available: {
      type: Boolean,
      default: true
    },
    spiceLevel: {
      type: String,
      enum: ['mild', 'medium', 'spicy'],
      default: 'medium'
    }
  }]
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Automatically generate image URLs for all items
hotelSchema.virtual('itemsWithUrls').get(function () {
  if (!this.items) return [];
  return this.items.map(item => ({
    ...item.toObject(),
    imageUrl: `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}`
  }));
});

const bakerySchema = new mongoose.Schema({
  items: [{
    name: { type: String, required: [true, 'Item name is required'], trim: true },
    price: { type: Number, required: [true, 'Price is required'], min: [1, 'Price must be at least 1'] },
    veg: { type: Boolean, default: true },
    image: { type: mongoose.Schema.Types.ObjectId, required: [true, 'Image is required for each item'] },
    available: { type: Boolean, default: true }
  }]
}, { toJSON: { virtuals: true }, toObject: { virtuals: true }});

bakerySchema.virtual('itemsWithUrls').get(function () {
  const base = 'https://jio-yatri-driver.onrender.com';
  return (this.items || []).map(item => ({
    ...item.toObject(),
    imageUrl: `${base}/api/shops/images/${item.image}`
  }));
});

// Cafe (same as hotel, but NO description, NO spiceLevel)
const cafeSchema = new mongoose.Schema({
  items: [{
    name: { type: String, required: [true, 'Item name is required'], trim: true },
    price: { type: Number, required: [true, 'Price is required'], min: [1, 'Price must be at least 1'] },
    image: { type: mongoose.Schema.Types.ObjectId, required: [true, 'Image is required for each item'] },
    available: { type: Boolean, default: true }
  }]
}, { toJSON: { virtuals: true }, toObject: { virtuals: true }});

cafeSchema.virtual('itemsWithUrls').get(function () {
  const base = 'https://jio-yatri-driver.onrender.com';
  return (this.items || []).map(item => ({
    ...item.toObject(),
    imageUrl: `${base}/api/shops/images/${item.image}`
  }));
});


// 4. Register discriminators
Shop.discriminator('grocery', grocerySchema);
Shop.discriminator('vegetable', vegetableSchema);
Shop.discriminator('provision', provisionSchema);
Shop.discriminator('medical', medicalSchema);
Shop.discriminator('hotel', hotelSchema);
Shop.discriminator('bakery', bakerySchema); // 👈 added
Shop.discriminator('cafe', cafeSchema);

module.exports = Shop;
