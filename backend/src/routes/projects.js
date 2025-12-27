const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const authenticate = require('../middleware/authenticate');

router.post('/', authenticate, projectController.createProject);
router.get('/', authenticate, projectController.listProjects);
router.put('/:projectId', authenticate, projectController.updateProject);
router.delete('/:projectId', authenticate, projectController.deleteProject);

// Task routes under projects
router.post('/:projectId/tasks', authenticate, taskController.createTask);
router.get('/:projectId/tasks', authenticate, taskController.listTasks);
router.patch('/:projectId/tasks/:taskId/status', authenticate, taskController.updateTaskStatus);
router.put('/:projectId/tasks/:taskId', authenticate, taskController.updateTask);

module.exports = router;
