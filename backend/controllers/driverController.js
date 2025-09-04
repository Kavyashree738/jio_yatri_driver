const Driver = require('../models/Driver');
const Shipment = require('../models/Shipment');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const User = require('../models/UserRole');
// Check if driver exists before registration
exports.checkDriverExists = async (req, res) => {
  try {
    
    const { userId } = req.params;
    const driver = await Driver.findOne({ userId });
    
    res.status(200).json({
      exists: !!driver,
      isRegistered: !!driver,
      driver: driver || null
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: 'Server error while checking driver status' 
    });
  }
};
// // Register driver with proper validation
// exports.registerDriver = async (req, res) => {
//   try {
//     const { 
//       userId, 
//       name, 
//       phone, 
//       aadharFileId, 
//       panFileId,
//       vehicleType, 
//       vehicleNumber, 
//       licenseFileId, 
//       rcFileId,
//       insuranceFileId
//     } = req.body;
    
//     // Validate required fields
//     if (!userId || !name || !phone || !aadharFileId || !panFileId || 
//         !vehicleType || !vehicleNumber || !licenseFileId || !rcFileId || !insuranceFileId) {
//       return res.status(400).json({
//         success: false,
//         error: 'All fields and documents are required'
//       });
//     }

//     // Validate vehicle number (format: KA01AB1234)
//     if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicleNumber)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid vehicle number (format: KA01AB1234)'
//       });
//     }

//     // Check if driver already exists
//     const existingDriver = await Driver.findOne({ userId });
//     if (existingDriver) {
//       return res.status(400).json({
//         success: false,
//         error: 'Driver already registered',
//         driver: existingDriver
//       });
//     }

//     // Create new driver
//     const driver = new Driver({
//       userId,
//       name,
//       phone,
//       documents: {
//         aadhar: aadharFileId,
//         pan: panFileId,
//         license: licenseFileId,
//         rc: rcFileId,
//         insurance: insuranceFileId
//       },
//       vehicleType,
//       vehicleNumber,
//       status: 'active'
//     });

//     await driver.save();
    
//     res.status(201).json({ 
//       success: true, 
//       data: driver 
//     });
//   } catch (err) {
//     if (err.code === 11000) {
//       const existingDriver = await Driver.findOne({ userId: req.body.userId });
//       return res.status(400).json({
//         success: false,
//         error: 'Driver registration failed - already exists',
//         driver: existingDriver
//       });
//     }
//     res.status(500).json({ 
//       success: false, 
//       error: err.message 
//     });
//   }
// };
// 
// exports.registerDriver = async (req, res) => {
//   try {
//     const { 
//       userId, 
//       name, 
//       phone, 
//       aadharFileId, 
//       panFileId,
//       vehicleType, 
//       vehicleNumber, 
//       licenseFileId, 
//       rcFileId,
//       insuranceFileId,
//     } = req.body;
    
//     // Validate required fields
//     if (!userId || !name || !phone || !aadharFileId || !panFileId || 
//         !vehicleType || !vehicleNumber || !licenseFileId || !rcFileId || !insuranceFileId) {
//       return res.status(400).json({
//         success: false,
//         error: 'All fields and documents are required'
//       });
//     }

//     // Validate vehicle number (format: KA01AB1234)
//     if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicleNumber)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid vehicle number (format: KA01AB1234)'
//       });
//     }

//     // Check if driver already exists
//     const existingDriver = await Driver.findOne({ userId });
//     if (existingDriver) {
//       return res.status(400).json({
//         success: false,
//         error: 'Driver already registered',
//         driver: existingDriver
//       });
//     }

//     // Create new driver
//     const driver = new Driver({
//       userId,
//       name,
//       phone,
//       documents: {
//         aadhar: aadharFileId,
//         pan: panFileId,
//         license: licenseFileId,
//         rc: rcFileId,
//         insurance: insuranceFileId
//       },
//       vehicleType,
//       vehicleNumber,
//       status: 'active'
//     });

