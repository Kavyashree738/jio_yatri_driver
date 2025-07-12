import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FaFileAlt, FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaEye, FaCloudUploadAlt } from 'react-icons/fa';
import '../styles/UserDocumentViewer.css';
import Header from '../components/Header'
import Footer from '../components/Footer'
const DocumentViewer = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
  const fetchDocuments = async () => {
    try {
      const token = await user.getIdToken(true);
      const response = await axios.get(
        `http://localhost:5000/api/upload/user-documents/${user.uid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const docs = response.data.filter(doc => doc.docType !== 'profile');

      // Keep only the latest document for each docType
      const latestDocsMap = {};
      for (const doc of docs) {
        const existing = latestDocsMap[doc.docType];
        if (!existing || new Date(doc.uploadDate) > new Date(existing.uploadDate)) {
          latestDocsMap[doc.docType] = doc;
        }
      }

      setDocuments(Object.values(latestDocsMap));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (user?.uid) fetchDocuments();
}, [user]);


  const handleView = async (filename, mimetype) => {
    try {
      const token = await user.getIdToken(true);
      const response = await axios.get(
        `http://localhost:5000/api/upload/file/${filename}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: mimetype }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError('Failed to open document: ' + err.message);
    }
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith('image/')) return <FaFileImage className="file-icon" />;
    if (mimetype.includes('pdf')) return <FaFilePdf className="file-icon" />;
    if (mimetype.includes('word')) return <FaFileWord className="file-icon" />;
    if (mimetype.includes('excel')) return <FaFileExcel className="file-icon" />;
    return <FaFileAlt className="file-icon" />;
  };

  return (
    <>
    <Header/>
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
            <div key={doc.id} className="document-row">
              <div className="document-type">
                {getFileIcon(doc.mimetype)}
                <span>{doc.docType}</span>
              </div>
              
              <button 
                className="view-btn"
                onClick={() => handleView(doc.filename, doc.mimetype)}
              >
                <FaEye className="eye-icon" />
              </button>

              <div className="upload-status">
                <FaCloudUploadAlt className="upload-icon" />
                <span>Uploaded</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
     <Footer/>
    </>
   
  );
};

export default DocumentViewer;
