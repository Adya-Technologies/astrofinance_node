import { Router, type Router as ExpressRouter } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword
} from '../controllers/users.controller';
import { authenticate, hasPermission } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import {
  createUserValidation,
  updateUserValidation,
  resetPasswordValidation
} from '../validations/users.validation';

const router: ExpressRouter = Router();

// All routes require authentication
router.use(authenticate);

// Get all admin users
router.get('/', hasPermission('admin.view'), getAllUsers);

// Get admin user by ID
router.get('/:id', hasPermission('admin.view'), getUserById);

// Create new admin user
router.post(
  '/',
  hasPermission('admin.create'),
  validate(createUserValidation),
  createUser
);

// Update admin user
router.put(
  '/:id',
  hasPermission('admin.edit'),
  validate(updateUserValidation),
  updateUser
);

// Reset admin user password
router.post(
  '/:id/reset-password',
  hasPermission('admin.edit'),
  validate(resetPasswordValidation),
  resetUserPassword
);

export default router;