//     await driver.save();
    
//     res.status(201).json({ 
//       success: true, 
//       data: driver 
//     });
//   } catch (err) {
//     if (err.code === 11000) {
//       const existingDriver = await Driver.findOne({ userId: req.body.userId });
//       return res.status(400).json({
//         success: false,
//         error: 'Driver registration failed - already exists',
//         driver: existingDriver
//       });
//     }
//     res.status(500).json({ 
//       success: false, 
//       error: err.message 
//     });
//   }
// };
// // Get driver by userId

exports.registerDriver = async (req, res) => {
  try {
    // console.log('[Registration] Starting driver registration process');
    // console.log('[Registration] Request body:', JSON.stringify(req.body, null, 2));

    const {
      userId,
      name,
      phone,
      aadharFileId,
      panFileId,
      vehicleType,
      vehicleNumber,
      licenseFileId,
      rcFileId,
      insuranceFileId,
      referralCode
    } = req.body;

    // console.log('[Registration] Extracted referralCode:', referralCode);


    // Validate required fields
    if (!userId || !name || !phone || !aadharFileId || !panFileId ||
      !vehicleType || !vehicleNumber || !licenseFileId || !rcFileId || !insuranceFileId) {
      // console.log('[Registration] Validation failed: Missing required fields', {
      //   missingFields: {
      //     userId: !userId,
      //     name: !name,
      //     phone: !phone,
      //     aadharFileId: !aadharFileId,
      //     panFileId: !panFileId,
      //     vehicleType: !vehicleType,
      //     vehicleNumber: !vehicleNumber,
      //     licenseFileId: !licenseFileId,
      //     rcFileId: !rcFileId,
      //     insuranceFileId: !insuranceFileId
      //   }
      // });
      return res.status(400).json({
        success: false,
        error: 'All fields and documents are required'
      });
    }

    // Validate vehicle number
    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicleNumber)) {
      // console.log('[Registration] Validation failed: Invalid vehicle number format', {
      //   vehicleNumber,
      //   isValid: /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(vehicleNumber)
      // });
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle number (format: KA01AB1234)'
      });
    }

    // Check if driver already exists
    // console.log(`[Registration] Checking for existing driver with userId: ${userId}`);
    const existingDriver = await Driver.findOne({ userId });
    // console.log('[Registration] Existing driver check result:', existingDriver);

    if (existingDriver) {
      // console.log('[Registration] Registration failed: Driver already exists', {
      //   existingDriverId: existingDriver._id
      // });
      return res.status(400).json({
        success: false,
        error: 'Driver already registered',
        driver: existingDriver
      });
    }

    // Create new driver
    // console.log('[Registration] Creating new driver document with referralCode:', referralCode);
    const driver = new Driver({
      userId,
      name,
      phone,
      documents: {
        aadhar: aadharFileId,
        pan: panFileId,
        license: licenseFileId,
        rc: rcFileId,
        insurance: insuranceFileId
      },
      vehicleType,
      vehicleNumber,
      status: 'active',
      referredBy: referralCode || undefined
    });

    await User.updateOne(
      { userId },
      { $set: { role: 'driver', isRegistered: true, phone } },
      { upsert: true }
    );

    // console.log('[Registration] Saving driver to database:', driver);
    await driver.save();
    // console.log('[Registration] Driver saved successfully:', driver._id);

    // Process referral if exists
    if (referralCode) {
      // console.log(`[Referral] Processing referral with code: ${referralCode}`);
      try {
        const referrer = await Driver.findOne({ referralCode });
        // console.log('[Referral] Referrer found:', referrer);

        if (referrer) {
          // console.log('[Referral] Checking for self-referral', {
          //   referrerUserId: referrer.userId,
          //   newDriverUserId: userId
          // });

          if (referrer.userId !== userId) {
            const reward = {
              amount: 10,
              description: `Referral from ${driver.name} (${userId})`,
              referredDriverId: userId,
              createdAt: new Date()
            };

            // console.log('[Referral] Creating referral reward:', reward);

            await Driver.updateOne(
              { userId: referrer.userId },
              {
                $push: { referralRewards: reward },
                $inc: {
                  totalReferrals: 1,
                  referralEarnings: reward.amount
                }
              }
            );

            // console.log('[Referral] Referral processed successfully', {
            //   referrerId: referrer._id,
            //   rewardAmount: reward.amount
            // });
          } else {
            // console.log('[Referral] Self-referral detected, skipping reward');
          }
        } else {
          // console.log('[Referral] No referrer found with the provided code');
        }
      } catch (referralError) {
        // console.error('[Referral] Error processing referral:', {
        //   error: referralError.message,
        //   stack: referralError.stack
        // });
        // Continue with registration even if referral fails
      }
    } else {
      console.log('[Referral] No referral code provided, skipping referral processing');
    }

    // console.log('[Registration] Registration completed successfully', {
    //   driverId: driver._id
    // });
    res.status(201).json({
      success: true,
      data: driver
    });
  } catch (err) {
    // console.error('[Registration] Error during registration:', {
    //   error: err.message,
    //   stack: err.stack,
    //   code: err.code,
    //   body: req.body
    // });

    if (err.code === 11000) {
      // console.log('[Registration] Duplicate key error detected');
      const existingDriver = await Driver.findOne({ userId: req.body.userId });
      // console.log('[Registration] Found existing driver:', existingDriver);

      return res.status(400).json({
        success: false,
        error: 'Driver registration failed - already exists',
        driver: existingDriver
      });
    }

    res.status(500).json({
      success: false,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

exports.getDriver = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.params.userId });
    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        error: 'Driver not found' 
      });
    }
    res.status(200).json({ 
      success: true, 
      data: driver 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
};
// Update driver status
exports.updateDriverStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be either "active" or "inactive"'
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.uid },
      {
        status,
        lastUpdated: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        status: driver.status,
        lastUpdated: driver.lastUpdated
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while updating status'
    });
  }
};
// Get driver status
exports.getDriverStatus = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.uid })
      .select('status lastUpdated -_id');

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error while fetching status'
    });
  }
};
exports.getDriverLocation = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.uid })
      .select('location isLocationActive -_id');
    
    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        error: 'Driver not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        location: driver.location,
        isLocationActive: driver.isLocationActive
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: 'Server error while fetching location' 
    });
  }
};
// UPDATE driver location
exports.updateDriverLocation = async (req, res) => {
  try {
    console.log('Incoming location update:', req.body); // Debug log

    // Validate coordinates if location is being activated
    if (req.body.isLocationActive !== false) {
      if (!req.body.coordinates || !Array.isArray(req.body.coordinates)) {
        return res.status(400).json({
          success: false,
          error: 'Coordinates must be provided as an array [longitude, latitude]'
        });
      }

      // Additional coordinate validation
      const [lng, lat] = req.body.coordinates;
      if (typeof lng !== 'number' || typeof lat !== 'number' ||
          lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates. Longitude must be [-180,180] and latitude [-90,90]'
        });
      }
    }

    const update = req.body.isLocationActive === false
      ? { 
          isLocationActive: false,
          'location.lastUpdated': Date.now()
        }
      : {
          location: {
            type: 'Point',
            coordinates: req.body.coordinates,
            lastUpdated: Date.now(),
            address: req.body.address || ''
          },
          isLocationActive: true
        };

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.uid },
      { $set: update },
      { new: true, runValidators: true }
    );
    
    if (!driver) {
      return res.status(404).json({ 
        success: false, 
        error: 'Driver not found' 
      });
    }

    console.log('Updated driver location:', driver.location); // Debug log

    res.status(200).json({
      success: true,
      data: {
        coordinates: driver.location.coordinates,
        lastUpdated: driver.location.lastUpdated,
        isLocationActive: driver.isLocationActive
      }
    });
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Failed to update location' 
    });
  }
};
// In your driverController.js
exports.registerFCMToken = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.uid;
    
    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: 'FCM token is required' 
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId },
      { fcmToken: token },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'FCM token saved successfully',
      driver
    });
  } catch (error) {
    console.error('Error saving FCM token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save FCM token'
    });
  }
};



