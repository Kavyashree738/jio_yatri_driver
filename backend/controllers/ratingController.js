const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const Shipment = require('../models/Shipment');

exports.submitRating = async (req, res) => {
  // console.log('=== STARTING RATING SUBMISSION PROCESS ===');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // console.log('✅ Transaction session started');

    const { shipmentId, rating, feedback } = req.body;
    const userId = req.user.uid;

    // console.log('📦 Request:', { shipmentId, rating, feedback, userId });

    if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Invalid shipment ID' });
    }

    if (!rating || rating < 1 || rating > 5) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5 stars' });
    }

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      userId: userId,
      status: 'delivered',
      'payment.status': 'paid'
    }).session(session);

    if (!shipment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Shipment not found or not eligible for rating' });
    }

    if (shipment.rating && shipment.rating.value) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'This shipment already has a rating' });
    }

    shipment.rating = {
      value: rating,
      feedback: feedback?.trim() || '',
      submittedAt: new Date(),
      userId
    };
    await shipment.save({ session });

    const assignedDriver = shipment.assignedDriver;
    let driverId = assignedDriver?._id;

    if (driverId && mongoose.Types.ObjectId.isValid(driverId.toString())) {
      driverId = driverId.toString();
    } else {
      console.warn("⚠️ Extracted Driver ID is not valid ObjectId:", driverId);
      driverId = null;
    }

    let driverResponse = {};

    if (driverId) {
      const driver = await Driver.findById(driverId).session(session);
      if (driver) {
        const newCount = driver.ratings.count + 1;
        const newAverage = ((driver.ratings.average * driver.ratings.count) + rating) / newCount;

        driver.ratings = {
          average: parseFloat(newAverage.toFixed(2)),
          count: newCount,
          details: [
            ...driver.ratings.details,
            {
              shipmentId: shipment._id,
              rating,
              feedback: feedback?.trim() || '',
              userId,
              createdAt: new Date()
            }
          ]
        };

        await driver.save({ session });
        driverResponse = {
          averageRating: driver.ratings.average,
          ratingCount: driver.ratings.count
        };

        // console.log("✅ Driver rating updated successfully");
      } else {
        console.log("⚠️ Driver not found in DB");
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        shipment: {
          id: shipment._id,
          rating: shipment.rating
        },
        driver: driverResponse
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Error in submitRating:", error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit rating',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};











