import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { user, logout, tenants, activeTenantId, setActiveTenant } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">SaaS Platform</div>
      <ul className="navbar-menu">
        <li><Link to="/dashboard">Dashboard</Link></li>
        <li><Link to="/projects">Projects</Link></li>
        {user?.role === 'tenant_admin' && <li><Link to="/users">Users</Link></li>}
      </ul>
      <div className="navbar-user">
        {user?.role === 'super_admin' && (
          <div className="tenant-switcher">
            <label htmlFor="tenant-select" className="tenant-label">Tenant</label>
            <select
              id="tenant-select"
              value={activeTenantId || ''}
              onChange={(e) => setActiveTenant(e.target.value || null)}
            >
              <option value="">Select tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="user-info">
          <div className="user-name">{user?.fullName}</div>
          <div className="user-role">{user?.role}</div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
      </div>
    </nav>
  );
}

export default Navbar;
