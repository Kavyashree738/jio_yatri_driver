const admin = require('firebase-admin');
const crypto = require('crypto');
const sendSms = require('../services/otpService');
const axios = require('axios');
const Shipment = require('../models/Shipment');
const User=require('../models/UserRole')
const Driver=require('../models/Driver')
const Shop=require('../models/CategoryModel')
const saveImageFromUrl = require("../utils/saveImageFromUrl");

const sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    console.log('Received OTP request for:', phoneNumber);

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'missing_phone_number',
        message: 'Phone number is required',
      });
    }

    // E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_phone_format',
        message: 'Please provide phone number in international format (+[country code][number])',
      });
    }

    // Check for recent OTP
     const recentOtp = await admin.firestore().collection('otps').doc(phoneNumber).get();
     const lastSentAt = recentOtp.exists ? recentOtp.data().lastSentAt?.toMillis?.() : 0;
   if (lastSentAt && lastSentAt > Date.now() - 300_000) {
      return res.status(429).json({
        success: false,
        error: 'otp_already_sent',
        message: 'Please wait before requesting a new OTP',
      });
    }

    // Generate and store OTP
    const otp = crypto.randomInt(1000, 10000); 
    const ttl = 5 * 60 * 1000; // 5 minutes

     await admin.firestore().collection('otps').doc(phoneNumber).set({
      otp,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + ttl),
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSentAt: admin.firestore.FieldValue.serverTimestamp(), 
    });


    // Custom SMS message format
    const smsMessage = `Hello ${phoneNumber}, Please find your OTP ${otp} for Jioyatri. Thanks, AmbaniYatri`;
    
    // Send SMS
    await sendSms(phoneNumber, smsMessage);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (error) {
    console.error('Error in sendOtp:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to send OTP. Please try again.',
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    const TEST_PHONE = "+911234567898";
    const TEST_OTP = "1234";
    
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'Phone number and OTP are required',
      });
    }

    if (phoneNumber === TEST_PHONE) {
      if (otp !== TEST_OTP) {
        return res.status(400).json({
          success: false,
          error: 'invalid_otp',
          message: 'Invalid test OTP entered',
        });
      }

      // Check if test user exists or create new
      const testUid = `test-${TEST_PHONE}`;
      let user;
      try {
        user = await admin.auth().getUser(testUid);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          user = await admin.auth().createUser({
            uid: testUid,
            phoneNumber: TEST_PHONE,
            displayName: 'Test User'
          });
        } else {
          throw error;
        }
      }

      const token = await admin.auth().createCustomToken(user.uid);

      return res.status(200).json({
        success: true,
        token,
        user: {
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          isTestUser: true
        },
      });
    }


    const otpDoc = await admin.firestore().collection('otps').doc(phoneNumber).get();

    if (!otpDoc.exists) {
      return res.status(400).json({
        success: false,
        error: 'invalid_otp',
        message: 'OTP expired or not requested',
      });
    }

    const { otp: storedOtp, expiresAt, attempts } = otpDoc.data();

    if (attempts >= 3) {
      return res.status(400).json({
        success: false,
        error: 'too_many_attempts',
        message: 'Too many attempts. Please request a new OTP.',
      });
    }

    if (expiresAt.toMillis() < Date.now()) {
      await otpDoc.ref.delete();
      return res.status(400).json({
        success: false,
        error: 'otp_expired',
        message: 'OTP expired. Please request a new one.',
      });
    }

    if (storedOtp.toString() !== otp.toString()) {
      await otpDoc.ref.update({ attempts: attempts + 1 });
      return res.status(400).json({
        success: false,
        error: 'invalid_otp',
        message: 'Invalid OTP entered',
      });
    }

    await otpDoc.ref.delete();

    let user;
    try {
      user = await admin.auth().getUserByPhoneNumber(phoneNumber);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        user = await admin.auth().createUser({ phoneNumber });
      } else {
        throw error;
      }
    }

    const token = await admin.auth().createCustomToken(user.uid);

    res.status(200).json({
      success: true,
      token,
      user: {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    res.status(500).json({
      success: false,
      error: 'verification_failed',
      message: 'OTP verification failed. Please try again.',
    });
  }
};

const sendReceiverOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const shipment = await Shipment.findById(id);

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    const receiverPhone = shipment.receiver?.phone;
    if (!receiverPhone) {
      return res.status(400).json({ success: false, message: 'Receiver phone number not found' });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Save OTP in shipment
    shipment.deliveryOtp = otp;
    shipment.deliveryOtpVerified = false;
    await shipment.save();

    // Send SMS to receiver
    const smsMessage = `Hello ${receiverPhone}, Please find your OTP ${otp} for jioyatri. Thanks, AmbaniYatri`;
    await sendSms(receiverPhone, smsMessage);

    console.log(`📦 Delivery OTP ${otp} sent to receiver ${receiverPhone}`);

    res.json({ success: true, message: 'OTP sent to receiver successfully!' });
  } catch (error) {
    console.error('Error sending receiver OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};


const verifyReceiverOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    const shipment = await Shipment.findById(id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Compare OTP
    if (shipment.deliveryOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Mark verified
    shipment.deliveryOtpVerified = true;
    shipment.deliveryOtp = null;
    await shipment.save();

    res.json({ success: true, message: 'Receiver OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying receiver OTP:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};


const googleLogin = async (req, res) => {
  try {
    console.log("\n===============================");
    console.log("📥 GOOGLE LOGIN API HIT (DRIVER)");
    console.log("===============================\n");

    const { firebaseToken, referralCode, role } = req.body;

    console.log("📌 Received Data:", {
      firebaseTokenExists: !!firebaseToken,
      referralCode,
      role
    });

    if (!firebaseToken || !role) {
      console.log("❌ Missing firebaseToken or role");
      return res.status(400).json({
        success: false,
        message: "firebaseToken and role are required"
      });
    }

    // 1️⃣ Verify Firebase token
    console.log("🔍 Verifying Firebase token...");
    const decoded = await admin.auth().verifyIdToken(firebaseToken);

    const firebaseUid = decoded.uid;
    const email = decoded.email || "";
    const name = decoded.name || "";
    const googlePhotoUrl = decoded.picture || null;

    console.log("✅ Firebase Token Decoded:", {
      firebaseUid,
      email,
      name,
      googlePhotoUrl
    });

    // ⭐ Download Google profile image (if exists)
    let googleProfileImage = null;
    if (googlePhotoUrl) {
      console.log("📸 Fetching Google profile image...");
      googleProfileImage = await saveImageFromUrl(googlePhotoUrl);
      console.log("📸 Image saved successfully:", googleProfileImage);
    }

    console.log("🔎 Checking if user exists in MongoDB...");

    // 🔥 FIXED SEARCH — find user using uid or userId
    let user = await User.findOne({
      $or: [{ uid: firebaseUid }, { userId: firebaseUid }]
    });

    if (!user) {
      console.log("🆕 No user found → Creating new user document...");

      user = await User.create({
        uid: firebaseUid,
        userId: firebaseUid,
        email,
        name,
        role,
        googleProvider: true,
        referredBy: referralCode || null,
        photo: googleProfileImage
      });

      console.log("🎉 New MongoDB user created:", {
        _id: user._id,
        uid: user.uid,
        role: user.role
      });
    } else {
      console.log("👤 Existing user found:", {
        _id: user._id,
        uid: user.uid,
        role: user.role
      });

      // 🔄 Update existing user
      user.uid = firebaseUid;
      user.userId = firebaseUid;
      user.role = role;

      if (googleProfileImage) {
        user.photo = googleProfileImage;
        console.log("📸 Updated Google profile image for user");
      }

      await user.save();

      console.log("🔄 User updated successfully:", {
        _id: user._id,
        role: user.role
      });
    }

    // 3️⃣ If driver role, update driver model
    if (role === "driver") {
      console.log("🚚 Checking driver record...");
      let driver = await Driver.findOne({ userId: firebaseUid });

      if (driver && googleProfileImage) {
        driver.profileImage = googleProfileImage;
        await driver.save();
        console.log("📸 Driver profile image saved to driver model");
      } else {
        console.log("⚠ No driver document found or no new image");
      }
    }

    // 4️⃣ Create Firebase custom token
    console.log("🎟 Creating Firebase Custom Token...");
    const customToken = await admin.auth().createCustomToken(firebaseUid);
    console.log("🎟 Custom Token Created Successfully");

    // 5️⃣ Response
    console.log("\n🚀 Sending Response Back To Client...\n");

    return res.status(200).json({
      success: true,
      firebaseToken: customToken,
      user
    });

  } catch (error) {
    console.error("❌ Google Login Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




module.exports = { sendOtp, verifyOtp,sendReceiverOtp,verifyReceiverOtp,googleLogin };












