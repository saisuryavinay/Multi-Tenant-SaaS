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

    // Insert super admin
    const superAdminId = uuidv4();
    await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, NULL, $2, $3, $4, $5, TRUE, NOW())
      ON CONFLICT DO NOTHING
    `, [superAdminId, 'superadmin@system.com', superAdminPassword, 'Super Administrator', 'super_admin']);
    console.log('✓ Super admin created');

    // Insert Demo Company tenant
    const demoTenantId = uuidv4();
    await pool.query(`
      INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (subdomain) DO NOTHING
    `, [demoTenantId, 'Demo Company', 'demo', 'active', 'pro', 25, 15]);
    console.log('✓ Demo tenant created');

    // Get the actual tenant ID (in case of conflict)
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE subdomain = $1', ['demo']);
    const actualTenantId = tenantResult.rows[0].id;

    // Insert tenant admin for Demo Company
    const adminId = uuidv4();
    await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (tenant_id, email) DO NOTHING
    `, [adminId, actualTenantId, 'admin@demo.com', demoAdminPassword, 'Demo Admin', 'tenant_admin']);
    console.log('✓ Tenant admin created');

    // Get actual admin ID
    const adminResult = await pool.query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [actualTenantId, 'admin@demo.com']);
    const actualAdminId = adminResult.rows[0].id;

    // Insert regular users
    const user1Id = uuidv4();
    const user2Id = uuidv4();
    
    await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (tenant_id, email) DO NOTHING
    `, [user1Id, actualTenantId, 'user1@demo.com', user1Password, 'User One', 'user']);

    await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (tenant_id, email) DO NOTHING
    `, [user2Id, actualTenantId, 'user2@demo.com', user2Password, 'User Two', 'user']);
    console.log('✓ Regular users created');

    // Get actual user IDs
    const user1Result = await pool.query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [actualTenantId, 'user1@demo.com']);
    const user2Result = await pool.query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [actualTenantId, 'user2@demo.com']);
    const actualUser1Id = user1Result.rows[0].id;
    const actualUser2Id = user2Result.rows[0].id;

    // Insert sample projects
    const project1Id = uuidv4();
    const project2Id = uuidv4();
    
    await pool.query(`
      INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT DO NOTHING
    `, [project1Id, actualTenantId, 'Website Redesign', 'Complete redesign of company website', 'active', actualAdminId]);

    await pool.query(`
      INSERT INTO projects (id, tenant_id, name, description, status, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT DO NOTHING
    `, [project2Id, actualTenantId, 'Mobile App Development', 'Develop mobile app for iOS and Android', 'active', actualAdminId]);
    console.log('✓ Sample projects created');

    // Get actual project IDs
    const proj1Result = await pool.query('SELECT id FROM projects WHERE tenant_id = $1 AND name = $2', [actualTenantId, 'Website Redesign']);
    const proj2Result = await pool.query('SELECT id FROM projects WHERE tenant_id = $1 AND name = $2', [actualTenantId, 'Mobile App Development']);
    const actualProj1Id = proj1Result.rows[0].id;
    const actualProj2Id = proj2Result.rows[0].id;

    // Insert sample tasks
    await pool.query(`
      INSERT INTO tasks (id, project_id, tenant_id, title, description, status, priority, assigned_to, due_date, created_at)
      VALUES 
        ($1, $2, $3, 'Design homepage mockup', 'Create high-fidelity mockup for homepage', 'in_progress', 'high', $4, CURRENT_DATE + INTERVAL '7 days', NOW()),
        ($5, $2, $3, 'Review design system', 'Audit and update design system components', 'todo', 'medium', $6, CURRENT_DATE + INTERVAL '10 days', NOW()),
        ($7, $2, $3, 'Implement responsive layout', 'Code responsive layout for all pages', 'todo', 'high', $4, CURRENT_DATE + INTERVAL '14 days', NOW()),
        ($8, $9, $3, 'Setup development environment', 'Configure React Native development setup', 'completed', 'high', $6, CURRENT_DATE - INTERVAL '2 days', NOW()),
        ($10, $9, $3, 'Design app navigation', 'Create navigation structure and wireframes', 'in_progress', 'medium', $4, CURRENT_DATE + INTERVAL '5 days', NOW())
      ON CONFLICT DO NOTHING
    `, [uuidv4(), actualProj1Id, actualTenantId, actualUser1Id, 
        uuidv4(), actualUser2Id, 
        uuidv4(), 
        uuidv4(), actualProj2Id, 
        uuidv4()]);
    console.log('✓ Sample tasks created');

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
