const admin = require('firebase-admin');
const crypto = require('crypto');
const sendSms = require('../services/otpService');
const axios = require('axios');


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

    const TEST_PHONE = "+911234567899";
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


module.exports = { sendOtp, verifyOtp };





