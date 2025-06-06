// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import IssuerPortal from './pages/IssuerPortal';
import VerifierPage from './pages/VerifierPage';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute'; // Import our gatekeeper
import './App.css';

function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/issuer"
        element={
          <ProtectedRoute requiredRole="issuer"> {/* Only allows issuers */}
            <IssuerPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/verifier"
        element={
          <ProtectedRoute>
            <VerifierPage />
          </ProtectedRoute>
        }
      />
      
      {/* Default route redirects to login */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
}

export default App;