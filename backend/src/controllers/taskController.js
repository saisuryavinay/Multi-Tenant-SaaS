const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logAudit } = require('../utils/auditLogger');

// Create Task (API 16)
exports.createTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, assignedTo, priority, dueDate } = req.body;
    const { userId, tenantId, role } = req.user;

    // Validation
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }

    // Get project and verify tenant
    const projectResult = await pool.query(
      'SELECT tenant_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const projectTenantId = projectResult.rows[0].tenant_id;

    // Super admin can create tasks in any project; tenant users must match
    if (role !== 'super_admin' && projectTenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Project does not belong to your tenant'
      });
    }

    // If assignedTo provided, verify user belongs to same tenant
    if (assignedTo) {
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
        [assignedTo, projectTenantId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user does not belong to same tenant'
        });
      }
    }

    // Create task
    const taskId = uuidv4();
    const result = await pool.query(`
      INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [taskId, projectId, projectTenantId, title, description, priority || 'medium', assignedTo || null, dueDate || null]);

    await logAudit(tenantId, userId, 'CREATE_TASK', 'task', taskId, req.ip);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
};

// List Project Tasks (API 17)
exports.listTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tenantId, role } = req.user;
    const { status, assignedTo, priority, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * Math.min(limit, 100);

    console.log('[LIST_TASKS] Called for projectId:', projectId, 'role:', role, 'tenantId:', tenantId);

    // Verify project belongs to tenant (super_admin can access any)
    const projectCheck = await pool.query(
      role === 'super_admin'
        ? 'SELECT id, tenant_id FROM projects WHERE id = $1'
        : 'SELECT id, tenant_id FROM projects WHERE id = $1 AND tenant_id = $2',
      role === 'super_admin' ? [projectId] : [projectId, tenantId]
    );

    console.log('[LIST_TASKS] Project check result:', projectCheck.rows);

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const effectiveTenantId = projectCheck.rows[0].tenant_id || tenantId;

    let whereClause = ['t.project_id = $1'];
    let values = [projectId];
    let paramCount = 2;

    if (status) {
      whereClause.push(`t.status = $${paramCount++}`);
      values.push(status);
    }

    if (assignedTo) {
      whereClause.push(`t.assigned_to = $${paramCount++}`);
      values.push(assignedTo);
    }

    if (priority) {
      whereClause.push(`t.priority = $${paramCount++}`);
      values.push(priority);
    }

    if (search) {
      whereClause.push(`LOWER(t.title) LIKE $${paramCount++}`);
      values.push(`%${search.toLowerCase()}%`);
    }

    const whereSQL = 'WHERE ' + whereClause.join(' AND ');

    const countQuery = `SELECT COUNT(*) FROM tasks t ${whereSQL}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    values.push(Math.min(limit, 100));
    values.push(offset);

    const query = `
      SELECT t.*,
             u.id as assigned_user_id, u.full_name as assigned_user_name, u.email as assigned_user_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      ${whereSQL}
      ORDER BY 
        CASE t.priority 
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        t.due_date ASC NULLS LAST
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    const result = await pool.query(query, values);
    
    console.log('[LIST_TASKS] Found', result.rows.length, 'tasks');

    res.json({
      success: true,
      data: {
        tasks: result.rows.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assigned_to ? {
            id: t.assigned_user_id,
            fullName: t.assigned_user_name,
            email: t.assigned_user_email
          } : null,
          dueDate: t.due_date,
          createdAt: t.created_at
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
    console.error('List tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list tasks'
    });
  }
};

// Update Task Status (API 18)
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    const { tenantId, userId, role } = req.user;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Get task and verify tenant (super_admin can update any task)
    const taskCheck = await pool.query(
      role === 'super_admin'
        ? 'SELECT id, tenant_id FROM tasks WHERE id = $1'
        : 'SELECT id, tenant_id FROM tasks WHERE id = $1 AND tenant_id = $2',
      role === 'super_admin' ? [taskId] : [taskId, tenantId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const auditTenantId = taskCheck.rows[0].tenant_id || tenantId;

    const result = await pool.query(`
      UPDATE tasks
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, status, updated_at
    `, [status, taskId]);

    await logAudit(auditTenantId, userId, 'UPDATE_TASK_STATUS', 'task', taskId, req.ip);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task status'
    });
  }
};

// Update Task (API 19)
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status, priority, assignedTo, dueDate } = req.body;
    const { tenantId, userId, role } = req.user;

    // Get task and verify tenant (super_admin can edit any task)
    const taskCheck = await pool.query(
      role === 'super_admin'
        ? 'SELECT id, tenant_id FROM tasks WHERE id = $1'
        : 'SELECT id, tenant_id FROM tasks WHERE id = $1 AND tenant_id = $2',
      role === 'super_admin' ? [taskId] : [taskId, tenantId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const auditTenantId = taskCheck.rows[0].tenant_id || tenantId;

    // If assignedTo provided, verify user belongs to same tenant
    if (assignedTo !== undefined && assignedTo !== null) {
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
        [assignedTo, tenantId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user does not belong to same tenant'
        });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(assignedTo);
    }
    if (dueDate !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(dueDate);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(taskId);

    const query = `
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING t.*, u.id as assigned_user_id, u.full_name as assigned_user_name, u.email as assigned_user_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $${paramCount}
    `;

    const result = await pool.query(query, values);

    await logAudit(auditTenantId, userId, 'UPDATE_TASK', 'task', taskId, req.ip);

    const task = result.rows[0];

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assigned_to ? {
          id: task.assigned_user_id,
          fullName: task.assigned_user_name,
          email: task.assigned_user_email
        } : null,
        dueDate: task.due_date,
        updatedAt: task.updated_at
      }
    });

  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
};
