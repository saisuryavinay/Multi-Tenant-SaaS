import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { projectAPI } from '../services/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Dashboard() {
  const { user, activeTenantId } = useAuth();
  const [stats, setStats] = useState({ projects: 0, tasks: 0, completed: 0, pending: 0 });
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [activeTenantId, user?.role]);

  const fetchDashboardData = async () => {
    // Super admins need an active tenant to fetch projects
    if (user?.role === 'super_admin' && !activeTenantId) {
      setRecentProjects([]);
      setStats({ projects: 0, tasks: 0, completed: 0, pending: 0 });
      setLoading(false);
      return;
    }

    try {
      const params = {};
      if (user?.role === 'super_admin' && activeTenantId) {
        params.tenantId = activeTenantId;
      }

      const projectsRes = await projectAPI.listProjects(params);
      const projects = projectsRes.data.data.projects;
      
      setRecentProjects(projects.slice(0, 5));
      
      let totalTasks = 0;
      let completedTasks = 0;
      
      for (const project of projects) {
        totalTasks += project.taskCount;
        completedTasks += project.completedTaskCount;
      }
      
      setStats({
        projects: projects.length,
        tasks: totalTasks,
        completed: completedTasks,
        pending: totalTasks - completedTasks
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1 style={{ marginBottom: '30px' }}>Dashboard</h1>

        {user?.role === 'super_admin' && !activeTenantId && (
          <div className="info-banner">Select a tenant from the top-right to view data.</div>
        )}
        
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Projects</h3>
            <div className="stat-value">{stats.projects}</div>
          </div>
          <div className="stat-card">
            <h3>Total Tasks</h3>
            <div className="stat-value">{stats.tasks}</div>
          </div>
          <div className="stat-card">
            <h3>Completed Tasks</h3>
            <div className="stat-value">{stats.completed}</div>
          </div>
          <div className="stat-card">
            <h3>Pending Tasks</h3>
            <div className="stat-value">{stats.pending}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Projects</h2>
            <Link to="/projects" className="btn btn-primary">View All</Link>
          </div>
          {recentProjects.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Tasks</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map(project => (
                  <tr key={project.id}>
                    <td><Link to={`/projects/${project.id}`}>{project.name}</Link></td>
                    <td><span className={`badge badge-${project.status === 'active' ? 'success' : 'warning'}`}>{project.status}</span></td>
                    <td>{project.completedTaskCount}/{project.taskCount}</td>
                    <td>{project.createdBy?.fullName}</td>
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
    </div>
  );
}

export default Dashboard;
