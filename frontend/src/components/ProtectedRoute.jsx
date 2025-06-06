// src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  // 1. Get Authentication State
  const { user } = useAuth();
  const location = useLocation();

  // 2. The Main Security Check
  if (!user) {
    // 3. The Redirect Logic
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 5. Permission Granted
  return children;
};

export default ProtectedRoute;