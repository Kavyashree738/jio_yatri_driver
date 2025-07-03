import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Header from './Header';
import Footer from './Footer';
import '../styles/UserDocumentViewer.css';

// Import your placeholder image
import documentPlaceholder from '../assets/images/pdf.png';

const UserDocumentsViewer = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [profileImages, setProfileImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const token = await user.getIdToken(true);
        const response = await axios.get(
          `http://localhost:5000/api/upload/user-documents/${user.uid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const profileImages = response.data.filter(doc => doc.docType === 'profile');
        const otherDocuments = response.data.filter(doc => doc.docType !== 'profile');
        
        setProfileImages(profileImages);
        setDocuments(otherDocuments);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user?.uid) fetchDocuments();
  }, [user]);

  const handleViewInBrowser = async (filename, mimetype) => {
    try {
      const token = await user.getIdToken(true);
      const response = await axios.get(
        `http://localhost:5000/api/upload/file/${filename}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { type: mimetype || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      if (mimetype && mimetype.startsWith('image/')) {
        const image = new Image();
        image.src = url;
        const win = window.open('');
        win.document.write(image.outerHTML);
      } else {
        window.open(url, '_blank');
      }
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError('Failed to open document: ' + err.message);
    }
  };

  const handleDownload = async (filename, originalName, mimetype) => {
    try {
      const token = await user.getIdToken();
      const response = await axios.get(
        `http://localhost:5000/api/upload/file/${filename}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { type: mimetype || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError('Failed to download: ' + err.message);
    }
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith('image/')) return 'fa-file-image';
    if (mimetype.includes('pdf')) return 'fa-file-pdf';
    if (mimetype.includes('word')) return 'fa-file-word';
    if (mimetype.includes('excel')) return 'fa-file-excel';
    if (mimetype.includes('zip')) return 'fa-file-archive';
    return 'fa-file-alt';
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <>
      <Header/>
      <div className="documents-viewer-container">
        <div className="documents-viewer-content">
          <div className="documents-header">
            <h1 className="documents-title">My Documents</h1>
            <div className="documents-summary">
              <span className="summary-item">
                <i className="fas fa-file-alt"></i> {documents.length} Documents
              </span>
              {/* <span className="summary-item">
                <i className="fas fa-user-circle"></i> {profileImages.length} Profile Images
              </span> */}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading your documents...</p>
              </div>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3>Couldn't load documents</h3>
              <p>{error}</p>
              <button 
                className="retry-button"
                onClick={() => window.location.reload()}
              >
                <i className="fas fa-sync-alt"></i> Try Again
              </button>
            </div>
          ) : (
            <div className="documents-grid">
              {documents.map(doc => (
                <div 
                  key={doc.id} 
                  className={`document-card ${activeDoc === doc.id ? 'active' : ''}`}
                  onMouseEnter={() => setActiveDoc(doc.id)}
                  onMouseLeave={() => setActiveDoc(null)}
                >
                  <div 
                    className="document-preview"
                    onClick={() => handleViewInBrowser(doc.filename, doc.mimetype)}
                  >
                    {doc.mimetype?.startsWith('image/') ? (
                      <div className="image-preview">
                        <img 
                          src={`http://localhost:5000/api/upload/file/${doc.filename}`}
                          alt={doc.originalName}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = documentPlaceholder;
                          }}
                        />
                        <div className="image-overlay">
                          <i className="fas fa-expand"></i>
                        </div>
                      </div>
                    ) : (
                      <div className="file-preview">
                        <div className="file-placeholder">
                          <img 
                            src={documentPlaceholder} 
                            alt="Document Placeholder" 
                            className="placeholder-image"
                          />
                          <div className="file-type-badge">
                            <i className={`fas ${getFileIcon(doc.mimetype)}`}></i>
                            <span className="file-extension">
                              {doc.originalName.split('.').pop().toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="document-info">
                    <h3 className="document-name" title={doc.originalName}>
                      {doc.originalName.length > 25 
                        ? `${doc.originalName.substring(0, 25)}...` 
                        : doc.originalName}
                    </h3>
                    <div className="document-meta">
                      <span className="document-type">
                        <i className="fas fa-tag"></i> {doc.docType}
                      </span>
                      <span className="document-date">
                        <i className="fas fa-calendar-alt"></i> {formatDate(doc.uploadDate)}
                      </span>
                    </div>
                    <div className="document-actions">
                      <button 
                        className="action-button view-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewInBrowser(doc.filename, doc.mimetype);
                        }}
                      >
                        <i className="fas fa-eye"></i> View
                      </button>
                      <button 
                        className="action-button download-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc.filename, doc.originalName, doc.mimetype);
                        }}
                      >
                        <i className="fas fa-download"></i> Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer/>
    </>
  );
};

export default UserDocumentsViewer;
