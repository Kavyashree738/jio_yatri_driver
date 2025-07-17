import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FaFileAlt, FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaEye, FaUpload } from 'react-icons/fa';
import '../styles/UserDocumentViewer.css';
import Header from '../components/Header';
import Footer from '../components/Footer';

const DocumentViewer = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentDocType, setCurrentDocType] = useState('');

  // Generate a unique key for each document
  const generateDocumentKey = (doc) => {
    return `${doc.docType}-${doc.id || doc.filename || doc.uploadDate || Date.now()}`;
  };

  useEffect(() => {
    const fetchDocumentsAndStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await user.getIdToken(true);

        // Fetch user documents
        const docResponse = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/upload/user-documents/${user.uid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const docs = Array.isArray(docResponse?.data)
          ? docResponse.data.filter(doc => doc?.docType !== 'profile')
          : [];

        const processedDocs = docs.map(doc => ({
          ...doc,
          id: doc.id || generateDocumentKey(doc),
          mimetype: doc.mimetype || doc.metadata?.mimetype || 'application/octet-stream',
          uploadDate: doc.uploadDate || new Date().toISOString()
        }));

        const latestDocsMap = processedDocs.reduce((acc, doc) => {
          if (!doc.docType) return acc;
          const existing = acc[doc.docType];
          if (!existing || new Date(doc.uploadDate) > new Date(existing.uploadDate)) {
            acc[doc.docType] = doc;
          }
          return acc;
        }, {});

        setDocuments(Object.values(latestDocsMap));

        // Fetch document verification status
        const statusResponse = await axios.get(
          `https://jio-yatri-driver.onrender.com/api/driver/${user.uid}/documents-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setStatusMap(statusResponse.data?.data || {});
      } catch (err) {
        setError(err.message || 'Failed to fetch documents or status');
      } finally {
        setLoading(false);
      }
    };

    if (user?.uid) fetchDocumentsAndStatus();
  }, [user]);

  const handleView = async (filename, mimetype) => {
    try {
      const token = await user.getIdToken(true);
      const response = await axios.get(
        `https://jio-yatri-driver.onrender.com/api/upload/file/${filename}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: mimetype }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError('Failed to open document: ' + (err.message || 'Unknown error'));
    }
  };

  const handleFileChange = (e, docType) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setCurrentDocType(docType);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentDocType) return;

    setUploading(true);
    setError(null);

    try {
      const token = await user.getIdToken(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('docType', currentDocType);

      const response = await axios.post(
        'http://localhost:5000/api/upload/file',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const newDocument = {
        ...response.data,
        id: response.data.id || generateDocumentKey(response.data),
        mimetype: response.data.mimetype || selectedFile.type || 'application/octet-stream',
        uploadDate: response.data.uploadDate || new Date().toISOString(),
        docType: currentDocType
      };

      setDocuments(prevDocs => {
        const existingIndex = prevDocs.findIndex(doc => doc.docType === currentDocType);
        if (existingIndex >= 0) {
          const updated = [...prevDocs];
          updated[existingIndex] = newDocument;
          return updated;
        }
        return [...prevDocs, newDocument];
      });

      setSelectedFile(null);
    } catch (err) {
      setError('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (mimetype = '') => {
    const type = mimetype.toLowerCase();
    if (type.startsWith('image/')) return <FaFileImage className="file-icon" />;
    if (type.includes('pdf')) return <FaFilePdf className="file-icon" />;
    if (type.includes('word')) return <FaFileWord className="file-icon" />;
    if (type.includes('excel') || type.includes('sheet')) return <FaFileExcel className="file-icon" />;
    return <FaFileAlt className="file-icon" />;
  };

  const getStatusBadge = (status) => {
    if (!status) return <span className="status-badge pending">Pending</span>;
    return (
      <span className={`status-badge ${status}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Add this helper function
  const allDocumentsVerified = () => {
    return documents.length > 0 &&
      documents.every(doc => statusMap[doc.docType] === 'verified');
  };


  return (
    <>
      <Header />
      <div className="document-container">
        <h2 className="document-title">My Documents</h2>

        {loading ? (
          <div className="loading">Loading documents...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : documents.length === 0 ? (
          <div className="empty">No documents found</div>
        ) : (
          <div className="document-list">
            {documents.map((doc) => (
              <div key={generateDocumentKey(doc)} className="document-row">
                <div className="document-type">
                  {getFileIcon(doc.mimetype)}
                  <span>{doc.docType || 'Unknown Document'}</span>
                </div>

                {/* Status Badge */}
                <div className="document-status">
                  {getStatusBadge(statusMap[doc.docType])}
                </div>

                <div className="document-actions">
                  <button
                    className="view-btn"
                    onClick={() => handleView(doc.filename, doc.mimetype)}
                    disabled={!doc.filename}
                    title="View document"
                  >
                    <FaEye className="eye-icon" />
                  </button>

                  {/* Only show upload button if document is not verified */}
                  {statusMap[doc.docType] !== 'verified' && (
                    <label className="update-btn" title="Update document">
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(e, doc.docType)}
                        style={{ display: 'none' }}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      />
                      <FaUpload className="upload-icon" />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedFile && (
          <div className="upload-preview">
            <p>Selected file: {selectedFile.name}</p>
            <div className="upload-buttons">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="upload-confirm-btn"
              >
                {uploading ? 'Uploading...' : 'Confirm Upload'}
              </button>
              <button
                onClick={() => setSelectedFile(null)}
                className="upload-cancel-btn"
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default DocumentViewer;
