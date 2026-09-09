import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import logger from '../../config/logger';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        userType: 'ADMIN' | 'STAFF' | 'USER';
        [key: string]: any;
      };
      staff?: any; // Replaces adminUser
    }
  }
}

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET as string;

/**
 * Middleware to authenticate admin users
 */
/**
 * Middleware to authenticate admin users
 */
export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Check if staff exists and is active (Replacing AdminUser with Staff)
    const staff = await prisma.staff.findUnique({
      where: { id: decoded.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!staff) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (staff.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    // Check if staff has admin privileges (optional, depending on requirements. For now, assuming successful login implies access)

    // Attach staff to request object.
    req.staff = staff;

    // Also attach to unified user object for consistency
    req.user = {
      id: staff.id,
      email: staff.email,
      userType: 'ADMIN',
      fullName: `${staff.firstName} ${staff.lastName}`,
      roles: staff.roles.map((r: any) => r.role?.name || r.name)
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to authenticate regular users
 */
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email || '',
      userType: 'USER',
      fullName: user.fullName
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to authenticate staff users
 */
export const authenticateStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Check if staff exists and is active
    const staff = await prisma.staff.findUnique({
      where: { id: decoded.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!staff) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (staff.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'User account is inactive' });
    }

    // Attach staff to request object
    req.staff = staff;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Unified authentication middleware for all user types
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Check user type from token
    const userType = decoded.userType;

    if (userType === 'ADMIN' || userType === 'STAFF') {
      // Both ADMIN and STAFF now map to Staff table
      const staff = await prisma.staff.findUnique({
        where: { id: decoded.id },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!staff) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (staff.status !== 'ACTIVE') {
        return res.status(403).json({ message: 'User account is inactive' });
      }

      // Attach staff to request object
      req.staff = staff;

      // Also attach to unified user object
      req.user = {
        id: staff.id,
        email: staff.email,
        userType: userType as 'ADMIN' | 'STAFF' | 'USER',
        fullName: `${staff.firstName} ${staff.lastName}`,
        roles: staff.roles
      };
    } else if (userType === 'USER') {
      // Check if user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'User account is inactive' });
      }

      // Attach user to request object
      req.user = {
        id: user.id,
        email: user.email || '',
        userType: 'USER',
        fullName: user.fullName
      };
    } else {
      return res.status(401).json({ message: 'Invalid user type' });
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to check if user has required permissions
 */
export const hasPermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // For regular users, we don't check permissions
    if (req.user.userType === 'USER') {
      return next();
    }

    // Extract permissions from user roles
    const userPermissions = new Set<string>();

    if (req.user.userType === 'ADMIN' && req.staff) {
      req.staff.roles.forEach((roleAssignment: any) => {
        roleAssignment.role.permissions.forEach((permissionAssignment: any) => {
          userPermissions.add(permissionAssignment.permission.code);
        });
      });
    } else if (req.user.userType === 'STAFF' && req.staff) {
      req.staff.roles.forEach((roleAssignment: any) => {
        roleAssignment.role.permissions.forEach((permissionAssignment: any) => {
          userPermissions.add(permissionAssignment.permission.code);
        });
      });
    }

    // Check if user has the required permission
    if (!userPermissions.has(requiredPermission)) {
      const identifier = req.user.username || req.user.employeeId || req.user.email;
      logger.warn(`Permission denied: ${identifier} attempted to access ${requiredPermission}`);
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }

    next();
  };
};