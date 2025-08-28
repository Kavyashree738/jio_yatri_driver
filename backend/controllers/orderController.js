// controllers/orderController.js
const mongoose = require('mongoose');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const Order = require('../models/Order');
// ⚠️ Make sure this is the Shop model that actually contains the items array.
const Shop = require('../models/CategoryModel'); // replace with '../models/Shop' if that's your real file
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
const { notifyNewShipment, notifyShopNewOrder } = require('../services/notificationService');
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// ---------- helpers ----------
const computeTotals = ({ items, deliveryFee = 0, discount = 0 }) => {
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  const total = +(subtotal + Number(deliveryFee) - Number(discount)).toFixed(2);
  return {
    subtotal: +subtotal.toFixed(2),
    deliveryFee: +Number(deliveryFee).toFixed(2),
    discount: +Number(discount).toFixed(2),
    total
  };
};

const toRad = d => d * Math.PI / 180;
function haversineKm(a, b) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return 0;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))).toFixed(2);
}

async function distanceKm(origin, destination) {
  try {
    if (!GOOGLE_MAPS_API_KEY) throw new Error('no-key');
    const r = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        units: 'metric',
        key: GOOGLE_MAPS_API_KEY
      }
    });
    if (r.data?.status === 'OK') {
      const meters = r.data.routes[0].legs[0].distance.value || 0;
      return +(meters / 1000).toFixed(2);
    }
    return haversineKm(origin, destination);
  } catch {
    return haversineKm(origin, destination);
  }
}

const VEHICLE_RATES = {
  TwoWheeler: 10,
  ThreeWheeler: 14,
  Truck: 18,
  Pickup9ft: 22,
  Tata407: 28
};
function deliveryCost(km, vehicleType) {
  const rate = VEHICLE_RATES[vehicleType] || VEHICLE_RATES.TwoWheeler;
  return +(km * rate).toFixed(2);
}

// ---------- create ----------
exports.createOrder = async (req, res) => {
  try {
    console.log('[createOrder] body:', JSON.stringify(req.body, null, 2));

    const {
      shopId,
      customer,
      items,
      notes,
      paymentMethod = 'cod',
      vehicleType = 'TwoWheeler'
    } = req.body;

    const ALLOWED_VEHICLES = new Set(['TwoWheeler', 'ThreeWheeler', 'Truck', 'Pickup9ft', 'Tata407']);
    const finalVehicleType = ALLOWED_VEHICLES.has(vehicleType) ? vehicleType : 'TwoWheeler';

    if (!shopId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'shopId and items are required' });
    }
    if (!customer?.name || !customer?.phone || !customer?.address?.line) {
      return res.status(400).json({ success: false, error: 'Customer name, phone, and address are required' });
    }

    const shop = await Shop.findById(shopId).lean();
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    console.log('[createOrder] shop items count =', (shop.items || []).length);

    // normalize items against shop catalog
    const normalized = [];
    for (const cartItem of items) {
      const itemFromDb = (shop.items || []).find(i => String(i._id) === String(cartItem.itemId));
      if (!itemFromDb) {
        const msg = `[createOrder] invalid item id: ${cartItem.itemId}`;
        console.log(msg);
        return res.status(400).json({ success: false, error: msg });
      }
      const qty = Math.max(1, Number(cartItem.quantity || 1));
      const price = Number(itemFromDb.price) || 0;
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
      const imageUrl = itemFromDb.image ? `${baseUrl}/api/shops/images/${itemFromDb.image}` : null;

      normalized.push({
        itemId: itemFromDb._id,
        name: itemFromDb.name,
        price,
        quantity: qty,
        imageUrl,
        veg: typeof itemFromDb.veg === 'boolean' ? itemFromDb.veg : null,
        category: itemFromDb.category || null
      });
    }

    const pricing = computeTotals({ items: normalized, deliveryFee: 0, discount: 0 });

    // ✅ Create the order FIRST
    const doc = await Order.create({
      shop: {
        _id: shop._id,
        name: shop.shopName,
        phone: shop.phone,
        phonePeNumber: shop.phonePeNumber,
        category: shop.category
      },
      customer: {
        userId: req.user?.uid || null,
        name: customer.name,
        phone: customer.phone,
        address: {
          line: customer.address.line,
          lat: customer.address.lat ?? null,
          lng: customer.address.lng ?? null
        }
      },
      vehicleType: finalVehicleType,
      items: normalized,
      pricing,
      notes: notes || '',
      status: 'pending',
      payment: { method: paymentMethod, status: 'unpaid' }
    });

    console.log('[createOrder] created:', doc._id.toString(), doc.orderCode);

    // ✅ THEN notify the shop owner (non-blocking)
    try {
      await notifyShopNewOrder(shop._id, doc); // or use shopId, both are fine
      console.log('[createOrder] notifyShopNewOrder sent');
    } catch (e) {
      console.warn('[createOrder] notifyShopNewOrder failed:', e.message);
    }

    return res.status(201).json({ success: true, data: doc });
  } catch (e) {
    console.error('[createOrder] failed:', e);
    return res.status(500).json({ success: false, error: 'Failed to create order' });
  }
};

