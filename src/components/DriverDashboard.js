// import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
// import { useAuth } from '../context/AuthContext';
// import { useNavigate } from 'react-router-dom';
// import { FaUser, FaPhone, FaToggleOn, FaToggleOff, FaCar, FaStar, FaCheck, FaTimes } from 'react-icons/fa';
// import { MdDirectionsCar, MdDirectionsBike, MdLocalShipping } from 'react-icons/md';
// import Header from './Header';
// import Footer from './Footer';
// import LocationTracker from './LocationTracker';
// import AvailableShipments from './AvailableShipments';
// import '../styles/DriverDashboard.css';
// import { signOut } from 'firebase/auth';
// import { auth } from '../firebase';
// import axios from 'axios';
// const DriverDashboard = () => {
//     const { user, setMessage } = useAuth();
//     const navigate = useNavigate();
//     const [driverInfo, setDriverInfo] = useState(null);
//     const [shipments, setShipments] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [status, setStatus] = useState('inactive');
//     const [isUpdating, setIsUpdating] = useState(false);
//     const [profileImage, setProfileImage] = useState(null);
//     const [isUploading, setIsUploading] = useState(false);
//     const fileInputRef = useRef(null);
//     const [isRegistered, setIsRegistered] = useState(true);

//     const fetchDriverInfo = useCallback(async () => {
//         try {
//             const token = await user.getIdToken();
//             const [driverRes, imageRes] = await Promise.all([
//                 fetch(`https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
//                     headers: { Authorization: `Bearer ${token}` }
//                 }),
//                 fetch(`https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}`, {
//                     headers: { Authorization: `Bearer ${token}` }
//                 })
//             ]);

//                          if (driverRes.status === 404) {
//             setIsRegistered(false);
//             setLoading(false);
//             return; 
//         }

//             if (!driverRes.ok) throw new Error('Failed to fetch driver info');

//             const driverData = await driverRes.json();
//             setDriverInfo(driverData.data);
//             setStatus(driverData.data?.status || 'inactive');

//             if (imageRes.ok) {
//                 const blob = await imageRes.blob();
//                 const imageUrl = URL.createObjectURL(blob);
//                 setProfileImage(imageUrl);
//             } else if (user.photoURL) {
//                 setProfileImage(user.photoURL);
//             }
//         } catch (err) {
//             setError(err.message);
//         } finally {
//             setLoading(false);
//         }
//     }, [user]);

//     useEffect(() => {
//         if (!user) return;

//         fetchDriverInfo();

//         const fetchShipments = async () => {
//             try {
//                 const res = await axios.get(`https://jio-yatri-driver.onrender.com/api/shipments/driver/${user.uid}`);
//                 setShipments(res.data);
//             } catch (err) {
//                 console.error('Error fetching shipments:', err.message);
//             }
//         };

//         fetchShipments();
//     }, [user, fetchDriverInfo]);
//     const allDocumentsVerified = useMemo(() => {
//         if (!driverInfo?.documentVerification) return false;
//         return Object.values(driverInfo.documentVerification).every(
//             status => status === 'verified'
//         );
//     }, [driverInfo]);

//     const completedDeliveries = useMemo(() => {
//         return shipments.filter(s => s.status?.toLowerCase() === 'delivered').length;
//     }, [shipments]);

//     const toggleStatus = async () => {
//         const newStatus = status === 'active' ? 'inactive' : 'active';
//         setIsUpdating(true);
//         try {
//             const token = await user.getIdToken(true);
//             const res = await fetch('https://jio-yatri-driver.onrender.com/api/driver/status', {
//                 method: 'PUT',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     Authorization: `Bearer ${token}`
//                 },
//                 body: JSON.stringify({ status: newStatus })
//             });

//             if (!res.ok) throw new Error('Failed to update status');
//             setStatus(newStatus);
//             setDriverInfo(prev => ({
//                 ...prev,
//                 status: newStatus,
//                 lastUpdated: new Date().toISOString()
//             }));
//             setMessage({ text: 'Status updated', isError: false });
//         } catch (err) {
//             setMessage({ text: err.message, isError: true });
//         } finally {
//             setIsUpdating(false);
//         }
//     };

