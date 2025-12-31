const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logAudit } = require('../utils/auditLogger');

// Create Project (API 12)
exports.createProject = async (req, res) => {
  try {

    // Super admins have read-only access in the new policy
    if (role === 'super_admin' || role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Superadmin has read-only access and cannot create projects' });
    }
    const { name, description, status, tenantId: bodyTenantId } = req.body;
    const { userId, tenantId: userTenantId, role } = req.user;

    // Super admin can specify tenantId in body; others use their own tenant
    const effectiveTenantId = role === 'super_admin' ? (bodyTenantId || userTenantId) : userTenantId;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }

    if (!effectiveTenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    // Check subscription limit
    const tenantResult = await pool.query(
      'SELECT max_projects, (SELECT COUNT(*) FROM projects WHERE tenant_id = $1) as current_projects FROM tenants WHERE id = $1',
      [effectiveTenantId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const { max_projects, current_projects } = tenantResult.rows[0];

    if (parseInt(current_projects) >= max_projects) {
      return res.status(403).json({
        success: false,
        message: 'Project limit reached'
      });
    }

    // Create project
    const projectId = uuidv4();
    const result = await pool.query(`
      INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, tenant_id, name, description, status, created_by, created_at
    `, [projectId, effectiveTenantId, name, description, status || 'active', userId]);

    await logAudit(effectiveTenantId, userId, 'CREATE_PROJECT', 'project', projectId, req.ip);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project'
    });
  }
};

// List Projects (API 13)
exports.listProjects = async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const { status, search, tenantId: queryTenantId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * Math.min(limit, 100);

    // Super admin can specify tenantId via query; tenant admins/users are restricted to their own tenant
    const effectiveTenantId = role === 'super_admin' ? (queryTenantId || tenantId) : tenantId;

    if (!effectiveTenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    let whereClause = ['p.tenant_id = $1'];
    let values = [effectiveTenantId];
    let paramCount = 2;

    if (status) {
      whereClause.push(`p.status = $${paramCount++}`);
      values.push(status);
    }

    if (search) {
      whereClause.push(`LOWER(p.name) LIKE $${paramCount++}`);
      values.push(`%${search.toLowerCase()}%`);
    }

    const whereSQL = 'WHERE ' + whereClause.join(' AND ');

    const countQuery = `SELECT COUNT(*) FROM projects p ${whereSQL}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(Math.min(limit, 100));
    values.push(offset);

    const query = `
      SELECT p.id, p.name, p.description, p.status, p.created_at,
             u.id as creator_id, u.full_name as creator_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') as completed_task_count
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      ${whereSQL}
      ORDER BY p.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: {
        projects: result.rows.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          createdBy: {
            id: p.creator_id,
            fullName: p.creator_name
          },
          taskCount: parseInt(p.task_count),
          completedTaskCount: parseInt(p.completed_task_count),
          createdAt: p.created_at
        })),
        total: total,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / Math.min(limit, 100)),
          limit: Math.min(limit, 100)
        }
      }
    });

  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list projects'
    });
  }
};

// Update Project (API 14)
exports.updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, status } = req.body;
    const { role, userId, tenantId } = req.user;

    if (role === 'super_admin' || role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Superadmin has read-only access and cannot update projects' });
    }

    // Get project
    const projectResult = await pool.query(
      'SELECT tenant_id, created_by FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projectResult.rows[0];

    // Authorization check
    if (role !== 'super_admin' && project.tenant_id !== tenantId) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (role !== 'super_admin' && role !== 'tenant_admin' && project.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(projectId);

    const query = `
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, description, status, updated_at
    `;

    const result = await pool.query(query, values);

    await logAudit(tenantId, userId, 'UPDATE_PROJECT', 'project', projectId, req.ip);

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project'
    });
  }
};

// Delete Project (API 15)
exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { role, userId, tenantId } = req.user;

    if (role === 'super_admin' || role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Superadmin has read-only access and cannot delete projects' });
    }

    // Get project
    const projectResult = await pool.query(
      'SELECT tenant_id, created_by FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projectResult.rows[0];

    // Authorization check
    if (role !== 'super_admin' && project.tenant_id !== tenantId) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (role !== 'super_admin' && role !== 'tenant_admin' && project.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);

    await logAudit(tenantId, userId, 'DELETE_PROJECT', 'project', projectId, req.ip);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project'
    });
  }
};
