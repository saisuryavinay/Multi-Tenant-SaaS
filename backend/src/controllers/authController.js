const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { logAudit } = require('../utils/auditLogger');

// Register Tenant (API 1)
exports.registerTenant = async (req, res) => {
  const client = await pool.connect();
  try {
    const { tenantName, subdomain, adminEmail, adminPassword, adminFullName } = req.body;

    // Validation
    if (!tenantName || !subdomain || !adminEmail || !adminPassword || !adminFullName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (adminPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Check subdomain uniqueness
    const subdomainCheck = await client.query(
      'SELECT id FROM tenants WHERE subdomain = $1',
      [subdomain.toLowerCase()]
    );

    if (subdomainCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Subdomain already exists'
      });
    }

    // Start transaction
    await client.query('BEGIN');

    // Create tenant
    const tenantId = uuidv4();
    await client.query(`
      INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', 'free', 5, 3, NOW(), NOW())
    `, [tenantId, tenantName, subdomain.toLowerCase()]);

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const adminUserId = uuidv4();
    await client.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'tenant_admin', TRUE, NOW(), NOW())
    `, [adminUserId, tenantId, adminEmail.toLowerCase(), passwordHash, adminFullName]);

    // Commit transaction
    await client.query('COMMIT');

    // Log audit
    await logAudit(tenantId, adminUserId, 'REGISTER_TENANT', 'tenant', tenantId, req.ip);

    res.status(201).json({
      success: true,
      message: 'Tenant registered successfully',
      data: {
        tenantId: tenantId,
        subdomain: subdomain.toLowerCase(),
        adminUser: {
          id: adminUserId,
          email: adminEmail.toLowerCase(),
          fullName: adminFullName,
          role: 'tenant_admin'
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Register tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  } finally {
    client.release();
  }
};

// User Login (API 2)
exports.login = async (req, res) => {
  try {
    const { email, password, tenantSubdomain } = req.body;

    // Validation
    if (!email || !password) {
      console.log('[LOGIN] Missing fields:', { email: !!email, password: !!password });
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    console.log('[LOGIN] Attempting login for:', email, 'tenant:', tenantSubdomain);

    // Check if this is a superadmin login (no tenant subdomain required for system admin)
    let tenantId = null;
    if (tenantSubdomain) {
      // Regular tenant user login
      const tenantResult = await pool.query(
        'SELECT id, name, status, subscription_plan, max_users, max_projects FROM tenants WHERE subdomain = $1',
        [tenantSubdomain.toLowerCase()]
      );

      if (tenantResult.rows.length === 0) {
        console.log('[LOGIN] Tenant not found:', tenantSubdomain);
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      const tenant = tenantResult.rows[0];
      console.log('[LOGIN] Tenant found:', tenant.id);

      if (tenant.status !== 'active') {
        console.log('[LOGIN] Tenant suspended:', tenant.status);
        return res.status(403).json({
          success: false,
          message: 'Tenant account is suspended'
        });
      }
      tenantId = tenant.id;
    } else {
      console.log('[LOGIN] No tenant subdomain provided, checking for superadmin');
    }

    // Find user
    let userResult;
    if (tenantId) {
      // Tenant user
      userResult = await pool.query(
        'SELECT id, tenant_id, email, password_hash, full_name, role, is_active FROM users WHERE tenant_id = $1 AND email = $2',
        [tenantId, email.toLowerCase()]
      );

      // Fallback: allow superadmin login even if a tenant subdomain was provided
      if (userResult.rows.length === 0) {
        userResult = await pool.query(
          'SELECT id, tenant_id, email, password_hash, full_name, role, is_active FROM users WHERE tenant_id IS NULL AND email = $1',
          [email.toLowerCase()]
        );
      }
    } else {
      // Superadmin (no tenant)
      userResult = await pool.query(
        'SELECT id, tenant_id, email, password_hash, full_name, role, is_active FROM users WHERE tenant_id IS NULL AND email = $1',
        [email.toLowerCase()]
      );
    }

    if (userResult.rows.length === 0) {
      console.log('[LOGIN] User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];
    console.log('[LOGIN] User found:', user.id, 'active:', user.is_active);

    if (!user.is_active) {
      console.log('[LOGIN] User inactive:', user.id);
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    console.log('[LOGIN] Verifying password for:', user.id);
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('[LOGIN] Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('[LOGIN] Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Log audit
    await logAudit(user.tenant_id, user.id, 'LOGIN', 'user', user.id, req.ip);

    console.log('[LOGIN] Login successful for:', email);
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          tenantId: user.tenant_id
        },
        token: token,
        expiresIn: 86400
      }
    });

  } catch (error) {
    console.error('[LOGIN] Error:', error.message, error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Get Current User (API 3)
exports.getCurrentUser = async (req, res) => {
  try {
    const { userId } = req.user;

    const result = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.tenant_id,
             t.id as tenant_id, t.name as tenant_name, t.subdomain, t.subscription_plan, t.max_users, t.max_projects
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        tenant: user.tenant_id ? {
          id: user.tenant_id,
          name: user.tenant_name,
          subdomain: user.subdomain,
          subscriptionPlan: user.subscription_plan,
          maxUsers: user.max_users,
          maxProjects: user.max_projects
        } : null
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user'
    });
  }
};

// Logout (API 4)
exports.logout = async (req, res) => {
  try {
    // For JWT-only, just return success (client removes token)
    await logAudit(req.user.tenantId, req.user.userId, 'LOGOUT', 'user', req.user.userId, req.ip);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};
