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
const serviceAccount = require('./config/firebase-service-account.json');
const verifyFirebaseToken=require('./middleware/verifyFirebaseToken')
const addressRoutes=require('./routes/addressRoutes')
const authRoutes=require('./routes/authRoutes')


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'authentication-e6bd0.appspot.com'
});

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


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
