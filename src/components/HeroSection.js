import React, { useState, useEffect, useRef } from 'react';
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
import { FaTruckPickup, FaTruckMoving, FaStore } from 'react-icons/fa';
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
import { useLocation, useSearchParams } from 'react-router-dom';
import driver from '../assets/images/driver.png'
import partner from '../assets/images/business-partner.jpg'
const HeroSection = () => {
    const controls = useAnimation();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [otpResendTime, setOtpResendTime] = useState(0);
    const [showOtpComponent, setShowOtpComponent] = useState(false);
    const [otp, setOtp] = useState('');
    const { user, message, setMessage, softSignedOut, endSoftLogout, refreshUserMeta } = useAuth();
    const [registrationStep, setRegistrationStep] = useState(0); // Start with 0 for role selection
    const [registrationSubStep, setRegistrationSubStep] = useState(1);
    const [isValidPhone, setIsValidPhone] = useState(false);
    const [userRole, setUserRole] = useState(null); // 'driver' or 'business'
    const [checkingRegistration, setCheckingRegistration] = useState(true);
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
    const [referralCode, setReferralCode] = useState('');
    const [showReferralField, setShowReferralField] = useState(false);
    const navigate = useNavigate();
    const { ref, inView: isInView } = useInView({ triggerOnce: true });
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(
        localStorage.getItem('welcomeMessageShown') !== 'true'
    );
    const location = useLocation();
    const [sp] = useSearchParams();
    const hasRoutedRef = useRef(false);


    const TEST_PHONE = "+911234567898";
    const TEST_OTP = "1234";
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
    }, [user]); useEffect(() => {
        const key = userRole === 'business' ? 'shop_ref' : 'driver_ref'; const fromUrl = (sp.get(key) || '').toUpperCase();
        if (fromUrl) setReferralCode(fromUrl);
    }, [sp, userRole]);
    // useEffect(() => {
    //     const run = async () => {
    //         if (softSignedOut || !auth.currentUser) {
    //             setIsRegistered(false);
    //             setRegistrationStep(0);
    //             return;
    //         }

    //         const { isRegistered, role } = await checkRegistrationStatus();
    //         setIsRegistered(!!isRegistered);

    //         // ✅ Do not redirect when user is already on Home
    //         const onHome = location.pathname === '/' || location.pathname === '/home';

    //         if (isRegistered && role === 'business' && !onHome) {
    //             if (!hasRoutedRef.current) {
    //                 hasRoutedRef.current = true;
    //                 navigate('/business-dashboard', { replace: true });
    //             }
    //             return;
    //         }

    //         if (isRegistered && role === 'driver' && !onHome) {
    //             if (!hasRoutedRef.current) {
    //                 hasRoutedRef.current = true;
    //                 navigate('/orders', { replace: true });
    //             }
    //             return;
    //         }

    //         // If we're on Home, show the post-login UI instead of redirecting
    //         if (isRegistered) {
    //             setRegistrationStep(4);
    //         } else if (role) {
    //             setUserRole(role);
    //             setRegistrationStep(role === 'driver' ? 2 : 1);
    //         } else {
    //             setRegistrationStep(0);
    //         }
    //     };

    //     const unsub = auth.onAuthStateChanged(run);
    //     return () => unsub();
    // }, [softSignedOut, location.pathname]); // include pathname so it re-evaluates on Home clicks

    useEffect(() => {
  const run = async () => {
    setCheckingRegistration(true);
    if (softSignedOut || !auth.currentUser) {
      setIsRegistered(false);
      setRegistrationStep(0);
      setCheckingRegistration(false);
      return;
    }

    const { isRegistered, role } = await checkRegistrationStatus();
    setIsRegistered(!!isRegistered);
    setUserRole(role || null);

    const onHome = location.pathname === '/' || location.pathname === '/home';

    // ✅ Business: not registered → force /register
    if (role === 'business' && !isRegistered && location.pathname !== '/register') {
      if (!hasRoutedRef.current) {
        hasRoutedRef.current = true;
        navigate('/register', { replace: true });
      }
       setCheckingRegistration(false);
      return;
    }

    // ✅ Business: registered → dashboard (unless already on home)
    if (role === 'business' && isRegistered && !onHome) {
      if (!hasRoutedRef.current) {
        hasRoutedRef.current = true;
        navigate('/business-dashboard', { replace: true });
      }
      setCheckingRegistration(false);
      return;
    }

    // ✅ Driver: registered → orders
    if (role === 'driver' && isRegistered && !onHome) {
      if (!hasRoutedRef.current) {
        hasRoutedRef.current = true;
        navigate('/orders', { replace: true });
      }
      return;
    }

    // ✅ Driver: not registered → show driver wizard on Home
    if (role === 'driver') {
      setRegistrationStep(isRegistered ? 4 : 2);
       setCheckingRegistration(false);
      return;
    }

    // ✅ Generic fallback
    setRegistrationStep(isRegistered ? 4 : 0);
    setCheckingRegistration(false); 
  };

  const unsub = auth.onAuthStateChanged(run);
  return () => unsub();
}, [softSignedOut, location.pathname, navigate]);


    const variants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
    };

    const validatePhoneNumber = (value) => {
        const isValid = /^\+[1-9]\d{1,14}$/.test(value);
        setIsValidPhone(isValid);
        return isValid;
    };
    const persistRole = async (role) => {
        const idToken = await auth.currentUser.getIdToken();
        await fetch('https://jio-yatri-driver.onrender.com/api/user/set-role', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                userId: auth.currentUser.uid,
                role,
                phone: phoneNumber
            })
        });
    };
    const handlePhoneChange = (value, country) => {
        const formattedValue = value.startsWith('+') ? value : `+${value}`;
        setPhoneNumber(formattedValue);
        validatePhoneNumber(formattedValue);
    };

    const startResendTimer = () => {
        setOtpResendTime(300);
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

    // useEffect(() => {
    //     const run = async () => {

    //         if (softSignedOut || !auth.currentUser) {
    //             setIsRegistered(false);
    //             setRegistrationStep(0);
    //             return;
    //         }

    //         const { isRegistered } = await checkRegistrationStatus();
    //         setIsRegistered(!!isRegistered);
    //         setRegistrationStep(isRegistered ? 4 : 1);

    //     };

    //     run();

    //     const unsub = auth.onAuthStateChanged(async (u) => {
    //         if (softSignedOut || !u) {
    //             setIsRegistered(false);
    //             setRegistrationStep(0);
    //             return;
    //         }

    //         const { isRegistered, role } = await checkRegistrationStatus();
    //         setIsRegistered(!!isRegistered);
    //         setRegistrationStep(isRegistered ? 4 : (role === 'driver' ? 2 : 1));
    //     });

    //     return () => unsub();
    // }, [softSignedOut]);



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
        if (!userRole) {
            setMessage({ text: 'Please select a role first.', isError: true });
            return;
        }
        if (!validatePhoneNumber(phoneNumber)) {
            setMessage({
                text: 'Please enter a valid international phone number (e.g., +91XXXXXXXXXX)',
                isError: true
            });
            return;
        }

        if (phoneNumber === TEST_PHONE) {
            setMessage({ text: `OTP sent to ${phoneNumber} (Test Mode)`, isError: false });
            setShowOtpComponent(true);
            startResendTimer();
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
        if (!userRole) {
            setMessage({ text: 'Please select a role first.', isError: true });
            return;
        }
        if (!otp || otp.length !== 4) {
            setMessage({ text: 'Please enter a 4-digit code', isError: true });
            return;
        }

        try {
            setIsLoading(true);
            const data = await handleApiRequest(`https://jio-yatri-driver.onrender.com/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber,
                    otp: phoneNumber === TEST_PHONE ? TEST_OTP : otp,
                    referralCode: referralCode || undefined,
                    role: userRole,// Include the user role in the verification

                })
            });

            const userCredential = await signInWithCustomToken(auth, data.token);
            setMessage({ text: 'Verification successful!', isError: false });
            setShowOtpComponent(false);

            // Redirect business partners to their registration
            // Persist the role we selected on the server
            await persistRole(userRole);

            // Reload role + registration into context+   await refreshUserMeta(auth.currentUser);
            const meta = await refreshUserMeta(auth.currentUser);

            endSoftLogout();

            // Navigate based on role/registration
            if (meta.role === 'business') {
                if (referralCode) {
                    localStorage.setItem('shopReferralCode', referralCode.toUpperCase());
                }
                navigate(meta.businessRegistered ? '/business-dashboard' : '/register', { replace: true });
            } else if (meta.role === 'driver') {
                setUserRole('driver');
                if (meta.driverRegistered) {
                    if (!hasRoutedRef.current) hasRoutedRef.current = true;
                    navigate('/orders', { replace: true });
                } else {
                    setShowOtpComponent(false);
                    setIsRegistered(false);
                    setRegistrationStep(2); // show driver wizard
                    setDriverData(prev => ({ ...prev, phone: phoneNumber }));
                }
            }
        }  catch (error) {
            setMessage({
                text: error.message || 'OTP verification failed',
                isError: true
            });
        } finally {
            setIsLoading(false);
        }
    };

    // after verifyOtp()

    // ✅ Auto-verify when OTP is fully entered or auto-filled
useEffect(() => {
  // Ensure OTP modal is visible, 4 digits entered, and no current verification running
  if (showOtpComponent && otp.length === 4 && !isLoading) {
    const timer = setTimeout(() => {
      verifyOtp(); // trigger verification automatically
    }, 200); // small delay to ensure autofill completes

    return () => clearTimeout(timer); // cleanup if OTP changes fast
  }
}, [otp, showOtpComponent]);




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

    // const checkRegistrationStatus = async () => {
    //     try {
    //         const user = auth.currentUser;
    //         if (!user) return false;

    //         const storedRegistration = localStorage.getItem(`driverRegistered_${user.uid}`);
    //         if (storedRegistration === 'true') return true;

    //         const token = await user.getIdToken();
    //         const response = await fetch(`http://localhost:5000/api/driver/check/${user.uid}`, {
    //             method: 'GET',
    //             headers: {
    //                 'Authorization': `Bearer ${token}`
    //             }
    //         });

    //         if (response.ok) {
    //             const data = await response.json();
    //             if (data.exists) {
    //                 localStorage.setItem(`driverRegistered_${user.uid}`, 'true');
    //                 setDriverData(prev => ({
    //                     ...prev,
    //                     name: data.driver?.name || user.displayName || '',
    //                     phone: data.driver?.phone || user.phoneNumber || '',
    //                     vehicleType: data.driver?.vehicleType || '',
    //                     vehicleNumber: data.driver?.vehicleNumber || ''
    //                 }));
    //                 return true;
    //             }
    //         }
    //         return false;
    //     } catch (error) {
    //         console.error('Error checking registration:', error);
    //         return false;
    //     }
    // };
    const checkRegistrationStatus = async () => {
        try {
            const u = auth.currentUser;
            if (!u) return { isRegistered: false, role: null };

            const token = await u.getIdToken();
            const res = await fetch(
                `https://jio-yatri-driver.onrender.com/api/user/check-registration/${u.uid}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!res.ok) return { isRegistered: false, role: null };
            const json = await res.json();
            if (!json.success) return { isRegistered: false, role: null };

            const { role, driverRegistered, businessRegistered } = json.data;

            let isRegistered = false;
            if (role === 'driver') {
                isRegistered = !!driverRegistered;
            } else if (role === 'business') {
                isRegistered = !!businessRegistered;
            }

            setIsRegistered(isRegistered);
            localStorage.setItem('isRegistered', isRegistered ? '1' : '0');
            localStorage.setItem('userRole', role || '');

            // OPTIONAL: if you want to prefill driver fields after a positive check:
            if (isRegistered && role === 'driver') {
                const res2 = await fetch(
                    `https://jio-yatri-driver.onrender.com/api/driver/profile/${u.uid}`, // or your existing driver GET endpoint
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (res2.ok) {
                    const d = await res2.json();
                    setDriverData(prev => ({
                        ...prev,
                        name: d.driver?.name || u.displayName || '',
                        phone: d.driver?.phone || u.phoneNumber || '',
                        vehicleType: d.driver?.vehicleType || '',
                        vehicleNumber: d.driver?.vehicleNumber || ''
                    }));
                }
            }

            return { isRegistered, role };
        } catch (error) {
            console.error('Error checking registration:', error);
            return { isRegistered: false, role: null };
        }
    };



    // useEffect(() => {
    //     const checkAuthAndRegistration = async () => {
    //         try {
    //             const user = auth.currentUser;
    //             if (user) {
    //                 const token = await user.getIdToken();
    //                 localStorage.setItem('token', token);

    //                 const isRegistered = await checkRegistrationStatus();
    //                 setIsRegistered(isRegistered);
    //                 if (isRegistered) {
    //                     setRegistrationStep(4);
    //                 } else {
    //                     setRegistrationStep(1);
    //                 }
    //             }
    //         } catch (error) {
    //             console.error('Initial check error:', error);
    //         }
    //     };

    //     checkAuthAndRegistration();

    //     const unsubscribe = auth.onAuthStateChanged(async (user) => {
    //         if (user) {
    //             const isRegistered = await checkRegistrationStatus();
    //             setIsRegistered(isRegistered);
    //             if (isRegistered) {
    //                 setRegistrationStep(4);
    //             } else {
    //                 setRegistrationStep(1);
    //             }
    //         } else {
    //             setIsRegistered(false);
    //             setRegistrationStep(0); // Reset to role selection
    //         }
    //     });

    //     return () => unsubscribe();
    // }, []);

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
                    insuranceFileId: driverData.insuranceFileId,
                    referralCode: referralCode || undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Registration failed');
            }

            localStorage.setItem(`driverRegistered_${userId}`, 'true');
            setIsRegistered(true);
            setMessage({ text: 'Registration successful!', isError: false });
            if (!hasRoutedRef.current) hasRoutedRef.current = true;     // optional guard
            navigate('/orders', { replace: true });
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
            localStorage.removeItem('userRole');
            localStorage.removeItem('isRegistered');
            setRegistrationStep(0); // Reset to role selection
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
            navigate('/home', { replace: true });
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
                        <div className="step-infos">
                            <div className="step-numbers">Step {step.number}</div>
                            <div className="step-titles">{step.title}</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const RoleSelection = () => (
        <div className="role-selection-container">
            <h3>Join as</h3>
            <div className="role-options">
                <button
                    className="role-option driver"
                    onClick={() => {
                        setUserRole('driver');
                        setRegistrationStep(1);
                    }}
                >
                  
                  
                    <img src={driver} style={{ width: "50px" ,height:"50px" ,marginBottom:"10px" }} alt="Driver" />
                    <span>Driver</span>
                    <p>Deliver packages and earn money</p>
                </button>
                <button
                    className="role-option business"
                    onClick={() => {
                        setUserRole('business');
                        setRegistrationStep(1);
                    }}
                >
                   
            
                        <img src={partner} style={{ width: "80px" ,height:"60px" ,marginBottom:"10px" }} alt="Partner" />
                    <span>Business Partner</span>
                    <p>List your business and reach more customers</p>
                </button>
            </div>
        </div>
    );

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
                        <h1>JIOYATRI</h1>
                        <h2>Delivery</h2>
                    </div>
                    <h2>Drive, Deliver & Earn with Jioyatri</h2>
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
                    {checkingRegistration ? (
    <div className="loading-role">
        <div className="loading-circle"></div>
    </div>
) : registrationStep === 0 ? (
                        <RoleSelection />
                    ) : registrationStep === 1 ? (
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

                            <div className="referral-toggle" onClick={() => setShowReferralField(!showReferralField)}>
                                {showReferralField ? 'Hide referral code' : 'Have a referral code?'}
                            </div>
                            {showReferralField && (
                                <div className="form-group">
                                    <input
                                        type="text"
                                        placeholder="Enter referral code (optional)"
                                        value={referralCode}
                                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                        className="referral-input"
                                        maxLength="10"
                                    />
                                </div>
                            )}
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

                           <form autoComplete="one-time-code"> {/* Helps iOS autofill */}
  <div className="otp-container">
    {[...Array(4)].map((_, index) => (
      <input
        key={index}
        type="text"
        maxLength="1"
        value={otp[index] || ''}
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, '');
          let newOtp = otp.split('');

          // ✅ If user pastes entire OTP (e.g. “1234”), auto-fill all boxes
          if (value.length > 1) {
            const digits = value.slice(0, 4).split('');
            setOtp(digits.join(''));
            return;
          }

          newOtp[index] = value;
          setOtp(newOtp.join('').slice(0, 4));

          // Move focus to next input automatically
          if (value && index < 3) {
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
        pattern="\d*"
        name={index === 0 ? 'otp' : undefined}           // ✅ add only on first box
        autoComplete={index === 0 ? 'one-time-code' : undefined} // ✅ add only on first box
      />
    ))}
  </div>
</form>


                            {message.isError && (
                                <div className="otp-error">
                                    {message.text}
                                </div>
                            )}

                            <button
                                onClick={verifyOtp}
                                disabled={isLoading || otp.length !== 4}
                                className={`otp-button ${isLoading || otp.length !== 4 ? 'disabled' : ''}`}
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
                                className="cancell-button"
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