//  const handleImageUpload = async (e) => {
//     console.log('--- handleImageUpload called ---');
    
//     const file = e.target.files[0];
//     console.log('Selected file:', file);

//     if (!file) {
//         console.warn('No file selected');
//         return;
//     }
//     e.target.value = '';

//     if (!file.type.match('image.*')) {
//         console.warn('File type not allowed:', file.type);
//         setError('Please select an image file');
//         return;
//     }

//     if (file.size > 5 * 1024 * 1024) {
//         console.warn('File size too large:', file.size);
//         setError('Image size should be < 5MB');
//         return;
//     }

//     setIsUploading(true);
//     setError(null);
//     console.log('File passed validation, starting upload...');

//     try {
//         const previewUrl = URL.createObjectURL(file);
//         setProfileImage(previewUrl);
//         console.log('Preview URL set:', previewUrl);

//         const formData = new FormData();
//         formData.append('file', file);
//         console.log('FormData prepared:', formData.get('file'));

//         const token = await user.getIdToken(true);
//         console.log('Firebase token retrieved:', token);

//         const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/profile-image', {
//             method: 'POST',
//             headers: { Authorization: `Bearer ${token}` },
//             body: formData
//         });
//         console.log('Upload request sent, status:', response.status);

//         const result = await response.json();
//         console.log('Upload response JSON:', result);

//         await fetchDriverInfo();
//         console.log('Driver info refreshed after upload');
//     } catch (err) {
//         console.error('Upload error:', err);
//         setError(err.message);
//     } finally {
//         setIsUploading(false);
//         console.log('Upload process finished');
//     }
// };


//     const handleLogout = async () => {
//         try {
//             await signOut(auth);
//             setMessage({ text: 'Logged out', isError: false });
//             navigate('/home');
//         } catch (error) {
//             setMessage({ text: error.message, isError: true });
//         }
//     };

//     const getVehicleIcon = () => {
//         switch (driverInfo?.vehicleType?.toLowerCase()) {
//             case 'twowheeler':
//                 return <span role="img" aria-label="Two Wheeler">🛵</span>;
//             case 'threewheeler':
//                 return <span role="img" aria-label="Three Wheeler">🛺</span>;
//             case 'truck':
//                 return <span role="img" aria-label="Truck">🚚</span>;
//             case 'Pickup9ft':
//                 return <span role="img" aria-label="Pickup9ft">🛻</span>;
//             case 'Tata407':
//                 return <span role="img" aria-label="Tata407">🚛</span>;
//             default:
//                 return <span role="img" aria-label="Car">🚗</span>;
//         }
//     };

//     const renderRatingStars = () => {
//         const rating = driverInfo?.ratings?.average || 0;
//         return (
//             <div className="dd-rating-stars">
//                 {[...Array(5)].map((_, i) => (
//                     <FaStar key={i} className={`dd-star ${i < rating ? 'dd-filled' : ''}`} />
//                 ))}
//                 <span className="dd-rating-text">{rating > 0 ? `${rating.toFixed(1)}/5` : 'Not rated yet'}</span>
//             </div>
//         );
//     };
//     const renderDocumentStatus = () => (
//         <div className="dd-document-status">
//             <h3>Document Verification Status</h3>
//             {Object.entries(driverInfo.documentVerification || {}).map(([docType, status]) => (
//                 <div key={docType} className={`dd-doc-item ${status}`}>
//                     <span>{docType}:</span>
//                     <span>
//                         {status === 'verified' ? (
//                             <FaCheck className="dd-verified" />
//                         ) : (
//                             <FaTimes className="dd-pending" />
//                         )}
//                         {status.charAt(0).toUpperCase() + status.slice(1)}
//                     </span>
//                 </div>
//             ))}
//         </div>
//     );

