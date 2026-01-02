const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.post('/tenants/:tenantId/users', authenticate, authorize('tenant_admin'), userController.addUser);
router.get('/tenants/:tenantId/users', authenticate, userController.listUsers);
router.put('/users/:userId', authenticate, userController.updateUser);
router.delete('/users/:userId', authenticate, authorize('tenant_admin', 'super_admin'), userController.deleteUser);

module.exports = router;
