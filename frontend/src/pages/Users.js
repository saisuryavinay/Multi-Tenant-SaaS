import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { userAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function Users() {
  const navigate = useNavigate();
  const { user, loading: authLoading, tenants, activeTenantId, setActiveTenant } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'user'
  });

  useEffect(() => {
    if (authLoading) return;

    const isSuperAdmin = user?.role === 'super_admin';
    const tenantId = isSuperAdmin ? activeTenantId : user?.tenant?.id;

    if (!isSuperAdmin && !tenantId) {
      navigate('/login');
      return;
    }

    if (!isSuperAdmin && user.role !== 'tenant_admin') {
      navigate('/dashboard');
      return;
    }

    if (tenantId) {
      fetchUsers(tenantId);
    }
  }, [authLoading, user, navigate, activeTenantId]);

  const fetchUsers = async (tenantId) => {
    try {
      setLoadingData(true);
      const response = await userAPI.listUsers(tenantId);
      setUsers(response.data.data.users);
      setLoadingData(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tenantId = user?.role === 'super_admin' ? activeTenantId : user.tenant.id;
    try {
      await userAPI.addUser(tenantId, formData);
      setShowModal(false);
      setFormData({ email: '', password: '', fullName: '', role: 'user' });
      fetchUsers(tenantId);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    const tenantId = user?.role === 'super_admin' ? activeTenantId : user.tenant.id;
    try {
      await userAPI.deleteUser(userId);
      fetchUsers(tenantId);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const tenantId = isSuperAdmin ? activeTenantId : user?.tenant?.id;
  const requiresTenantSelection = isSuperAdmin && !tenantId;

  if (authLoading || loadingData) return (
    <div>
      <Navbar />
      <div className="loading">Loading...</div>
    </div>
  );

  if (requiresTenantSelection) {
    return (
      <div>
        <Navbar />
        <div className="container">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Team Members</h2>
            </div>
            <div style={{ padding: '16px' }}>
              <p>Please select a tenant to manage users.</p>
              <select
                value={activeTenantId || ''}
                onChange={(e) => setActiveTenant(e.target.value || null)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="">Select tenant</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="card">
          <div className="card-header" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <h2 className="card-title" style={{ flex: 1 }}>Team Members</h2>
            {isSuperAdmin && (
              <select
                value={activeTenantId || ''}
                onChange={(e) => setActiveTenant(e.target.value || null)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <button onClick={() => setShowModal(true)} className="btn btn-primary">Add User</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-primary">{u.role}</span></td>
                  <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    {u.id !== user.id && (
                      <button onClick={() => handleDelete(u.id)} className="btn btn-danger">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add User</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  minLength="8"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  style={{width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ddd'}}
                >
                  <option value="user">User</option>
                  <option value="tenant_admin">Tenant Admin</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">Add User</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
