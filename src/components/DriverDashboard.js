import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaPhone, FaToggleOn, FaToggleOff, FaCar, FaYoutube, FaStar, FaCheck, FaTimes } from 'react-icons/fa';
import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
import Header from './Header';
import Footer from './Footer';
import LocationTracker from './LocationTracker';
import AvailableShipments from './AvailableShipments';
import '../styles/DriverDashboard.css';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import moment from 'moment';
import ImageCropper from './ImageCropper';
import { FaUpload } from 'react-icons/fa'
import useDriverHeartbeat from '../hooks/useDriverHeartbeat';
import img from '../assets/images/avatar.jpg'
import 'moment/locale/en-in'; // Import the locale you need
import DailyEarningsFilter from './DailyEarningsFilter';
import HelplineButton from './HelplineButton';
// import useDriverHeartbeat from '../hooks/useDriverHeartbeat';
// Initialize moment with the desired locale
moment.locale('en-in');

const DriverDashboard = () => {
    const { user, setMessage } = useAuth();
    const navigate = useNavigate();
    const [driverInfo, setDriverInfo] = useState(null);
    const [shipments, setShipments] = useState([]);
    const [settlement, setSettlement] = useState({
        today: { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
        pending: []
    });
    const [isOnline, setIsOnline] = useState(true);
    // useDriverHeartbeat(user, isOnline);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('inactive');
    useDriverHeartbeat(user, status === 'active');
    const [isUpdating, setIsUpdating] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [isRegistered, setIsRegistered] = useState(true);
    const [pollingInterval, setPollingInterval] = useState(null);
    const [marqueeActive, setMarqueeActive] = useState(false);
    const [marqueeText] = useState('Earn ₹10 Cashback');
    const [fatal, setFatal] = useState(null);


    const [passbookUploaded, setPassbookUploaded] = useState(false);
    const passbookInputRef = useRef(null);


    // 👇 add this near your other useStates
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);




    const [cropMode, setCropMode] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const [showUploadOptions, setShowUploadOptions] = useState(false);


    const loadRazorpay = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleSettlementPayment = async (settlementId, amount) => {
        try {
            const token = await user.getIdToken();

            // Step 1: Ask backend to create Razorpay order
            const res = await axios.post(
                ` https://jio-yatri-driver.onrender.com/api/settlement/initiate-payment`,
                { settlementId, amount },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const order = res.data.order;

            // Step 2: Load Razorpay
            const loaded = await loadRazorpay();
            if (!loaded) throw new Error('Razorpay SDK failed to load');

            const options = {
                key: process.env.REACT_APP_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: "Owner Settlement",
                description: `Settlement Payment`,
                order_id: order.id,
                handler: async function (response) {
                    // ✅ Step 3: Verify payment with backend (ONLY ONCE)
                    await axios.post(
                        ` https://jio-yatri-driver.onrender.com/api/settlement/verify-payment`,
                        {
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            settlementId,
                            driverId: user.uid,
                            amount // ✅ pass driverToOwner value
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );

                    setMessage({ text: 'Payment successful. Settlement cleared.', isError: false });
                    fetchDriverInfo(); // refresh settlements
                },
                prefill: {
                    name: driverInfo?.name,
                    contact: driverInfo?.phone
                },
                theme: { color: "#3399cc" }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err) {
            console.error(err);
            setMessage({ text: err.message, isError: true });
        }
    };



    const fetchDriverInfo = useCallback(async () => {
        try {
            const token = await user.getIdToken();

            // First check for pending settlements
            const settlementCheckRes = await fetch(
                ` https://jio-yatri-driver.onrender.com/api/settlement/check-settlement/${user.uid}`,
                {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (!settlementCheckRes.ok) {
                throw new Error('Failed to check settlements');
            }

            // Then fetch all driver data
            const [driverRes, imageRes, settlementRes] = await Promise.all([
                fetch(` https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(` https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(` https://jio-yatri-driver.onrender.com/api/settlement/driver/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (driverRes.status === 404) {
                setIsRegistered(false);
                setLoading(false);
                return;
            }

            if (!driverRes.ok) throw new Error('Failed to fetch driver info');

            const driverData = await driverRes.json();
            const settlementData = await settlementRes.json();

            // 🧭 Debugging logs
            console.log("✅ Driver info:", driverData.data);
            console.log("📄 Document verification from backend:", driverData.data.documentVerification);


            setDriverInfo(driverData.data);
            setPassbookUploaded(!!driverData.data?.passbook);
            setStatus(driverData.data?.status || 'inactive');
            setSettlement({
                today: settlementData.currentDaySettlement || {
                    cashCollected: 0,
                    onlineCollected: 0,
                    driverEarned: 0,
                    ownerEarned: 0
                },
                pending: settlementData.pending || []
            });

            try {
                if (imageRes.ok) {
                    const blob = await imageRes.blob();
                    if (blob.size > 0) {
                        const imageUrl = URL.createObjectURL(blob);
                        setProfileImage(imageUrl);
                    } else {
                        setProfileImage(img); // 🟢 fallback to imported default image
                    }
                } else if (user.photoURL) {
                    setProfileImage(user.photoURL);
                } else {
                    setProfileImage(img); // 🟢 fallback to imported default image
                }
            } catch (imgErr) {
                console.warn('⚠️ Profile image fetch failed:', imgErr.message);
                setProfileImage(img); // 🟢 always fallback to default image
            }


        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
    if (!window.DriverStatus) {
        console.warn("⚠️ DriverStatus bridge not available yet");
        return;
    }

    if (status === "active") {
        console.log("🔵 Sync ONLINE with Flutter (status change)");
        window.DriverStatus.postMessage("online");
    } else {
        console.log("🔴 Sync OFFLINE with Flutter (status change)");
        window.DriverStatus.postMessage("offline");
    }
}, [status]);

    // 🔑 Send Firebase ID Token to Flutter so Android can use it
useEffect(() => {
    const sendTokenToFlutter = async () => {
        if (!DriverAuth) {
    console.warn("⚠️ DriverAuth bridge not ready");
    return;
}


        try {
            const token = await user.getIdToken(true);
            console.log("🔑 Sending ID token → Flutter");
DriverAuth.postMessage(token);

        } catch (err) {
            console.error("❌ Failed to get token:", err);
        }
    };

    if (status === "active" && user) {
        sendTokenToFlutter();
    }
}, [status, user]);


    // 🔄 AUTO-REFRESH TOKEN every 45 minutes and send to Flutter
useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
        try {
            const newToken = await user.getIdToken(true); // force refresh
            console.log("♻️ Auto-refreshed token → sending to Flutter");

            if (window.DriverAuth) {
                DriverAuth.postMessage(newToken);

            }
        } catch (err) {
            console.error("❌ Error refreshing token:", err);
        }
    }, 45 * 60 * 1000); // every 45 minutes

    return () => clearInterval(interval);
}, [user]);



    useEffect(() => {
        const onErr = (e) => {
            const msg = e?.message || e?.error?.message || String(e);
            const file = e?.filename ? ` @ ${e.filename}:${e.lineno || ''}:${e.colno || ''}` : '';
            setFatal(`${msg}${file}`);
        };

        const onRej = (e) => {
            const reason = e?.reason;
            const msg = (reason && (reason.message || reason.toString())) || 'Unhandled promise rejection';
            const stack = reason?.stack ? `\n${reason.stack}` : '';
            setFatal(`${msg}${stack}`);
        };

        window.addEventListener('error', onErr);
        window.addEventListener('unhandledrejection', onRej);

        return () => {
            window.removeEventListener('error', onErr);
            window.removeEventListener('unhandledrejection', onRej);
        };
    }, []);


    useEffect(() => {
        if (!user) return;

        fetchDriverInfo();

        const fetchShipments = async () => {
            try {
                const token = await user.getIdToken();
                const res = await axios.get(` https://jio-yatri-driver.onrender.com/api/shipments/driver/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setShipments(res.data || []);
            } catch (err) {
                console.error('Error fetching shipments:', err.message);
            }
        };

        fetchShipments();
    }, [user, fetchDriverInfo]);

    // 🔄 Polling to auto-refresh settlements
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            fetchDriverInfo(); // keep checking settlements & driver info
        }, 10000); // every 10 seconds (set 5000 for 5 seconds)

        return () => clearInterval(interval); // cleanup on unmount
    }, [user, fetchDriverInfo]);

    useEffect(() => {
        const interval = setInterval(() => {
            // Toggle marquee every 8 seconds (4s static, 4s animation)
            setMarqueeActive(prev => !prev);
        }, 8000);

        return () => clearInterval(interval);
    }, [])

    // const allDocumentsVerified = useMemo(() => {
    //     if (!driverInfo?.documentVerification) return false;
    //     return Object.values(driverInfo.documentVerification).every(
    //         status => status === 'verified'
    //     );
    // }, [driverInfo]);
    const allDocumentsVerified = useMemo(() => {
        if (!driverInfo?.documentVerification) return false;
        return Object.entries(driverInfo.documentVerification)
            .filter(([key]) => !['verificationStatus', 'verificationNotes'].includes(key))
            .every(([_, status]) => status.trim().toLowerCase() === 'verified');
    }, [driverInfo]);



    const completedDeliveries = useMemo(() => {
        return shipments.filter(s => s.status?.toLowerCase() === 'delivered').length;
    }, [shipments]);

    const toggleStatus = async () => {
        const newStatus = status === 'active' ? 'inactive' : 'active';
        setIsUpdating(true);
        try {
            const token = await user.getIdToken(true);
            const res = await fetch(' https://jio-yatri-driver.onrender.com/api/driver/status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error('Failed to update status');
            setStatus(newStatus);
            setDriverInfo(prev => ({
                ...prev,
                status: newStatus,
                lastUpdated: new Date().toISOString()
            }));
            setMessage({ text: 'Status updated', isError: false });

            if (window.DriverStatus) {
            if (newStatus === 'active') {
                window.DriverStatus.postMessage('online');
                console.log('📡 Sent online → Flutter');
            } else {
                window.DriverStatus.postMessage('offline');
                console.log('📡 Sent offline → Flutter');
            }
        } else {
            console.warn('⚠️ Flutter DriverStatus bridge not available');
        }
        } catch (err) {
            setMessage({ text: err.message, isError: true });
        } finally {
            setIsUpdating(false);
        }
    };
    // 📸 Handles both PDF and Image selection (camera or file)
    const handlePassbookSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf';

        if (isPDF) {
            // Direct upload if it's a PDF
            handlePassbookUpload(file);
        } else if (isImage) {
            // Open cropper for image
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageToCrop(reader.result);
                setShowCropper(true);
            };
            reader.readAsDataURL(file);
        } else {
            setMessage({ text: 'Only image or PDF files are allowed.', isError: true });
        }
    };

    const handleShareClick = async () => {
        try {
            const token = await user.getIdToken();
            navigate('/refferal', {
                state: {
                    token
                }
            });
        } catch (error) {
            console.error('Error getting token:', error);
            navigate('/refferal');
        }
    };

    // const handlePassbookUpload = async (e) => {
    //     const file = e.target.files[0];
    //     if (!file) return;

    //     try {
    //         const token = await user.getIdToken();
    //         const formData = new FormData();
    //         formData.append('file', file);

    //         const res = await fetch('http://localhost:5000/api/passbook/upload-passbook', {
    //             method: 'POST',
    //             headers: { Authorization: `Bearer ${token}` },
    //             body: formData
    //         });

    //         if (!res.ok) throw new Error('Passbook upload failed');
    //         const data = await res.json();

    //         setPassbookUploaded(true);
    //         setMessage({ text: 'Passbook uploaded successfully', isError: false });
    //     } catch (err) {
    //         console.error('Error uploading passbook:', err);
    //         setMessage({ text: err.message, isError: true });
    //     }
    // };
    // 🆕 Updated to receive File directly (no event)
    const handlePassbookUpload = async (file) => {
        if (!file) return;

        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('https://jio-yatri-driver.onrender.com/api/passbook/upload-passbook', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Passbook upload failed');

            setPassbookUploaded(true);
            setMessage({ text: 'Passbook uploaded successfully', isError: false });
        } catch (err) {
            console.error('Error uploading passbook:', err);
            setMessage({ text: err.message, isError: true });
        }
    };
    // ✅ Called after cropping done
    const handleCroppedPassbook = async (croppedImageUrl) => {
        setShowCropper(false);

        const response = await fetch(croppedImageUrl);
        const blob = await response.blob();
        const croppedFile = new File([blob], 'passbook.jpg', { type: 'image/jpeg' });

        await handlePassbookUpload(croppedFile);
        setImageToCrop(null);
    };


    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) {
            console.log('No file selected');
            return;
        }

        if (!file.type.match('image.*')) {
            setError('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image size should be less than 5MB');
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setSelectedImage(previewUrl);
        setCropMode(true); // ✅ Opens cropper popup
    };

    const handleCropComplete = async (croppedImageUrl) => {
        setCropMode(false);
        setProfileImage(croppedImageUrl);

        const blob = await fetch(croppedImageUrl).then((r) => r.blob());
        const formData = new FormData();
        formData.append('file', blob, 'profile.jpg');

        const token = await user.getIdToken(true);

        try {
            const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/profile-image', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            await fetchDriverInfo();
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setMessage({ text: 'Logged out', isError: false });
            navigate('/');
        } catch (error) {
            setMessage({ text: error.message, isError: true });
        }
    };

    const handleYoutubeClick = () => {
        window.open('https://youtube.com/@ambaninewstv?si=PBGWaPOKXdjV-Oa4', '_blank');
    };


    // const handleSettlePayment = async (settlementId, amount, direction) => {
    //     try {
    //         const token = await user.getIdToken();
    //         await axios.post(`http://localhost:5000/api/settlement/complete/${user.uid}`, {
    //             settlementId,
    //             amount,
    //             direction
    //         }, {
    //             headers: { Authorization: `Bearer ${token}` }
    //         });

    //         // Refresh settlement data
    //         const res = await axios.get(`http://localhost:5000/api/settlement/driver/${user.uid}`, {
    //             headers: { Authorization: `Bearer ${token}` }
    //         });

    //         setSettlement({
    //             today: res.data.currentDaySettlement || { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
    //             pending: res.data.pending || []
    //         });

    //         setMessage({ text: 'Payment settled successfully', isError: false });
    //     } catch (err) {
    //         setMessage({ text: err.message, isError: true });
    //     }
    // };

    // ✅ NEW (no DB mutation)
    const handleSettlePayment = async (settlementId, amount, direction) => {
        try {
            // If you want, you can notify owner via a non-mutating endpoint.
            // Otherwise just show a toast/snackbar message:
            setMessage({ text: 'Thanks! The owner will confirm your settlement shortly.', isError: false });

            // Optionally re-fetch settlements to show it is still "pending"
            const token = await user.getIdToken();
            const res = await axios.get(` https://jio-yatri-driver.onrender.com/api/settlement/driver/${user.uid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSettlement({
                today: res.data.currentDaySettlement || { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
                pending: res.data.pending || []
            });
        } catch (err) {
            setMessage({ text: err.message, isError: true });
        }
    };


    const getVehicleIcon = () => {
        if (!driverInfo?.vehicleType) return <MdDirectionsCar />;

        switch (driverInfo.vehicleType.toLowerCase()) {
            case 'twowheeler': return <MdDirectionsBike />;
            case 'threewheeler': return <span role="img" aria-label="Three Wheeler">🛺</span>;
            case 'truck': return <MdLocalShipping />;
            case 'pickup9ft': return <span role="img" aria-label="Pickup">🛻</span>;
            case 'tata407': return <span role="img" aria-label="Truck">🚛</span>;
            default: return <MdDirectionsCar />;
        }
    };

    const handleUploadClick = () => {
        const choice = window.confirm("Click OK to open Camera or Cancel to choose from Files");

        if (choice) {
            document.getElementById("cameraInput").click(); // Opens Camera
        } else {
            document.getElementById("fileInput").click(); // Opens Files/Gallery
        }
    };



    const renderRatingStars = () => {
        const rating = driverInfo?.ratings?.average || 0;
        return (
            <div className="dd-rating-stars">
                {[...Array(5)].map((_, i) => (
                    <FaStar key={i} className={`dd-star ${i < Math.floor(rating) ? 'dd-filled' : ''}`} />
                ))}
                <span className="dd-rating-text">{rating > 0 ? `${rating.toFixed(1)}/5` : 'Not rated yet'}</span>
            </div>
        );
    };

    const renderDocumentStatus = () => {
        if (!driverInfo?.documentVerification) return null;

        return (
            <div className="dd-document-status">
                <h3>Document Verification Status</h3>
                {Object.entries(driverInfo.documentVerification).map(([docType, status]) => (
                    <div key={docType} className={`dd-doc-item ${status}`}>
                        <span>{docType.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span>
                            {status === 'verified' ? (
                                <FaCheck className="dd-verified" />
                            ) : (
                                <FaTimes className="dd-pending" />
                            )}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    // 🚨 Block dashboard if pending settlements exist
    // 🚨 Block dashboard if pending settlements exist
    if (settlement?.pending?.length > 0) {
        return (
            <>
                <Header />
                <div className="pending-overlay">
                    <div className="pending-modal">
                        <h2 className="pending-title">Pending Settlements</h2>
                        <p className="pending-message">
                            You have pending settlements. Please clear them first.
                            Once the owner confirms your payment, your dashboard will unlock automatically.
                        </p>

                        <div className="pending-list">
                            {settlement.pending.map(item => (
                                <div key={item._id} className="pending-item">
                                    <span className="pending-date">{moment(item.date).format('MMM D')}:</span>
                                    {item.driverToOwner > 0 && (
                                        <button
                                            className="settle-btn"
                                            onClick={() => handleSettlementPayment(item._id, item.driverToOwner)}
                                        >
                                            Pay Owner: ₹{(item.driverToOwner || 0).toFixed(2)}
                                        </button>
                                    )}

                                    {item.ownerToDriver > 0 && (
                                        <span className="pending-receive">
                                            Receive: ₹{(item.ownerToDriver || 0).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button onClick={handleLogout} className="pending-btn">
                            Logout
                        </button>
                    </div>
                </div>
                <Footer />
            </>
        );
    }


    if (fatal) {
        return (
            <>
                <Header />
                <div style={{
                    padding: 16,
                    background: '#fff3cd',
                    color: '#664d03',
                    border: '1px solid #ffecb5',
                    borderRadius: 8,
                    margin: 16,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace'
                }}>
                    <strong>Runtime Error:</strong>{'\n'}{fatal}
                </div>
                <Footer />
            </>
        );
    }

    if (!user) {
        return (
            <>
                <Header />
                <div className="dd-auth-required">
                    <div className="dd-auth-card">
                        <h2>You are not logged in</h2>
                        <p>Please log in to access your dashboard.</p>
                        <button
                            className="dd-auth-login-btn"
                            onClick={() => navigate('/home')}
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    if (loading) return (
        <div className="dd-loading">
            <div className="dd-spinner-container">
                <div className="dd-beautiful-spinner"></div>
                <p className="dd-loading-text">Loading Dashboard...</p>
            </div>
        </div>
    );

    if (!isRegistered) return (
        <>
            <Header />
            <div className="registration-required">
                <h2>Complete Your Registration</h2>
                <p>You need to complete the registration process before accessing the dashboard.</p>
                <button onClick={() => navigate('/home')}>
                    Complete Registration
                </button>
                <button onClick={handleLogout}>Logout</button>
            </div>
            <Footer />
        </>
    );


    if (error) return <div className="dd-error">Error: {error}</div>;

    if (!allDocumentsVerified) return (
        <>
            <Header />
            <div className="verify-container">
                <div className="verify-card">
                    <h2 className="verify-title">Documents Verification Required</h2>
                    <p className="verify-message">
                        Your documents are under review. You'll get full access once all documents are verified by our team.
                    </p>
                    {renderDocumentStatus()}
                    <button className="verify-logout-btn" onClick={handleLogout}>
                        Logout
                    </button>


                </div>
            </div>
            <Footer />
        </>
    );

    return (
        <>
            <Header />


            <div className="dd-container">


                <div className="driverTopUI-header">
                    <h2 className="driverTopUI-title">Driver Dashboard</h2>
                    <img src={profileImage || img} alt="Driver" className="driverTopUI-avatar" />
                    <HelplineButton />
                </div>

                <div className="driverTopUI-row">
                    <button className="driverTopUI-share" onClick={handleShareClick}>
                        <div className="driverTopUI-marquee">
                            <span>Earn ₹10 Cashback — Share & Earn Now!</span>
                        </div>
                    </button>

                    <button className="driverTopUI-youtube" onClick={handleYoutubeClick}>
                        <FaYoutube className="driverTopUI-youtube-icon" />
                    </button>

                    <div className="driverTopUI-status">
                        <label className="driverTopUI-switch">
                            <input
                                type="checkbox"
                                checked={status === 'active'}
                                onChange={toggleStatus}
                            />
                            <span className="driverTopUI-slider"></span>
                        </label>
                        <span className="driverTopUI-status-text">
                            {status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>





                {!passbookUploaded && (
                    <div className={`dd-passbook-alert ${passbookUploaded ? 'dd-passbook-hide' : ''}`}>
                        <div className="dd-passbook-marquee-container">
                            <div className="dd-passbook-marquee-content">
                                <span className="dd-passbook-marquee-text">
                                    Please upload your passbook for payment settlements. We keep your information safe and secure.
                                </span>
                                <span className="dd-passbook-marquee-text dd-passbook-marquee-duplicate">
                                    Please upload your passbook for payment settlements. We keep your information safe and secure.
                                </span>
                            </div>
                        </div>

                        <button
                            className="dd-passbook-upload-btn"
                            onClick={() => setShowUploadOptions(true)}
                        >
                            <FaUpload style={{ marginRight: '6px' }} />
                        </button>



                        {/* <input
                                type="file"
                                accept="image/*,application/pdf"
                                ref={passbookInputRef}
                                style={{ display: 'none' }}
                                onChange={handlePassbookUpload}
                            /> */}
                        {/* For Gallery/File */}
                        {/* Hidden input for picking from Files/Gallery */}
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            id="fileInput"
                            style={{ display: 'none' }}
                            onChange={(e) => handlePassbookSelect(e)}
                        />

                        {/* Hidden input for directly opening Camera */}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            id="cameraInput"
                            style={{ display: 'none' }}
                            onChange={(e) => handlePassbookSelect(e)}
                        />



                    </div>
                )}




                {/* <div className="dd-profile">
                    <div className="dd-profile-card">
                        <div className="dd-profile-header">
                            <div className="dd-avatar">
                                {isUploading ? (
                                    <div className="dd-spinner"></div>
                                ) : profileImage ? (
                                    <img
                                        src={profileImage}
                                        className="dd-profile-image"
                                        alt="Profile"
                                        onClick={() => fileInputRef.current.click()} // Make avatar clickable
                                        style={{ cursor: 'pointer' }} // Shows pointer on hover
                                    />
                                ) : (
                                    <FaUser
                                        className="dd-default-avatar"
                                        onClick={() => fileInputRef.current.click()} // Make default avatar clickable
                                        style={{ cursor: 'pointer' }}
                                    />
                                )}

                                <input
                                    ref={(ref) => {
                                        fileInputRef.current = ref;
                                        // console.log('File input ref set:', ref);
                                    }}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        // console.log('File input changed event triggered', e);
                                        // console.log('Files selected:', e.target.files);
                                        handleImageUpload(e);
                                    }}
                                    disabled={isUploading}
                                />
                            </div>

                            <h2>{driverInfo?.name || 'Driver'}</h2>
                            {renderRatingStars()}
                        </div>
                        <div className="dd-profile-details">
                            <div><FaPhone /> {driverInfo?.phone || 'N/A'}</div>
                            <div>{getVehicleIcon()} {driverInfo?.vehicleType || 'N/A'} - {driverInfo?.vehicleNumber || 'N/A'}</div>

                            <div className='buttons'>
                                <button className="dd-logout-btn" onClick={handleLogout}>Logout</button>





                            </div>
                        </div>
                    </div>

                    <div className="dd-stats">
                        <div className="dd-stat-card">
                            <h3>Completed Deliveries</h3>
                            <p>{completedDeliveries}</p>
                        </div>
                        <div className="dd-stat-card">
                            <h3>Earnings</h3>
                            <p>₹{(driverInfo?.earnings || 0).toFixed(2)}</p>
                        </div>
                        <div className="dd-stat-card">
                            <h3>Rating</h3>
                            <p>{(driverInfo?.ratings?.average || 0).toFixed(1)}</p>
                        </div>
                    </div>
                </div> */}

                <div className="settlement-card">
                    <h3>Today's Earnings</h3>

                    {!settlement?.today ? (
                        <p>No rides today</p>
                    ) : (
                        <>
                            <div className="settlement-row">
                                <span>Cash Collected:</span>
                                <span>₹{(settlement.today.cashCollected || 0).toFixed(2)}</span>
                            </div>
                            <div className="settlement-row">
                                <span>Online Payments:</span>
                                <span>₹{(settlement.today.onlineCollected || 0).toFixed(2)}</span>
                            </div>
                            {(settlement.today.cashCollected || 0) > 0 && (
                                <div className="settlement-row highlight">
                                    <span>Owner Share (20%):</span>
                                    <span className="negative">
                                        ₹{((settlement.today.cashCollected || 0) * 0.2).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {(settlement.today.onlineCollected || 0) > 0 && (
                                <div className="settlement-row highlight">
                                    <span>Your Share (80%):</span>
                                    <span className="positive">
                                        ₹{((settlement.today.onlineCollected || 0) * 0.8).toFixed(2)}
                                    </span>
                                </div>
                            )}

                        </>
                    )}

                    {settlement?.pending?.length > 0 && (
                        <div className="pending-settlements">
                            <h4>Pending Settlements</h4>
                            {settlement.pending.map(item => (
                                <div key={item._id} className="pending-item">
                                    <span>{moment(item.date).format('MMM D')}: </span>
                                    {item.driverToOwner > 0 && (
                                        // <button
                                        //     className="settle-btn"
                                        //     onClick={() => handleSettlePayment(item._id, item.driverToOwner, 'driverToOwner')}
                                        // >
                                        //     Pay Owner: ₹{(item.driverToOwner || 0).toFixed(2)}
                                        // </button>
                                        <button
                                            className="settle-btn"
                                            onClick={() => handleSettlementPayment(item._id, item.driverToOwner)}
                                        >
                                            Pay Owner: ₹{(item.driverToOwner || 0).toFixed(2)}
                                        </button>

                                    )}
                                    {item.ownerToDriver > 0 && (
                                        <span className="positive">
                                            Receive: ₹{(item.ownerToDriver || 0).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <AvailableShipments />

                {/* {driverInfo && (
                    <DailyEarningsFilter
                        paymentSettlements={driverInfo.paymentSettlements || []}
                        registrationDate={driverInfo.createdAt}
                        onFilter={(filtered) => console.log(filtered)}
                    />
                )} */}

                {/* <div className="dd-actions">
                    <button className="dd-history-btn" onClick={() => navigate('/delivery-history')}>
                        Delivery History
                    </button>

                    <button
                        className="dd-history-btn"
                        onClick={() => navigate('/driver/earnings', { state: { driverInfo } })}
                    >
                        Daily Earnings
                    </button>
                </div> */}
            </div>
            {/* <LocationTracker /> */}

            {cropMode && (
                <ImageCropper
                    image={selectedImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setCropMode(false)}
                />
            )}
            {showCropper && (
                <div className="cropper-overlay">
                    <div className="cropper-modal">
                        <ImageCropper
                            image={imageToCrop}
                            onCropComplete={handleCroppedPassbook}
                            onCancel={() => {
                                setShowCropper(false);
                                setImageToCrop(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {showUploadOptions && (
                <div className="upload-bottomsheet-overlay" onClick={() => setShowUploadOptions(false)}>
                    <div className="upload-bottomsheet" onClick={(e) => e.stopPropagation()}>
                        <h3>Select Upload Option</h3>

                        <button
                            className="upload-option"
                            onClick={() => {
                                document.getElementById("cameraInput").click();
                                setShowUploadOptions(false);
                            }}
                        >
                            📷 Camera
                        </button>

                        <button
                            className="upload-option"
                            onClick={() => {
                                document.getElementById("fileInput").click();
                                setShowUploadOptions(false);
                            }}
                        >
                            📂 Gallery / Files
                        </button>

                        <button
                            className="upload-cancel"
                            onClick={() => setShowUploadOptions(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}


            {status === 'inactive' && (
                <div className="go-overlay">
                    <div className="go-container">
                        <div className="go-circle" onClick={toggleStatus}>
                            Go!
                        </div>
                        <div className="go-bottom">
                            <p className="go-message">
                                You are currently offline.<br />
                                Tap below to go online and start receiving shipments!
                            </p>
                        </div>
                    </div>
                </div>
            )}








            <Footer />
        </>
    );
};

export default DriverDashboard;

