require('dotenv').config();
const express = require('express');
const cors = require('cors'); // ✅ Keep only this
const mongoose = require('mongoose');
const driverRoutes = require('./routes/driverRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const ShipmentRoutes=require('./routes/ShipmentRoutes')
const admin = require('firebase-admin');
const app = express();
const PORT = process.env.PORT || 5000;
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const verifyFirebaseToken=require('./middleware/verifyFirebaseToken')
const addressRoutes=require('./routes/addressRoutes')
const authRoutes=require('./routes/authRoutes')
const paymentRoutes=require('./routes/paymentRoutes')
const axios = require('axios');
const settlement=require('./routes/settlementRoutes')
const userRoutes=require('./routes/userRoutes')
const shopRoutes=require('./routes/shopRoutes')
const orderRoutes = require('./routes/orders');
const shipmentImages=require('./routes/shipmentImageRoutes')
const adminRoutes = require('./routes/admin');
// app.use(cors());
const corsOptions = {
  origin: ['https://driver.jioyatri.com','https://jioyatri-admin.netlify.app'], // ✅ Allow your frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH'],
  credentials: true // Optional, only if you use cookies or tokens
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'authentication-e6bd0.appspot.com'
  });
}


// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));




app.use('/api/upload', uploadRoutes);
app.use('/api/driver',driverRoutes)
app.use('/api/shipments',ShipmentRoutes)
app.use('/api/address', addressRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/payment',paymentRoutes)
app.use('/api/settlement',settlement)
app.use('/api/user',userRoutes)
app.use('/api/shops',shopRoutes)
app.use('/api/orders', orderRoutes);
app.use('/api/shipment-images', shipmentImages);
app.use('/api/admin', adminRoutes);
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
