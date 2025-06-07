import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import IssuerPortal from './pages/IssuerPortal';
import VerifierPage from './pages/VerifierPage';
import Dashboard from './pages/Dashboard';

// The ONLY import you need for protection and layout
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
      {/* --- Public Route --- */}
      <Route path="/login" element={<Login />} />

      {/* --- Protected Routes --- */}
      {/* Each route is explicitly protected and given the standard layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      
      {/* The Issuer page is protected AND requires the "issuer" role */}
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
          <ProtectedRoute>
            <VerifierPage />
          </ProtectedRoute>
        }
      />
      
      {/* --- Default & Fallback Routes --- */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;