//     if (!user) {
//     return (
//         <>
//          <Header />
//         <div className="dd-auth-required">
//             <div className="dd-auth-card">
//                 <h2>You are not logged in</h2>
//                 <p>Please log in to access your dashboard.</p>
//                 <button
//                     className="dd-auth-login-btn"
//                     onClick={() => navigate('/home')}
//                 >
//                     Go to Login
//                 </button>
//             </div>
//         </div>
//         <Footer />
//                         </>
//     );
// }

//     if (loading) return (
//         <div className="dd-loading">
//             <div className="dd-spinner-container">
//                 <div className="dd-beautiful-spinner"></div>
//                 <p className="dd-loading-text">Loading Dashboard...</p>
//             </div>
//         </div>
//     );

    
//     if (!isRegistered) return (
//     <>
//         <Header />
//         <div className="registration-required">
//             <h2>Complete Your Registration</h2>
//             <p>You need to complete the registration process before accessing the dashboard.</p>
//             <button onClick={() => navigate('/home')}>
//                 Complete Registration
//             </button>
//             <button onClick={handleLogout}>Logout</button>
//         </div>
//         <Footer />
//     </>
// );

//     if (error) return <div className="dd-error">Error: {error}</div>;
//     if (!allDocumentsVerified) return (
//         <>
//             <Header />
//             <div className="verify-container">
//                 <div className="verify-card">
//                     <h2 className="verify-title">Documents Verification Required</h2>
//                     <p className="verify-message">
//                         Your documents are under review. You'll get full access once all documents are verified by our team.
//                     </p>

//                     <div className="verify-status-box">
//                         <h3 className="verify-status-title">Document Verification Status</h3>
//                         {Object.entries(driverInfo.documentVerification || {}).map(([docType, status]) => (
//                             <div key={docType} className={`verify-status-item ${status}`}>
//                                 <span className="verify-doc-type">
//                                     {docType.replace(/([A-Z])/g, ' $1').trim()}:
//                                 </span>
//                                 <span className="verify-doc-status">
//                                     {status === 'verified' ? (
//                                         <>
//                                             <FaCheck className="verify-icon verified" />
//                                             Verified
//                                         </>
//                                     ) : (
//                                         <>
//                                             <FaTimes className="verify-icon pending" />
//                                             Pending
//                                         </>
//                                     )}
//                                 </span>
//                             </div>
//                         ))}
//                     </div>

//                     <button className="verify-logout-btn" onClick={handleLogout}>
//                         Logout
//                     </button>
//                 </div>
//             </div>
//             <Footer />
//         </>

//     );


//     return (
//         <>
//             <Header />
//             <div className="dd-container">
//                 <div className="dd-header">
//                     <h1>Driver Dashboard</h1>
//                     <div className="dd-status-toggle">
//                         <span>Status: {status}</span>
//                         <button
//                             onClick={toggleStatus}
//                             disabled={isUpdating}
//                             className={`dd-toggle-btn ${status === 'active' ? 'dd-active' : 'dd-inactive'}`}
//                         >
//                             {status === 'active' ? <FaToggleOn /> : <FaToggleOff />}
//                             {isUpdating ? 'Updating...' : status === 'active' ? 'Go Offline' : 'Go Online'}
//                         </button>
//                     </div>
//                 </div>

//                 <div className="dd-profile">
//                     <div className="dd-profile-card">
//                         <div className="dd-profile-header">
//                         <div className="dd-avatar">
//   {isUploading ? (
//     <div className="dd-spinner"></div>
//   ) : profileImage ? (
//     <img
//       src={profileImage}
//       className="dd-profile-image"
//       alt="Profile"
//       onClick={() => fileInputRef.current.click()} // Make avatar clickable
//       style={{ cursor: 'pointer' }} // Shows pointer on hover
//     />
//   ) : (
//     <FaUser
//       className="dd-default-avatar"
//       onClick={() => fileInputRef.current.click()} // Make default avatar clickable
//       style={{ cursor: 'pointer' }}
//     />
//   )}

//   <input
//     ref={(ref) => {
//       fileInputRef.current = ref;
//       console.log('File input ref set:', ref);
//     }}
//     type="file"
//     accept="image/*"
//     style={{ display: 'none' }}
//     onChange={(e) => {
//       handleImageUpload(e);
//     }}
//     disabled={isUploading}
//   />
// </div>

