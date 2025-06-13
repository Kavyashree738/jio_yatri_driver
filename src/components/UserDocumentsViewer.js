import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/UserDocumentViewer.css';
import Header from './Header';
import Footer from './Footer';

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
          `https://jio-yatri-driver.onrender.com/api/upload/user-documents/${user.uid}`,
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
        `https://jio-yatri-driver.onrender.com/api/upload/file/${filename}`,
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
        `https://jio-yatri-driver.onrender.com/api/upload/file/${filename}`,
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

  if (loading) return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading your documents...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <div className="error-icon">!</div>
      <h3>Error loading documents</h3>
      <p>{error}</p>
      <button 
        className="retry-button"
        onClick={() => window.location.reload()}
      >
        Try Again
      </button>
    </div>
  );

  return (
    <>
      <Header/>
      <div className="user-documents-viewer">
        <section className="documents-section">
          <header className="viewer-header">
            <h2>My Documents</h2>
            <p className="document-count">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </p>
          </header>
          
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
                    <div className="image-preview-wrapper">
                      <img 
                        src={`https://jio-yatri-driver.onrender.com/api/upload/file/${doc.filename}`}
                        alt={doc.originalName}
                        className="document-image"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/250x180?text=Image+Not+Found';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="document-icon-large">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                      <span className="file-extension">
                        {doc.originalName.split('.').pop().toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="document-details">
                  <h3 className="document-title" title={doc.originalName}>
                    {doc.originalName.length > 20 
                      ? `${doc.originalName.substring(0, 20)}...` 
                      : doc.originalName}
                  </h3>
                  <div className="document-meta">
                    <span className="document-type">{doc.docType}</span>
                    <span className="document-date">
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="document-actions">
                    <button 
                      className="view-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewInBrowser(doc.filename, doc.mimetype);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </button>
                    <button 
                      className="download-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc.filename, doc.originalName, doc.mimetype);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Footer/>
    </>
  );
};

export default UserDocumentsViewer;