const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose=require('mongoose')
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.initiatePayment = async (req, res) => {
  console.log('Initiate payment request received');
  console.log('Headers:', req.headers);
  console.log('Params:', req.params);

  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      console.log('Shipment not found');
      return res.status(404).json({ error: 'Shipment not found' });
    }

    console.log('Found shipment:', {
      id: shipment._id,
      status: shipment.status,
      payment: shipment.payment
    });

    if (shipment.status !== 'delivered') {
      console.log('Shipment not in delivered state');
      return res.status(400).json({ error: 'Shipment not available for payment' });
    }

    if (shipment.payment.status !== 'pending') {
      console.log('Payment already processed:', shipment.payment.status);
      return res.status(400).json({ error: 'Payment already processed' });
    }

    console.log('Creating Razorpay order for amount:', shipment.cost * 100);
    const order = await rzp.orders.create({
      amount: shipment.cost * 100,
      currency: 'INR',
      receipt: `shipment_${shipment.trackingNumber}`,
    });

    console.log('Order created:', order);

    shipment.payment = {
      method: 'razorpay',
      status: 'pending',
      razorpayOrderId: order.id
    };

    await shipment.save();
    console.log('Shipment updated with payment details');

    res.json(order);
  } catch (err) {
    console.error('Error in initiatePayment:', {
      message: err.message,
      stack: err.stack,
      response: err.response?.data
    });
    res.status(500).json({ error: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  try {
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const shipment = await Shipment.findOne({
      _id: req.body.shipmentId,
      'payment.razorpayOrderId': razorpay_order_id
    });

    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    shipment.payment = {
      method: 'razorpay',
      status: 'paid',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      collectedAt: new Date()
    };

    shipment.paymentHistory.push({
      amount: shipment.cost,
      method: 'razorpay',
      transactionId: razorpay_payment_id,
      recordedBy: shipment.userId
    });

    await shipment.save();

    // Update driver if assigned
    if (shipment.assignedDriver?.driverId) {
      await Driver.findByIdAndUpdate(shipment.assignedDriver.driverId, {
        $inc: {
          'earnings': shipment.cost,
          'paymentBreakdown.online': shipment.cost
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.markCashPaid = async (req, res) => {
  try {
    console.log('\n=== CASH PAYMENT INITIATED ===');

    const shipment = await Shipment.findById(req.params.id);
    console.log('[CASH] Shipment fetched:', shipment);

    if (!shipment) {
      console.log('[CASH] Shipment not found');
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }

    console.log('[CASH] Shipment status:', shipment.status);
    if (shipment.status !== 'delivered') {
      console.log('[CASH] Shipment not yet delivered');
      return res.status(400).json({
        success: false,
        error: 'Shipment must be delivered first'
      });
    }

    console.log('[CASH] Payment status:', shipment.payment?.status);
    if (shipment.payment?.status !== 'pending') {
      console.log('[CASH] Payment already processed');
      return res.status(400).json({
        success: false,
        error: 'Payment already processed'
      });
    }

    // ✅ Use .toObject() to extract driverId safely
    const shipmentObj = shipment.toObject();
    const driverId = shipmentObj.assignedDriver && shipmentObj.assignedDriver._id;
    console.log('[CASH] Driver ID:', driverId);

    if (!driverId) {
      console.log('[CASH] No valid driver assigned');
      return res.status(400).json({
        success: false,
        error: 'No valid driver assigned'
      });
    }

    // ✅ Update shipment payment
    shipment.payment = {
      method: 'cash',
      status: 'paid',
      collectedAt: new Date(),
      collectedBy: driverId
    };
    console.log('[CASH] Shipment payment updated');

    // ✅ Add to shipment's payment history
    shipment.paymentHistory.push({
      amount: shipment.cost,
      method: 'cash',
      transactionId: `cash-${Date.now()}`,
      recordedBy: driverId,
      collectedAt: new Date()
    });
    console.log('[CASH] Shipment payment history updated');

    // ✅ Update driver earnings
    await Driver.findByIdAndUpdate(driverId, {
      $inc: {
        earnings: shipment.cost,
        'paymentBreakdown.cash': shipment.cost
      },
      $push: {
        collectedPayments: {
          shipment: shipment._id,
          amount: shipment.cost,
          method: 'cash',
          collectedAt: new Date()
        }
      }
    });
    console.log('[CASH] Driver earnings updated');

    await shipment.save();
    console.log('[CASH] Shipment saved successfully');

    return res.json({
      success: true,
      message: 'Cash payment recorded successfully'
    });

  } catch (err) {
    console.error('[CASH] Error during cash payment:', err);
    return res.status(500).json({
      success: false,
      error: 'Cash payment processing failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    console.log('=== CASH PAYMENT PROCESS COMPLETED ===\n');
  }
};