exports.incrementCompletedDeliveries = async (req, res) => {
  console.log('Incrementing completed deliveries for user:', req.user.uid);
  try {
    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.uid },
      { 
        $inc: { completedDeliveries: 1 },
        $set: { lastUpdated: Date.now() }
      },
      { new: true }
    );

    console.log('Update result:', driver);

    if (!driver) {
      console.error('Driver not found for user:', req.user.uid);
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    console.log('Successfully incremented deliveries. New count:', driver.completedDeliveries);
    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (err) {
    console.error('Error incrementing deliveries:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update completed deliveries'
    });
  }
};


exports.verifyDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status, notes, docType } = req.body; // Add docType to body
    const adminId = req.user.uid;

    // Validate inputs
    if (!driverId || !docType) {
      return res.status(400).json({
        success: false,
        error: 'Driver ID and document type are required'
      });
    }

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification status'
      });
    }

    // Validate document type
    const validDocTypes = ['aadhar', 'pan', 'license', 'rc', 'insurance'];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document type'
      });
    }

    const updateData = {
      $set: {
        [`documentVerification.${docType}`]: status,
        verificationNotes: notes || '',
        verifiedAt: new Date(),
        verifiedBy: adminId
      }
    };

    const driver = await Driver.findOneAndUpdate(
      { userId: driverId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify driver document'
    });
  }
};

