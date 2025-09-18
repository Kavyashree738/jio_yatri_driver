const Driver = require('../models/Driver');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const Razorpay = require('razorpay');
const crypto = require('crypto');


const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.initiateSettlementPayment = async (req, res) => {
  try {
    const { settlementId, amount } = req.body;
    if (!settlementId || !amount) {
      return res.status(400).json({ error: 'Invalid settlement details' });
    }

    const order = await rzp.orders.create({
      amount: amount * 100, // in paise
      currency: 'INR',
      receipt: `settlement_${settlementId}`
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifySettlementPayment = async (req, res) => {
  const { 
    razorpay_payment_id, 
    razorpay_order_id, 
    razorpay_signature, 
    settlementId, 
    driverId, 
    amount // ✅ must be sent from frontend
  } = req.body;

  try {
    // Step 1: Verify Razorpay signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Step 2: Mark settlement as settled + store Razorpay details
    const driver = await Driver.findOneAndUpdate(
      { userId: driverId, 'paymentSettlements._id': settlementId },
      {
        $set: {
          'paymentSettlements.$.status': 'settled',
          'paymentSettlements.$.settledAt': new Date(),
          'paymentSettlements.$.razorpayOrderId': razorpay_order_id,
          'paymentSettlements.$.razorpayPaymentId': razorpay_payment_id,
          'paymentSettlements.$.razorpaySignature': razorpay_signature
        },
        $push: {
          collectedPayments: {
            shipment: null, // because this is a settlement, not a delivery
            amount: amount, // ✅ actual settlement amount from frontend
            method: 'razorpay',
            transactionId: razorpay_payment_id,
            collectedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found or settlement missing' });
    }

    // Step 3: Extract updated settlement
    const updatedSettlement = driver.paymentSettlements.find(
      s => s._id.toString() === settlementId
    );

    // ✅ Step 4: Adjust earnings based on settlement type
    if (updatedSettlement) {
      if (updatedSettlement.driverToOwner > 0) {
        // Driver paid owner → reduce driver earnings
        driver.earnings = (driver.earnings || 0) - updatedSettlement.driverToOwner;
      }

      if (updatedSettlement.ownerToDriver > 0) {
        // Owner paid driver → increase driver earnings
        driver.earnings = (driver.earnings || 0) + updatedSettlement.ownerToDriver;
      }

      await driver.save();
    }

    // Step 5: Respond with updated settlement
    res.json({ 
      success: true, 
      settlement: updatedSettlement,
      message: 'Settlement marked as settled successfully'
    });

  } catch (err) {
    console.error(`[verifySettlementPayment] ERROR:`, err);
    res.status(500).json({ error: err.message });
  }
};




async function checkAndSettle(driverId, session = null) {
  // console.log('\n' + '='.repeat(50));
  // console.log(`[checkAndSettle] START - Processing driver: ${driverId}`);
  // console.log(`[checkAndSettle] Session: ${session ? 'Active' : 'None'}`);
  // console.log('='.repeat(50) + '\n');
  
  const options = session ? { session } : {};
  
  try {
    // 1. Get driver document
    // console.log(`[${new Date().toISOString()}] [checkAndSettle] STEP 1: Fetching driver document for ID: ${driverId}`);
    const driver = await Driver.findOne({ userId: driverId }, null, options);
    
    if (!driver) {
      // console.error(`\n[${new Date().toISOString()}] [checkAndSettle] ERROR: Driver not found for ID: ${driverId}`);
      // console.log('='.repeat(50));
      throw new Error('Driver not found');
    }
    
    // console.log(`\n[${new Date().toISOString()}] [checkAndSettle] Driver document found:`);
    // console.log({
    //   _id: driver._id,
    //   userId: driver.userId,
    //   lastSettlementDate: driver.lastSettlementDate,
    //   currentDaySettlement: driver.currentDaySettlement
    // });

    // 2. Calculate date range
    const now = moment().tz('Asia/Kolkata');
    const today = now.clone().startOf('day');
    let lastSettled = driver.lastSettlementDate 
      ? moment(driver.lastSettlementDate).tz('Asia/Kolkata').startOf('day')
      : now.clone().subtract(30, 'days').startOf('day');

    // console.log(`\n[${new Date().toISOString()}] [checkAndSettle] Date calculations:`);
    // console.log({
    //   'Current Time (IST)': now.format('YYYY-MM-DD HH:mm:ss'),
    //   'Today (start of day)': today.format('YYYY-MM-DD'),
    //   'Last Settled Date': lastSettled.format('YYYY-MM-DD'),
    //   'Days Since Last Settlement': today.diff(lastSettled, 'days')
    // });

    // Safety check for abnormal dates
    if (lastSettled.isBefore('2020-01-01')) {
      // console.warn(`\n[${new Date().toISOString()}] [checkAndSettle] WARNING: Abnormal last settlement date detected:`);
      // console.log({
      //   'Original Date': driver.lastSettlementDate,
      //   'Reset To': now.clone().subtract(30, 'days').format('YYYY-MM-DD'),
      //   'Reason': 'Date was before 2020-01-01'
      // });
      lastSettled = now.clone().subtract(30, 'days').startOf('day');
    }

    // 3. Process only recent days (max 30 days at a time)
    let daysToSettle = [];
    let currentDay = lastSettled.clone().add(1, 'day');
    
    while (currentDay.isBefore(today, 'day') && daysToSettle.length < 30) {
      daysToSettle.push(currentDay.clone());
      currentDay.add(1, 'day');
    }

    // console.log(`\n[${new Date().toISOString()}] [checkAndSettle] Days to process:`);
    // console.log({
    //   'Total Days': daysToSettle.length,
    //   'Date Range': `${daysToSettle[0]?.format('YYYY-MM-DD')} to ${daysToSettle[daysToSettle.length-1]?.format('YYYY-MM-DD')}`,
    //   'Days List': daysToSettle.map(d => d.format('YYYY-MM-DD'))
    // });

    // 4. Process each day
    for (const day of daysToSettle) {
      const dayFormatted = day.format('YYYY-MM-DD');
      // console.log(`\n[${new Date().toISOString()}] [checkAndSettle] Processing day: ${dayFormatted}`);
      
      const lastUpdated = moment(driver.currentDaySettlement.lastUpdated).tz('Asia/Kolkata');
      const hasTransactions = lastUpdated.isSame(day, 'day') && 
                            (driver.currentDaySettlement.cashCollected > 0 || 
                             driver.currentDaySettlement.onlineCollected > 0);

      // console.log(`[${new Date().toISOString()}] [checkAndSettle] Transaction check for ${dayFormatted}:`);
      // console.log({
      //   'Last Updated': lastUpdated.format('YYYY-MM-DD HH:mm:ss'),
      //   'Cash Collected': driver.currentDaySettlement.cashCollected,
      //   'Online Collected': driver.currentDaySettlement.onlineCollected,
      //   'Has Transactions': hasTransactions
      // });

      if (hasTransactions) {
        // console.log(`[${new Date().toISOString()}] [checkAndSettle] Found transactions for ${dayFormatted}, initiating settlement...`);
        await performDailySettlement(driver._id, day.toDate(), session);
      }

      // console.log(`[${new Date().toISOString()}] [checkAndSettle] Updating last settlement date to ${dayFormatted}`);
      const updateResult = await Driver.findOneAndUpdate(
        { userId: driverId },
        { $set: { lastSettlementDate: day.toDate() } },
        { ...options }
      );
      // console.log(`[${new Date().toISOString()}] [checkAndSettle] Update result:`, updateResult ? 'Success' : 'Failed');
    }

    // console.log('\n' + '='.repeat(50));
    // console.log(`[checkAndSettle] COMPLETED - Processed ${daysToSettle.length} days for driver: ${driverId}`);
    // console.log('='.repeat(50) + '\n');
  } catch (err) {
    // console.error('\n' + '!'.repeat(50));
    // console.error(`[${new Date().toISOString()}] [checkAndSettle] ERROR in processing driver ${driverId}:`);
    // console.error({
    //   'Error Message': err.message,
    //   'Stack Trace': err.stack,
    //   'Error Time': new Date().toISOString()
    // });
    // console.error('!'.repeat(50) + '\n');
    throw err;
  }
}

exports.recordPayment = async (req, res) => {
  // console.log('\n' + '='.repeat(70));
  // console.log(`[recordPayment] START - New payment recording initiated`);
  // console.log(`[recordPayment] Timestamp: ${new Date().toISOString()}`);
  // console.log('='.repeat(70) + '\n');
  
  const session = await mongoose.startSession();
  session.startTransaction();
  // console.log(`[${new Date().toISOString()}] [recordPayment] MongoDB transaction started`);

  try {
    const { driverId, amount, method } = req.body;
    // console.log(`[${new Date().toISOString()}] [recordPayment] Request body:`);
    // console.log({
    //   driverId,
    //   amount,
    //   method,
    //   timestamp: new Date().toISOString()
    // });

    // Validate input
    if (!['cash', 'online'].includes(method)) {
      // console.error(`\n[${new Date().toISOString()}] [recordPayment] ERROR: Invalid payment method "${method}"`);
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // console.log(`\n[${new Date().toISOString()}] [recordPayment] STEP 1: Checking and settling existing payments`);
    await checkAndSettle(driverId, session);

    // console.log(`\n[${new Date().toISOString()}] [recordPayment] STEP 2: Preparing update object`);
    const update = {
      $inc: {
        [`currentDaySettlement.${method}Collected`]: amount,
        'currentDaySettlement.driverEarned': method === 'online' ? amount * 0.8 : 0,
        'currentDaySettlement.ownerEarned': method === 'cash' ? amount * 0.2 : 0,
        'earnings': amount * (method === 'online' ? 0.8 : 1),
        [`paymentBreakdown.${method}`]: amount
      },
      $push: {
        collectedPayments: {
          amount,
          method,
          collectedAt: new Date()
        }
      }
    };

    // console.log(`[${new Date().toISOString()}] [recordPayment] Update operation details:`);
    // console.log(JSON.stringify(update, null, 2));

    // console.log(`\n[${new Date().toISOString()}] [recordPayment] STEP 3: Updating driver document`);
    const result = await Driver.findOneAndUpdate(
      { userId: driverId }, 
      update,
      { new: true, session }
    );

    await session.commitTransaction();
    // console.log(`\n[${new Date().toISOString()}] [recordPayment] Transaction committed successfully`);
    
    // console.log(`[${new Date().toISOString()}] [recordPayment] RESULT:`);
    // console.log({
    //   success: true,
    //   driverId: result.userId,
    //   updatedFields: {
    //     earnings: result.earnings,
    //     paymentBreakdown: result.paymentBreakdown,
    //     collectedPayments: result.collectedPayments.length
    //   }
    // });

    // console.log('\n' + '='.repeat(70));
    // console.log(`[recordPayment] COMPLETED - Payment recorded successfully`);
    // console.log('='.repeat(70) + '\n');
    res.json({ success: true, driver: result });
  } catch (err) {
    // console.error('\n' + '!'.repeat(70));
    // console.error(`[${new Date().toISOString()}] [recordPayment] ERROR:`);
    // console.error({
    //   message: err.message,
    //   stack: err.stack,
    //   timestamp: new Date().toISOString()
    // });
    
    await session.abortTransaction();
    // console.error(`[${new Date().toISOString()}] [recordPayment] Transaction aborted due to error`);
    
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    session.endSession();
    // console.log(`[${new Date().toISOString()}] [recordPayment] MongoDB session ended`);
  }
};

async function performDailySettlement(driverId, settlementDate, session = null) {
  // console.log('\n' + '='.repeat(60));
  // console.log(`[performDailySettlement] START - Processing driver: ${driverId}`);
  // console.log(`[performDailySettlement] Settlement date: ${settlementDate}`);
  // console.log(`[performDailySettlement] Session: ${session ? 'Active' : 'None'}`);
  // console.log('='.repeat(60) + '\n');
  
  const options = session ? { session } : {};
  
  try {
    // console.log(`[${new Date().toISOString()}] [performDailySettlement] STEP 1: Fetching driver document`);
    const driver = await Driver.findById(driverId, null, options);
    
    // console.log(`\n[${new Date().toISOString()}] [performDailySettlement] Current settlement data:`);
    // console.log({
    //   cashCollected: driver.currentDaySettlement.cashCollected,
    //   onlineCollected: driver.currentDaySettlement.onlineCollected,
    //   driverEarned: driver.currentDaySettlement.driverEarned,
    //   ownerEarned: driver.currentDaySettlement.ownerEarned,
    //   lastUpdated: driver.currentDaySettlement.lastUpdated
    // });
    
    const { cashCollected, onlineCollected } = driver.currentDaySettlement;
    
    const settlementData = {
      date: settlementDate,
      cashCollected,
      onlineCollected,
      driverEarned: onlineCollected * 0.8,
      ownerEarned: cashCollected * 0.2,
      driverToOwner: cashCollected * 0.2,
      ownerToDriver: onlineCollected * 0.8,
      status: 'pending'
    };

    // console.log(`\n[${new Date().toISOString()}] [performDailySettlement] STEP 2: Settlement data to be created:`);
    // console.log(settlementData);
    
    // console.log(`\n[${new Date().toISOString()}] [performDailySettlement] STEP 3: Updating driver record`);
    const result = await Driver.findByIdAndUpdate(
      driverId,
      {
        $push: { paymentSettlements: settlementData },
        $set: {
          'currentDaySettlement': {
            cashCollected: 0,
            onlineCollected: 0,
            driverEarned: 0,
            ownerEarned: 0,
            lastUpdated: new Date()
          }
        }
      },
      { new: true, ...options }
    );

    // console.log(`\n[${new Date().toISOString()}] [performDailySettlement] Update result:`);
    // console.log({
    //   modifiedCount: result ? 1 : 0,
    //   settlementId: settlementData._id,
    //   newSettlementData: result ? result.paymentSettlements.slice(-1)[0] : null
    // });

    // console.log('\n' + '='.repeat(60));
    // console.log(`[performDailySettlement] COMPLETED - Settlement processed for driver: ${driverId}`);
    // console.log('='.repeat(60) + '\n');
  } catch (err) {
    // console.error('\n' + '!'.repeat(60));
    // console.error(`[${new Date().toISOString()}] [performDailySettlement] ERROR:`);
    // console.error({
    //   message: err.message,
    //   stack: err.stack,
    //   driverId,
    //   settlementDate,
    //   timestamp: new Date().toISOString()
    // });
    // console.error('!'.repeat(60) + '\n');
    throw err;
  }
}

exports.checkSettlement = async (req, res) => {
  // console.log('\n' + '='.repeat(50));
  // console.log(`[checkSettlement] START - Request for userId: ${req.params.userId}`);
  // console.log('='.repeat(50) + '\n');
  
  try {
    // console.log(`[${new Date().toISOString()}] [checkSettlement] Initiating settlement check`);
    await checkAndSettle(req.params.userId);
    
    // console.log(`\n[${new Date().toISOString()}] [checkSettlement] Settlement check completed successfully`);
    // console.log('\n' + '='.repeat(50));
    // console.log(`[checkSettlement] COMPLETED`);
    // console.log('='.repeat(50) + '\n');
    res.json({ 
      success: true,
      userId: req.params.userId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // console.error('\n' + '!'.repeat(50));
    // console.error(`[${new Date().toISOString()}] [checkSettlement] ERROR:`);
    // console.error({
    //   message: err.message,
    //   stack: err.stack,
    //   userId: req.params.userId,
    //   timestamp: new Date().toISOString()
    // });
    // console.error('!'.repeat(50) + '\n');
    
    res.status(500).json({ 
      error: err.message,
      userId: req.params.userId,
      timestamp: new Date().toISOString()
    });
  }
};

exports.dailySettlement = async (req, res) => {
  // console.log('\n' + '='.repeat(70));
  // console.log(`[dailySettlement] START - Manual settlement process initiated`);
  // console.log('='.repeat(70) + '\n');
  
  try {
    const today = moment().tz('Asia/Kolkata').startOf('day').toDate();
    // console.log(`[${new Date().toISOString()}] [dailySettlement] Settlement date: ${today}`);

    // console.log(`\n[${new Date().toISOString()}] [dailySettlement] STEP 1: Fetching all drivers`);
    const drivers = await Driver.find({});
    // console.log(`[${new Date().toISOString()}] [dailySettlement] Found ${drivers.length} drivers to process`);

    for (const driver of drivers) {
      // console.log(`\n[${new Date().toISOString()}] [dailySettlement] Processing driver:`);
      // console.log({
      //   driverId: driver._id,
      //   name: driver.name,
      //   userId: driver.userId,
      //   lastSettlementDate: driver.lastSettlementDate
      // });
      await checkAndSettle(driver.userId); 
    }

    // console.log(`\n[${new Date().toISOString()}] [dailySettlement] RESULT: Processed ${drivers.length} drivers`);
    // console.log('\n' + '='.repeat(70));
    // console.log(`[dailySettlement] COMPLETED`);
    // console.log('='.repeat(70) + '\n');
    res.json({ 
      success: true, 
      processed: drivers.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // console.error('\n' + '!'.repeat(70));
    // console.error(`[${new Date().toISOString()}] [dailySettlement] ERROR:`);
    // console.error({
    //   message: err.message,
    //   stack: err.stack,
    //   timestamp: new Date().toISOString()
    // });
    // console.error('!'.repeat(70) + '\n');
    
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

exports.getDriverSettlement = async (req, res) => {
  // console.log('\n' + '='.repeat(60));
  // console.log(`[getDriverSettlement] START - Request for userId: ${req.params.userId}`);
  // console.log('='.repeat(60) + '\n');
  
  try {
    // console.log(`[${new Date().toISOString()}] [getDriverSettlement] Querying driver document`);
    const driver = await Driver.findOne({ userId: req.params.userId })
      .select('paymentSettlements currentDaySettlement lastSettlementDate');
    
    if (!driver) {
      // console.error(`\n[${new Date().toISOString()}] [getDriverSettlement] ERROR: Driver not found`);
      // console.log('='.repeat(60));
      return res.status(404).json({ 
        error: 'Driver not found',
        userId: req.params.userId
      });
    }

    // Get all settlements and sort by date (newest first)
    const allSettlements = driver.paymentSettlements || [];
    
    // Separate pending and settled
    const pendingSettlements = allSettlements
      .filter(s => s.status === 'pending')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
      
    const settledSettlements = allSettlements
      .filter(s => s.status === 'settled')
      .sort((a, b) => new Date(b.settledAt || b.date) - new Date(a.settledAt || a.date));

    // console.log(`\n[${new Date().toISOString()}] [getDriverSettlement] Found settlements:`);
    // console.log({
    //   total: allSettlements.length,
    //   pending: pendingSettlements.length,
    //   settled: settledSettlements.length
    // });

    // console.log('\n' + '='.repeat(60));
    // console.log(`[getDriverSettlement] COMPLETED`);
    // console.log('='.repeat(60) + '\n');
    
    res.json({
      success: true,
      pending: pendingSettlements,
      settled: settledSettlements,
      currentDaySettlement: driver.currentDaySettlement,
      lastSettlementDate: driver.lastSettlementDate
    });
  } catch (err) {
    // console.error('\n' + '!'.repeat(60));
    // console.error(`[${new Date().toISOString()}] [getDriverSettlement] ERROR:`);
    // console.error({
    //   message: err.message,
    //   stack: err.stack,
    //   userId: req.params.userId,
    //   timestamp: new Date().toISOString()
    // });
    // console.error('!'.repeat(60) + '\n');
    
    res.status(500).json({ 
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
exports.completeSettlement = async (req, res) => {
  // console.log('\n' + '='.repeat(70));
  // console.log(`[completeSettlement] START - Request for userId: ${req.params.userId}`);
  // console.log(`[completeSettlement] Settlement ID: ${req.body.settlementId}`);
  // console.log('='.repeat(70) + '\n');
  
  try {
    const { settlementId } = req.body;
    
    // console.log(`\n[${new Date().toISOString()}] [completeSettlement] STEP 1: Updating settlement status`);
    const driver = await Driver.findOneAndUpdate(
      { userId: req.params.userId, 'paymentSettlements._id': settlementId },
      {
        $set: {
          'paymentSettlements.$.status': 'settled',
          'paymentSettlements.$.settledAt': new Date()
        }
      },
      { new: true }
    );

    // console.log(`\n[${new Date().toISOString()}] [completeSettlement] Update result:`);
    // console.log({
    //   driverId: driver._id,
    //   userId: driver.userId,
    //   updatedSettlement: settlementId,
    //   updatedDocument: driver.paymentSettlements.find(s => s._id.toString() === settlementId)
    // });

    // console.log('\n' + '='.repeat(70));
    // console.log(`[completeSettlement] COMPLETED - Settlement marked as complete`);
    // console.log('='.repeat(70) + '\n');
    res.json({ 
      success: true, 
      driver: {
        _id: driver._id,
        userId: driver.userId
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // console.error('\n' + '!'.repeat(70));
    // console.error(`[${new Date().toISOString()}] [completeSettlement] ERROR:`);
    // console.error({
    //   message: err.message,
    //   stack: err.stack,
    //   userId: req.params.userId,
    //   settlementId: req.body.settlementId,
    //   timestamp: new Date().toISOString()
    // });
    // console.error('!'.repeat(70) + '\n');
    
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
