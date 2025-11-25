// src/pages/KycPending.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaSync,
  FaUpload,
  FaSignOutAlt
} from 'react-icons/fa';
import '../styles/KycPending.css';
import { useTranslation } from "react-i18next";

const apiBase =
  'https://jio-yatri-driver.onrender.com';

export default function KycPending() {
  const { t } = useTranslation();
  const { user, softLogout } = useAuth();
  const nav = useNavigate();

  const [status, setStatus] = useState('none'); // none|submitted|verified|rejected
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const timerRef = useRef(null);

  // file reupload state
  const [aadhaarNew, setAadhaarNew] = useState(null);
  const [panNew, setPanNew] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSoftLogout = () => {
    softLogout();
    nav('/home', { replace: true, state: { from: '/kyc-pending' } });
  };

  const fetchKyc = async () => {
    if (!user) return;
    try {
      setErr('');
      const token = await user.getIdToken();
      const res = await axios.get(`${apiBase}/api/user/me/kyc`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const k = res.data?.data || {};
      setStatus(k.status || 'none');
      setInfo(k);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || t("kyc_error_fetch"));
    }
  };

  useEffect(() => {
    fetchKyc();
    timerRef.current = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timerRef.current);
  }, [user]);

  useEffect(() => {
    fetchKyc();
  }, [tick]);

  // redirect when verified
  useEffect(() => {
    if (status === 'verified') {
      nav('/business-dashboard', { replace: true });
    }
  }, [status, nav]);

  const handleResubmit = async () => {
    try {
      setErr('');

      if (!aadhaarNew && !panNew) {
        setErr(t("kyc_err_select_docs"));
        return;
      }

      if (aadhaarNew && aadhaarNew.size > 5 * 1024 * 1024) {
        setErr(t("kyc_err_aadhaar_size"));
        return;
      }
      if (panNew && panNew.size > 5 * 1024 * 1024) {
        setErr(t("kyc_err_pan_size"));
        return;
      }

      setUploading(true);
      const fd = new FormData();
      if (aadhaarNew) fd.append('aadhaar', aadhaarNew);
      if (panNew) fd.append('pan', panNew);

      const token = await user.getIdToken();
      const res = await axios.put(`${apiBase}/api/user/me/kyc-docs`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      const k = res.data?.data || {};
      setInfo(k);
      setStatus('submitted');
      setAadhaarNew(null);
      setPanNew(null);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e.message ||
          t("kyc_error_resubmit")
      );
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="kyc-wrap">
        <div className="kyc-card">{t("kyc_login_required")}</div>
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
        <h1>{t("kyc_verification")}</h1>

        {status === 'submitted' && (
          <>
            <div className="kyc-state waiting">
              <FaClock /> {t("kyc_status_submitted")}
            </div>
            <p className="kyc-sub">
              {t("kyc_status_submitted_sub")}
            </p>
          </>
        )}

        {status === 'none' && (
          <>
            <div className="kyc-state waiting">
              <FaClock /> {t("kyc_status_none")}
            </div>
            <p className="kyc-sub">{t("kyc_status_none_sub")}</p>
          </>
        )}

        {status === 'rejected' && (
          <>
            <div className="kyc-state rejected">
              <FaTimesCircle /> {t("kyc_status_rejected")}
            </div>

            {info?.notes ? (
              <div className="kyc-notes">
                {t("kyc_reject_reason")} {info.notes}
              </div>
            ) : null}

            <p className="kyc-sub">
              {t("kyc_resubmit_sub")}
            </p>

            <div className="kyc-reupload">
              <div className="kyc-reupload-row">
                <label>{t("aadhaar_label")}</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) =>
                    setAadhaarNew(e.target.files?.[0] || null)
                  }
                />
                {aadhaarNew && (
                  <small>{t("selected")}: {aadhaarNew.name}</small>
                )}
                {info?.aadhaarUrl && (
                  <a
                    className="kyc-view-link"
                    href={info.aadhaarUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("view_current_aadhaar")}
                  </a>
                )}
              </div>

              <div className="kyc-reupload-row">
                <label>{t("pan_label")}</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) =>
                    setPanNew(e.target.files?.[0] || null)
                  }
                />
                {panNew && (
                  <small>{t("selected")}: {panNew.name}</small>
                )}
                {info?.panUrl && (
                  <a
                    className="kyc-view-link"
                    href={info.panUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("view_current_pan")}
                  </a>
                )}
              </div>

              <button
                className="btn"
                disabled={uploading}
                onClick={handleResubmit}
              >
                <FaUpload />{' '}
                {uploading ? t("uploading") : t("resubmit_docs")}
              </button>
            </div>

            <p className="kyc-sub">{t("kyc_resubmit_note")}</p>
          </>
        )}

        {status === 'verified' && (
          <div className="kyc-state verified">
            <FaCheckCircle /> {t("kyc_status_verified")}
          </div>
        )}

        <div className="kyc-meta">
          <TimeRow label={t("submitted")} value={info?.submittedAt} />
          <TimeRow label={t("verified")} value={info?.verifiedAt} />
          <TimeRow label={t("rejected")} value={info?.rejectedAt} />
        </div>

        <div className="kyc-actions">
          <button className="btn" onClick={fetchKyc}>
            <FaSync /> {t("refresh")}
          </button>

          <button className="btn" onClick={handleSoftLogout}>
            <FaSignOutAlt /> {t("sign_out")}
          </button>
        </div>

        {err && <div className="kyc-error">{err}</div>}
      </div>
    </div>
  );
}
