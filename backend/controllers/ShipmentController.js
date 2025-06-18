const axios = require('axios');
const Shipment = require('../models/Shipment');
const Driver=require('../models/Driver')
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

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
          origin:` ${origin.lat},${origin.lng}`,
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
    const { sender, receiver, vehicleType, distance, cost } = req.body;
    const userId = req.user.uid;

    const trackingNumber = uuidv4().split('-')[0].toUpperCase();

    const newShipment = new Shipment({
      sender: {
        name: sender.name,
        phone: sender.phone,
        address: {
          addressLine1: sender.address.addressLine1,
          coordinates: sender.address.coordinates
        }
      },
      receiver: {
        name: receiver.name,
        phone: receiver.phone,
        address: {
          addressLine1: receiver.address.addressLine1,
          coordinates: receiver.address.coordinates
        }
      },
      vehicleType,
      distance,
      cost,
      trackingNumber,
      userId,
      status: 'pending'
    });

    const savedShipment = await newShipment.save();

    res.status(201).json({
      message: 'Shipment created successfully',
      trackingNumber: savedShipment.trackingNumber,
      shipment: savedShipment
    });
  } catch (error) {
    console.error('Error creating shipment:', error);
    res.status(500).json({ 
      message: 'Failed to create shipment',
      error: error.message,
      details: error.errors
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
    // 1. Get the logged-in driver
    const driver = await Driver.findOne({ userId: req.user.uid }).select('vehicleType');

    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }

    // 2. Fetch shipments that match the vehicle type
    const matchingShipments = await Shipment.find({
      vehicleType: driver.vehicleType,
      status: 'pending' // Optional: Only pending shipments
    });

    res.status(200).json({
      success: true,
      shipments: matchingShipments
    });
  } catch (error) {
    console.error('Error fetching matching shipments:', error);
    res.status(500).json({ success: false, error: 'Server error while fetching shipments' });
  }
};


exports.acceptShipment = async (req, res) => {
  try {
    console.log('🔥 acceptShipment controller hit');
    const shipmentId = req.params.id;
    const firebaseUid = req.user.uid;

    const driver = await Driver.findOne({ userId: firebaseUid });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const shipment = await Shipment.findById(shipmentId);

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    shipment.status = 'assigned';
    shipment.assignedDriver = {
      _id: driver._id,
      userId: driver.userId,
      name: driver.name,
      phone: driver.phone,
      vehicleNumber: driver.vehicleNumber,
    };

    await shipment.save();

    res.status(200).json({ message: 'Shipment accepted successfully', shipment });
  } catch (error) {
    console.error('Error accepting shipment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
