import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { MdEmail, MdDirectionsCar, MdTwoWheeler, MdLocalShipping } from 'react-icons/md';
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signInWithCustomToken,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { auth, googleProvider, storage } from '../firebase';
import PhoneInput from 'react-phone-input-2';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FaUpload } from 'react-icons/fa';
import 'react-phone-input-2/lib/style.css';
import '../styles/HeroSection.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import delivery from '../assets/images/delivery-service.png'
const HeroSection = () => {
    const controls = useAnimation();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [otpResendTime, setOtpResendTime] = useState(0);
    const [showOtpComponent, setShowOtpComponent] = useState(false);
    const [otp, setOtp] = useState('');
    const { user, message, setMessage } = useAuth();
    const [registrationStep, setRegistrationStep] = useState(1);
    const [registrationSubStep, setRegistrationSubStep] = useState(1);
    const [isValidPhone, setIsValidPhone] = useState(false);
    const [driverData, setDriverData] = useState({
        name: '',
        phone: '',
        vehicleType: '',
        vehicleNumber: '',
        licenseFile: null,
        rcFile: null,
        licenseFileId: null,
        rcFileId: null
    });
    const [fileUploadProgress, setFileUploadProgress] = useState({ license: 0, rc: 0 });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const navigate = useNavigate();
    const { ref, inView: isInView } = useInView({ triggerOnce: true });
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(
        localStorage.getItem('welcomeMessageShown') !== 'true'
    );

    useEffect(() => {
        if (isInView) {
            controls.start('visible');
        }
    }, [isInView, controls]);
    useEffect(() => {
        let timer;

        if (user) {
            // Only show welcome message if it hasn't been shown before
            const shouldShowWelcome = localStorage.getItem('welcomeMessageShown') !== 'true';
            setShowWelcomeMessage(shouldShowWelcome);

            if (shouldShowWelcome) {
                // Set timeout to hide welcome message after 1 minute (60000ms)
                timer = setTimeout(() => {
                    setShowWelcomeMessage(false);
                    localStorage.setItem('welcomeMessageShown', 'true');
                }, 1000);
            }
        }

        // Cleanup the timer when component unmounts or user changes
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [user]);
    const validatePhoneNumber = (value) => {
        // Strict validation for E.164 format
        const isValid = /^\+[1-9]\d{1,14}$/.test(value);
        setIsValidPhone(isValid);
        return isValid;
    };

    const handlePhoneChange = (value, country) => {
        // Force international format
        const formattedValue = value.startsWith('+') ? value : `+${value}`;
        setPhoneNumber(formattedValue);
        validatePhoneNumber(formattedValue);
    };

    const startResendTimer = () => {
        setOtpResendTime(30);
        const timer = setInterval(() => {
            setOtpResendTime((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => {
        const checkAuthAndRegistration = async () => {
            try {
                const user = auth.currentUser;
                if (user) {
                    const token = await user.getIdToken();
                    localStorage.setItem('token', token);

                    const isRegistered = await checkRegistrationStatus();
                    setIsRegistered(isRegistered);
                    if (isRegistered) {
                        setRegistrationStep(3);
                    } else {
                        setRegistrationStep(2);
                    }
                }
            } catch (error) {
                console.error('Initial check error:', error);
            }
        };

        checkAuthAndRegistration();

        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                const isRegistered = await checkRegistrationStatus();
                setIsRegistered(isRegistered);
                if (isRegistered) {
                    setRegistrationStep(3);
                } else {
                    setRegistrationStep(2);
                }
            } else {
                setIsRegistered(false);
                setRegistrationStep(1);
            }
        });

        return () => unsubscribe();
    }, []);

    const checkRegistrationStatus = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return false;

            const storedRegistration = localStorage.getItem(`driverRegistered_${user.uid}`);
            if (storedRegistration === 'true') return true;

            const token = await user.getIdToken();
            const response = await fetch(`https://jio-yatri-driver.onrender.com/api/driver/check/${user.uid}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.exists) {
                    localStorage.setItem(`driverRegistered_${user.uid}`, 'true');
                    setDriverData(prev => ({
                        ...prev,
                        name: data.driver?.name || user.displayName || '',
                        phone: data.driver?.phone || user.phoneNumber || '',
                        vehicleType: data.driver?.vehicleType || '',
                        vehicleNumber: data.driver?.vehicleNumber || ''
                    }));
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking registration:', error);
            return false;
        }
    };

    const variants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
    };

    const initializeRecaptcha = () => {
        try {
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    size: 'invisible',
                    callback: () => {
                        console.log('reCAPTCHA verified');
                    },
                    'expired-callback': () => {
                        setMessage({ text: 'Security check expired. Please try again.', isError: true });
                        resetRecaptcha();
                    },
                });
            }
        } catch (error) {
            console.error('reCAPTCHA initialization failed:', error);
            setMessage({
                text: 'Failed to initialize security check. Please refresh the page.',
                isError: true,
            });
        }
    };

    const resetRecaptcha = () => {
        if (window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier.clear();
                window.recaptchaVerifier = null;
            } catch (error) {
                console.error('Error resetting reCAPTCHA:', error);
            }
        }
        initializeRecaptcha();
    };

    useEffect(() => {
        initializeRecaptcha();
        return () => {
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = null;
                } catch (error) {
                    console.error('Error cleaning up reCAPTCHA:', error);
                }
            }
        };
    }, []);

    const storeToken = async (user) => {
        try {
            const token = await user.getIdToken();
            localStorage.setItem('token', token);
            console.log('Token stored successfully');
        } catch (error) {
            console.error('Error storing token:', error);
        }
    };

    const handleApiRequest = async (url, options) => {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Request failed');
        }
        return response.json();
    };

    const sendCode = async () => {
        if (!validatePhoneNumber(phoneNumber)) {
            setMessage({
                text: 'Please enter a valid international phone number (e.g., +91XXXXXXXXXX)',
                isError: true
            });
            return;
        }

        try {
            setIsLoading(true);
            setMessage({ text: '', isError: false });

            const data = await handleApiRequest(`https://jio-yatri-driver.onrender.com/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber })
            });

            console.log(data)
            console.log(phoneNumber)
            setMessage({
                text: `OTP sent to ${phoneNumber}`,
                isError: false
            });
            setShowOtpComponent(true);
            startResendTimer();

            if (process.env.NODE_ENV === 'development' && data.otp) {
                console.log(`[DEV] OTP: ${data.otp}`);
            }
        } catch (error) {
            setMessage({
                text: error.message || 'Failed to send OTP',
                isError: true
            });
        } finally {
            setIsLoading(false);
        }
    };

    const verifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            setMessage({ text: 'Please enter a 6-digit code', isError: true });
            return;
        }

        try {
            setIsLoading(true);
            const data = await handleApiRequest(`https://jio-yatri-driver.onrender.com/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber,
                    otp
                })
            });

            const userCredential = await signInWithCustomToken(auth, data.token);
            setMessage({ text: 'Verification successful!', isError: false });
            setShowOtpComponent(false);
        } catch (error) {
            setMessage({
                text: error.message || 'OTP verification failed',
                isError: true
            });
        } finally {
            setIsLoading(false);
        }
    };

    const resendOtp = async () => {
        if (otpResendTime > 0) return;
        await sendCode();
    };

    const signInWithGoogle = async () => {
        try {
            setIsLoading(true);
            const result = await signInWithPopup(auth, googleProvider);
            setMessage({ text: 'Google sign-in successful!', isError: false });
        } catch (error) {
            setMessage({
                text: `Google sign-in failed: ${error.message}`,
                isError: true
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (file, type) => {
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            setMessage({ text: 'Only JPEG, PNG, or PDF files allowed', isError: true });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ text: 'File size must be less than 5MB', isError: true });
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            const token = await user.getIdToken(true);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', user.uid);
            formData.append('docType', type);

            const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/file', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            const result = await response.json();

            setDriverData(prev => ({
                ...prev,
                [`${type}File`]: file,
                [`${type}FileId`]: result.fileId
            }));
            setMessage({ text: `${type.toUpperCase()} uploaded successfully!`, isError: false });
        } catch (error) {
            console.error('Upload error:', error);
            setMessage({ text: error.message || 'File upload failed', isError: true });
        }
    };

    const validateVehicleNumber = (number) => {
        const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
        return regex.test(number);
    };

    const handleNextStep = () => {
        if (registrationSubStep === 1) {
            if (!driverData.name || !driverData.phone) {
                setMessage({ text: 'Please fill in all required fields', isError: true });
                return;
            }
        } else if (registrationSubStep === 2) {
            if (!driverData.vehicleType || !driverData.vehicleNumber) {
                setMessage({ text: 'Please fill in all vehicle details', isError: true });
                return;
            }
            if (!validateVehicleNumber(driverData.vehicleNumber)) {
                setMessage({ text: 'Please enter a valid vehicle number (e.g., KA01AB1234)', isError: true });
                return;
            }
        }
        setRegistrationSubStep(registrationSubStep + 1);
    };

    const handlePrevStep = () => {
        setRegistrationSubStep(registrationSubStep - 1);
    };

    const submitDriverRegistration = async () => {
        try {
            setIsSubmitting(true);
            setMessage({ text: 'Registering your account...', isError: false });

            const token = await auth.currentUser.getIdToken();
            const userId = auth.currentUser.uid;

            const response = await fetch('https://jio-yatri-driver.onrender.com/api/driver/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: userId,
                    name: driverData.name,
                    phone: driverData.phone,
                    vehicleType: driverData.vehicleType,
                    vehicleNumber: driverData.vehicleNumber,
                    licenseFileId: driverData.licenseFileId,
                    rcFileId: driverData.rcFileId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Registration failed');
            }

            localStorage.setItem(`driverRegistered_${userId}`, 'true');
            setIsRegistered(true);
            setMessage({ text: 'Registration successful!', isError: false });
            setRegistrationStep(3);
        } catch (error) {
            if (error.message.includes('duplicate key')) {
                localStorage.setItem(`driverRegistered_${auth.currentUser.uid}`, 'true');
                setIsRegistered(true);
                setRegistrationStep(3);
                setMessage({ text: 'You are already registered!', isError: true });
            } else {
                setMessage({ text: error.message, isError: true });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('token');
            localStorage.removeItem(`driverRegistered_${auth.currentUser?.uid}`);
            setRegistrationStep(1);
            setRegistrationSubStep(1);
            setIsRegistered(false);
            setDriverData({
                name: '',
                phone: '',
                vehicleType: '',
                vehicleNumber: '',
                licenseFile: null,
                rcFile: null,
                licenseFileId: null,
                rcFileId: null
            });
            setMessage({ text: 'Logged out successfully', isError: false });
        } catch (error) {
            setMessage({ text: 'Logout failed: ' + error.message, isError: true });
        }
    };

    return (
        <section className="hero-section" id="hero">
            <div className="hero-bg-blur" />
            <div className="hero-content-wrapper" ref={ref}>
                <motion.div
                    className="hero-text"
                    initial="hidden"
                    animate={controls}
                    variants={variants}
                    transition={{ duration: 0.8 }}
                >
                    <div className="text">
                        <h1>JIO YATRI</h1>
                        <h2>Delivery</h2>
                    </div>
                    <h2>Door-to-Door Intercity Courier from Bangalore</h2>
                    <p>
                        Connect with 19,000+ destinations across India through our smooth and affordable courier service.
                    </p>
                </motion.div>

                <motion.div
                    className="hero-image"
                    initial="hidden"
                    animate={controls}
                    variants={variants}
                    transition={{ duration: 0.8, delay: 0.3 }}
                >
                    {registrationStep === 1 ? (
                        <form className="registration-form hero-form" onSubmit={(e) => e.preventDefault()}>
                            <h3>Register Now</h3>

                            <div className="phone-input-group">
                                <PhoneInput
                                    country={'in'}
                                    value={phoneNumber}
                                    onChange={handlePhoneChange}
                                    placeholder="+91 9876543210"
                                    inputClass={`phone-input ${!isValidPhone && phoneNumber ? 'error' : ''}`}
                                    containerClass="phone-input-container"
                                />
                                {!isValidPhone && phoneNumber && (
                                    <p className="phone-error-message">
                                        Please enter in international format (e.g., +91XXXXXXXXXX)
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={sendCode}
                                type="button"
                                disabled={!phoneNumber || isLoading}
                                className={`button ${(!phoneNumber || isLoading) ? 'disabled' : ''}`}
                            >
                                {isLoading ? 'Sending...' : 'Send Verification Code'}
                            </button>

                            <div className="divider">or</div>

                            <div className="social-buttons">
                                <button type="button" className="google-btn" onClick={signInWithGoogle}>
                                    <FcGoogle className="social-icon" />
                                    <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
                                </button>
                                <button type="button" className="apple-btn">
                                    <FaApple className="social-icon" size={20} />
                                    <span>Continue with Apple</span>
                                </button>
                                <button type="button" className="email-btn">
                                    <MdEmail className="social-icon" size={20} />
                                    <span>Continue with Email</span>
                                </button>
                            </div>
                        </form>
                    ) : registrationStep === 2 ? (
                        <div className="driver-registration-form">
                            <h3>Complete Driver Profile ({registrationSubStep}/3)</h3>

                            {registrationSubStep === 1 && (
                                <>
                                    <div className="form-group">
                                        <label>Full Name*</label>
                                        <input
                                            type="text"
                                            value={driverData.name}
                                            onChange={(e) => setDriverData({ ...driverData, name: e.target.value })}
                                            placeholder="Enter full name"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Phone Number*</label>
                                        <input
                                            type="tel"
                                            value={driverData.phone}
                                            onChange={(e) => setDriverData({ ...driverData, phone: e.target.value })}
                                            placeholder="Enter phone number"
                                            required
                                        />
                                    </div>

                                    <div className="form-navigation">
                                        <button
                                            onClick={handleNextStep}
                                            className="next-btn"
                                            disabled={!driverData.name || !driverData.phone}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </>
                            )}

                            {registrationSubStep === 2 && (
                                <>
                                    <div className="form-group">
                                        <label>Vehicle Type*</label>
                                        <div className="vehicle-options">
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'TwoWheeler' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'TwoWheeler' })}
                                            >
                                                <MdTwoWheeler /> TwoWheeler
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'ThreeWheeler' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'ThreeWheeler' })}
                                            >
                                                <MdDirectionsCar /> ThreeWheeler
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'Truck' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'Truck' })}
                                            >
                                                <MdLocalShipping /> Truck
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Vehicle Number*</label>
                                        <input
                                            type="text"
                                            value={driverData.vehicleNumber}
                                            onChange={(e) => setDriverData({ ...driverData, vehicleNumber: e.target.value.toUpperCase() })}
                                            placeholder="e.g., KA01AB1234"
                                            required
                                        />
                                    </div>

                                    <div className="form-navigation">
                                        <button
                                            onClick={handlePrevStep}
                                            className="prev-btn"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleNextStep}
                                            className="next-btn"
                                            disabled={!driverData.vehicleType || !driverData.vehicleNumber}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </>
                            )}

                            {registrationSubStep === 3 && (
                                <>
                                    <div className="form-group">
                                        <label>Driver License*</label>
                                        <div className="file-upload">
                                            <input
                                                type="file"
                                                id="license-upload"
                                                accept="image/*,.pdf"
                                                onChange={(e) => handleFileUpload(e.target.files[0], 'license')}
                                                hidden
                                            />
                                            <label htmlFor="license-upload" className="upload-btn">
                                                <FaUpload /> {driverData.licenseFile ? 'Uploaded' : 'Upload License'}
                                            </label>
                                            {fileUploadProgress.license > 0 && fileUploadProgress.license < 100 && (
                                                <progress value={fileUploadProgress.license} max="100" />
                                            )}
                                        </div>
                                        <small className="hint">Upload a clear photo/scan of your driver's license (JPEG, PNG, PDF)</small>
                                    </div>

                                    <div className="form-group">
                                        <label>Vehicle RC*</label>
                                        <div className="file-upload">
                                            <input
                                                type="file"
                                                id="rc-upload"
                                                accept="image/*,.pdf"
                                                onChange={(e) => handleFileUpload(e.target.files[0], 'rc')}
                                                hidden
                                            />
                                            <label htmlFor="rc-upload" className="upload-btn">
                                                <FaUpload /> {driverData.rcFile ? 'Uploaded' : 'Upload RC'}
                                            </label>
                                            {fileUploadProgress.rc > 0 && fileUploadProgress.rc < 100 && (
                                                <progress value={fileUploadProgress.rc} max="100" />
                                            )}
                                        </div>
                                        <small className="hint">Upload a clear photo/scan of your vehicle RC (JPEG, PNG, PDF)</small>
                                    </div>

                                    <div className="form-navigation">
                                        <button
                                            onClick={handlePrevStep}
                                            className="prev-btn"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={submitDriverRegistration}
                                            disabled={isSubmitting || !driverData.licenseFile || !driverData.rcFile}
                                            className="submit-btn"
                                        >
                                            {isSubmitting ? 'Registering...' : 'Complete Registration'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : showWelcomeMessage ? (
                        <div className="welcome-message">
                            <h3>Login Successful!</h3>
                            <p>You can now access all features.</p>
                        </div>
                    ) : (
                        <div className="post-login-image">
                            <img
                                src={delivery}
                                alt="Welcome to our service"
                                className="login-success-img"
                            />
                        </div>
                    )}

                    <div id="recaptcha-container" style={{ visibility: 'hidden' }}></div>

                    {message.text && (
                        <div className={`message ${message.isError ? 'error' : 'success'}`}>
                            {message.text}
                        </div>
                    )}
                </motion.div>

                {showOtpComponent && (
                    <div className="otp-overlay">
                        <div className="otp-modal">
                            <h3 className="otp-title">Enter Verification Code</h3>
                            <p className="otp-subtitle">Sent to {phoneNumber}</p>

                            {/* 6-digit OTP input boxes */}
                            <div className="otp-container">
                                {[...Array(6)].map((_, index) => (
                                    <input
                                        key={index}
                                        type="text"
                                        maxLength="1"
                                        value={otp[index] || ''}
                                        onChange={(e) => {
                                            const newOtp = otp.split('');
                                            newOtp[index] = e.target.value.replace(/\D/g, '');
                                            setOtp(newOtp.join('').slice(0, 6));

                                            // Auto focus next input
                                            if (e.target.value && index < 5) {
                                                document.getElementById(`otp-input-${index + 1}`).focus();
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            // Handle backspace to move to previous input
                                            if (e.key === 'Backspace' && !otp[index] && index > 0) {
                                                document.getElementById(`otp-input-${index - 1}`).focus();
                                            }
                                        }}
                                        className={`otp-input ${otp[index] ? 'filled' : ''}`}
                                        id={`otp-input-${index}`}
                                        inputMode="numeric"
                                    />
                                ))}
                            </div>

                            {message.isError && (
                                <div className="otp-error">
                                    {message.text}
                                </div>
                            )}

                            <button
                                onClick={verifyOtp}
                                disabled={isLoading || otp.length !== 6}
                                className={`otp-button ${isLoading || otp.length !== 6 ? 'disabled' : ''}`}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner"></span> Verifying...
                                    </>
                                ) : (
                                    'Verify Code'
                                )}
                            </button>

                            <button
                                onClick={resendOtp}
                                disabled={otpResendTime > 0}
                                className="resend-button"
                            >
                                {otpResendTime > 0 ? `Resend in ${otpResendTime}s` : 'Resend Code'}
                            </button>

                            <button
                                onClick={() => {
                                    setShowOtpComponent(false);
                                    setOtp('');
                                    setMessage({ text: '', isError: false });
                                }}
                                className="cancel-button"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default HeroSection;
