const mongoose = require('mongoose');
const Shop = require('../models/CategoryModel');
const { GridFSBucket } = require('mongodb');
const User = require('../models/UserRole'); // Adjust the path as needed
let gfs;
const initGridFS = () => {
  return new Promise((resolve, reject) => {
    const conn = mongoose.connection;
    if (conn.readyState === 1) {
      gfs = new GridFSBucket(conn.db, { bucketName: 'shop_files' });
      return resolve(gfs);
    }
    conn.once('open', () => {
      gfs = new GridFSBucket(conn.db, { bucketName: 'shop_files' });
      resolve(gfs);
    });
    conn.on('error', reject);
  });
};
const gfsPromise = initGridFS();

// const uploadFiles = async (files) => {
//   return await Promise.all(
//     files.map(file => {
//       return new Promise((resolve, reject) => {
//         const uploadStream = gfs.openUploadStream(file.originalname);
//         uploadStream.end(file.buffer);
//         uploadStream.on('finish', () => resolve(uploadStream.id));
//         uploadStream.on('error', reject);
//       });
//     })
//   );
// };

const uploadFiles = async (files) => {
  return Promise.all(files.map(file => new Promise((resolve, reject) => {
    const uploadStream = gfs.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: {
        uploadedAt: new Date(),
        originalName: file.originalname,
      }
    });
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.on('error', reject);
    uploadStream.end(file.buffer);
  })));
};


// exports.registerShop = async (req, res) => {
//   try {
//     await gfsPromise;
//     const { category, ...shopData } = req.body;
//     if (!category || !['grocery', 'vegetable', 'provision', 'medical', 'hotel'].includes(category)) {
//       return res.status(400).json({ success: false, error: 'Valid category is required' });
//     }

//     const referralCode = (shopData.referralCode || '').toString().trim().toUpperCase();
//     delete shopData.referralCode; // prevent overriding this shop's own referralCode

//     // Handle shop images upload
//     let shopImageIds = [];
//     if (req.files['shopImages']) {
//       shopImageIds = await uploadFiles(req.files['shopImages']);
//     }

//     // Handle items for ALL categories (including hotel)
//     let items = [];
//     if (req.body.items) {
//       items = JSON.parse(req.body.items);

//       // Process item images
//       if (req.files['itemImages']) {
//         const itemImages = req.files['itemImages'];
//         for (let i = 0; i < items.length && i < itemImages.length; i++) {
//           const fileId = await new Promise((resolve, reject) => {
//             const uploadStream = gfs.openUploadStream(itemImages[i].originalname);
//             uploadStream.end(itemImages[i].buffer);
//             uploadStream.on('finish', () => resolve(uploadStream.id));
//             uploadStream.on('error', reject);
//           });
//           items[i].image = fileId;
//         }
//       }

//       // Validate required fields for hotel items
//       if (category === 'hotel') {
//         for (const item of items) {
//           if (!item.image) {
//             return res.status(400).json({
//               success: false,
//               error: 'Image is required for each food item'
//             });
//           }
//         }
//       }
//     }

//     const parsedAddress = typeof shopData.address === 'string'
//       ? JSON.parse(shopData.address)
//       : shopData.address;

//     // Create the shop document
//     const newShop = new Shop({
//       ...shopData,
//       address: parsedAddress,
//       category,
//       shopImages: shopImageIds,
//       items // Include items for ALL categories
//     });

//     await newShop.save();

//     await User.updateOne(
//       { userId: shopData.userId },
//       { $set: { role: 'business', isRegistered: true, phone: shopData.phone } },
//       { upsert: true });


//     if (referralCode) {
//       try {
//         const referrer = await Shop.findOne({ referralCode }).select('_id userId shopName referralCode');
//         if (referrer && String(referrer.userId) !== String(newShop.userId)) {
//           const reward = {
//             amount: 20,
//             description: `Referred shop ${newShop.shopName} (${newShop._id})`,
//             referredShopId: String(newShop._id)
//           };

