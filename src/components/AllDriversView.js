import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FaEye, FaCheck, FaTimes, FaSync, FaExclamationCircle, FaCar, FaPhone, FaIdCard } from 'react-icons/fa';
import '../styles/AdminDriverVerification.css';

const AdminDriverVerification = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isDocumentOpen, setIsDocumentOpen] = useState(false);

  useEffect(() => {
    console.log('Component mounted, fetching drivers...');
    fetchDrivers();
  }, []);

  useEffect(() => {
    console.log('Search term or drivers changed, filtering...', { searchTerm, driverCount: drivers.length });
    const filtered = drivers.filter(driver => {
      const search = searchTerm.toLowerCase();
      return (
        (driver.name?.toLowerCase().includes(search)) ||
        (driver.phone?.toString().includes(searchTerm)) ||
        (driver.vehicleNumber?.toLowerCase().includes(search))
      );
    });
    console.log('Filtered drivers count:', filtered.length);
    setFilteredDrivers(filtered);
  }, [searchTerm, drivers]);

  const fetchDrivers = async () => {
    try {
      console.log('Starting to fetch drivers...');
      setLoading(true);
      const response = await axios.get('https://jio-yatri-driver.onrender.com/api/upload/all');
      console.log('Drivers fetched:', response.data.data.length);
      setDrivers(response.data.data);
    } catch (err) {
      console.error('Failed to fetch drivers:', {
        error: err.message,
        response: err.response?.data,
        stack: err.stack
      });
    } finally {
      setLoading(false);
      console.log('Loading complete');
    }
  };

  const handleVerify = async (driverId, docType, status) => {
    console.log('Verifying document:', { driverId, docType, status });
    try {
      const token = await user.getIdToken(true);
      console.log('Token retrieved for verification');
      
      await axios.put(
        `https://jio-yatri-driver.onrender.com/api/driver/drivers/${driverId}/verify`,
        { status, notes: `${docType} ${status}`, docType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Verification successful, refreshing drivers...');
      fetchDrivers();
    } catch (err) {
      console.error('Verification failed:', {
        error: err.message,
        response: err.response?.data,
        stack: err.stack
      });
      alert(`Verification failed: ${err.message}`);
    }
  };

  const viewDocument = async (driver, docType) => {
    console.log('Attempting to view document:', { driverId: driver.id, docType });
    
    const doc = driver.documents[docType];
    console.log('Document data from driver:', doc);
    
    if (!doc?.id) {
      console.error('Document ID missing or invalid:', doc);
      alert('Document ID missing or invalid');
      return;
    }

    try {
      console.log('Getting user token...');
      const token = await user.getIdToken(true);
      console.log('Token retrieved');

      console.log('Fetching file info for document ID:', doc.id);
      const fileInfo = await axios.get(
        `https://jio-yatri-driver.onrender.com/api/upload/file-info/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('File info response:', fileInfo.data);

      if (!fileInfo.data?.filename) {
        console.error('Filename missing in response');
        throw new Error('Filename not found');
      }

      console.log('Fetching file content for filename:', fileInfo.data.filename);
      const response = await axios.get(
       `https://jio-yatri-driver.onrender.com/api/upload/admin/file/${fileInfo.data.filename}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );
      console.log('File fetch response status:', response.status);

      const blob = new Blob([response.data], { type: response.data.type });
      const blobUrl = URL.createObjectURL(blob);
      console.log('Created blob URL:', blobUrl.substring(0, 50) + '...');

      setSelectedDriver(driver);
      setSelectedDocument({
        type: docType,
        url: blobUrl,
        mimeType: response.data.type
      });
      setIsDocumentOpen(true);
      console.log('Document viewer opened successfully');
    } catch (error) {
      console.error('Error viewing document:', {
        error: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      alert(`Failed to load document: ${error.message}`);
    }
  };

  const closeDocument = () => {
    console.log('Closing document viewer');
    if (selectedDocument?.url) {
      console.log('Revoking blob URL');
      URL.revokeObjectURL(selectedDocument.url);
    }
    setIsDocumentOpen(false);
    setSelectedDocument(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading drivers...</p>
    </div>
  );

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Driver Verification</h1>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search drivers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="refresh-btn" onClick={fetchDrivers}>
            <FaSync className="icon" /> Refresh
          </button>
        </div>
      </div>

      <div className="drivers-grid">
  {filteredDrivers.length > 0 ? (
    filteredDrivers.map((driver) => {
      const isFullyVerified = Object.values(driver.documents).every(
        (doc) => doc.verified === 'verified'
      );

      return (
        <div
          key={driver.id}
          className={`driver-card ${isFullyVerified ? 'verified-card' : ''}`}
        >
          {/* ✅ Show Verified Tag */}
          {isFullyVerified && (
            <div className="verified-tag">✅ Verified</div>
          )}

          <div className="driver-header">
            <div className="driver-avatar">
              {driver.name?.charAt(0).toUpperCase()}
            </div>
            <div className="driver-info">
              <h3 title={driver.name}>{driver.name}</h3>
              <p className="driver-meta">
                <FaPhone className="meta-icon" /> {driver.phone}
              </p>
              <div className="vehicle-info">
                <span><FaCar className="meta-icon" /> {driver.vehicleType}</span>
                <span>{driver.vehicleNumber}</span>
              </div>
            </div>
          </div>

          <div className="documents-section">
            <h4><FaIdCard className="section-icon" /> Documents</h4>
            <div className="documents-list">
              {Object.entries(driver.documents).map(([docType, doc]) => (
                <div key={docType} className="document-item">
                  <div className="document-info">
                    <span className="document-type" title={docType.toUpperCase()}>
                      {docType.toUpperCase()}
                    </span>
                    <span
                      className="document-status"
                      style={{ backgroundColor: getStatusColor(doc.verified) }}
                    >
                      {doc.verified || 'pending'}
                    </span>
                  </div>
                  <div className="document-actions">
                    {doc.uploaded ? (
                      <>
                        <button
                          className="action-btn view"
                          onClick={() => viewDocument(driver, docType)}
                          title="View Document"
                        >
                          <FaEye className="icon" /> <span className="btn-text">View</span>
                        </button>
                        <button
                          className={`action-btn verify ${doc.verified === 'verified' ? 'active' : ''}`}
                          onClick={() => handleVerify(driver.id, docType, 'verified')}
                          disabled={doc.verified === 'verified'}
                          title="Verify Document"
                        >
                          <FaCheck className="icon" /> <span className="btn-text">Verify</span>
                        </button>
                        <button
                          className={`action-btn reject ${doc.verified === 'rejected' ? 'active' : ''}`}
                          onClick={() => handleVerify(driver.id, docType, 'rejected')}
                          disabled={doc.verified === 'rejected'}
                          title="Reject Document"
                        >
                          <FaTimes className="icon" /> <span className="btn-text">Reject</span>
                        </button>
                      </>
                    ) : (
                      <span className="not-uploaded">Not Uploaded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    })
  ) : (
    <div className="no-results">
      <FaExclamationCircle className="no-results-icon" />
      <p>No drivers found matching your search</p>
    </div>
  )}
</div>


      {isDocumentOpen && selectedDocument && (
        <div className="document-modal">
          <div className="modal-overlay" onClick={closeDocument}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h3 title={`${selectedDriver.name} - ${selectedDocument.type.toUpperCase()}`}>
                {selectedDriver.name} - {selectedDocument.type.toUpperCase()}
              </h3>
              <button onClick={closeDocument} className="close-btn" title="Close">
                &times;
              </button>
            </div>
            <div className="modal-body">
              {selectedDocument.mimeType === 'application/pdf' ? (
                <embed 
                  src={selectedDocument.url} 
                  type="application/pdf"
                  className="document-viewer"
                />
              ) : (
                <img 
                  src={selectedDocument.url} 
                  alt="Document" 
                  className="document-viewer"
                  onError={(e) => {
                    console.error('Error loading document image:', e);
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eee"/><text x="50%" y="50%" font-family="Arial" font-size="10" fill="%23aaa" text-anchor="middle" dominant-baseline="middle">Document not available</text></svg>';
                  }}
                />
              )}
            </div>
            <div className="modal-footer">
              <button className="close-doc-btn" onClick={closeDocument}>
                Close Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDriverVerification;