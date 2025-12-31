import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { projectAPI } from '../services/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Projects() {
  const { user, loading: authLoading, tenants, activeTenantId, setActiveTenant } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    if (authLoading) return;

    const tenantId = user?.role === 'super_admin' ? activeTenantId : user?.tenant?.id;
    if (!tenantId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    fetchProjects(tenantId);
  }, [authLoading, user, activeTenantId]);

  const fetchProjects = async (tenantId) => {
    try {
      const response = await projectAPI.listProjects(user?.role === 'super_admin' ? { tenantId } : undefined);
      setProjects(response.data.data.projects);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const tenantId = user?.role === 'super_admin' ? activeTenantId : user?.tenant?.id;
      
      if (!tenantId) {
        alert('Please select a tenant first');
        return;
      }

      const payload = { ...formData };
      // Super admin must specify which tenant to create project for
      if (user?.role === 'super_admin') {
        payload.tenantId = tenantId;
      }
      
      await projectAPI.createProject(payload);
      setShowModal(false);
      setFormData({ name: '', description: '' });
      if (tenantId) fetchProjects(tenantId);
    } catch (error) {
      console.error('Error creating project:', error);
      alert(error.response?.data?.message || 'Failed to create project');
    }
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectAPI.deleteProject(projectId);
      const tenantId = user?.role === 'super_admin' ? activeTenantId : user?.tenant?.id;
      if (tenantId) fetchProjects(tenantId);
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(error.response?.data?.message || 'Failed to delete project');
    }
  };

  if (loading || authLoading) return (
    <div>
      <Navbar />
      <div className="loading">Loading...</div>
    </div>
  );

  const canShowSelector = user?.role === 'super_admin' || user?.role === 'superadmin';
  const isReadOnly = user?.role === 'super_admin' || user?.role === 'superadmin';
  const tenantId = user?.role === 'super_admin' ? activeTenantId : user?.tenant?.id;
  const requiresTenantSelection = canShowSelector && !tenantId;

  if (requiresTenantSelection) {
    return (
      <div>
        <Navbar />
        <div className="container">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Projects</h2>
            </div>
            <div style={{ padding: '16px' }}>
              <p>Please select a tenant to view projects.</p>
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
            <h2 className="card-title" style={{ flex: 1 }}>Projects</h2>
            {canShowSelector && (
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
            {!isReadOnly && <button onClick={() => setShowModal(true)} className="btn btn-primary">Create Project</button>}
          </div>
          {projects.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Tasks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project.id}>
                    <td><Link to={`/projects/${project.id}`}>{project.name}</Link></td>
                    <td>{project.description}</td>
                    <td><span className={`badge badge-${project.status === 'active' ? 'success' : 'warning'}`}>{project.status}</span></td>
                    <td>{project.completedTaskCount}/{project.taskCount}</td>
                    <td>
                      <Link to={`/projects/${project.id}`} className="btn btn-secondary">View</Link>
                      {!isReadOnly && (
                        <button onClick={() => handleDelete(project.id)} className="btn btn-danger" style={{marginLeft: '8px'}}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-text">No projects yet. Create your first project!</div>
            </div>
          )}
        </div>
      </div>

      {showModal && !isReadOnly && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Project</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  style={{width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ddd'}}
                />
              </div>
              <button type="submit" className="btn btn-primary">Create</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Projects;