// ---------- read single ----------
exports.getOrder = async (req, res) => {
  try {
    console.log('[getOrder] id =', req.params.id);
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    return res.json({ success: true, data: order });
  } catch (e) {
    console.error('[getOrder] error:', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
};

// ---------- list by shop ----------
// controllers/orderController.js
exports.getOrdersByShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    console.log('[getOrdersByShop] shopId param =', shopId);

    const or = [{ 'shop._id': shopId }]; // string form (just in case)
    if (mongoose.isValidObjectId(shopId)) {
      or.push({ 'shop._id': new mongoose.Types.ObjectId(shopId) }); // ObjectId form (actual)
    }
    const orders = await Order.find({ $or: or })
      .sort({ createdAt: -1 })
      .lean();
    console.log('[getOrdersByShop] found =', orders.length,
      orders.map(o => ({ _id: o._id, code: o.orderCode, shop: String(o.shop?._id) })).slice(0, 5)
    );
    return res.json({ success: true, data: orders });
  } catch (e) {
    console.error('[getOrdersByShop] error:', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
};

// ---------- list by user ----------
exports.getOrdersByUser = async (req, res) => {
  try {
    const { phone, userId } = req.query;
    console.log('[getOrdersByUser] query =', req.query);
    const q = phone ? { 'customer.phone': phone } : { 'customer.userId': userId };
    const orders = await Order.find(q).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: orders });
  } catch (e) {
    console.error('[getOrdersByUser] error:', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch user orders' });
  }
};

// ---------- update status ----------
// exports.updateOrderStatus = async (req, res) => {
//   try {
//     const { status } = req.body;
//     console.log('[updateOrderStatus] id =', req.params.id, 'status =', status);

//     const allowed = ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
//     if (!allowed.includes(status)) {
//       return res.status(400).json({ success: false, error: 'Invalid status' });
//     }

//     const updated = await Order.findByIdAndUpdate(
//       req.params.id,
//       { $set: { status } },
//       { new: true }
//     );

//     if (!updated) {
//       return res.status(404).json({ success: false, error: 'Order not found' });
//     }
//     console.log('[updateOrderStatus] updated ->', updated._id.toString(), updated.status);
//     return res.json({ success: true, data: updated });
//   } catch (e) {
//     console.error('[updateOrderStatus] error:', e);
//     return res.status(500).json({ success: false, error: 'Failed to update status' });
//   }
// };

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    console.log('[updateOrderStatus] id =', req.params.id, 'status =', status);

    const allowed = ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    console.log('[updateOrderStatus] updated ->', updated._id.toString(), updated.status);
    return res.json({ success: true, data: updated });
  } catch (e) {
    console.error('[updateOrderStatus] error:', e);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
};
// ---------- update payment ----------
// exports.updatePaymentStatus = async (req, res) => {
//   try {
//     const { status = 'paid', method, provider, txnId } = req.body;
//     console.log('[updatePaymentStatus] id =', req.params.id, 'payload =', req.body);

//     const allowed = ['unpaid', 'paid', 'refunded'];
//     if (!allowed.includes(status)) {
//       return res.status(400).json({ success: false, error: 'Invalid payment status' });
//     }

//     const update = { 'payment.status': status };
//     if (method) update['payment.method'] = method;
//     if (provider !== undefined) update['payment.provider'] = provider;
//     if (txnId !== undefined) update['payment.txnId'] = txnId;

//     let doc = await Order.findByIdAndUpdate(
//       req.params.id,
//       { $set: update },
//       { new: true }
//     );

//     if (!doc) {
//       return res.status(404).json({ success: false, error: 'Order not found' });
//     }

//     // auto create shipment on first time "paid"
//     if (doc.payment?.status === 'paid' && !doc.shipmentId) {
//       try {
//         const shipment = await createShipmentForOrder(doc);
//         doc = await Order.findById(doc._id).lean(); // reflect shipmentId
//         console.log('[updatePaymentStatus] Shipment created:', shipment._id.toString());
//       } catch (e) {
//         console.error('[updatePaymentStatus] Shipment creation failed:', e.message);
//       }
//     }

