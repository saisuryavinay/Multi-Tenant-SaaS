const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authenticate = require('../middleware/authenticate');

// Task status and update routes (mounted at /api/tasks)
router.patch('/:taskId/status', authenticate, taskController.updateTaskStatus);
router.put('/:taskId', authenticate, taskController.updateTask);

module.exports = router;
