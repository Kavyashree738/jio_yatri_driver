import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaPhone, FaEnvelope, FaSignOutAlt } from 'react-icons/fa';
import '../styles/UserProfile.css';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom'; // ✅ NEW

const UserProfile = () => {
  const { user, setMessage } = useAuth();
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const navigate = useNavigate(); // ✅ Initialize navigate

  useEffect(() => {
    setUploadedPhoto(localStorage.getItem('uploadedPhoto'));
    setManualName(localStorage.getItem('manualName') || '');
    setManualEmail(localStorage.getItem('manualEmail') || '');
    setManualPhone(localStorage.getItem('manualPhone') || '');
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedPhoto(reader.result);
      localStorage.setItem('uploadedPhoto', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('manualName', manualName);
    localStorage.setItem('manualEmail', manualEmail);
    localStorage.setItem('manualPhone', manualPhone);
    setEditingProfile(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage({ text: 'Logged out successfully.', isError: false });
      navigate('/');
    } catch (error) {
      setMessage({ text: 'Logout failed: ' + error.message, isError: true });
    }
  };

  if (!user) return <div className="user-profile">Not logged in</div>;

  const isPhoneLogin = user.providerData.some(
    (provider) => provider.providerId === 'phone'
  );
  const isEmailLogin = user.providerData.some(
    (provider) =>
      provider.providerId === 'password' ||
      provider.providerId === 'google.com' ||
      provider.providerId === 'apple.com'
  );

  const shouldAskManualProfile =
    (isPhoneLogin && (!manualName || !manualEmail)) ||
    (isEmailLogin && !user.phoneNumber && !manualPhone) ||
    editingProfile;

  return (
    <>
      <Header />
      <div className="profile-container">
        <div className="user-profile">
          <div className="profile-header">
            <div className="profile-image-wrapper">
              {uploadedPhoto ? (
                <img src={uploadedPhoto} alt="Profile" className="profile-pic" />
              ) : user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="profile-pic" />
              ) : (
                <div className="profile-pic-default">
                  <FaUser size={48} />
                </div>
              )}
              <label htmlFor="upload-photo" className="camera-icon">📷</label>
              <input
                type="file"
                accept="image/*"
                id="upload-photo"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
            </div>

            <h2 className="profile-name">
              {user.displayName || manualName || 'User'}
            </h2>
          </div>

          {shouldAskManualProfile && (
            <form className="manual-form" onSubmit={handleProfileSubmit}>
              <h3>Complete your profile</h3>
              {isPhoneLogin && (
                <>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    required
                  />
                </>
              )}
              {isEmailLogin && !user.phoneNumber && (
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  required
                />
              )}
              <button type="submit">Save Profile</button>
            </form>
          )}

          {!editingProfile && (manualName || manualPhone || manualEmail) && (
            <button className="edit-btn" onClick={() => setEditingProfile(true)}>
              Edit Profile Info
            </button>
          )}

          <div className="profile-details">
            {(user.phoneNumber || manualPhone) && (
              <div className="detail-item">
                <FaPhone className="detail-icon" />
                <span>{user.phoneNumber || manualPhone}</span>
              </div>
            )}
            {(user.email || manualEmail) && (
              <div className="detail-item">
                <FaEnvelope className="detail-icon" />
                <span>{user.email || manualEmail}</span>
              </div>
            )}
            {user.metadata?.creationTime && (
              <div className="detail-item">
                <span className="detail-label">Account Created:</span>
                <span>{new Date(user.metadata.creationTime).toLocaleDateString()}</span>
              </div>
            )}
            {user.metadata?.lastSignInTime && (
              <div className="detail-item">
                <span className="detail-label">Last Login:</span>
                <span>{new Date(user.metadata.lastSignInTime).toLocaleString()}</span>
              </div>
            )}
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default UserProfile;
