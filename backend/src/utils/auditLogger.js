const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const logAudit = async (tenantId, userId, action, entityType, entityId, ipAddress = null) => {
  try {
    const query = `
      INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    
    await pool.query(query, [
      uuidv4(),
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      ipAddress
    ]);
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
};

module.exports = { logAudit };
