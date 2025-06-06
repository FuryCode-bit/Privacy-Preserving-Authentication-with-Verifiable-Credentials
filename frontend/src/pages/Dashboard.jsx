import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

// --- Reusable Button Component ---
const ActionButton = ({ onClick, children, className = '' }) => (
  <button onClick={onClick} className={`bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm ${className}`}>
    {children}
  </button>
);

// --- Disclosure Modal Component ---
const DisclosureModal = ({ isOpen, onClose, cred, onGenerate }) => {
  if (!isOpen || !cred) return null;

  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const vcData = JSON.parse(cred.credential_data);
  const claims = Object.keys(vcData.credentialSubject || {}).filter(c => c !== 'id');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsGenerating(true);
    setError('');

    const selectedClaims = Array.from(event.target.elements)
      .filter(el => el.type === 'checkbox' && el.checked)
      .map(el => el.name);
      
    try {
      await onGenerate(cred, selectedClaims);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to generate presentation.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create Presentation</h2>
        <p className="mb-4">Select the claims you want to reveal.</p>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2 mb-4">
            {claims.map(claim => (
              <label key={claim} className="flex items-center space-x-2">
                <input type="checkbox" name={claim} defaultChecked className="rounded" />
                <span>{claim}</span>
              </label>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
            <button type="submit" disabled={isGenerating} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">
              {isGenerating ? 'Generating...' : 'Generate & Download'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---
const Dashboard = () => {
  const [credentials, setCredentials] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  // State for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCred, setSelectedCred] = useState(null);

  const fetchCredentials = useCallback(async () => {
    try {
      const response = await apiClient.get('/list_credentials');
      setCredentials(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch credentials');
      if (err.response?.status === 401) {
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleOpenModal = (cred) => {
    setSelectedCred(cred);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedCred(null);
    setIsModalOpen(false);
  };
  
  const handleGeneratePresentation = async (cred, selectedClaims) => {
    const vcData = JSON.parse(cred.credential_data);
    const disclosureFrame = {
        "@context": vcData["@context"],
        type: vcData.type,
        credentialSubject: {
            "@explicit": true,
            id: {},
            ...selectedClaims.reduce((acc, claim) => ({...acc, [claim]: {}}), {})
        }
    };
    
    const response = await apiClient.post('/create_presentation', {
        cred_id: cred.cred_id,
        disclosure_frame: disclosureFrame
    });
    
    // Trigger download
    const presentation = response.data;
    const blob = new Blob([JSON.stringify(presentation, null, 2)], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presentation-${cred.cred_id}-${Date.now()}.jsonld`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="min-h-screen flex justify-center items-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Welcome, {user?.email}</h1>
          <button onClick={() => { logout(); navigate('/login'); }} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
            Logout
          </button>
        </header>

        <h2 className="text-2xl font-bold mb-4">🎓 My Credentials</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className="space-y-4">
          {credentials.length === 0 ? (
            <p>No credentials found.</p>
          ) : (
            credentials.map((cred) => {
              const vcData = JSON.parse(cred.credential_data);
              const { credentialSubject: subject = {}, type = [] } = vcData;
              const vcType = type.find(t => t !== 'VerifiableCredential') || 'Credential';
              return (
                <div key={cred.cred_id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <h3 className="text-xl font-semibold text-blue-800 mb-2">{vcType}</h3>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <p><strong>Name:</strong> {subject.name || 'N/A'}</p>
                    <p><strong>University:</strong> {subject.university || 'N/A'}</p>
                    <p><strong>Course:</strong> {subject.course || 'N/A'}</p>
                    <p><strong>Grade:</strong> {subject.grade || 'N/A'}</p>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-3 mt-3">
                    <p><strong>Issued:</strong> {new Date(cred.issued_at).toLocaleDateString()}</p>
                    <div className="flex space-x-2">
                      <ActionButton onClick={() => handleOpenModal(cred)}>Create Presentation</ActionButton>
                      <ActionButton onClick={() => { /* Download logic */ }}>Download Full VC</ActionButton>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <DisclosureModal isOpen={isModalOpen} onClose={handleCloseModal} cred={selectedCred} onGenerate={handleGeneratePresentation} />
    </div>
  );
};

export default Dashboard;