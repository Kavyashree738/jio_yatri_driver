const Driver = require('../models/Driver');

exports.registerDriver = async (req, res) => {
  try {
    const { userId, name, phone, vehicleType, vehicleNumber, licenseFileId, rcFileId } = req.body;

    const driver = new Driver({
      userId,
      name,
      phone,
      vehicleType,
      vehicleNumber,
      documents: {
        license: licenseFileId,
        rc: rcFileId
      }
    });

    await driver.save();
    res.status(201).json({ success: true, data: driver });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getDriver = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.params.userId });
    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }
    res.status(200).json({ success: true, data: driver });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};



exports.updateDriverStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status input
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status. Must be either "active" or "inactive"' 
      });
    }

    // Find and update driver status
    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.id },
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
    console.error('Error updating driver status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while updating status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getDriverStatus = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user.id })
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
    console.error('Error fetching driver status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while fetching status'
    });
  }
};