//           await Shop.updateOne(
//             { _id: referrer._id },
//             {
//               $push: { referralRewards: reward },
//               $inc: { totalReferrals: 1, referralEarnings: reward.amount }
//             }
//           );

//           // store who referred this new shop
//           await Shop.updateOne(
//             { _id: newShop._id },
//             { $set: { referredBy: referralCode } }
//           );
//         }
//         // invalid/self referral => no credit, no block
//       } catch (refErr) {
//         console.error('[Shop Referral] credit error:', refErr);
//         // do not fail registration for referral issues
//       }
//     }

//     res.status(201).json({
//       success: true,
//       data: newShop
//     });
//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       error: error.message
//     });
//   }
// };

exports.registerShop = async (req, res) => {
  try {
    await gfsPromise;

    const { category, ...shopData } = req.body;
    if (!category || !['grocery', 'vegetable', 'provision', 'medical', 'hotel', 'bakery', 'cafe'].includes(category)) {
      return res.status(400).json({ success: false, error: 'Valid category is required' });
    }

    const referralCode = (shopData.referralCode || '').toString().trim().toUpperCase();
    delete shopData.referralCode; // prevent overriding this shop's own referralCode

    // Handle shop images upload (via uploadFiles)
    let shopImageIds = [];
    if (req.files && req.files['shopImages']) {
      shopImageIds = await uploadFiles(req.files['shopImages']);
    }

    // KYC: Aadhaar & PAN (optional) — also via uploadFiles
    let aadhaarId = null;
    let panId = null;
    if (req.files && req.files['aadhaar'] && req.files['aadhaar'].length) {
      const [id] = await uploadFiles(req.files['aadhaar']); // maxCount:1
      aadhaarId = id;
    }
    if (req.files && req.files['pan'] && req.files['pan'].length) {
      const [id] = await uploadFiles(req.files['pan']); // maxCount:1
      panId = id;
    }

    // Handle items for ALL categories (including hotel)
    let items = [];
    if (req.body.items) {
      items = JSON.parse(req.body.items);

      // Process item images (use uploadFiles helper)
      if (req.files && req.files['itemImages']) {
        const uploadedIds = await uploadFiles(req.files['itemImages']);
        for (let i = 0; i < items.length && i < uploadedIds.length; i++) {
          items[i].image = uploadedIds[i];
        }
      }

      // Validate required fields for hotel items (image required)
      if (category === 'hotel') {
        for (const item of items) {
          if (!item.image) {
            return res.status(400).json({
              success: false,
              error: 'Image is required for each food item'
            });
          }
        }
      }
    }

    const parsedAddress = typeof shopData.address === 'string'
      ? JSON.parse(shopData.address)
      : shopData.address;

    // Create the shop document
    const newShop = new Shop({
      ...shopData,
      address: parsedAddress,
      category,
      shopImages: shopImageIds,
      items,
       geoLocation: {
    type: "Point",
    coordinates: [
      parsedAddress?.coordinates?.lng,
      parsedAddress?.coordinates?.lat
    ]
  }
    });

    await newShop.save();

    // Basic user flags
    await User.updateOne(
      { userId: shopData.userId },
      { $set: { role: 'business',  businessRegistered: true, phone: shopData.phone } },
      { upsert: true });


    // If any KYC doc was provided, store its IDs on the user
    if (aadhaarId || panId) {
      await User.updateOne(
        { userId: shopData.userId },
        {
          $set: {
            hasKyc: true,
            'kyc.aadhaarFile': aadhaarId || null,
            'kyc.panFile': panId || null,
            'kyc.status': 'submitted',
            'kyc.submittedAt': new Date()
          }
        }
      );
    }

    // Referral credit (unchanged)
    if (referralCode) {
      try {
        const referrer = await Shop.findOne({ referralCode }).select('_id userId shopName referralCode');
        if (referrer && String(referrer.userId) !== String(newShop.userId)) {
          const reward = {
            amount: 20,
            description: `Referred shop ${newShop.shopName} (${newShop._id})`,
            referredShopId: String(newShop._id)
          };

          await Shop.updateOne(
            { _id: referrer._id },
            {
              $push: { referralRewards: reward },
              $inc: { totalReferrals: 1, referralEarnings: reward.amount }
            }
          );

          // store who referred this new shop
          await Shop.updateOne(
            { _id: newShop._id },
            { $set: { referredBy: referralCode } }
          );
        }
        // invalid/self referral => no credit, no block
      } catch (refErr) {
        // console.error('[Shop Referral] credit error:', refErr);
        // do not fail registration for referral issues
      }
    }

    res.status(201).json({
      success: true,
      data: newShop
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get shops by category
exports.getShopsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    // Find shops without populating (since GridFS files can't be properly populated)
    const shops = await Shop.find({ category }).sort({ createdAt: -1 }).lean();

    // Process shops to add image URLs
    const shopsWithUrls = shops.map(shop => ({
      ...shop,
      shopImageUrls: shop.shopImages?.map(imgId =>
        `https://jio-yatri-driver.onrender.com/api/shops/images/${imgId}`
      ) || [],
      items: shop.items?.map(item => ({
        ...item,
        imageUrl: item.image ?
          `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}` :
          null
      })) || [],
      rooms: shop.rooms?.map(room => ({
        ...room,
        imageUrls: room.images?.map(imgId =>
          `https://jio-yatri-driver.onrender.com/api/shops/images/${imgId}`
        ) || []
      })) || []
    }));

    res.status(200).json({ success: true, data: shopsWithUrls });
  } catch (err) {
    // console.error('Error in getShopsByCategory:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch shops' });
  }
};

// Get shop by ID
exports.getShopById = async (req, res) => {
  try {
    // console.log(`[ShopController] Fetching shop with ID: ${req.params.id}`);
    const shop = await Shop.findById(req.params.id).lean();

    if (!shop) {
      // console.log('[ShopController] Shop not found');
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Generate image URLs
    const baseUrl = 'https://jio-yatri-driver.onrender.com';
    const response = {
      ...shop,
      shopImageUrls: shop.shopImages?.map(imgId =>
        `${baseUrl}/api/shops/images/${imgId}`
      ) || [],
      items: shop.items?.map(item => ({
        ...item,
        imageUrl: item.image ?
          `${baseUrl}/api/shops/images/${item.image}` :
          null
      })) || []
    };

    // console.log('[ShopController] Shop found:', {
    //   _id: response._id,
    //   shopName: response.shopName,
    //   itemCount: response.items?.length
    // });
    res.status(200).json({ success: true, data: response });
  } catch (err) {
    // console.error('[ShopController] Error in getShopById:', {
    //   message: err.message,
    //   params: req.params
    // });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
};

// Get image from GridFS
exports.getImage = async (req, res) => {
  try {
    // console.log('[ShopController] Starting getImage function');
    // console.log(`[ShopController] Image ID received: ${req.params.id}`);

    await gfsPromise;
    // console.log('[ShopController] GridFS connection established');

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    // console.log(`[ShopController] Converted to ObjectId: ${fileId}`);

    // console.log('[ShopController] Searching for file in GridFS...');
    const files = await gfs.find({ _id: fileId }).toArray();
    // console.log(`[ShopController] Found ${files.length} matching files`);

    if (!files || files.length === 0) {
      // console.log('[ShopController] No files found');
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // console.log('[ShopController] Preparing to stream file...');
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    const downloadStream = gfs.openDownloadStream(fileId);

    downloadStream.on('error', (err) => {
      // console.error('[ShopController] Error streaming file:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Error streaming file' });
      }
    });

    // console.log('[ShopController] Starting file stream');
    downloadStream.pipe(res);
  } catch (err) {
    // console.error('[ShopController] Error in getImage:', {
    //   message: err.message,
    //   stack: err.stack,
    //   name: err.name
    // });
    res.status(500).json({
      success: false,
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
};

// Update shop
exports.updateShop = async (req, res) => {
  // console.log('--- STARTING SHOP UPDATE ---');
  try {
    await gfsPromise;

    // helpers
    const parseJson = (val, fb) => {
      if (val == null) return fb;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return fb; }
    };
    const idFromUrl = (u) => (u ? String(u).split('/').pop().split('?')[0] : null);
    const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

    // parse
    const userId = req.body.userId;
    const shopId = req.params.id;
    const itemsIn = parseJson(req.body.items, []);
    const cuisineTypes = parseJson(req.body.cuisineTypes, []);
    const address = parseJson(req.body.address, null);
    const existingShopImages = parseJson(req.body.existingShopImages, []);

    // load + auth
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
    if (String(shop.userId) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // shop images
    const newShopImageIds = [];
    if (Array.isArray(req.files?.shopImages)) {
      for (const f of req.files.shopImages) newShopImageIds.push(await uploadFile(f));
    }
    shop.shopImages = [...existingShopImages, ...newShopImageIds];

    // items
    const uploadedItemFiles = Array.isArray(req.files?.itemImages) ? req.files.itemImages : [];
    let fileIdx = 0;
    const newItems = [];

    for (let i = 0; i < itemsIn.length; i++) {
      const it = itemsIn[i] || {};
      const name = it.name;
      const price = it.price != null ? Number(it.price) : null;

      // resolve image
      let imageId = it.image || null;
      if (!imageId && it.imageUrl) imageId = idFromUrl(it.imageUrl);
      if (!imageId && fileIdx < uploadedItemFiles.length) {
        imageId = await uploadFile(uploadedItemFiles[fileIdx++]);
      }
      if (shop.category === 'hotel' && !imageId) {
        return res.status(400).json({
          success: false,
          error: `Image is required for item "${name || `#${i + 1}`}".`
        });
      }

      // base per item
      const out = { name, price };

      // category-specific fields  ✅ includes medical.prescriptionRequired
      switch (shop.category) {
        case 'hotel':
          out.veg = toBool(it.veg);
          if (it.category) out.category = String(it.category);
          if (it.description) out.description = String(it.description);
          if (it.spiceLevel) out.spiceLevel = String(it.spiceLevel);
          break;
        case 'bakery':
          out.veg = toBool(it.veg);
          break;
        case 'cafe':
          break;
        case 'grocery':
          if (it.description) out.description = String(it.description);
          if (it.weight != null && it.weight !== '') out.weight = String(it.weight);  // ✅ add
          if (it.brand != null && it.brand !== '') out.brand = String(it.brand);      // ✅ add
          if (it.quantity != null && it.quantity !== '') out.quantity = Number(it.quantity); // 👈 new
          break;


        case 'vegetable':
          if (it.organic !== undefined) out.organic = toBool(it.organic);
          if (it.quantity != null && it.quantity !== '') out.quantity = Number(it.quantity);
          break;

        case 'provision':
          if (it.weight != null && it.weight !== '') out.weight = String(it.weight);
          if (it.brand != null && it.brand !== '') out.brand = String(it.brand);
           if (it.quantity != null && it.quantity !== '') out.quantity = Number(it.quantity); // 👈 new
          break;

        case 'medical':
          out.prescriptionRequired = toBool(it.prescriptionRequired); // ← crucial
          break;

        default:
          break;
      }

      if (imageId) out.image = imageId;
      newItems.push(out);
    }

    shop.items = newItems;

    // basic fields
    if (req.body.shopName != null) shop.shopName = req.body.shopName;
    if (req.body.phone != null) shop.phone = req.body.phone;
    if (req.body.phonePeNumber != null) shop.phonePeNumber = req.body.phonePeNumber;
    if (req.body.email != null) shop.email = req.body.email;
    if (address) shop.address = address;
    if (req.body.openingTime != null) shop.openingTime = req.body.openingTime;
    if (req.body.closingTime != null) shop.closingTime = req.body.closingTime;
    if (Array.isArray(cuisineTypes)) shop.cuisineTypes = cuisineTypes;

    const saved = await shop.save();

    const baseUrl = 'https://jio-yatri-driver.onrender.com';
    const data = {
      ...saved.toObject(),
      shopImageUrls: (saved.shopImages || []).map(id => `${baseUrl}/api/shops/images/${id}`),
      items: (saved.items || []).map(it => ({
        ...it,
        imageUrl: it.image ? `${baseUrl}/api/shops/images/${it.image}` : null
      }))
    };

    return res.json({ success: true, data, message: 'Shop updated successfully' });
  } catch (error) {
    // console.error('[updateShop] failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update shop' });
  }
};




// Delete shop
exports.deleteShop = async (req, res) => {
  try {
    // console.log('[ShopController] Starting shop deletion');
    const { userId } = req.body;
    const existingShop = await Shop.findById(req.params.id);

    if (!existingShop) {
      // console.log('[ShopController] Shop not found');
      return res.status(404).json({ success: false, error: "Shop not found" });
    }

    if (existingShop.userId !== userId) {
      // console.log('[ShopController] Unauthorized access attempt');
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Delete all associated images
    const allImageIds = [
      ...existingShop.shopImages,
      ...(existingShop.items?.map(item => item.image).filter(Boolean)) || []
    ];

    // console.log(`[ShopController] Deleting ${allImageIds.length} associated images`);
    await Promise.all(
      allImageIds.map(imageId =>
        gfs.delete(new mongoose.Types.ObjectId(imageId))
          .then(() => console.log(` `))
          .catch(err => console.error(``))
      )
    );

    await Shop.findByIdAndDelete(req.params.id);
    // console.log('[ShopController] Shop deleted successfully');

    res.json({ success: true, data: {} });
  } catch (error) {
    // console.error('[ShopController] Delete failed:', {
    //   message: error.message,
    //   stack: error.stack
    // });
    res.status(500).json({
      success: false,
      error: "Failed to delete shop",
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

exports.getShopsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    // Find shops without populating (since GridFS files can't be properly populated)
    const shops = await Shop.find({ category }).sort({ createdAt: -1 }).lean();

    // Process shops to add image URLs
    const shopsWithUrls = shops.map(shop => ({
      ...shop,
      shopImageUrls: shop.shopImages?.map(imgId =>
        `https://jio-yatri-driver.onrender.com/api/shops/images/${imgId}`
      ) || [],
      items: shop.items?.map(item => ({
        ...item,
        imageUrl: item.image ?
          `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}` :
          null
      })) || [],
      rooms: shop.rooms?.map(room => ({
        ...room,
        imageUrls: room.images?.map(imgId =>
          `https://jio-yatri-driver.onrender.com/api/shops/images/${imgId}`
        ) || []
      })) || []
    }));

    res.status(200).json({ success: true, data: shopsWithUrls });
  } catch (err) {
    // console.error('Error in getShopsByCategory:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch shops' });
  }
};
exports.getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id).lean();
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Add image URLs to the response
    const response = {
      ...shop,
      shopImageUrls: shop.shopImages?.map(imgId =>
        `https://jio-yatri-driver.onrender.com/api/shops/images/${imgId}`
      ) || [],
      items: shop.items?.map(item => ({
        ...item,
        imageUrl: item.image ?
          `https://jio-yatri-driver.onrender.com/api/shops/images/${item.image}` :
          null
      })) || []
    };

    // console.log("Shop response being sent:", {
    //   _id: response._id,
    //   shopName: response.shopName,
    //   itemCount: response.items?.length,
    //   firstItemImageUrl: response.items?.[0]?.imageUrl
    // });

    res.status(200).json({ success: true, data: response });
  } catch (err) {
    // console.error('Error in getShopById:', {
    //   message: err.message,
    //   stack: err.stack,
    //   params: req.params
    // });
    res.status(500).json({ success: false, error: 'Failed to fetch shop' });
  }
};

exports.getImage = async (req, res) => {
  try {
    // console.log('1. Starting getImage function');
    // console.log(`2. Image ID received: ${req.params.id}`);

    await gfsPromise;
    // console.log('3. GridFS connection established');

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    // console.log(`4. Converted to ObjectId: ${fileId}`);

    // console.log('5. Searching for file in GridFS...');
    const files = await gfs.find({ _id: fileId }).toArray();
    // console.log(`6. Found ${files.length} matching files`);

    if (!files || files.length === 0) {
      // console.log('7. No files found');
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // console.log('8. Preparing to stream file...');
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    const downloadStream = gfs.openDownloadStream(fileId);

    downloadStream.on('error', (err) => {
      // console.error('9. Error streaming file:', err);
      res.status(500).json({ success: false, error: 'Error streaming file' });
    });

    // console.log('10. Starting file stream');
    downloadStream.pipe(res);
  } catch (err) {
    // console.error('11. Error in getImage:', err);
    // console.error('12. Error details:', {
    //   message: err.message,
    //   stack: err.stack,
    //   name: err.name
    // });
    res.status(500).json({ success: false, error: err.message });
  }
};
// Update shop (single, final version)
// exports.updateShop = async (req, res) => {
//   console.log('--- STARTING SHOP UPDATE ---');
//   try {
//     await gfsPromise;

//     // Helpers
//     const parseJson = (val, fb) => {
//       if (val == null) return fb;
//       if (typeof val === 'object') return val;
//       try { return JSON.parse(val); } catch { return fb; }
//     };
//     const idFromUrl = (u) => (u ? String(u).split('/').pop().split('?')[0] : null);

//     // Parse
//     const userId = req.body.userId;
//     const shopId = req.params.id;
//     const itemsIn = parseJson(req.body.items, []);
//     const cuisineTypes = parseJson(req.body.cuisineTypes, []);
//     const address = parseJson(req.body.address, null);
//     const existingShopImages = parseJson(req.body.existingShopImages, []);

//     // Load + authorize
//     const shop = await Shop.findById(shopId);
//     if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
//     if (String(shop.userId) !== String(userId)) {
//       return res.status(403).json({ success: false, error: 'Unauthorized' });
//     }

//     // SHOP IMAGES: keep the ones user kept + add new uploads
//     const newShopImageIds = [];
//     if (Array.isArray(req.files?.shopImages)) {
//       for (const file of req.files.shopImages) {
//         newShopImageIds.push(await uploadFile(file));
//       }
//     }
//     shop.shopImages = [...existingShopImages, ...newShopImageIds];

//     // ITEMS: rebuild safely, preserving existing images
//     const uploadedItemFiles = Array.isArray(req.files?.itemImages) ? req.files.itemImages : [];
//     let fileIdx = 0;
//     const newItems = [];

//     for (let i = 0; i < itemsIn.length; i++) {
//       const it = itemsIn[i] || {};
//       const name = it.name;
//       const price = it.price != null ? Number(it.price) : null;
//       const veg = !!it.veg;
//       const category = it.category;
//       const description = it.description || '';

//       // 1) Use explicit id if present
//       let imageId = it.image || null;
//       // 2) Or derive from imageUrl
//       if (!imageId && it.imageUrl) imageId = idFromUrl(it.imageUrl);
//       // 3) Or consume next uploaded file only if needed
//       if (!imageId && fileIdx < uploadedItemFiles.length) {
//         imageId = await uploadFile(uploadedItemFiles[fileIdx++]);
//       }

//       // Hotels must have image per item
//       if (shop.category === 'hotel' && !imageId) {
//         return res.status(400).json({
//           success: false,
//           error: `Image is required for item "${name || `#${i + 1}`}".`
//         });
//       }

//       newItems.push({
//         name, price, veg, category, description,
//         image: imageId || undefined
//       });
//     }

//     shop.items = newItems;

//     // Basic fields
//     if (req.body.shopName != null) shop.shopName = req.body.shopName;
//     if (req.body.phone != null) shop.phone = req.body.phone;
//     if (req.body.phonePeNumber != null) shop.phonePeNumber = req.body.phonePeNumber;
//     if (req.body.email != null) shop.email = req.body.email;
//     if (address) shop.address = address;
//     if (req.body.openingTime != null) shop.openingTime = req.body.openingTime;
//     if (req.body.closingTime != null) shop.closingTime = req.body.closingTime;
//     if (Array.isArray(cuisineTypes)) shop.cuisineTypes = cuisineTypes;

//     const saved = await shop.save();

//     // Build URLs
//     const base = process.env.API_BASE_URL || 'http://localhost:5000';
//     const data = {
//       ...saved.toObject(),
//       shopImageUrls: (saved.shopImages || []).map(id => `${base}/api/shops/images/${id}`),
//       items: (saved.items || []).map(it => ({
//         ...it,
//         imageUrl: it.image ? `${base}/api/shops/images/${it.image}` : null
//       }))
//     };

//     return res.json({ success: true, data, message: 'Shop updated successfully' });
//   } catch (error) {
//     console.error('[updateShop] failed:', error);
//     return res.status(500).json({ success: false, error: error.message || 'Failed to update shop' });
//   }
// };


// Helper function with enhanced debugging
const uploadFile = async (file) => {
  // console.log(`[DEBUG] Starting upload for file: ${file.originalname}`);
  return new Promise((resolve, reject) => {
    const uploadStream = gfs.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: {
        uploadedAt: new Date(),
        originalName: file.originalname
      }
    });

    uploadStream.on('finish', () => {
      // console.log(`[DEBUG] File uploaded successfully: ${file.originalname} as ${uploadStream.id}`);
      resolve(uploadStream.id);
    });

    uploadStream.on('error', (err) => {
      // console.error(`[ERROR] File upload failed for ${file.originalname}:`, {
      //   message: err.message,
      //   stack: err.stack
      // });
      reject(err);
    });

    uploadStream.end(file.buffer);
  });
};


exports.deleteShop = async (req, res) => {
  try {
    const { userId } = req.body;
    const existingShop = await Shop.findById(req.params.id);
    if (!existingShop) {
      return res.status(404).json({ success: false, error: "Shop not found" });
    }

    if (existingShop.userId !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const allImageIds = [
      ...existingShop.shopImages,
      ...(existingShop.items?.map(item => item.image).filter(Boolean)) || [],
      ...(existingShop.rooms?.flatMap(room => room.images) || [])
    ];

    await Promise.all(
      allImageIds.map(imageId =>
        gfs.delete(new mongoose.Types.ObjectId(imageId)).catch(() => { })
      )
    );

    await Shop.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete shop" });
  }
};

// Add this to your shop controller
exports.getShopsByOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const shops = await Shop.find({ userId: ownerId }).sort({ createdAt: -1 }).lean();

    const baseUrl = 'https://jio-yatri-driver.onrender.com';
    const shopsWithUrls = shops.map(shop => ({
      ...shop,
      shopImageUrls: shop.shopImages?.map(imgId =>
        `${baseUrl}/api/shops/images/${imgId}`
      ) || [],
      items: shop.items?.map(item => ({
        ...item,
        imageUrl: item.image ?
          `${baseUrl}/api/shops/images/${item.image}` :
          null
      })) || []
    }));

    res.status(200).json({ success: true, data: shopsWithUrls });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch owner shops'
    });
  }
};


const verifySelf = (shop, user) => {
  if (!user?.uid) return false;
  return String(shop.userId) === String(user.uid);
};

// POST /api/shops/apply-referral
// Validate a referral code (no state change)
exports.applyShopReferral = async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) {
      return res.status(400).json({ success: false, error: 'Referral code is required' });
    }

    const referrer = await Shop.findOne({ referralCode }).select('shopName userId referralCode');
    if (!referrer) {
      return res.status(400).json({ success: false, error: 'Invalid referral code' });
    }

    // prevent self-referral (by user)
    if (req.user?.uid && String(referrer.userId) === String(req.user.uid)) {
      return res.status(400).json({ success: false, error: 'Cannot use your own referral code' });
    }

    return res.status(200).json({
      success: true,
      message: 'Referral code is valid',
      referrerName: referrer.shopName
    });
  } catch (error) {
    // console.error('[applyShopReferral] failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to validate referral code' });
  }
};