//                             <h2>{driverInfo.name}</h2>
//                             {renderRatingStars()}
//                         </div>
//                         <div className="dd-profile-details">
//                             <div><FaPhone /> {driverInfo.phone}</div>
//                             <div>{getVehicleIcon()} {driverInfo.vehicleType} - {driverInfo.vehicleNumber}</div>
//                             <button className="dd-logout-btn" onClick={handleLogout}>Logout</button>
//                         </div>
//                     </div>

//                     <div className="dd-stats">
//                         <div className="dd-stat-card">
//                             <h3>Completed Deliveries</h3>
//                             <p>{completedDeliveries}</p>
//                         </div>
//                         <div className="dd-stat-card">
//                             <h3>Earnings</h3>
//                             <p>₹{driverInfo.earnings?.toFixed(2) || '0.00'}</p>
//                         </div>
//                         <div className="dd-stat-card">
//                             <h3>Rating</h3>
//                             <p>{driverInfo.ratings?.average?.toFixed(1) || 'Not rated yet'}</p>
//                         </div>
//                     </div>
//                 </div>

//                 <div className="dd-actions">
//                     <button className="dd-history-btn" onClick={() => navigate('/delivery-history')}>Delivery History</button>
//                 </div>
//             </div>
//             <LocationTracker />
//             <AvailableShipments />
//             <Footer />
//         </>
//     );
// };

// export default DriverDashboard;

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

