import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from 'reactstrap';
import AppLayout from './AppLayout'; // The visual shell (Header, background, etc.)

/**
 * A powerful component that wraps a page to provide:
 * 1. Authentication check (must be logged in).
 * 2. Authorization check (must have a specific role, if required).
 * 3. A consistent visual layout (`AppLayout`).
 *
 * This is the single component used to protect all pages in the app.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The page component to render (e.g., <Dashboard />).
 * @param {string} [props.requiredRole] - Optional. The role the user must have to access the page.
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // 1. Handle loading state
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
      </div>
    );
  }

  // 2. Handle Authentication: Is the user logged in?
  if (!user) {
    // Not logged in, redirect to login page, saving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Handle Authorization: Does the user have the right role?
  if (requiredRole && user.role !== requiredRole) {
    // Logged in, but wrong role. Redirect to dashboard with an error message.
    return (
      <Navigate
        to="/dashboard"
        state={{
          alert: {
            message: 'Access Denied: You do not have permission to view this page.',
            color: 'danger',
          },
        }}
        replace
      />
    );
  }

  // 4. Success: User is authenticated and authorized. Render the page inside the standard layout.
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
};

export default ProtectedRoute;