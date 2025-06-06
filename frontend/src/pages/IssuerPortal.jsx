import React, { useState } from 'react';
import apiClient from '../api/apiClient';

const IssuerPortal = () => {
  const [form, setForm] = useState({
    name: '',
    holderEmail: '',
    degree: '',
    grade: '',
    date: '',
  });
  const [vc, setVc] = useState(null);
  const [error, setError] = useState('');
  const [isIssuing, setIsIssuing] = useState(false); // To disable the button during request

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleIssue = async () => {
    setError('');
    setIsIssuing(true);
    setVc(null);

    const payload = {
      name: form.name,
      holder_email: form.holderEmail, // Your backend expects snake_case
      course: form.degree,
      grade: form.grade,
      completionDate: form.date,
    };

    try {
      // 2. USE your apiClient for the POST request
      const response = await apiClient.post('/issue_vc', payload);
      
      // The apiClient automatically handles success/error status,
      // throwing an error on non-2xx responses.
      const issuedVc = response.data;
      setVc(issuedVc);
      alert('✅ Credential Issued Successfully');
      setForm({ name: '', holderEmail: '', degree: '', grade: '', date: '' });

    } catch (err) {
      // apiClient errors can be handled gracefully
      let errorMessage = 'An unknown error occurred.';
      if (err.response && err.response.data && err.response.data.error) {
          errorMessage = err.response.data.error;
      } else if (err.response && err.response.data && err.response.data.message) {
          errorMessage = err.response.data.message;
      } else if (err.message) {
          errorMessage = err.message;
      }
      
      console.error('Error issuing credential:', err.response || err);
      setError(`❌ Failed to issue credential: ${errorMessage}`);
      alert(`❌ Failed to issue credential: ${errorMessage}`);
    } finally {
      setIsIssuing(false); // Re-enable the button
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg mb-8">
        <h2 className="text-xl font-bold mb-4">🎓 Issue Credential</h2>
        <input
          name="name"
          placeholder="Recipient's Name"
          value={form.name}
          onChange={handleChange}
          className="w-full p-2 border rounded mb-3"
        />
        <input
          name="holderEmail" // Corrected: Input name matches state key
          placeholder="Holder Email"
          value={form.holderEmail}
          onChange={handleChange}
          className="w-full p-2 border rounded mb-3"
        />
        <input
          name="degree"
          placeholder="Degree Title"
          value={form.degree}
          onChange={handleChange}
          className="w-full p-2 border rounded mb-3"
        />
        <input
          name="grade"
          placeholder="Grade"
          value={form.grade}
          onChange={handleChange}
          className="w-full p-2 border rounded mb-3"
        />
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          className="w-full p-2 border rounded mb-4"
        />
        <button
          onClick={handleIssue}
          className="bg-green-600 hover:bg-green-700 text-white w-full py-2 rounded"
        >
          Issue Credential
        </button>
      </div>

      {vc && (
        <div className="w-full max-w-lg"> {/* Added a div for consistent width */}
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(vc, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'verifiable-credential.json';
              document.body.appendChild(a); // Append to body to ensure it's clickable in all browsers
              a.click();
              document.body.removeChild(a); // Clean up
              URL.revokeObjectURL(url);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded"
          >
            📄 Download Credential as JSON
          </button>
        </div>
      )}
    </div>
  );
};

export default IssuerPortal;