import 'moment/locale/en-in'; // Import the locale you need
import DailyEarningsFilter from './DailyEarningsFilter';
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
    const [isUpdating, setIsUpdating] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [isRegistered, setIsRegistered] = useState(true);
    const [pollingInterval, setPollingInterval] = useState(null);
    const [marqueeActive, setMarqueeActive] = useState(false);
    const [marqueeText] = useState('Earn ₹10 Cashback');
    const fetchDriverInfo = useCallback(async () => {
        try {
            const token = await user.getIdToken();

            // First check for pending settlements
            const settlementCheckRes = await fetch(
                `https://jio-yatri-driver.onrender.com/api/settlement/check-settlement/${user.uid}`,
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
                fetch(`https://jio-yatri-driver.onrender.com/api/driver/info/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`https://jio-yatri-driver.onrender.com/api/upload/profile-image/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`https://jio-yatri-driver.onrender.com/api/settlement/driver/${user.uid}`, {
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

            setDriverInfo(driverData.data);
            setStatus(driverData.data?.status || 'inactive');
            setSettlement({
                today: settlementData.currentDaySettlement  || {
                    cashCollected: 0,
                    onlineCollected: 0,
                    driverEarned: 0,
                    ownerEarned: 0
                },
                pending: settlementData.pending || []
            });

            if (imageRes.ok) {
                const blob = await imageRes.blob();
                const imageUrl = URL.createObjectURL(blob);
                setProfileImage(imageUrl);
            } else if (user.photoURL) {
                setProfileImage(user.photoURL);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;

        fetchDriverInfo();

        const fetchShipments = async () => {
            try {
                const token = await user.getIdToken();
                const res = await axios.get(`https://jio-yatri-driver.onrender.com/api/shipments/driver/${user.uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setShipments(res.data || []);
            } catch (err) {
                console.error('Error fetching shipments:', err.message);
            }
        };

        fetchShipments();
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
            const res = await fetch('https://jio-yatri-driver.onrender.com/api/driver/status', {
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
        } catch (err) {
            setMessage({ text: err.message, isError: true });
        } finally {
            setIsUpdating(false);
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

    const handleImageUpload = async (e) => {
        // console.log('File selected'); // Debug log
        const file = e.target.files[0];
        if (!file) {
            console.log('No file selected');
            return;
        }
        e.target.value = ''; // Reset input

        // console.log('File type:', file.type, 'Size:', file.size); // Debug log

        if (!file.type.match('image.*')) {
            console.log('Invalid file type');
            setError('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            console.log('File too large');
            setError('Image size should be < 5MB');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            console.log('Starting upload'); // Debug log
            const previewUrl = URL.createObjectURL(file);
            setProfileImage(previewUrl);

            const formData = new FormData();
            formData.append('file', file);

            const token = await user.getIdToken(true);
            const response = await fetch('https://jio-yatri-driver.onrender.com/api/upload/profile-image', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            console.log('Upload response:', response); // Debug log

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            await fetchDriverInfo();
        } catch (err) {
            console.error('Upload error:', err); // Debug log
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


    const handleSettlePayment = async (settlementId, amount, direction) => {
        try {
            const token = await user.getIdToken();
            await axios.post(`https://jio-yatri-driver.onrender.com/api/settlement/complete/${user.uid}`, {
                settlementId,
                amount,
                direction
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Refresh settlement data
            const res = await axios.get(`https://jio-yatri-driver.onrender.com/api/settlement/driver/${user.uid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSettlement({
                today: res.data.today || { cashCollected: 0, onlineCollected: 0, driverEarned: 0, ownerEarned: 0 },
                pending: res.data.pendingSettlements || []
            });

            setMessage({ text: 'Payment settled successfully', isError: false });
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
                <div className="dd-header">
                    <h1>Driver Dashboard</h1>
                   <div className='buttons'>
                     <button className="dd-share-btn" onClick={handleShareClick}>
                        <div className="dd-marquee-container">
                            {marqueeActive ? (
                                <div className="dd-marquee-content">
                                    <span className="dd-marquee-text">{marqueeText}</span>
                                </div>
                            ) : (
                                <div className="dd-static-text">Share</div>
                            )}
                        </div>
                    </button>
                     <button className="dd-youtube-btn" onClick={handleYoutubeClick}>
                                    <FaYoutube className='dd-youtube-icon' />
                                </button>
                   </div>
                    <div className="dd-status-toggle">
                        <span>Status: {status}</span>
                        <button
                            onClick={toggleStatus}
                            disabled={isUpdating}
                            className={`dd-toggle-btn ${status === 'active' ? 'dd-active' : 'dd-inactive'}`}
                        >
                            {status === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                            {isUpdating ? 'Updating...' : status === 'active' ? 'Go Offline' : 'Go Online'}
                        </button>
                    </div>
                </div>

                <div className="dd-profile">
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
                </div>

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
                            <div className="settlement-row highlight">
                                <span>You owe Owner (20%):</span>
                                <span className="negative">
                                    ₹{((settlement.today.cashCollected || 0) * 0.2).toFixed(2)}
                                </span>
                            </div>
                            <div className="settlement-row highlight">
                                <span>Owner owes You (80%):</span>
                                <span className="positive">
                                    ₹{((settlement.today.onlineCollected || 0) * 0.8).toFixed(2)}
                                </span>
                            </div>
                        </>
                    )}

                    {settlement?.pending?.length > 0 && (
                        <div className="pending-settlements">
                            <h4>Pending Settlements</h4>
                            {settlement.pending.map(item => (
                                <div key={item._id} className="pending-item">
                                    <span>{moment(item.date).format('MMM D')}: </span>
                                    {item.driverToOwner > 0 && (
                                        <button
                                            className="settle-btn"
                                            onClick={() => handleSettlePayment(item._id, item.driverToOwner, 'driverToOwner')}
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

                {driverInfo && (
                    <DailyEarningsFilter
                        paymentSettlements={driverInfo.paymentSettlements || []}
                        registrationDate={driverInfo.createdAt}
                        onFilter={(filtered) => console.log(filtered)}
                    />
                )}

                <div className="dd-actions">
                    <button className="dd-history-btn" onClick={() => navigate('/delivery-history')}>
                        Delivery History
                    </button>

                    {/* <button className="dd-history-btn" onClick={() => navigate('/driver/earnings')}>
                        View Earnings History
                    </button> */}
                </div>
            </div>
            <LocationTracker />
            <AvailableShipments />
            <Footer />
        </>
    );
};

export default DriverDashboard;
