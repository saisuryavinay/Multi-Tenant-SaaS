import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { taskAPI, userAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function ProjectDetails() {
  const { projectId } = useParams();
  const { user, loading: authLoading, activeTenantId } = useAuth();
  const isReadOnly = user?.role === 'super_admin' || user?.role === 'superadmin';
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignedTo: '',
    dueDate: ''
  });

  const fetchData = useCallback(async (tenantId) => {
    try {
      setLoadingData(true);
      const [tasksRes, usersRes] = await Promise.all([
        taskAPI.listTasks(projectId),
        userAPI.listUsers(tenantId)
      ]);
      setTasks(tasksRes.data.data.tasks);
      setUsers(usersRes.data.data.users);
      setLoadingData(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoadingData(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (authLoading) return;
    const tenantId = user?.role === 'super_admin' ? activeTenantId : user?.tenant?.id;
    if (!tenantId) return;
    fetchData(tenantId);
  }, [projectId, authLoading, user, activeTenantId, fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await taskAPI.createTask(projectId, {
        ...formData,
        assignedTo: formData.assignedTo || null
      });
      setShowModal(false);
      setFormData({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' });
      const tenantId = user?.role === 'super_admin' ? activeTenantId : user?.tenant?.id;
      if (tenantId) {
        fetchData(tenantId);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create task');
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await taskAPI.updateTaskStatus(taskId, { status: newStatus });
      const tenantId = user?.role === 'super_admin' ? activeTenantId : user?.tenant?.id;
      if (tenantId) {
        fetchData(tenantId);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update task status');
    }
  };

  if (authLoading || loadingData) return (
    <div>
      <Navbar />
      <div className="loading">Loading...</div>
    </div>
  );

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Project Tasks</h2>
            {!isReadOnly && <button onClick={() => setShowModal(true)} className="btn btn-primary">Add Task</button>}
          </div>
          {tasks.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    <td>{task.title}</td>
                    <td>{task.description || '-'}</td>
                    <td>
                      <select
                        value={task.status}
                        onChange={isReadOnly ? undefined : (e) => updateTaskStatus(task.id, e.target.value)}
                        disabled={isReadOnly}
                        className={`badge badge-${task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'warning' : 'info'}`}
                        style={{border: 'none', cursor: isReadOnly ? 'default' : 'pointer'}}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-text">No tasks yet. Create your first task!</div>
            </div>
          )}
        </div>
      </div>

      {showModal && !isReadOnly && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Task</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Task Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
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
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  style={{width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ddd'}}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label>Assign To</label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                  style={{width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ddd'}}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary">Create Task</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetails;
