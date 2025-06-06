const Driver = require('../models/Driver');

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

// Register driver with proper validation
exports.registerDriver = async (req, res) => {
  try {
    const { userId, name, phone, vehicleType, vehicleNumber, licenseFileId, rcFileId } = req.body;

    // Validate required fields
    if (!userId || !name || !phone || !vehicleType || !vehicleNumber || !licenseFileId || !rcFileId) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if driver already exists
    const existingDriver = await Driver.findOne({ userId });
    if (existingDriver) {
      return res.status(400).json({
        success: false,
        error: 'Driver already registered',
        driver: existingDriver
      });
    }

    // Create new driver
    const driver = new Driver({
      userId,
      name,
      phone,
      vehicleType,
      vehicleNumber,
      documents: {
        license: licenseFileId,
        rc: rcFileId
      },
      status: 'active'
    });

    await driver.save();
    
    res.status(201).json({ 
      success: true, 
      data: driver 
    });
  } catch (err) {
    if (err.code === 11000) {
      // If somehow we still hit duplicate key (race condition)
      const existingDriver = await Driver.findOne({ userId: req.body.userId });
      return res.status(400).json({
        success: false,
        error: 'Driver registration failed - already exists',
        driver: existingDriver
      });
    }
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// Get driver by userId
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