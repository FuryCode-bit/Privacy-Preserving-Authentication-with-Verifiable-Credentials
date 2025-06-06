import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient'; // Corrected the import path assuming apiClient.js is in src/api/

// --- NEW: Import useAuth to connect to the context ---
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const navigate = useNavigate();

  // --- NEW: Get the login function from the AuthContext ---
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      const response = await apiClient.post('/login', { email, password });
      
      if (response.data.token && response.data.user) {
        // Now this 'login' function is defined because we got it from useAuth()
        login(response.data.user, response.data.token);

        // Navigate to the correct page after a successful login
        if (response.data.user.role === 'issuer') {
          navigate('/issuer');
        } else {
          // Default to dashboard for holder/verifier
          navigate('/dashboard');
        }
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message || 'Login failed. Please check your credentials.');
      } else {
        setError("An error occurred. Please try again later.");
      }
      console.error("Login error:", err);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-6">VC Diploma Login</h1>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <label className="block mb-1 font-medium text-sm">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded mb-4 text-sm"
          placeholder="you@example.com"
        />

        <label className="block mb-1 font-medium text-sm">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded mb-4 text-sm"
          placeholder="••••••••"
        />

        {/* This role selector is now mostly for initial UI preference before true auth */}
        <label className="block mb-1 font-medium text-sm">Preferred Role (for navigation after login)</label>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="w-full border p-2 rounded mb-6 text-sm"
        >
          <option value="issuer">Issuer</option>
          <option value="verifier">Verifier</option>
        </select>

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default Login;