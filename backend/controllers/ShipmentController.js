const axios = require('axios');
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver')
const Order = require('../models/Order');
const Shop = require('../models/CategoryModel');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const { notifyNewShipment } = require('../services/notificationService');
const { fanOutShipmentToNearbyDrivers } = require('../controllers/orderController');
const mongoose = require('mongoose');  // Add this line at the top

function toGeoPoint(input) {
  // Already a Point?
  if (input && input.type === 'Point' && Array.isArray(input.coordinates)) {
    const [lng, lat] = input.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }
  // Maybe a raw array?
  if (Array.isArray(input) && input.length === 2) {
    const [lng, lat] = input;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }
  return null;
}
exports.calculateDistance = async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination ||
      typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
      return res.status(400).json({
        error: 'Invalid coordinates format',
        details: 'Expected { lat: number, lng: number } for both origin and destination'
      });
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin: ` ${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          key: GOOGLE_MAPS_API_KEY,
          units: 'metric'
        }
      }
    );

    if (response.data.status !== 'OK') {
      return res.status(400).json({
        error: 'Could not calculate route',
        status: response.data.status,
        message: response.data.error_message || 'No route could be found between the specified locations'
      });
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    const distanceInKm = leg.distance.value / 1000;
    const duration = leg.duration.text;

    res.json({
      distance: distanceInKm,
      duration: duration,
      polyline: route.overview_polyline.points
    });

  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate distance',
      details: error.message
    });
  }
};


const { v4: uuidv4 } = require('uuid');

exports.createShipment = async (req, res) => {
  try {
    const {
      sender,
      receiver,
      parcel,
      vehicleType,
      distance,
      cost,
      shopId,          // optional (shop order)
      isShopOrder      // optional (boolean)
    } = req.body;

    const userId = req.user.uid;

    // Basic validation
    if (!sender?.name || !sender?.phone || !sender?.address?.addressLine1) {
      return res.status(400).json({ error: 'Sender name, phone, and addressLine1 are required' });
    }
    if (!receiver?.name || !receiver?.phone || !receiver?.address?.addressLine1) {
      return res.status(400).json({ error: 'Receiver name, phone, and addressLine1 are required' });
    }
    if (!parcel?.description) {
      return res.status(400).json({ error: 'Parcel description is required' });
    }
    if (!vehicleType || !Number.isFinite(distance) || !Number.isFinite(cost)) {
      return res.status(400).json({ error: 'vehicleType, distance, and cost are required' });
    }
    if (isShopOrder && !shopId) {
      return res.status(400).json({ error: 'Shop ID is required for shop orders' });
    }

    // Normalize coordinates to GeoJSON Points (sender & receiver)
    const senderPoint   = toGeoPoint(sender.address?.coordinates);
    const receiverPoint = toGeoPoint(receiver.address?.coordinates);

    if (!senderPoint) {
      return res.status(400).json({ error: 'Sender coordinates must be GeoJSON Point or [lng,lat]' });
    }
    if (!receiverPoint) {
      return res.status(400).json({ error: 'Receiver coordinates must be GeoJSON Point or [lng,lat]' });
    }

    const trackingNumber = uuidv4().split('-')[0].toUpperCase();

    // Build doc
    const shipmentData = {
      sender: {
        name: sender.name,
        phone: sender.phone,
        email: sender.email || '',
        address: {
          addressLine1: sender.address.addressLine1,
          coordinates: senderPoint,         // GeoJSON Point
        }
      },
      receiver: {
        name: receiver.name,
        phone: receiver.phone,
        email: receiver.email || '',
        address: {
          addressLine1: receiver.address.addressLine1,
          coordinates: receiverPoint,       // GeoJSON Point
        }
      },
      parcel: {
        description: parcel.description,
        images: [] // fill later
      },
      vehicleType,
      distance,
      cost,
      trackingNumber,
      userId,
      status: 'pending'
    };

    if (isShopOrder) {
      shipmentData.shopId = shopId;
      shipmentData.isShopOrder = true;
    }

    // Save
    const savedShipment = await new Shipment(shipmentData).save();

    // ---------------- 10km proximity fan-out (using Driver.lastKnownLocation) ----------------
    const MAX_DISTANCE_METERS = 10_000;

    const nearbyDrivers = await Driver.find({
      vehicleType,
      status: 'active',
      isAvailable: true,               // optional but recommended
      fcmToken: { $ne: null },
      lastKnownLocation: {
        $near: {
          $geometry: senderPoint,      // sender GeoJSON point
          $maxDistance: MAX_DISTANCE_METERS
        }
      }
    })
    .select('userId fcmToken')
    .lean();

    console.log(`[createShipment] Found ${nearbyDrivers.length} drivers within 10km of sender`);

    await Promise.all(
      nearbyDrivers.map(d => notifyNewShipment(d.userId, savedShipment))
    );
    // ----------------------------------------------------------------------------------------

    return res.status(201).json({
      message: 'Shipment created successfully',
      trackingNumber: savedShipment.trackingNumber,
      shipment: savedShipment
    });

  } catch (error) {
    console.error('Error creating shipment:', error);

    // Duplicate tracking number (rare, but keep your previous handling)
    if (error.code === 11000 && error.keyPattern?.trackingNumber) {
      return res.status(409).json({
        message: 'Please try again',
        error: 'Duplicate tracking number'
      });
    }

    return res.status(500).json({
      message: 'Failed to create shipment',
      error: error.message
    });
  }
};

exports.getUserShipments = async (req, res) => {
  try {
    const userId = req.user.uid;
    const shipments = await Shipment.find({ userId }).sort({ createdAt: -1 });
    res.json(shipments);
  } catch (error) {
    console.error('Fetch shipments error:', error);
    res.status(500).json({ message: 'Failed to fetch shipments' });
  }
};

// Get order status for users
exports.getOrderStatus = async (req, res) => {
  try {
    const order = await Shipment.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({
      status: order.status,
      driverId: order.assignedDriver,
      trackingNumber: order.trackingNumber
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
};

exports.getMatchingShipments = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.uid })
       .select('vehicleType lastKnownLocation activeShipment')
      .lean();

    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }

        if (driver.activeShipment) {
      return res.status(200).json({
        success: true,
        shipments: [],
        message: 'You already have an active shipment. Complete or deliver it before viewing new ones.'
      });
    }

    const point = driver.lastKnownLocation;
    const validPoint = point && point.type === 'Point' &&
      Array.isArray(point.coordinates) && point.coordinates.length === 2 &&
      typeof point.coordinates[0] === 'number' && typeof point.coordinates[1] === 'number';

    if (!validPoint) {
      return res.status(200).json({
        success: true,
        shipments: [],
        message: 'No recent location. Open dashboard to share location.'
      });
    }

    const MAX_DISTANCE_METERS = 10_000;

    const shipments = await Shipment.find({
      status: 'pending',
      vehicleType: driver.vehicleType,
      'sender.address.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: point.coordinates }, // driver last-known
          $maxDistance: MAX_DISTANCE_METERS
        }
      }
    })
    .sort({ createdAt: -1 })
    .lean();

    res.status(200).json({ success: true, shipments });
  } catch (error) {
    console.error('Error fetching matching shipments:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching shipments' });
  }
};



// exports.acceptShipment = async (req, res) => {
//   try {
//     console.log('🔥 acceptShipment controller hit');
//     const shipmentId = req.params.id;
//     const firebaseUid = req.user.uid;

//     const driver = await Driver.findOne({ userId: firebaseUid });

//     if (!driver) {
//       return res.status(404).json({ message: 'Driver not found' });
//     }

//     const shipment = await Shipment.findById(shipmentId);

//     if (!shipment) {
//       return res.status(404).json({ message: 'Shipment not found' });
//     }

//     shipment.status = 'assigned';
//     shipment.assignedDriver = {
//       _id: driver._id,
//       userId: driver.userId,
//       name: driver.name,
//       phone: driver.phone,
//       vehicleNumber: driver.vehicleNumber,
//     };

//     await shipment.save();

//     res.status(200).json({ message: 'Shipment accepted successfully', shipment });
//   } catch (error) {
//     console.error('Error accepting shipment:', error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };

exports.acceptShipment = async (req, res) => {
  try {
    console.log('🔥 acceptShipment controller hit');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Params:', req.params);
    console.log('User UID:', req.user.uid);

    const shipmentId = req.params.id;
    const firebaseUid = req.user.uid;
    const { location } = req.body;

    // Validate location if provided
    if (location) {
      console.log('Location received in request:', location);
      if (!Array.isArray(location)) {
        console.error('Location is not an array');
        return res.status(400).json({
          message: 'Invalid location format. Expected [longitude, latitude]'
        });
      }
      if (location.length !== 2) {
        console.error('Location array length is not 2');
        return res.status(400).json({
          message: 'Invalid location format. Expected [longitude, latitude]'
        });
      }
      if (typeof location[0] !== 'number' || typeof location[1] !== 'number') {
        console.error('Location coordinates are not numbers');
        return res.status(400).json({
          message: 'Invalid coordinates. Longitude and latitude must be numbers'
        });
      }
      if (location[0] < -180 || location[0] > 180 || location[1] < -90 || location[1] > 90) {
        console.error('Location coordinates out of valid range');
        return res.status(400).json({
          message: 'Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90'
        });
      }
    } else {
      console.log('No location provided in request');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log('MongoDB transaction started');

    try {
      // 1. Find the driver
      console.log('Looking for driver with UID:', firebaseUid);
      const driver = await Driver.findOne({ userId: firebaseUid }).session(session);

      if (!driver) {
        console.error('Driver not found');
        await session.abortTransaction();
        return res.status(404).json({ message: 'Driver not found' });
      }

      console.log('Driver found:', {
        _id: driver._id,
        name: driver.name,
        currentLocation: driver.location,
        activeShipment: driver.activeShipment
      });

      // Determine driver location to use
      const driverLocation = location ||
        (driver.location?.coordinates || [0, 0]);
      console.log('Driver location to be saved:', driverLocation);

      // 2. Update the driver
      const driverUpdate = {
        isLocationActive: true,
        activeShipment: shipmentId,
        lastUpdated: new Date(),
        'location.coordinates': driverLocation,
        'location.lastUpdated': new Date()
      };

      console.log('Driver update payload:', driverUpdate);

      const updatedDriver = await Driver.findByIdAndUpdate(
        driver._id,
        { $set: driverUpdate },
        { new: true, session }
      );

      console.log('Driver updated successfully:', {
        _id: updatedDriver._id,
        activeShipment: updatedDriver.activeShipment,
        location: updatedDriver.location
      });

      // 3. Update the shipment
      const shipmentUpdate = {
        status: 'assigned',
        assignedDriver: {
          _id: driver._id,
          userId: driver.userId,
          name: driver.name,
          phone: driver.phone,
          vehicleNumber: driver.vehicleNumber,
          vehicleType: driver.vehicleType
        },
        driverLocation: {
          type: 'Point',
          coordinates: driverLocation,
          lastUpdated: new Date()
        }
      };

      console.log('Shipment update payload:', shipmentUpdate);

      const shipment = await Shipment.findByIdAndUpdate(
        shipmentId,
        { $set: shipmentUpdate },
        { new: true, session }
      );

      if (!shipment) {
        console.error('Shipment not found with ID:', shipmentId);
        await session.abortTransaction();
        return res.status(404).json({ message: 'Shipment not found' });
      }

      console.log('Shipment updated successfully:', {
        _id: shipment._id,
        status: shipment.status,
        assignedDriver: shipment.assignedDriver,
        driverLocation: shipment.driverLocation
      });


      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      shipment.pickupOtp = otp;
      shipment.pickupVerifiedAt = null;

      if (shipment.isShopOrder) {
        // console.log(`🛍️ Shop order: Pickup OTP ${otp} generated for receiver in app`);
      } else {
        // console.log(`🚚 Normal shipment: Pickup OTP ${otp} generated for sender`);
      }
      await shipment.save({ session });

      

      await session.commitTransaction();
      console.log('Transaction committed successfully');

      // Emit real-time update if using Socket.io
      if (req.io) {
        console.log('Emitting socket.io update for shipment:', shipmentId);
        req.io.to(`shipment_${shipmentId}`).emit('shipment_updated', shipment);
      }

      res.status(200).json({
        message: 'Shipment accepted successfully',
        shipment,
        driverLocation: shipment.driverLocation
      });

    } catch (error) {
      console.error('Transaction error:', error);
      await session.abortTransaction();
      console.log('Transaction aborted due to error');
      throw error;
    } finally {
      session.endSession();
      console.log('MongoDB session ended');
    }

  } catch (error) {
    console.error('Error in acceptShipment controller:', {
      message: error.message,
      stack: error.stack,
      ...(error.response && { responseData: error.response.data })
    });
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.updateDriverLocation = async (req, res) => {
  try {
    const { coordinates } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates array [longitude, latitude] is required'
      });
    }

    const shipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      {
        driverLocation: {
          type: 'Point',
          coordinates: coordinates
        },
        // Optionally update status to "in-transit" if it was "assigned"
        // $set: {
        //   status: req.body.status || 'in-transit'
        // }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: shipment._id,
        trackingNumber: shipment.trackingNumber,
        driverLocation: shipment.driverLocation,
        status: shipment.status
      }
    });

  } catch (err) {
    console.error(`Error updating driver location: ${err.message}`.red);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};



exports.cancelShipment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // const log = (...args) => console.log('🚀 [CancelShipment]', ...args);

  try {
    const { id } = req.params;
    const { reason } = req.body;

    // log('\n🧾 API called');
    // log('📦 Shipment ID:', id);
    // log('🗒️ Reason from frontend:', reason);

    // STEP 0️⃣ — Load original shipment before cancellation
    // log('\n🔎 [Step 0] Fetching original shipment...');
    const original = await Shipment.findById(id).lean();

    if (!original) {
      await session.abortTransaction();
      // log('❌ [Step 0] Shipment not found before cancel.');
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // log('🧱 [Step 0] Pre-cancel details:', {
    //   status: original.status,
    //   isShopOrder: original.isShopOrder,
    //   shopId: String(original.shopId || 'null'),
    //   distance: original.distance,
    //   cost: original.cost,
    //   vehicleType: original.vehicleType,
    //   assignedDriver: original.assignedDriver?.userId || 'none',
    //   recreatedFrom: original.recreatedFrom || null,
    //   recreatedTo: original.recreatedTo || null,
    // });

    // STEP 1️⃣ — Cancel the shipment
    // log('\n🛑 [Step 1] Marking shipment as cancelled...');
    const shipment = await Shipment.findByIdAndUpdate(
      id,
      { status: 'cancelled', $unset: { driverLocation: 1 } },
      { new: true, session }
    );

    if (!shipment) {
      await session.abortTransaction();
      // log('❌ [Step 1] Shipment not found during cancel.');
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    // log('✅ [Step 1] Shipment cancelled successfully →', shipment._id);

    // STEP 2️⃣ — Release driver (if assigned)
    if (shipment.assignedDriver?.userId) {
      // log('\n🧹 [Step 2] Releasing driver →', shipment.assignedDriver.userId);
      await Driver.findOneAndUpdate(
        { userId: shipment.assignedDriver.userId },
        { $set: { isLocationActive: false }, $unset: { activeShipment: 1 } },
        { session }
      );
      // log('✅ [Step 2] Driver released from shipment.');
    } else {
      // log('ℹ️ [Step 2] No assigned driver found.');
    }

    // STEP 3️⃣ — Handle shop orders (recreate shipment)
    // log('\n🔁 [Step 3] Checking if shipment needs to be recreated...');
    let newShipmentId = null;

    if (original.isShopOrder && original.shopId) {
      // log('🏪 [Step 3] Shop order detected →', original.shopId);

      // Try to find linked order
      let order = await Order.findOne({ shipmentId: original._id }).lean();

      if (!order) {
        // log('⚠️ [Step 3] No direct order link found. Searching fallback...');
        order = await Order.findOne({
          'shop._id': original.shopId,
          'customer.phone': original.receiver?.phone || original.sender?.phone,
        })
          .sort({ createdAt: -1 })
          .lean();

        // if (order) log('✅ [Step 3] Found order by fallback:', order._id);
        // else log('❌ [Step 3] No related order found.');
      } else {
        // log('✅ [Step 3] Found linked order via shipmentId:', order._id);
      }

      if (order) {
        // Load shop details
        const shop = await Shop.findById(order.shop?._id || order.shop).lean();
        if (!shop) {
          // log('❌ [Step 4] Shop not found, aborting recreation.');
        } else {
          // log('\n📍 [Step 4] Preparing pickup/drop coordinates...');
          const shopLat = shop?.address?.coordinates?.lat ?? shop?.address?.coordinates?.[1];
          const shopLng = shop?.address?.coordinates?.lng ?? shop?.address?.coordinates?.[0];
          const custLat = order?.customer?.address?.lat ?? order?.customer?.address?.coordinates?.[1];
          const custLng = order?.customer?.address?.lng ?? order?.customer?.address?.coordinates?.[0];

          const pickupPoint = (Number.isFinite(shopLat) && Number.isFinite(shopLng))
            ? { type: 'Point', coordinates: [shopLng, shopLat] }
            : original.sender?.address?.coordinates;

          const dropPoint = (Number.isFinite(custLat) && Number.isFinite(custLng))
            ? { type: 'Point', coordinates: [custLng, custLat] }
            : original.receiver?.address?.coordinates;

          // log('✅ PickupPoint:', JSON.stringify(pickupPoint));
          // log('✅ DropPoint:', JSON.stringify(dropPoint));

          const newCost = original.cost ?? 0;
          const newDistance = original.distance ?? 0;
          // log('💰 [Step 4] Using original cost/distance:', newCost, '/', newDistance);

          // Create new shipment inside same transaction
          // log('\n🧩 [Step 4] Creating new shipment (in-transaction)...');
          const newShipmentArr = await Shipment.create([{
            userId: original.userId || order.customer?.userId || 'guest',
            sender: {
              ...original.sender,
              address: { ...(original.sender?.address || {}), coordinates: pickupPoint }
            },
            receiver: {
              ...original.receiver,
              address: { ...(original.receiver?.address || {}), coordinates: dropPoint }
            },
            parcel: original.parcel,
            vehicleType: original.vehicleType || order.vehicleType || 'TwoWheeler',
            distance: newDistance,
            cost: newCost,
            trackingNumber: Math.random().toString(36).substring(2, 8).toUpperCase(),
            status: 'pending',
            shopId: original.shopId,
            isShopOrder: true,
            payment: original.payment,
            recreatedFrom: null,
            recreatedTo: null,
          }], { session });

          const newShipment = newShipmentArr[0];
          newShipmentId = newShipment._id;
          // log('✅ [Step 4] New shipment created →', newShipmentId);

          // 🔗 Link recreatedFrom / recreatedTo using .save()
          // log('\n🔗 [Step 4] Linking recreatedFrom / recreatedTo using .save()...');
          const oldDoc = await Shipment.findById(shipment._id).session(session);
          const newDoc = await Shipment.findById(newShipmentId).session(session);

          if (oldDoc && newDoc) {
            oldDoc.recreatedTo = newShipmentId;
            newDoc.recreatedFrom = shipment._id;

            await oldDoc.save({ session });
            await newDoc.save({ session });

            // log('✅ [Link-Save] old.recreatedTo   →', oldDoc.recreatedTo);
            // log('✅ [Link-Save] new.recreatedFrom →', newDoc.recreatedFrom);
          } else {
            // log('⚠️ [Link-Save] One of the docs not found in session');
          }

          // Update order with new shipmentId
          // log('\n📦 [Step 4] Updating order with new shipmentId...');
          await Order.findByIdAndUpdate(order._id, { $set: { shipmentId: newShipmentId } }, { session });
          // log('✅ Order updated successfully →', order._id, '→', newShipmentId);

          // STEP 5️⃣ — Notify nearby drivers
          try {
            // log('\n📣 [Step 5] Sending notifications to nearby drivers...');
            await fanOutShipmentToNearbyDrivers({
              shipment: newShipment,
              vehicleType: newShipment.vehicleType,
              pickupPoint: pickupPoint,
              radiusMeters: 10000,
            });
            // log('✅ [Step 5] Notifications sent.');
          } catch (err) {
            // log('⚠️ [Step 5] Notification failed:', err.message);
          }

          // Emit socket event
          if (req.io) {
            // log('🛰️ [Socket] Emitting shipment_recreated...');
            req.io.to(`order_${order._id}`).emit('shipment_recreated', {
              orderId: order._id,
              oldShipmentId: shipment._id,
              newShipmentId: newShipmentId
            });
          }
        }
      }
    } else {
      // log('ℹ️ [Step 3] Not a shop order. Skipping recreation.');
    }

    // ✅ Commit transaction
    await session.commitTransaction();
    // log('\n✅ [Final] Transaction committed.');

    // 🔍 Verify recreatedFrom/recreatedTo after commit (outside session)
    if (newShipmentId) {
      const verifyOld = await Shipment.findById(shipment._id).lean();
      const verifyNew = await Shipment.findById(newShipmentId).lean();
      // log('🔍 [Post-Commit Verify] old.recreatedTo   =', verifyOld?.recreatedTo || null);
      // log('🔍 [Post-Commit Verify] new.recreatedFrom =', verifyNew?.recreatedFrom || null);
    }

    session.endSession();
    // log('🔚 MongoDB session closed.\n');

    // Respond
    return res.status(200).json({
      success: true,
      message: 'Shipment cancelled successfully',
      data: {
        oldShipmentId: shipment._id,
        newShipmentId: newShipmentId || null,
        recreated: Boolean(newShipmentId),
        reason: reason || null,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('🔥 [CancelShipment] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};



exports.deliverShipment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // 1. Update the shipment status
    const shipment = await Shipment.findByIdAndUpdate(
      id,
      {
        status: 'delivered',
        deliveredAt: new Date(),
        $unset: { driverLocation: 1 } // Remove driver location
      },
      { new: true, session }
    );

    if (!shipment) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, error: 'Shipment not found' });
    }

    // 2. Update the driver's active shipment
    if (shipment.assignedDriver?.userId) {
      await Driver.findOneAndUpdate(
        { userId: shipment.assignedDriver.userId },
        {
          $set: { isLocationActive: false },
          $unset: { activeShipment: 1 }
        },
        { session }
      );
    }

    await session.commitTransaction();

    // Emit real-time update if using Socket.io
    if (req.io) {
      req.io.to(`shipment_${shipment._id}`).emit('shipment_updated', shipment);
    }

    res.status(200).json({
      success: true,
      data: shipment
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error delivering shipment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark shipment as delivered',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

exports.getDriverHistory = async (req, res) => {
  try {
    const { status } = req.query;
    const driverId = req.user.id; // From auth middleware

    let query = { driver: driverId };

    if (status && status !== 'all') {
      query.status = status;
    }

    const shipments = await Shipment.find(query)
      .populate('sender receiver')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: shipments.map(shipment => ({
        ...shipment,
        cost: parseFloat(shipment.cost.toFixed(2))
      }))
    });
  } catch (error) {
    console.error('Error fetching driver history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shipment history'
    });
  }
};


// exports.getShipmentById = async (req, res) => {
//   try {
//     const shipment = await Shipment.findById(req.params.id);
//     if (!shipment) {
//       return res.status(404).json({ message: 'Shipment not found' });
//     }
//     res.status(200).json(shipment);
//   } catch (error) {
//     console.error('Error fetching shipment:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };


exports.getShipmentById = async (req, res) => {
  const id = req.params.id;

  // Validate MongoDB ObjectId before querying
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid shipment ID format' });
  }

  try {
    const shipment = await Shipment.findById(id)
      .select({
        _id: 1,
        status: 1,
        'driverLocation.coordinates': 1,
        'sender.address.coordinates': 1,
        'receiver.address.coordinates': 1,
      })
      .lean();

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    res.status(200).json(shipment);
  } catch (error) {
    console.error('Error fetching shipment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getShopShipments = async (req, res) => {
  try {
    const { shopId } = req.params;
    const shipments = await Shipment.find({ shopId })
      .populate('shopId', 'name phone address')
      .sort({ createdAt: -1 });

    res.json(shipments);
  } catch (error) {
    console.error('Error fetching shop shipments:', error);
    res.status(500).json({ message: 'Failed to fetch shop shipments' });
  }
};

exports.verifyPickupOtp = async (req, res) => {
  try {
    console.log("📩 [verifyPickupOtp] API called");
    const { id } = req.params;
    const { otp } = req.body;

    console.log("➡️ Shipment ID:", id);
    console.log("➡️ OTP received from frontend:", otp);

    const shipment = await Shipment.findById(id);
    console.log("🔍 Shipment fetched from DB:", shipment ? "✅ Found" : "❌ Not found");

    if (!shipment) {
      console.log("❌ Shipment not found for ID:", id);
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    console.log("📦 Current shipment OTP in DB:", shipment.pickupOtp);
    console.log("🆚 Comparing OTPs → DB:", shipment.pickupOtp, "| Frontend:", otp);

    if (shipment.pickupOtp !== otp) {
      console.log("⚠️ Invalid OTP entered!");
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    console.log("✅ OTP matched successfully!");
    shipment.status = 'picked_up';
    shipment.pickupVerifiedAt = new Date();
    shipment.pickupOtp = null;

    console.log("📝 Updating shipment status to 'picked_up'...");
    await shipment.save();
    console.log("💾 Shipment saved successfully:", shipment._id);

    res.status(200).json({
      success: true,
      message: 'Pickup verified successfully',
      shipment
    });

    console.log("✅ Response sent successfully to frontend");

  } catch (error) {
    console.error("🔥 Error verifying pickup OTP:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getShipmentStatusOnly = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shipment ID format' });
    }

    // Fetch only the "status" field
    const shipment = await Shipment.findById(id).select('status').lean();

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    return res.status(200).json({ success: true, status: shipment.status });
  } catch (error) {
    console.error('Error fetching shipment status:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};



exports.getShipmentPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate shipment ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shipment ID format' });
    }

    // Fetch only payment info
    const shipment = await Shipment.findById(id)
      .select('payment.method payment.status cost trackingNumber')
      .lean();

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    return res.status(200).json({
      success: true,
      payment: shipment.payment || { status: 'unknown' },
      cost: shipment.cost,
      trackingNumber: shipment.trackingNumber,
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching payment status',
      error: error.message,
    });
  }
};













