import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { MdEmail, MdDirectionsCar, MdTwoWheeler, MdLocalShipping } from 'react-icons/md';
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { auth, googleProvider, storage } from '../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FaUpload } from 'react-icons/fa';
import 'react-phone-input-2/lib/style.css';
import '../styles/HeroSection.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
    const controls = useAnimation();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showOtpComponent, setShowOtpComponent] = useState(false);
    const [otp, setOtp] = useState('');
    const { user, message, setMessage } = useAuth();
    const [registrationStep, setRegistrationStep] = useState(1);
    const [registrationSubStep, setRegistrationSubStep] = useState(1);
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

    useEffect(() => {
        if (isInView) {
            controls.start('visible');
        }
    }, [isInView, controls]);

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
            const response = await fetch(`http://localhost:5000/api/driver/check/${user.uid}`, {
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

    const verifyOtp = async () => {
        if (otp.length !== 6) {
            setMessage({ text: 'Please enter a 6-digit code.', isError: true });
            return;
        }

        try {
            setIsLoading(true);
            setMessage({ text: 'Verifying code...', isError: false });

            const result = await confirmationResult.confirm(otp);
            await storeToken(result.user);

            setMessage({ text: 'Verification successful!', isError: false });
            setShowOtpComponent(false);
            setPhoneNumber('');
            setOtp('');
            setRegistrationStep(2);
            setDriverData(prev => ({
                ...prev,
                phone: result.user.phoneNumber || ''
            }));
        } catch (error) {
            setMessage({ text: 'Verification failed: ' + error.message, isError: true });
        } finally {
            setIsLoading(false);
        }
    };

    const sendCode = async () => {
        try {
            setIsLoading(true);
            setMessage({ text: 'Sending verification code...', isError: false });

            const formattedPhoneNumber = phoneNumber.startsWith('+')
                ? phoneNumber
                : `+91${phoneNumber.replace(/\D/g, '')}`;

            if (formattedPhoneNumber.length < 12) {
                throw new Error('Please enter a valid phone number');
            }

            if (!window.recaptchaVerifier) {
                initializeRecaptcha();
            }

            const confirmation = await signInWithPhoneNumber(auth, formattedPhoneNumber, window.recaptchaVerifier);
            setConfirmationResult(confirmation);

            setMessage({ text: `Verification code sent to ${formattedPhoneNumber}`, isError: false });
            setShowOtpComponent(true);
        } catch (error) {
            console.error('Error sending code:', error);
            setMessage({ text: `Failed to send code: ${error.message}`, isError: true });
            resetRecaptcha();
        } finally {
            setIsLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        try {
            setIsLoading(true);
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            setDriverData({
                ...driverData,
                name: user.displayName || '',
                phone: user.phoneNumber || '',
                email: user.email || '',
                photoURL: user.photoURL 
            });
            await storeToken(user);
            setMessage({ text: 'Google sign-in successful!', isError: false });
            setRegistrationStep(2);
        } catch (error) {
            console.error('Google sign-in error:', error);
            setMessage({ text: `Google sign-in failed: ${error.message}`, isError: true });
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
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', auth.currentUser.uid);
            formData.append('docType', type);

            const response = await fetch('http://localhost:5000/api/upload/file', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setDriverData(prev => ({
                    ...prev,
                    [`${type}File`]: file,
                    [`${type}FileId`]: result.fileId
                }));
                setMessage({ text: `${type.toUpperCase()} uploaded successfully!`, isError: false });
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            setMessage({ text: error.message, isError: true });
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

            const response = await fetch('http://localhost:5000/api/driver/register', {
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
                                <input
                                    type="tel"
                                    placeholder="Enter phone number"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className={`input ${message.isError ? 'error' : ''}`}
                                />
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
                                                className={`vehicle-btn ${driverData.vehicleType === 'bike' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'bike' })}
                                            >
                                                <MdTwoWheeler /> Bike
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'van' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'van' })}
                                            >
                                                <MdDirectionsCar /> Van
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'truck' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'truck' })}
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
                    ) : (
                        <div className="welcome-container">
                            <h3>Welcome, {driverData.name}!</h3>
                            <p>You're now registered as a driver with vehicle number: {driverData.vehicleNumber}</p>
                            <button
                                onClick={handleLogout}
                                className="logout-btn"
                            >
                                Logout
                            </button>
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
                            <input
                                type="text"
                                placeholder="6-digit code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="otp-input"
                                maxLength={6}
                            />
                            <button
                                onClick={verifyOtp}
                                disabled={isLoading}
                                className={`otp-button ${isLoading ? 'disabled' : ''}`}
                            >
                                {isLoading ? 'Verifying...' : 'Verify Code'}
                            </button>
                            <button
                                onClick={() => setShowOtpComponent(false)}
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