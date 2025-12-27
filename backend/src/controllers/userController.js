const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { logAudit } = require('../utils/auditLogger');

// Add User to Tenant (API 8)
exports.addUser = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { email, password, fullName, role } = req.body;
    const { role: userRole, tenantId: userTenantId } = req.user;

    // Only tenant_admin can add users
    if (userRole !== 'tenant_admin' || userTenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and full name are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Check subscription limit
    const tenantResult = await pool.query(
      'SELECT max_users, (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as current_users FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const { max_users, current_users } = tenantResult.rows[0];

    if (parseInt(current_users) >= max_users) {
      return res.status(403).json({
        success: false,
        message: 'Subscription limit reached'
      });
    }

    // Check email uniqueness within tenant
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
      [tenantId, email.toLowerCase()]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists in this tenant'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const newUserRole = role || 'user';

    const result = await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      RETURNING id, email, full_name, role, tenant_id, is_active, created_at
    `, [userId, tenantId, email.toLowerCase(), passwordHash, fullName, newUserRole]);

    await logAudit(tenantId, req.user.userId, 'CREATE_USER', 'user', userId, req.ip);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

// List Tenant Users (API 9)
exports.listUsers = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { tenantId: userTenantId, role: userRole } = req.user;

    // Authorization: tenant users must match tenant; super_admin can view any
    if (userRole !== 'super_admin' && userTenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { search, role, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * Math.min(limit, 100);

    let whereClause = ['tenant_id = $1'];
    let values = [tenantId];
    let paramCount = 2;

    if (search) {
      whereClause.push(`(LOWER(full_name) LIKE $${paramCount} OR LOWER(email) LIKE $${paramCount})`);
      values.push(`%${search.toLowerCase()}%`);
      paramCount++;
    }

    if (role) {
      whereClause.push(`role = $${paramCount++}`);
      values.push(role);
    }

    const whereSQL = 'WHERE ' + whereClause.join(' AND ');

    const countQuery = `SELECT COUNT(*) FROM users ${whereSQL}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(Math.min(limit, 100));
    values.push(offset);

    const query = `
      SELECT id, email, full_name, role, is_active, created_at
      FROM users
      ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: {
        users: result.rows,
        total: total,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / Math.min(limit, 100)),
          limit: Math.min(limit, 100)
        }
      }
    });

  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list users'
    });
  }
};

// Update User (API 10)
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, role, isActive } = req.body;
    const { role: userRole, userId: currentUserId, tenantId: userTenantId } = req.user;

    // Get target user
    const userResult = await pool.query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetTenantId = userResult.rows[0].tenant_id;

    // Authorization check
    const isSelf = userId === currentUserId;
    const isTenantAdmin = userRole === 'tenant_admin' && userTenantId === targetTenantId;

    if (!isSelf && !isTenantAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Users can only update their own fullName
    if (isSelf && !isTenantAdmin && (role !== undefined || isActive !== undefined)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to update these fields'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(fullName);
    }
    if (role !== undefined && isTenantAdmin) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (isActive !== undefined && isTenantAdmin) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, full_name, role, is_active, updated_at
    `;

    const result = await pool.query(query, values);

    await logAudit(targetTenantId, currentUserId, 'UPDATE_USER', 'user', userId, req.ip);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
};

// Delete User (API 11)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role: userRole, userId: currentUserId, tenantId: userTenantId } = req.user;

    // Cannot delete self
    if (userId === currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete yourself'
      });
    }

    // Get target user
    const userResult = await pool.query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetTenantId = userResult.rows[0].tenant_id;

    // Only tenant_admin can delete
    if (userRole !== 'tenant_admin' || userTenantId !== targetTenantId) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    await logAudit(targetTenantId, currentUserId, 'DELETE_USER', 'user', userId, req.ip);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};
