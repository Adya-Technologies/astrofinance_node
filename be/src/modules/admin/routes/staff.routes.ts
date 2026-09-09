import { Router, type Router as ExpressRouter, Request as ExpressRequest, Response, NextFunction } from 'express';

// Extend the Express Request interface to include adminUser
interface Request extends ExpressRequest {
  staff?: {
    id: string;
    roles: Array<{ id: string; name: string }>;
    [key: string]: any;
  };
}
import {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  resetStaffPassword,
  deleteStaff
} from '../controllers/staff.controller';
import { authenticate, hasPermission } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import {
  createStaffValidation,
  updateStaffValidation,
  resetPasswordValidation
} from '../validations/staff.validation';

const router: ExpressRouter = Router();

// All routes require authentication
router.use(authenticate);

// Only Super Admin can access staff management
const isSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Check roles from the token first (if available)
  const tokenRoles = req.user?.roles || [];

  // Then check roles from the staff object (from database)
  const dbRoles = req.staff?.roles || [];
  const dbRoleNames = dbRoles.map((role: any) => role.role?.name || role.name);

  // Check if either source has the Super Admin role
  const isSuperAdmin =
    (Array.isArray(tokenRoles) && tokenRoles.includes('Super Admin')) ||
    dbRoleNames.includes('Super Admin');

  if (!isSuperAdmin) {
    return res.status(403).json({
      message: 'Access denied. Only Super Admin can manage staff.'
    });
  }

  next();
};

// Apply Super Admin check to all staff routes
router.use(isSuperAdmin);

// Get all staff members
router.get('/', hasPermission('staff.view'), getAllStaff);

// Get staff member by ID
router.get('/:id', hasPermission('staff.view'), getStaffById);

// Create new staff member
router.post(
  '/',
  hasPermission('staff.create'),
  validate(createStaffValidation),
  createStaff
);

// Update staff member
router.put(
  '/:id',
  hasPermission('staff.edit'),
  validate(updateStaffValidation),
  updateStaff
);

// Reset staff password
router.post(
  '/:id/reset-password',
  hasPermission('staff.edit'),
  validate(resetPasswordValidation),
  resetStaffPassword
);

// Delete staff member
router.delete(
  '/:id',
  hasPermission('staff.delete'),
  deleteStaff
);

export default router;