//     return res.json({ success: true, data: doc });
//   } catch (e) {
//     console.error('[updatePaymentStatus] failed:', e);
//     return res.status(500).json({ success: false, error: 'Failed to update payment status' });
//   }
// };

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status = 'paid', method, provider, txnId } = req.body;
    console.log('[updatePaymentStatus] id =', req.params.id, 'payload =', req.body);

    const allowed = ['unpaid', 'paid', 'refunded'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid payment status' });
    }

    const update = { 'payment.status': status };
    if (method) update['payment.method'] = method;
    if (provider !== undefined) update['payment.provider'] = provider;
    if (txnId !== undefined) update['payment.txnId'] = txnId;

    let doc = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // auto create shipment on first time "paid"
    if (doc.payment?.status === 'paid' && !doc.shipmentId) {
      try {
        const shipment = await createShipmentForOrder(doc);
        doc = await Order.findById(doc._id).lean(); // reflect shipmentId
        console.log('[updatePaymentStatus] Shipment created:', shipment._id.toString());
      } catch (e) {
        console.error('[updatePaymentStatus] Shipment creation failed:', e.message);
      }
    }

    return res.json({ success: true, data: doc });
  } catch (e) {
    console.error('[updatePaymentStatus] failed:', e);
    return res.status(500).json({ success: false, error: 'Failed to update payment status' });
  }
};



// --- core: create shipment from order ---
async function createShipmentForOrder(orderDoc) {
  const shop = await Shop.findById(orderDoc.shop._id || orderDoc.shop).lean();
  if (!shop) throw new Error('Shop not found for shipment creation');

  const origin = {
    lat: shop?.address?.coordinates?.lat,
    lng: shop?.address?.coordinates?.lng
  };
  const destination = {
    lat: orderDoc?.customer?.address?.lat,
    lng: orderDoc?.customer?.address?.lng
  };

  if (origin.lat == null || origin.lng == null || destination.lat == null || destination.lng == null) {
    throw new Error('Missing coordinates for shop or customer.');
  }

  const km = await distanceKm(origin, destination);
  const cost = deliveryCost(km, orderDoc.vehicleType);

  const parcelDesc = (orderDoc.items || [])
    .map(i => `${i.quantity}x ${i.name}`)
    .join(', ')
    .slice(0, 180);

  const shipment = await Shipment.create({
    userId: orderDoc.customer?.userId || 'guest',
    sender: {
      name: shop.shopName,
      phone: shop.phone,
      address: {
        addressLine1: shop?.address?.address || '',
        coordinates: origin
      }
    },
    receiver: {
      name: orderDoc.customer?.name || '',
      phone: orderDoc.customer?.phone || '',
      address: {
        addressLine1: orderDoc.customer?.address?.line || '',
        coordinates: destination
      }
    },
    parcel: { description: parcelDesc, images: [] },
    vehicleType: orderDoc.vehicleType || 'TwoWheeler',
    distance: km,
    cost,
    trackingNumber: uuidv4().split('-')[0].toUpperCase(),
    status: 'pending',
    shopId: shop._id,
    isShopOrder: true,
    payment: { status: 'pending', method: null }
  });

  // Optional: notify drivers
  try {
    const drivers = await Driver.find({
      vehicleType: shipment.vehicleType,
      status: 'active',
      fcmToken: { $ne: null }
    }).select('userId');
    for (const d of drivers) {
      await notifyNewShipment?.(d.userId, shipment);
    }
  } catch (e) {
    console.warn('[createShipmentForOrder] notify failed:', e.message);
  }

  await Order.findByIdAndUpdate(orderDoc._id, { $set: { shipmentId: shipment._id } });
  return shipment;
}


// ADD THIS
exports.getOrdersByOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    console.log('[getOrdersByOwner] ownerId =', ownerId);

    // get all shops for this owner
    const shops = await Shop.find({ userId: ownerId })
      .select('_id shopName')
      .lean();

    const shopIds = shops.map(s => s._id);
    if (shopIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // fetch orders for any of the owner's shops
    const orders = await Order.find({ 'shop._id': { $in: shopIds } })
      .sort({ createdAt: -1 })
      .lean();

    console.log('[getOrdersByOwner] shops =', shopIds.length, 'orders =', orders.length);
    return res.json({ success: true, data: orders });
  } catch (e) {
    console.error('[getOrdersByOwner] error:', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch owner orders' });
  }
};

