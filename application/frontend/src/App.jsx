import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import IssuerPortal from './pages/IssuerPortal';
import VerifierPage from './pages/VerifierPage';
import Dashboard from './pages/Dashboard';
import RegisterHolder from './pages/RegisterHolder';

import ProtectedRoute from './components/ProtectedRoute'; 
import './App.css';

const NotFound = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h1>404 | Page Not Found</h1>
    </div>
);

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
    
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/register-holder"
        element={
          <ProtectedRoute requiredRole="issuer">
            <RegisterHolder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/issuer"
        element={
          <ProtectedRoute requiredRole="issuer">
            <IssuerPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/verifier"
        element={
          <VerifierPage />
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;