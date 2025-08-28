// src/pages/KycPending.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCheckCircle, FaClock, FaTimesCircle, FaSync, FaUpload, FaSignOutAlt } from 'react-icons/fa';
import '../styles/KycPending.css';

const apiBase = 'https://jio-yatri-driver.onrender.com';

export default function KycPending() {
  const { user, softLogout } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState('none'); // none|submitted|verified|rejected
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const timerRef = useRef(null);

  // local state for re-upload
  const [aadhaarNew, setAadhaarNew] = useState(null);
  const [panNew, setPanNew] = useState(null);
  const [uploading, setUploading] = useState(false);


  const handleSoftLogout = () => {
    // clear app auth state, keep Firebase session
    softLogout();
    // send them to your entry/auth page
    nav('/home', { replace: true, state: { from: '/kyc-pending' } });
  };

  const fetchKyc = async () => {
    if (!user) return;
    try {
      setErr('');
      const token = await user.getIdToken();
      const res = await axios.get(`${apiBase}/api/user/me/kyc`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const k = res.data?.data || {};
      setStatus(k.status || 'none');
      setInfo(k);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to fetch KYC');
    }
  };

  // Poll every 5s; clear on unmount
  useEffect(() => {
    fetchKyc(); // initial
    timerRef.current = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { fetchKyc(); /* eslint-disable */ }, [tick]);

  // Redirect immediately when verified
  useEffect(() => {
    if (status === 'verified') {
      nav('/business-dashboard', { replace: true });
    }
  }, [status, nav]);

  const handleResubmit = async () => {
    try {
      setErr('');
      if (!aadhaarNew && !panNew) {
        setErr('Please select at least one file to re-upload.');
        return;
      }
      if (aadhaarNew && aadhaarNew.size > 5 * 1024 * 1024) {
        setErr('Aadhaar file must be 5MB or less');
        return;
      }
      if (panNew && panNew.size > 5 * 1024 * 1024) {
        setErr('PAN file must be 5MB or less');
        return;
      }

      setUploading(true);
      const fd = new FormData();
      if (aadhaarNew) fd.append('aadhaar', aadhaarNew);
      if (panNew) fd.append('pan', panNew);

      const token = await user.getIdToken();
      const res = await axios.put(`${apiBase}/api/user/me/kyc-docs`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });

      const k = res.data?.data || {};
      setInfo(k);
      setStatus('submitted'); // immediately flip to submitted
      setAadhaarNew(null);
      setPanNew(null);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to re-upload KYC');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="kyc-wrap">
        <div className="kyc-card">Please login to continue.</div>
      </div>
    );
  }

  const TimeRow = ({ label, value }) =>
    value ? (
      <div className="kyc-time-row">
        <span>{label}</span>
        <span>{new Date(value).toLocaleString()}</span>
      </div>
    ) : null;

  return (
    <div className="kyc-wrap">
      <div className="kyc-card">
        <h1>KYC Verification</h1>

        {status === 'submitted' && (
          <>
            <div className="kyc-state waiting">
              <FaClock /> Your documents are under verification.
            </div>
            <p className="kyc-sub">We’ll move you to the dashboard as soon as they’re verified.</p>
          </>
        )}

        {status === 'none' && (
          <>
            <div className="kyc-state waiting">
              <FaClock /> We haven’t received your KYC yet.
            </div>
            <p className="kyc-sub">Please submit Aadhaar and PAN in the registration form.</p>
          </>
        )}

        {status === 'rejected' && (
          <>
            <div className="kyc-state rejected">
              <FaTimesCircle /> Your KYC was rejected.
            </div>
            {info?.notes ? <div className="kyc-notes">Reason: {info.notes}</div> : null}
            <p className="kyc-sub">Re-upload only the document(s) that need correction.</p>

            <div className="kyc-reupload">
              <div className="kyc-reupload-row">
                <label>Aadhaar (PDF or Image)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setAadhaarNew(e.target.files?.[0] || null)}
                />
                {aadhaarNew && <small>Selected: {aadhaarNew.name}</small>}
                {info?.aadhaarUrl && (
                  <a className="kyc-view-link" href={info.aadhaarUrl} target="_blank" rel="noreferrer">
                    View current Aadhaar
                  </a>
                )}
              </div>

              <div className="kyc-reupload-row">
                <label>PAN (PDF or Image)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setPanNew(e.target.files?.[0] || null)}
                />
                {panNew && <small>Selected: {panNew.name}</small>}
                {info?.panUrl && (
                  <a className="kyc-view-link" href={info.panUrl} target="_blank" rel="noreferrer">
                    View current PAN
                  </a>
                )}
              </div>

              <button className="btn" disabled={uploading} onClick={handleResubmit}>
                <FaUpload /> {uploading ? 'Uploading…' : 'Re-submit documents'}
              </button>
            </div>

            <p className="kyc-sub">
              After re-submission, the status will change to “submitted” and you’ll be moved to the
              dashboard automatically when verified.
            </p>
          </>
        )}

        {status === 'verified' && (
          <div className="kyc-state verified">
            <FaCheckCircle /> Verified — redirecting to your dashboard…
          </div>
        )}

        <div className="kyc-meta">
          <TimeRow label="Submitted" value={info?.submittedAt} />
          <TimeRow label="Verified" value={info?.verifiedAt} />
          <TimeRow label="Rejected" value={info?.rejectedAt} />
        </div>

        <div className="kyc-actions">
          <button className="btn" onClick={fetchKyc} title="Refresh now">
            <FaSync /> Refresh
          </button>

          <button className="btn" onClick={handleSoftLogout} title="Sign out">
               <FaSignOutAlt /> Sign out
              </button>
        </div>

        {err && <div className="kyc-error">{err}</div>}
      </div>
    </div>
  );
}
