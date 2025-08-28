import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FaEye, FaSync, FaUpload, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/OwnerDocumentViews.css';
import Header from './Header';
import Footer from './Footer'
const apiBase = 'https://jio-yatri-driver.onrender.com';

export default function OwnerDocumentViews() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('none'); // none|submitted|verified|rejected
  const [info, setInfo] = useState(null);

  // new uploads (optional)
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [busy, setBusy] = useState(false);

  // polling
  const [tick, setTick] = useState(0);
  const timerRef = useRef(null);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKyc(); /* initial */ }, [user]); // eslint-disable-line

  // Poll every 5s while not verified
  useEffect(() => {
    if (!user) return;
    timerRef.current = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timerRef.current);
  }, [user]);

  useEffect(() => { fetchKyc(); /* poll */ }, [tick]); // eslint-disable-line

  // Auto-redirect when verified (optional UX)
  useEffect(() => {
    if (status === 'verified') {
      // You can push to dashboard or show a button — here we just leave a success banner + button.
      // nav('/business-dashboard', { replace: true });
    }
  }, [status, nav]);

  const onSelectFile = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setErr('File must be 5MB or less');
      return;
    }
    setter(f);
  };

  const submitReupload = async () => {
    if (!user) return;
    if (!aadhaarFile && !panFile) {
      setErr('Please choose Aadhaar and/or PAN file to upload.');
      return;
    }
    try {
      setBusy(true);
      setErr('');
      const fd = new FormData();
      if (aadhaarFile) fd.append('aadhaar', aadhaarFile);
      if (panFile) fd.append('pan', panFile);

      const token = await user.getIdToken();
      await axios.put(`${apiBase}/api/user/me/kyc-docs`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // After successful upload, status becomes "submitted"
      setAadhaarFile(null);
      setPanFile(null);
      await fetchKyc();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to upload documents');
    } finally {
      setBusy(false);
    }
  };

  const StatusBadge = ({ value }) => {
    if (value === 'verified') return <span className="odv-badge verified"><FaCheckCircle /> Verified</span>;
    if (value === 'rejected') return <span className="odv-badge rejected"><FaTimesCircle /> Rejected</span>;
    if (value === 'submitted') return <span className="odv-badge submitted"><FaClock /> Submitted</span>;
    return <span className="odv-badge none">No KYC</span>;
  };

  const TimeRow = ({ label, value }) =>
    value ? (
      <div className="odv-time-row">
        <span>{label}</span>
        <span>{new Date(value).toLocaleString()}</span>
      </div>
    ) : null;

  if (loading) {
    return <div className="odv-wrap"><div className="odv-card">Loading…</div></div>;
  }

  return (
    <>
    <Header/>
    <div className="odv-wrap">
      <div className="odv-card">
        <div className="odv-header">
          <h1>Owner Documents (KYC)</h1>
          <div className="odv-actions">
            <button className="odv-btn light" onClick={fetchKyc}><FaSync /> Refresh</button>
            {status === 'verified' && (
              <button className="odv-btn primary" onClick={() => nav('/business-dashboard')}>Go to Dashboard</button>
            )}
          </div>
        </div>

        <div className="odv-status-row">
          <div className="odv-status-left">
            Overall status: <StatusBadge value={status} />
          </div>
          {info?.notes ? <div className="odv-notes">Admin notes: {info.notes}</div> : null}
        </div>

        {/* Only show upload sections if status is not verified */}
        {status !== 'verified' && (
          <>
            <div className="odv-grid">
              {/* Aadhaar */}
              <div className="odv-box">
                <div className="odv-box-head">
                  <h3>Aadhaar</h3>
                  {info?.aadhaarUrl ? (
                    <a className="odv-btn link" href={info.aadhaarUrl} target="_blank" rel="noreferrer">
                      <FaEye /> View
                    </a>
                  ) : <span className="odv-missing">Not uploaded</span>}
                </div>

                <div className="odv-upload">
                  <label className="odv-file">
                    <input type="file" accept=".pdf,image/*" onChange={onSelectFile(setAadhaarFile)} />
                    <span className="odv-file-name">{aadhaarFile ? aadhaarFile.name : 'Choose file (PDF or image)'}</span>
                    <span className="odv-file-btn"><FaUpload /> Browse</span>
                  </label>
                  {aadhaarFile && (
                    <div className="odv-file-meta">
                      {(aadhaarFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}
                </div>
              </div>

              {/* PAN */}
              <div className="odv-box">
                <div className="odv-box-head">
                  <h3>PAN</h3>
                  {info?.panUrl ? (
                    <a className="odv-btn link" href={info.panUrl} target="_blank" rel="noreferrer">
                      <FaEye /> View
                    </a>
                  ) : <span className="odv-missing">Not uploaded</span>}
                </div>

                <div className="odv-upload">
                  <label className="odv-file">
                    <input type="file" accept=".pdf,image/*" onChange={onSelectFile(setPanFile)} />
                    <span className="odv-file-name">{panFile ? panFile.name : 'Choose file (PDF or image)'}</span>
                    <span className="odv-file-btn"><FaUpload /> Browse</span>
                  </label>
                  {panFile && (
                    <div className="odv-file-meta">
                      {(panFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="odv-meta">
              <TimeRow label="Submitted" value={info?.submittedAt} />
              <TimeRow label="Verified" value={info?.verifiedAt} />
              <TimeRow label="Rejected" value={info?.rejectedAt} />
            </div>

            <div className="odv-footer">
              <button className="odv-btn primary" onClick={submitReupload} disabled={busy}>
                {busy ? 'Uploading…' : 'Submit selected files'}
              </button>
              {status !== 'verified' && (
                <div className="odv-hint">We auto-check your status every 5 seconds.</div>
              )}
            </div>
          </>
        )}

        {/* Show only view options and metadata when verified */}
        {status === 'verified' && (
          <>
            <div className="odv-grid">
              {/* Aadhaar */}
              <div className="odv-box">
                <div className="odv-box-head">
                  <h3>Aadhaar</h3>
                  {info?.aadhaarUrl ? (
                    <a className="odv-btn link" href={info.aadhaarUrl} target="_blank" rel="noreferrer">
                      <FaEye /> View
                    </a>
                  ) : <span className="odv-missing">Not available</span>}
                </div>
              </div>

              {/* PAN */}
              <div className="odv-box">
                <div className="odv-box-head">
                  <h3>PAN</h3>
                  {info?.panUrl ? (
                    <a className="odv-btn link" href={info.panUrl} target="_blank" rel="noreferrer">
                      <FaEye /> View
                    </a>
                  ) : <span className="odv-missing">Not available</span>}
                </div>
              </div>
            </div>

            <div className="odv-meta">
              <TimeRow label="Submitted" value={info?.submittedAt} />
              <TimeRow label="Verified" value={info?.verifiedAt} />
            </div>
          </>
        )}

        {err && <div className="odv-error">{err}</div>}
      </div>
    </div>
    <Footer/>
    </>
  );
}