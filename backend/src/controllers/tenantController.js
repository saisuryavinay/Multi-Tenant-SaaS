const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');

// Get Tenant Details (API 5)
exports.getTenantDetails = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { role, tenantId: userTenantId } = req.user;

    // Authorization check
    if (role !== 'super_admin' && userTenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const result = await pool.query(`
      SELECT t.*,
             (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as total_users,
             (SELECT COUNT(*) FROM projects WHERE tenant_id = t.id) as total_projects,
             (SELECT COUNT(*) FROM tasks WHERE tenant_id = t.id) as total_tasks
      FROM tenants t
      WHERE t.id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const tenant = result.rows[0];

    res.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        status: tenant.status,
        subscriptionPlan: tenant.subscription_plan,
        maxUsers: tenant.max_users,
        maxProjects: tenant.max_projects,
        createdAt: tenant.created_at,
        stats: {
          totalUsers: parseInt(tenant.total_users),
          totalProjects: parseInt(tenant.total_projects),
          totalTasks: parseInt(tenant.total_tasks)
        }
      }
    });

  } catch (error) {
    console.error('Get tenant details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tenant details'
    });
  }
};

// Update Tenant (API 6)
exports.updateTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { name, status, subscriptionPlan, maxUsers, maxProjects } = req.body;
    const { role, tenantId: userTenantId } = req.user;

    // Authorization check
    if (role !== 'super_admin' && role !== 'tenant_admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    if (role !== 'super_admin' && userTenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Tenant admins can only update name
    if (role === 'tenant_admin' && (status || subscriptionPlan || maxUsers || maxProjects)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to update these fields'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (status !== undefined && role === 'super_admin') {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (subscriptionPlan !== undefined && role === 'super_admin') {
      updates.push(`subscription_plan = $${paramCount++}`);
      values.push(subscriptionPlan);
    }
    if (maxUsers !== undefined && role === 'super_admin') {
      updates.push(`max_users = $${paramCount++}`);
      values.push(maxUsers);
    }
    if (maxProjects !== undefined && role === 'super_admin') {
      updates.push(`max_projects = $${paramCount++}`);
      values.push(maxProjects);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(tenantId);

    const query = `
      UPDATE tenants
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, subdomain, status, subscription_plan, max_users, max_projects, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    await logAudit(tenantId, req.user.userId, 'UPDATE_TENANT', 'tenant', tenantId, req.ip);

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tenant'
    });
  }
};

// List All Tenants (API 7)
exports.listTenants = async (req, res) => {
  try {
    const { role } = req.user;

    // Only super_admin can list all tenants
    if (role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const { page = 1, limit = 10, status, subscriptionPlan } = req.query;
    const offset = (page - 1) * Math.min(limit, 100);

    let whereClause = [];
    let values = [];
    let paramCount = 1;

    if (status) {
      whereClause.push(`t.status = $${paramCount++}`);
      values.push(status);
    }

    if (subscriptionPlan) {
      whereClause.push(`t.subscription_plan = $${paramCount++}`);
      values.push(subscriptionPlan);
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const countQuery = `SELECT COUNT(*) FROM tenants t ${whereSQL}`;
    const countResult = await pool.query(countQuery, values);
    const totalTenants = parseInt(countResult.rows[0].count);

    values.push(Math.min(limit, 100));
    values.push(offset);

    const query = `
      SELECT t.*,
             (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as total_users,
             (SELECT COUNT(*) FROM projects WHERE tenant_id = t.id) as total_projects
      FROM tenants t
      ${whereSQL}
      ORDER BY t.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: {
        tenants: result.rows.map(t => ({
          id: t.id,
          name: t.name,
          subdomain: t.subdomain,
          status: t.status,
          subscriptionPlan: t.subscription_plan,
          totalUsers: parseInt(t.total_users),
          totalProjects: parseInt(t.total_projects),
          createdAt: t.created_at
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTenants / Math.min(limit, 100)),
          totalTenants: totalTenants,
          limit: Math.min(limit, 100)
        }
      }
    });

  } catch (error) {
    console.error('List tenants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list tenants'
    });
  }
};