// GET /api/shops/:shopId/referral-code
// Ensure a code exists for this shop (auth required)
exports.getShopReferralCode = async (req, res) => {
  try {
    const { shopId } = req.params;
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    // authorize: only the owner can fetch/generate
    if (!req.user?.uid || String(shop.userId) !== String(req.user.uid)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!shop.referralCode) {
      shop.referralCode = await Shop.generateReferralCode('SB');
      await shop.save();
    }

    const shareLink = `https://play.google.com/store/apps/details?id=com.matspl.jioyatripartner?shop_ref=${shop.referralCode}`;

    return res.json({
      success: true,
      referralCode: shop.referralCode,
      shareLink
    });
  } catch (error) {
    // console.error('[getShopReferralCode] failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to get referral code' });
  }
};

// GET /api/shops/:shopId/referral-stats
exports.getShopReferralStats = async (req, res) => {
  try {
    const { shopId } = req.params;
    const shop = await Shop.findById(shopId).lean();
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    // authorize
    if (!req.user?.uid || String(shop.userId) !== String(req.user.uid)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // All shops referred by this shop’s code
    const referredShops = shop.referralCode
      ? await Shop.find({ referredBy: shop.referralCode })
        .select('shopName userId createdAt')
        .lean()
      : [];

    return res.json({
      success: true,
      referralCode: shop.referralCode || null,
      totalReferrals: shop.totalReferrals || 0,
      totalEarnings: shop.referralEarnings || 0,
      rewards: shop.referralRewards || [],
      referredShops: referredShops.map(s => ({
        shopId: s._id,
        name: s.shopName,
        ownerUserId: s.userId,
        joinedAt: s.createdAt
      }))
    });
  } catch (error) {
    // console.error('[getShopReferralStats] failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
};

// GET /api/shops/referrals/leaderboard
exports.getShopReferralLeaderboard = async (req, res) => {
  try {
    const top = await Shop.aggregate([
      { $match: { referralRewards: { $exists: true, $not: { $size: 0 } } } },
      { $addFields: { totalRewards: { $sum: '$referralRewards.amount' } } },
      { $sort: { totalRewards: -1 } },
      { $limit: 10 },
      { $project: { shopName: 1, referralCode: 1, totalRewards: 1, referralsCount: { $size: '$referralRewards' } } }
    ]);

    return res.json({ success: true, data: top });
  } catch (error) {
    // console.error('[getShopReferralLeaderboard] failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
};
exports.addItemToShop = async (req, res) => {
  try {
    const shopId = req.params.id;
    const userId = req.body.userId;
    const item = JSON.parse(req.body.item || '{}');

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Verify owner
    if (String(shop.userId) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!item.name || item.price == null) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    // 🔍 Check if item already exists by name (case-insensitive)
    const existingIndex = shop.items.findIndex(
      (i) => i.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );

    if (existingIndex !== -1) {
      // ✅ Update existing item details instead of adding duplicate
      const existingItem = shop.items[existingIndex];

      shop.items[existingIndex] = {
        ...existingItem,
        ...item, // overwrite changed fields (price, quantity, desc, etc.)
      };

      await shop.save();

      const baseUrl = 'https://jio-yatri-driver.onrender.com';
      const data = {
        ...shop.toObject(),
        items: shop.items.map(it => ({
          ...it,
          imageUrl: it.image ? `${baseUrl}/api/shops/images/${it.image}` : null
        }))
      };

      return res.json({
        success: true,
        data,
        message: `Item "${item.name}" updated successfully ✅`
      });
    }

    // ✅ Otherwise add new item
    shop.items.push(item);
    await shop.save();

    const baseUrl = 'https://jio-yatri-driver.onrender.com';
    const data = {
      ...shop.toObject(),
      items: shop.items.map(it => ({
        ...it,
        imageUrl: it.image ? `${baseUrl}/api/shops/images/${it.image}` : null
      }))
    };

    res.json({
      success: true,
      data,
      message: 'Item added successfully ✅'
    });

  } catch (err) {
    // console.error('[addItemToShop] failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