// Get driver documents with verification statuses
exports.getDocumentStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const driver = await Driver.findOne({ userId }).select('documentVerification');

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.status(200).json({
      success: true,
      data: driver.documentVerification
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching document status'
    });
  }
};

exports.getOwnerDashboard = async (req, res) => {
  try {
    const drivers = await Driver.find();

    if (!drivers || drivers.length === 0) {
      return res.status(200).json([]);
    }

    const dashboardData = drivers.map(driver => {
      if (!Array.isArray(driver.collectedPayments)) {
        return null;
      }

      const cashPayments = driver.collectedPayments
        .filter(p => p.method === 'cash')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const onlinePayments = driver.collectedPayments
        .filter(p => p.method === 'online')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const totalEarnings = cashPayments + onlinePayments;

      const cashOwedToOwner = cashPayments * 0.2;
      const onlineOwedToDriver = onlinePayments * 0.8;

      let netPayment = 0;
      let paymentDirection = '';

      if (cashOwedToOwner > onlineOwedToDriver) {
        netPayment = cashOwedToOwner - onlineOwedToDriver;
        paymentDirection = 'Driver owes owner';
      } else {
        netPayment = onlineOwedToDriver - cashOwedToOwner;
        paymentDirection = 'Owner owes driver';
      }

      return {
        driverId: driver._id,
        userId: driver.userId,
        name: driver.name,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber,
        vehicleType: driver.vehicleType,

        totalEarnings,
        cashPayments,
        onlinePayments,
        cashOwedToOwner,
        onlineOwedToDriver,
        netPayment,
        paymentDirection,

        // ✅ Include payment settlements
        allSettlements: driver.paymentSettlements || [],

        // ✅ Include current day settlement
        currentDaySettlement: driver.currentDaySettlement || {
          cashCollected: 0,
          onlineCollected: 0,
          driverEarned: 0,
          ownerEarned: 0
        }
      };
    }).filter(data => data !== null);

    res.status(200).json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getDailySummary = async (req, res) => {
  try {
    const drivers = await Driver.find();
    const summaryMap = {}; // Using an object to group by date and driver

    drivers.forEach(driver => {
      driver.collectedPayments.forEach(payment => {
        const dateKey = moment(payment.collectedAt).format('YYYY-MM-DD');
        const driverDateKey = `${dateKey}_${driver._id}`; // Unique key combining date and driver

        if (!summaryMap[driverDateKey]) {
          summaryMap[driverDateKey] = {
            driverId: driver._id,
            name: driver.name,
            vehicleNumber: driver.vehicleNumber,
            date: dateKey,
            cash: 0,
            online: 0,
            ownerShareFromCash: 0,
            driverShareFromOnline: 0
          };
        }

        if (payment.method === 'cash') {
          summaryMap[driverDateKey].cash += payment.amount;
          summaryMap[driverDateKey].ownerShareFromCash += payment.amount * 0.2;
        } else if (payment.method === 'online') {
          summaryMap[driverDateKey].online += payment.amount;
          summaryMap[driverDateKey].driverShareFromOnline += payment.amount * 0.8;
        }
      });
    });

    // Convert the map to an array
    const summary = Object.values(summaryMap);

    // Sort by date (newest first) and then by driver name
    summary.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
};


exports.settlePayment = async (req, res) => {
  console.group('\n[Backend] Settlement Request');
  try {
    const { driverId } = req.params; // Firebase UID
    const { settlementId } = req.body;

    // console.log('Received IDs:', { driverId, settlementId });

    // Validate settlementId
    if (!mongoose.isValidObjectId(settlementId)) {
      console.error('Invalid settlementId');
      return res.status(400).json({ error: 'Invalid settlementId' });
    }

    // Find driver by userId
    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      // console.error('Driver not found');
      return res.status(404).json({ error: 'Driver not found', driverId });
    }

    // Find the pending settlement
    const settlement = driver.paymentSettlements.find(
      s => s._id.toString() === settlementId && s.status === 'pending'
    );

    if (!settlement) {
      // console.error('Pending settlement not found');
      return res.status(404).json({ error: 'Pending settlement not found', settlementId });
    }

    // Update the settlement
    settlement.status = 'settled';
    settlement.settledAt = new Date();

    await driver.save();

    // console.log('Settlement updated successfully:', settlement);
    res.json({
      success: true,
      message: 'Payment settled successfully',
      settlement
    });

  } catch (error) {
    console.error('Settlement error:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    console.groupEnd();
  }
};



exports.bulkSettlePayments = async (req, res) => {
  // console.group('\n[bulkSettlePayments] ▶ Start');
  // console.time('[bulkSettlePayments] total');

  try {
    const { driverId } = req.params;
    const { settlementIds } = req.body || {};

    // console.log('[Input] driverId:', driverId);
    // console.log('[Input] settlementIds (raw):', settlementIds);

    // Basic validation
    if (!Array.isArray(settlementIds) || settlementIds.length === 0) {
      // console.warn('[Validation] settlementIds missing or empty');
      // console.groupEnd();
      // console.timeEnd('[bulkSettlePayments] total');
      return res.status(400).json({ error: 'No settlement IDs provided' });
    }

    // Normalize + de-duplicate IDs
    const normalizedIds = [...new Set(settlementIds.map(String))];
    // console.log('[Normalize] unique settlementIds:', normalizedIds);

    // Separate valid/invalid ObjectIds
    const invalidIds = normalizedIds.filter(id => !mongoose.isValidObjectId(id));
    const validIds = normalizedIds.filter(id => mongoose.isValidObjectId(id));
    if (invalidIds.length) console.warn('[Validation] Invalid ObjectIds:', invalidIds);
    // console.log(`[Validation] Valid IDs count: ${validIds.length}`);

    // Fetch driver
    // console.time('[DB] find driver');
    const driver = await Driver.findOne({ userId: driverId });
    // console.timeEnd('[DB] find driver');

    if (!driver) {
      // console.error('[DB] Driver not found for userId:', driverId);
      // console.groupEnd();
      // console.timeEnd('[bulkSettlePayments] total');
      return res.status(404).json({ error: 'Driver not found' });
    }

    const settlements = driver.paymentSettlements || [];
    // console.log(`[State] Driver has ${settlements.length} paymentSettlements`);

    // Index settlements for quick lookup
    const byId = new Map();
    for (const s of settlements) byId.set(String(s._id), s);

    const foundIds = validIds.filter(id => byId.has(id));
    const missingIds = validIds.filter(id => !byId.has(id));
    if (missingIds.length) console.warn('[Lookup] IDs not found on this driver:', missingIds);

    // Preview what will be updated
    const preview = foundIds.map(id => {
      const s = byId.get(id);
      return { id, currentStatus: s.status, willUpdate: s.status === 'pending' };
    });
    if (preview.length) {
      // console.log('[Preview] What will be updated:');
      // console.table(preview);
    }

    // Apply updates
    let updatedCount = 0;
    const updatedIds = [];
    const alreadySettled = [];

    for (const id of foundIds) {
      const s = byId.get(id);
      if (s.status === 'pending') {
        s.status = 'settled';
        s.settledAt = new Date();
        updatedCount++;
        updatedIds.push(id);
      } else {
        alreadySettled.push({ id, status: s.status, settledAt: s.settledAt });
      }
    }

    // console.log(`[Update] Will mark ${updatedCount} settlements as settled`);
    if (alreadySettled.length) {
      // console.log('[Update] Skipped (already settled or non-pending):');
      // console.table(alreadySettled);
    }

    // Persist
    driver.markModified('paymentSettlements'); // extra safety
    // console.time('[DB] save driver');
    await driver.save();
    // console.timeEnd('[DB] save driver');

    const response = {
      success: true,
      message: `${updatedCount} settlements marked as settled`,
      meta: {
        requested: normalizedIds.length,
        validCount: validIds.length,
        invalidIds,
        updatedIds,
        alreadySettled,
        missingIds
      }
    };

    // console.log('[Result] Response payload:', response);
    // console.groupEnd();
    // console.timeEnd('[bulkSettlePayments] total');

    return res.json(response);

  } catch (err) {
    // console.error('[Error] bulkSettlePayments failed:', err);
    // console.groupEnd();
    // console.timeEnd('[bulkSettlePayments] total');
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

class ReferralError extends Error {
  constructor(message, code = 400) {
    super(message);
    this.code = code;
    this.name = 'ReferralError';
  }
}
async function runTransaction(callback) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}



// exports.applyReferral = async (req, res, next) => {
//   console.log('[Referral] Starting referral application process');

//   try {
//     const { referralCode } = req.body;
//     const driverId = req.user?.uid; // Get from verified token

//     console.log(`[Referral] Received request - Driver ID: ${driverId}, Referral Code: ${referralCode || 'none'}`);

//     if (!referralCode) {
//       console.log('[Referral] Error: No referral code provided');
//       return res.status(400).json({ error: 'Referral code is required' });
//     }

//     // 1. Verify the referring driver exists
//     console.log(`[Referral] Looking up referrer with code: ${referralCode}`);
//     const referrer = await Driver.findOne({ referralCode });

//     if (!referrer) {
//       console.log('[Referral] Error: Referrer not found with the provided code');
//       return res.status(400).json({ 
//         error: 'Invalid referral code',
//         details: 'No driver found with this referral code'
//       });
//     }

//     console.log(`[Referral] Found referrer: ${referrer.userId} (${referrer.name})`);

//     // 2. Check if driver is trying to self-refer
//     if (referrer.userId === driverId) {
//       console.log('[Referral] Error: Self-referral attempt detected');
//       return res.status(400).json({ 
//         error: 'Cannot use your own referral code',
//         details: `Referrer ID (${referrer.userId}) matches current user ID`
//       });
//     }

//     // 3. Check if already referred
//     console.log(`[Referral] Checking if driver ${driverId} was already referred`);
//     const existingDriver = await Driver.findOne({ userId: driverId });

//     if (existingDriver?.referredBy) {
//       console.log(`[Referral] Error: Driver already referred by ${existingDriver.referredBy}`);
//       return res.status(400).json({ 
//         error: 'Already used a referral code',
//         details: `Previously used code: ${existingDriver.referredBy}`
//       });
//     }

//     // 4. Apply referral
//     const reward = {
//       amount: 20,
//       description: `Referral from ${driverId}`,
//       referredDriverId: driverId,
//       createdAt: new Date()
//     };

//     console.log(`[Referral] Preparing to update referrer ${referrer.userId} with reward`, reward);

//     const referrerUpdate = await Driver.updateOne(
//       { userId: referrer.userId },
//       { 
//         $push: { referralRewards: reward },
//         $inc: { 
//           totalReferrals: 1,
//           referralEarnings: reward.amount 
//         }
//       }
//     );

//     console.log(`[Referral] Referrer update result:`, {
//       matched: referrerUpdate.matchedCount,
//       modified: referrerUpdate.modifiedCount
//     });

//     // Update the referred driver
//     console.log(`[Referral] Updating driver ${driverId} with referral code`);
//     const driverUpdate = await Driver.updateOne(
//       { userId: driverId },
//       { referredBy: referralCode }
//     );

//     console.log(`[Referral] Driver update result:`, {
//       matched: driverUpdate.matchedCount,
//       modified: driverUpdate.modifiedCount
//     });

//     console.log('[Referral] Successfully applied referral code');
//     res.json({ 
//       success: true,
//       referrer: referrer.userId,
//       rewardAmount: reward.amount
//     });

//   } catch (error) {
//     console.error('[Referral] Critical Error:', {
//       message: error.message,
//       stack: error.stack,
//       requestBody: req.body,
//       user: req.user
//     });

//     res.status(500).json({ 
//       error: 'Failed to apply referral code',
//       ...(process.env.NODE_ENV === 'development' && { 
//         details: error.message,
//         stack: error.stack 
//       })
//     });
//   }
// };

exports.applyReferral = async (req, res) => {
  try {
    // console.log('[Referral] Starting referral validation process');
    // console.log('[Referral] Request body:', JSON.stringify(req.body, null, 2));
    // console.log('[Referral] Authenticated user:', req.user);

    const { referralCode } = req.body;

    if (!referralCode) {
      // console.log('[Referral] Validation failed: No referral code provided');
      return res.status(400).json({
        success: false,
        error: 'Referral code is required'
      });
    }

    // console.log(`[Referral] Looking up referrer with code: ${referralCode}`);
    const referrer = await Driver.findOne({ referralCode });
    // console.log('[Referral] Referrer found:', referrer);

    if (!referrer) {
      // console.log('[Referral] Validation failed: Invalid referral code');
      return res.status(400).json({
        success: false,
        error: 'Invalid referral code'
      });
    }

    // Check for self-referral
    if (req.user?.uid && referrer.userId === req.user.uid) {
      // console.log('[Referral] Validation failed: Self-referral detected', {
      //   referrerUserId: referrer.userId,
      //   currentUser: req.user.uid
      // });
      return res.status(400).json({
        success: false,
        error: 'Cannot use your own referral code'
      });
    }

    // console.log('[Referral] Validation successful', {
    //   referrerId: referrer._id,
    //   referrerName: referrer.name,
    //   referrerUserId: referrer.userId
    // });

    res.status(200).json({
      success: true,
      message: 'Referral code is valid',
      referrerName: referrer.name
    });

  } catch (error) {
    // console.error('[Referral] Error during validation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate referral code',
      details: error.message
    });
  }
};


exports.getReferralCode = async (req, res, next) => {
  // console.log("\n[Referral] ====== Starting getReferralCode ======");

  try {
    const { driverId } = req.params;
    // console.log(`[Referral] Request received - Driver ID: ${driverId}`);

    // Find driver
    const driver = await Driver.findOne({ userId: driverId });
    // console.log("[Referral] Driver lookup result:", driver ? "FOUND" : "NOT FOUND");

    if (!driver) {
      // console.log("[Referral] ❌ Error: Driver not found");
      throw new ReferralError("Driver not found", 404);
    }

    // Ensure referral code exists
    if (!driver.referralCode) {
      // console.log("[Referral] No referral code found for driver. Generating new code...");
      driver.referralCode = await Driver.generateReferralCode();
      await driver.save();
      // console.log(`[Referral] ✅ New referral code generated: ${driver.referralCode}`);
    } else {
      // console.log(`[Referral] Existing referral code found: ${driver.referralCode}`);
    }

    const shareLink = `https://play.google.com/store/apps/details?id=com.matspl.jioyatripartner&driver_ref=${driver.referralCode}`;
    // console.log(`[Referral] Generated share link: ${shareLink}`);

    // Send response
    res.json({
      referralCode: driver.referralCode,
      shareLink,
    });

    // console.log("[Referral] ✅ Response sent successfully");

  } catch (error) {
    console.log("[Referral] ❌ Error occurred:", error.message);
    next(error);
  }
};

exports.getReferralStats = async (req, res, next) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      throw new ReferralError('Driver not found', 404);
    }

    const referredDrivers = await Driver.find({ referredBy: driver.referralCode });

    res.json({
      referralCode: driver.referralCode,
      totalReferrals: referredDrivers.length,
      totalEarnings: driver.referralEarnings,
      rewards: driver.referralRewards,
      referredDrivers: referredDrivers.map(d => ({
        driverId: d.userId,
        name: d.name,
        joinedAt: d.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
};

exports.getReferralLeaderboard = async (req, res, next) => {
  try {
    const topReferrers = await Driver.aggregate([
      { $match: { referralRewards: { $exists: true, $not: { $size: 0 } } } },
      { $addFields: { totalRewards: { $sum: "$referralRewards.amount" } } },
      { $sort: { totalRewards: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          referralCode: 1,
          totalRewards: 1,
          referralsCount: { $size: "$referralRewards" }
        }
      }
    ]);

    res.json(topReferrers);
  } catch (error) {
    next(error);
  }
};

// Add this NEW endpoint to driverController.js
// Add this to your driverController.js - PUT THIS WITH YOUR OTHER EXPORTS
exports.updateDriverLocationRegular = async (req, res) => {
  try {
    const { coordinates, isLocationActive = true } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates array [longitude, latitude] is required'
      });
    }

    const [longitude, latitude] = coordinates;
    
    // Validate coordinates
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.uid },
      {
        $set: {
          'location.coordinates': coordinates,
          'location.lastUpdated': new Date(),
          isLocationActive: isLocationActive
        }
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      coordinates: driver.location.coordinates
    });

  } catch (err) {
    console.error('Error updating driver location:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Add this status endpoint to driverController.js
exports.getLocationStatus = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.uid });
    
    if (!driver) {
      return res.status(404).json({ status: 'Driver not found' });
    }

    if (!driver.isLocationActive) {
      return res.json({ status: '📍 Location not shared' });
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isRecent = driver.location.lastUpdated > thirtyMinutesAgo;

    if (isRecent) {
      const timeLeft = Math.round((driver.location.lastUpdated.getTime() + 30 * 60 * 1000 - Date.now()) / 60000);
      return res.json({ 
        status: `✅ Location active (expires in ${timeLeft} minutes)`,
        coordinates: driver.location.coordinates
      });
    } else {
      return res.json({ status: '📍 Location expired - share again' });
    }

  } catch (error) {
    console.error('Error getting location status:', error);
    res.status(500).json({ status: 'Error checking location status' });
  }
};
