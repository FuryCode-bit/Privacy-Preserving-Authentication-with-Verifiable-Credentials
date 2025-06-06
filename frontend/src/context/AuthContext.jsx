import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        try {
          const response = await apiClient.get('/me');
          setUser(response.data);
        } catch (error) {
          console.error("Session token is invalid.", error);
          localStorage.removeItem('jwt_token');
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('jwt_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setUser(null);
  };

  const value = { user, isLoading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};