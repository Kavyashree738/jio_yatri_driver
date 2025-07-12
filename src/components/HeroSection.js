import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FcGoogle } from 'react-icons/fc';
import { FaApple, FaCheck, FaUpload } from 'react-icons/fa';
import { FaCloudUploadAlt } from "react-icons/fa";
import { MdOutlineTwoWheeler } from "react-icons/md";
import {
    MdEmail,
    MdDirectionsCar,
    MdTwoWheeler,
    MdLocalShipping,
    MdPerson,
    MdCreditCard,
    MdDirectionsBike,
    MdDescription
} from 'react-icons/md';
import { GiPickupTruck } from 'react-icons/gi';
import { IoCloudDone } from "react-icons/io5";
import { FaTruckPickup, FaTruckMoving } from 'react-icons/fa';
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
import 'react-phone-input-2/lib/style.css';
import '../styles/HeroSection.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import delivery from '../assets/images/delivery-service.png';

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
        aadharFile: null,
        panFile: null,
        phone: '',
        vehicleType: '',
        vehicleNumber: '',
        vehicleRCFile: null,
        vehicleInsuranceFile: null,
        licenseFile: null,
        licenseFileId: null,
        rcFileId: null,
        insuranceFileId: null,
        aadharFileId: null,
        panFileId: null
    });
    const [fileUploadProgress, setFileUploadProgress] = useState({
        aadhar: 0,
        pan: 0,
        license: 0,
        rc: 0,
        insurance: 0
    });
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
            const shouldShowWelcome = localStorage.getItem('welcomeMessageShown') !== 'true';
            setShowWelcomeMessage(shouldShowWelcome);

            if (shouldShowWelcome) {
                timer = setTimeout(() => {
                    setShowWelcomeMessage(false);
                    localStorage.setItem('welcomeMessageShown', 'true');
                }, 1000);
            }
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [user]);

    const variants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
    };

    const validatePhoneNumber = (value) => {
        const isValid = /^\+[1-9]\d{1,14}$/.test(value);
        setIsValidPhone(isValid);
        return isValid;
    };

    const handlePhoneChange = (value, country) => {
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
            setIsLoading(true);
            setMessage({ text: `Uploading ${type} file...`, isError: false });

            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }

            const token = await user.getIdToken(true);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', user.uid);
            formData.append('docType', type);

            // Track upload progress
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    setFileUploadProgress(prev => ({
                        ...prev,
                        [type]: progress
                    }));
                }
            });

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
        } finally {
            setIsLoading(false);
            setFileUploadProgress(prev => ({
                ...prev,
                [type]: 0
            }));
        }
    };

    const validateVehicleNumber = (number) => {
        const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
        return regex.test(number);
    };

    const handleNextStep = () => {
        if (registrationSubStep === 1) {
            if (!driverData.name) {
                setMessage({ text: 'Please enter your full name', isError: true });
                return;
            }
            if (!driverData.aadharFileId) {
                setMessage({ text: 'Please upload Aadhar card', isError: true });
                return;
            }
            if (!driverData.panFileId) {
                setMessage({ text: 'Please upload PAN card', isError: true });
                return;
            }
        } else if (registrationSubStep === 2) {
            if (!driverData.vehicleType) {
                setMessage({ text: 'Please select vehicle type', isError: true });
                return;
            }
            if (!driverData.vehicleNumber) {
                setMessage({ text: 'Please enter vehicle number', isError: true });
                return;
            }
            if (!validateVehicleNumber(driverData.vehicleNumber)) {
                setMessage({ text: 'Please enter a valid vehicle number (e.g., KA01AB1234)', isError: true });
                return;
            }
            if (!driverData.rcFileId) {
                setMessage({ text: 'Please upload RC document', isError: true });
                return;
            }
            if (!driverData.insuranceFileId) {
                setMessage({ text: 'Please upload insurance document', isError: true });
                return;
            }
        }
        setRegistrationSubStep(registrationSubStep + 1);
    };

    const handlePrevStep = () => {
        setRegistrationSubStep(registrationSubStep - 1);
    };

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
                        setRegistrationStep(4);
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
                    setRegistrationStep(4);
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
                    aadharFileId: driverData.aadharFileId,
                    panFileId: driverData.panFileId,
                    vehicleType: driverData.vehicleType,
                    vehicleNumber: driverData.vehicleNumber,
                    licenseFileId: driverData.licenseFileId,
                    rcFileId: driverData.rcFileId,
                    insuranceFileId: driverData.insuranceFileId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Registration failed');
            }

            localStorage.setItem(`driverRegistered_${userId}`, 'true');
            setIsRegistered(true);
            setMessage({ text: 'Registration successful!', isError: false });
            setRegistrationStep(4);
        } catch (error) {
            if (error.message.includes('duplicate key')) {
                localStorage.setItem(`driverRegistered_${auth.currentUser.uid}`, 'true');
                setIsRegistered(true);
                setRegistrationStep(4);
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
                aadharFile: null,
                panFile: null,
                phone: '',
                vehicleType: '',
                vehicleNumber: '',
                licenseFile: null,
                rcFile: null,
                insuranceFile: null,
                licenseFileId: null,
                rcFileId: null,
                insuranceFileId: null,
                aadharFileId: null,
                panFileId: null
            });
            setMessage({ text: 'Logged out successfully', isError: false });
        } catch (error) {
            setMessage({ text: 'Logout failed: ' + error.message, isError: true });
        }
    };
    const StepIndicator = ({ currentStep }) => {
        const steps = [
            { number: 1, title: 'Owner', icon: <MdPerson /> },
            { number: 2, title: 'Vehicle', icon: <MdDirectionsCar /> },
            { number: 3, title: 'Driver', icon: <MdCreditCard /> }
        ];

        return (
            <div className="step-indicator">
                {steps.map((step) => (
                    <div
                        key={step.number}
                        className={`step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
                    >
                        <div className="step-icon">{step.icon}</div>
                        <div className="step-info">
                            <div className="step-number">Step {step.number}</div>
                            <div className="step-title">{step.title}</div>
                        </div>
                    </div>
                ))}
            </div>
        );
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
                    <h2>Drive, Deliver & Earn with JioYatri</h2>
                    <p>
                        Join our trusted driver network and earn by delivering packages across 19,000+ destinations in India. Flexible timings, secure payouts, and a seamless delivery experience.
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
                            <StepIndicator currentStep={registrationSubStep} />

                            {registrationSubStep === 1 && (
                                <>
                                    <div className="form-group floating-input">
                                        <input
                                            type="text"
                                            value={driverData.name}
                                            onChange={(e) => setDriverData({ ...driverData, name: e.target.value })}
                                            placeholder="Full Name"
                                            required
                                            id="name-input"
                                        />
                                        <label htmlFor="name-input">Full Name</label>
                                    </div>

                                    <div className="document-upload-row">
                                        <div className="document-upload-group">
                                            <span className="document-label">Owner Aadhar Card*</span>
                                            <label htmlFor="aadhar-upload" className="document-upload-btn">
                                                <FaUpload className="upload-icon" />
                                                <input
                                                    type="file"
                                                    id="aadhar-upload"
                                                    accept="image/*,.pdf"
                                                    onChange={(e) => handleFileUpload(e.target.files[0], 'aadhar')}
                                                    hidden

                                                />
                                            </label>
                                        </div>
                                        {driverData.aadharFileId && (
                                            <div className="uploaded-indicator">
                                                <IoCloudDone className="uploaded-icon" />
                                                <span>Uploaded</span>
                                            </div>
                                        )}
                                        {fileUploadProgress.aadhar > 0 && fileUploadProgress.aadhar < 100 && (
                                            <progress value={fileUploadProgress.aadhar} max="100" />
                                        )}
                                    </div>

                                    <div className="document-upload-row">
                                        <div className="document-upload-group">
                                            <span className="document-label">Owner PAN Card*</span>
                                            <label htmlFor="pan-upload" className="document-upload-btn">
                                                <FaUpload className="upload-icon" />
                                                <input
                                                    type="file"
                                                    id="pan-upload"
                                                    accept="image/*,.pdf"
                                                    onChange={(e) => handleFileUpload(e.target.files[0], 'pan')}
                                                    hidden
                                                />
                                            </label>
                                        </div>
                                        {driverData.panFileId && (
                                            <div className="uploaded-indicator">
                                                <IoCloudDone className="uploaded-icon" />
                                                <span>Uploaded</span>
                                            </div>
                                        )}
                                        {fileUploadProgress.pan > 0 && fileUploadProgress.pan < 100 && (
                                            <progress value={fileUploadProgress.pan} max="100" />
                                        )}
                                    </div>

                                    <div className="form-navigation">
                                        <button
                                            onClick={handleNextStep}
                                            className="next-btn"
                                            disabled={!driverData.name || !driverData.aadharFileId || !driverData.panFileId}
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
                                                <MdOutlineTwoWheeler /> Two Wheeler
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'ThreeWheeler' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'ThreeWheeler' })}
                                            >
                                                <MdDirectionsCar /> Three Wheeler
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'Truck' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'Truck' })}
                                            >
                                                <MdLocalShipping /> Truck
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'Pickup9ft' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'Pickup9ft' })}
                                            >
                                                <FaTruckPickup /> Pickup9ft
                                            </button>
                                            <button
                                                type="button"
                                                className={`vehicle-btn ${driverData.vehicleType === 'Tata407' ? 'active' : ''}`}
                                                onClick={() => setDriverData({ ...driverData, vehicleType: 'Tata407' })}
                                            >
                                                <FaTruckMoving /> Tata407
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Vehicle Number</label>
                                        <input
                                            type="text"
                                            value={driverData.vehicleNumber}
                                            onChange={(e) => setDriverData({ ...driverData, vehicleNumber: e.target.value.toUpperCase() })}
                                            placeholder="e.g., KA01AB1234"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Vehicle RC Document</label>
                                        <div className="document-upload-row">
                                            <div className="document-upload-group">
                                                <span className="document-label">vehicle RC</span>
                                                <label htmlFor="rc-upload" className="document-upload-btn">
                                                    <FaUpload className="upload-icon" />
                                                    <input
                                                        type="file"
                                                        id="rc-upload"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            const file = e.target.files[0];
                                                            if (file) handleFileUpload(file, 'rc');
                                                        }}
                                                        hidden
                                                    />
                                                </label>
                                            </div>
                                            {driverData.rcFileId && (
                                                <div className="uploaded-indicator">
                                                    <IoCloudDone className="uploaded-icon" />
                                                    <span>Uploaded</span>
                                                </div>
                                            )}
                                            {fileUploadProgress.rc > 0 && fileUploadProgress.rc < 100 && (
                                                <progress value={fileUploadProgress.rc} max="100" />
                                            )}
                                        </div>

                                        {/* <small className="hint">Upload a clear photo/scan of your vehicle RC (JPEG, PNG, PDF)</small> */}
                                    </div>

                                    <div className="form-group">
                                        <label>Vehicle Insurance</label>
                                        <div className="document-upload-row">
                                            <div className="document-upload-group">
                                                <span className="document-label">Vehicle Insurance</span>
                                                <label htmlFor="insurance-upload" className="document-upload-btn">
                                                    <FaUpload className="upload-icon" />
                                                    <input
                                                        type="file"
                                                        id="insurance-upload"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            const file = e.target.files[0];
                                                            if (file) handleFileUpload(file, 'insurance');
                                                        }}
                                                        hidden
                                                    />
                                                </label>
                                            </div>
                                            {driverData.insuranceFileId && (
                                                <div className="uploaded-indicator">
                                                    <IoCloudDone className="uploaded-icon" />
                                                    <span>Uploaded</span>
                                                </div>
                                            )}
                                            {fileUploadProgress.insurance > 0 && fileUploadProgress.insurance < 100 && (
                                                <progress value={fileUploadProgress.insurance} max="100" />
                                            )}
                                        </div>
                                        {/* <small className="hint">Upload a clear photo/scan of your vehicle insurance (JPEG, PNG, PDF)</small> */}
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
                                            disabled={
                                                !driverData.vehicleType ||
                                                !driverData.vehicleNumber ||
                                                !driverData.rcFileId ||
                                                !driverData.insuranceFileId ||
                                                fileUploadProgress.rc > 0 ||
                                                fileUploadProgress.insurance > 0
                                            }
                                        >
                                            Next
                                        </button>
                                    </div>
                                </>
                            )}

                            {registrationSubStep === 3 && (
                                <>
                                    <div className="form-group">
                                        {/* <label>Phone Number*</label> */}
                                        <PhoneInput
                                            country={'in'}
                                            value={driverData.phone}
                                            onChange={(value) => {
                                                const formattedValue = value.startsWith('+') ? value : `+${value}`;
                                                setDriverData({ ...driverData, phone: formattedValue });
                                            }}
                                            placeholder="+91 9876543210"
                                            inputClass="phone-input"
                                            containerClass="phone-input-container"
                                        />
                                    </div>

                                    <div className="form-group">
                                        {/* <label>Driver License</label> */}

                                        <div className="document-upload-row">
                                            <div className="document-upload-group">
                                                <span className="document-label">Driver License</span>
                                                <label htmlFor="license-upload" className="document-upload-btn">
                                                    <FaUpload className="upload-icon" />
                                                    <input
                                                        type="file"
                                                        id="license-upload"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => handleFileUpload(e.target.files[0], 'license')}
                                                        hidden
                                                    />
                                                </label>
                                            </div>
                                            {driverData.licenseFileId && (
                                                <div className="uploaded-indicator">
                                                    <IoCloudDone className="uploaded-icon" />
                                                    <span>Uploaded</span>
                                                </div>
                                            )}
                                            {fileUploadProgress.license > 0 && fileUploadProgress.license < 100 && (
                                                <progress value={fileUploadProgress.license} max="100" />
                                            )}
                                        </div>

                                        {/* <small className="hint">Upload a clear photo/scan of your driver's license (JPEG, PNG, PDF)</small> */}
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
                                            disabled={isSubmitting || !driverData.phone || !driverData.licenseFileId}
                                            className="submit-btn"
                                        >
                                            {isSubmitting ? 'Registering...' : 'Register'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : registrationStep === 4 && showWelcomeMessage ? (
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

                                            if (e.target.value && index < 5) {
                                                document.getElementById(`otp-input-${index + 1}`).focus();
                                            }
                                        }}
                                        onKeyDown={(e) => {
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
