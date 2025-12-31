const pool = require('../src/config/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const runSeeds = async () => {
  try {
    console.log('Starting database seeding...');
    
    // Hash passwords
    const superAdminPassword = await bcrypt.hash('Admin@123', 10);
    const demoAdminPassword = await bcrypt.hash('Demo@123', 10);
    const user1Password = await bcrypt.hash('User@123', 10);
    const user2Password = await bcrypt.hash('User@123', 10);

    // Insert super admin with conflict handling
    const superAdminId = uuidv4();
    const superAdminEmail = 'superadmin@system.com';
    
    const superAdminResult = await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, NULL, $2, $3, $4, $5, TRUE, NOW())
      ON CONFLICT (email) WHERE tenant_id IS NULL
      DO NOTHING
      RETURNING id
    `, [superAdminId, superAdminEmail, superAdminPassword, 'Super Administrator', 'super_admin']);
    
    if (superAdminResult.rows.length > 0) {
      console.log('✓ Super admin created:', superAdminResult.rows[0].id);
    } else {
      console.log('✓ Super admin already exists');
    }

    // Insert Demo Company tenant with conflict handling
    const demoTenantId = uuidv4();
    const tenantResult = await pool.query(`
      INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (subdomain) DO NOTHING
      RETURNING id
    `, [demoTenantId, 'Demo Company', 'demo', 'active', 'pro', 25, 15]);
    
    let actualTenantId;
    if (tenantResult.rows.length > 0) {
      actualTenantId = tenantResult.rows[0].id;
      console.log('✓ Demo tenant created:', actualTenantId);
    } else {
      // If conflict, retrieve existing tenant
      const existingTenant = await pool.query('SELECT id FROM tenants WHERE subdomain = $1', ['demo']);
      actualTenantId = existingTenant.rows[0].id;
      console.log('✓ Demo tenant already exists:', actualTenantId);
    }

    // Insert tenant admin for Demo Company
    const adminId = uuidv4();
    const adminEmail = 'admin@demo.com';
    
    const adminResult = await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (tenant_id, email) DO NOTHING
      RETURNING id
    `, [adminId, actualTenantId, adminEmail, demoAdminPassword, 'Demo Admin', 'tenant_admin']);
    
    let actualAdminId;
    if (adminResult.rows.length > 0) {
      actualAdminId = adminResult.rows[0].id;
      console.log('✓ Tenant admin created:', actualAdminId);
    } else {
      // If conflict, retrieve existing admin
      const existingAdmin = await pool.query(
        'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
        [actualTenantId, adminEmail]
      );
      actualAdminId = existingAdmin.rows[0].id;
      console.log('✓ Tenant admin already exists:', actualAdminId);
    }

    // Insert regular users
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    const user1Email = 'user1@demo.com';
    const user2Email = 'user2@demo.com';
    
    const user1Result = await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (tenant_id, email) DO NOTHING
      RETURNING id
    `, [user1Id, actualTenantId, user1Email, user1Password, 'User One', 'user']);
    
    let actualUser1Id;
    if (user1Result.rows.length > 0) {
      actualUser1Id = user1Result.rows[0].id;
      console.log('✓ User One created:', actualUser1Id);
    } else {
      const existingUser1 = await pool.query(
        'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
        [actualTenantId, user1Email]
      );
      actualUser1Id = existingUser1.rows[0].id;
      console.log('✓ User One already exists:', actualUser1Id);
    }

    const user2Result = await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (tenant_id, email) DO NOTHING
      RETURNING id
    `, [user2Id, actualTenantId, user2Email, user2Password, 'User Two', 'user']);
    
    let actualUser2Id;
    if (user2Result.rows.length > 0) {
      actualUser2Id = user2Result.rows[0].id;
      console.log('✓ User Two created:', actualUser2Id);
    } else {
      const existingUser2 = await pool.query(
        'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
        [actualTenantId, user2Email]
      );
      actualUser2Id = existingUser2.rows[0].id;
      console.log('✓ User Two already exists:', actualUser2Id);
    }

    // Insert sample projects
    const project1Id = uuidv4();
    const project2Id = uuidv4();
    
    const proj1Result = await pool.query(`
      INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [project1Id, actualTenantId, 'Website Redesign', 'Complete redesign of company website', 'active', actualAdminId]);
    
    let actualProj1Id;
    if (proj1Result.rows.length > 0) {
      actualProj1Id = proj1Result.rows[0].id;
      console.log('✓ Project 1 created:', actualProj1Id);
    } else {
      const existingProj1 = await pool.query(
        'SELECT id FROM projects WHERE tenant_id = $1 AND name = $2',
        [actualTenantId, 'Website Redesign']
      );
      actualProj1Id = existingProj1.rows[0].id;
      console.log('✓ Project 1 already exists:', actualProj1Id);
    }

    const proj2Result = await pool.query(`
      INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [project2Id, actualTenantId, 'Mobile App Development', 'Develop mobile app for iOS and Android', 'active', actualAdminId]);
    
    let actualProj2Id;
    if (proj2Result.rows.length > 0) {
      actualProj2Id = proj2Result.rows[0].id;
      console.log('✓ Project 2 created:', actualProj2Id);
    } else {
      const existingProj2 = await pool.query(
        'SELECT id FROM projects WHERE tenant_id = $1 AND name = $2',
        [actualTenantId, 'Mobile App Development']
      );
      actualProj2Id = existingProj2.rows[0].id;
      console.log('✓ Project 2 already exists:', actualProj2Id);
    }

    // Insert sample tasks
    const tasksCheck = await pool.query(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id IN ($1, $2)',
      [actualProj1Id, actualProj2Id]
    );
    
    if (tasksCheck.rows[0].count === '0' || tasksCheck.rows[0].count === 0) {
      await pool.query(`
        INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at)
        VALUES 
          ($1, $2, $3, 'Design homepage mockup', 'Create high-fidelity mockup for homepage', 'in_progress', 'high', $4, CURRENT_DATE + INTERVAL '7 days', NOW()),
          ($5, $2, $3, 'Review design system', 'Audit and update design system components', 'todo', 'medium', $6, CURRENT_DATE + INTERVAL '10 days', NOW()),
          ($7, $2, $3, 'Implement responsive layout', 'Code responsive layout for all pages', 'todo', 'high', $4, CURRENT_DATE + INTERVAL '14 days', NOW()),
          ($8, $9, $3, 'Setup development environment', 'Configure React Native development setup', 'completed', 'high', $6, CURRENT_DATE - INTERVAL '2 days', NOW()),
          ($10, $9, $3, 'Design app navigation', 'Create navigation structure and wireframes', 'in_progress', 'medium', $4, CURRENT_DATE + INTERVAL '5 days', NOW())
      `, [uuidv4(), actualProj1Id, actualTenantId, actualUser1Id, 
          uuidv4(), actualUser2Id, 
          uuidv4(), 
          uuidv4(), actualProj2Id, 
          uuidv4()]);
      console.log('✓ Sample tasks created');
    } else {
      console.log('✓ Sample tasks already exist');
    }

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nTest credentials:');
    console.log('Super Admin: superadmin@system.com / Admin@123');
    console.log('Tenant Admin (demo): admin@demo.com / Demo@123');
    console.log('User 1 (demo): user1@demo.com / User@123');
    console.log('User 2 (demo): user2@demo.com / User@123');

  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
};

if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runSeeds;
