import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, tenantAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState(localStorage.getItem('activeTenantId'));

  const setActiveTenant = (tenantId) => {
    setActiveTenantId(tenantId);
    if (tenantId) {
      localStorage.setItem('activeTenantId', tenantId);
    } else {
      localStorage.removeItem('activeTenantId');
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      // Hydrate quickly from local storage to avoid UI flicker while we re-validate the session
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (err) {
          localStorage.removeItem('user');
        }
      }

      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          const userData = response.data.data;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));

          // If super admin, fetch tenants and set default active tenant
          if (userData.role === 'super_admin') {
            const tenantsRes = await tenantAPI.listTenants();
            const fetchedTenants = tenantsRes.data.data.tenants || [];
            setTenants(fetchedTenants);

            if (!activeTenantId && fetchedTenants.length > 0) {
              const defaultTenantId = fetchedTenants[0].id;
              setActiveTenant(defaultTenantId);
            }
          }
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials) => {
    const response = await authAPI.login(credentials);
    const { token } = response.data.data;

    // Persist token first so subsequent requests (including /auth/me) are authorized
    localStorage.setItem('token', token);

    // Fetch a canonical user shape (with tenant object) to keep UI code consistent
    const meResponse = await authAPI.getCurrentUser();
    const userData = meResponse.data.data;
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    if (userData.role === 'super_admin') {
      const tenantsRes = await tenantAPI.listTenants();
      const fetchedTenants = tenantsRes.data.data.tenants || [];
      setTenants(fetchedTenants);
      if (fetchedTenants.length > 0) {
        setActiveTenant(fetchedTenants[0].id);
      }
    } else {
      setActiveTenant(null);
    }

    return meResponse;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeTenantId');
    setUser(null);
    setTenants([]);
    setActiveTenantId(null);
  };

  const register = async (data) => {
    return await authAPI.registerTenant(data);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      register,
      tenants,
      activeTenantId,
      setActiveTenant
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
