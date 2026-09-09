import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';
import { getUserNavigation, getUserPermissions } from '../services/navigation.service';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';



/**
 * Office user login (admin or staff)
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Disable caching for login response
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Unified Staff Login (replaces AdminUser and Staff separate checks)
    const staffUser = await prisma.staff.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username },
          { employeeId: username }
        ],
        status: 'ACTIVE'
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (staffUser) {
      // Check if password hash is set
      if (!staffUser.passwordHash) {
        throw new ApiError(401, 'Password not set. Please contact administrator.');
      }

      const isPasswordValid = await bcrypt.compare(password, staffUser.passwordHash);

      if (!isPasswordValid) {
        // Increment failed login attempts
        await prisma.staff.update({
          where: { id: staffUser.id },
          data: { failedLoginAttempts: { increment: 1 } }
        });

        throw new ApiError(401, 'Invalid username or password');
      }

      // Reset failed login attempts and update last login time
      await prisma.staff.update({
        where: { id: staffUser.id },
        data: {
          failedLoginAttempts: 0,
          lastLogin: new Date()
        }
      });

      // Determine user type context (for permissions service)
      // If user has "Super Admin" or "Admin" role, we might treat them as ADMIN context if needed?
      // For now, everyone is 'STAFF' in the sense of table source.
      // But preserving 'ADMIN' token type for backward compatibility might be wise if FE relies on it.
      const hasAdminRole = staffUser.roles.some(r =>
        r.role.name.toLowerCase().includes('admin') || r.role.isSystem
      );
      const userType = hasAdminRole ? 'ADMIN' : 'STAFF';

      // Get user permissions and navigation items
      // Note: check navigation.service.ts if it relies on 'ADMIN' mapping to AdminUser table.
      const permissions = await getUserPermissions(staffUser.id, 'STAFF'); // Using STAFF service path for all
      const navigationItems = await getUserNavigation(staffUser.id, 'STAFF');

      // Debug log
      logger.debug(`Office login: Found ${permissions.length} permissions and ${navigationItems.length} navigation items`);

      // Create audit log
      await createAuditLog(
        req,
        'Staff',
        staffUser.id,
        AuditAction.LOGIN,
        null,
        { id: staffUser.id, email: staffUser.email, loginType: userType }
      );

      // Generate JWT token
      const token = jwt.sign(
        {
          id: staffUser.id,
          employeeId: staffUser.employeeId,
          email: staffUser.email,
          username: staffUser.username,
          userType: userType // 'ADMIN' or 'STAFF'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as SignOptions
      );

      // Prepare response
      const response = {
        user: {
          id: staffUser.id,
          employeeId: staffUser.employeeId,
          username: staffUser.username,
          email: staffUser.email,
          fullName: `${staffUser.firstName} ${staffUser.lastName}`,
          userType: userType,
          isActive: staffUser.status === 'ACTIVE',
          department: staffUser.department,
          position: staffUser.position,
          roles: staffUser.roles.map(r => ({
            id: r.role.id,
            name: r.role.name
          })),
          permissions,
          navigation: navigationItems
        },
        token
      };

      // Debug log
      logger.debug(`Office login response for ${staffUser.email}`);

      // Return user data and token
      return res.json(response);
    }

    // If no user found
    throw new ApiError(401, 'Invalid username or password');
  } catch (error) {
    logger.error(`Office login error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'An error occurred during login');
  }
};

/**
 * Office user logout
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    // const userType = req.user?.userType;

    if (userId) {
      // Create audit log
      await createAuditLog(
        req,
        'Staff',
        userId,
        AuditAction.LOGOUT,
        null,
        { id: userId }
      );
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error(`Logout error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'An error occurred during logout');
  }
};

/**
 * Get office user profile
 */
/**
 * Get office user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const staffUser = await prisma.staff.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!staffUser) {
      throw new ApiError(404, 'User not found');
    }

    // Get user permissions and navigation items
    const permissions = await getUserPermissions(staffUser.id, 'STAFF');
    const navigationItems = await getUserNavigation(staffUser.id, 'STAFF');

    const hasAdminRole = staffUser.roles.some(r => r.role.name.toLowerCase().includes('admin') || r.role.isSystem);
    const resolvedUserType = hasAdminRole ? 'ADMIN' : 'STAFF';

    return res.json({
      id: staffUser.id,
      employeeId: staffUser.employeeId,
      username: staffUser.username,
      email: staffUser.email,
      fullName: `${staffUser.firstName} ${staffUser.lastName}`,
      firstName: staffUser.firstName,
      lastName: staffUser.lastName,
      phone: staffUser.phone,
      address: staffUser.address,
      dateOfBirth: staffUser.dateOfBirth,
      joinDate: staffUser.joinDate,
      department: staffUser.department,
      position: staffUser.position,
      status: staffUser.status,
      profileImage: staffUser.profileImage,
      userType: resolvedUserType,
      roles: staffUser.roles.map(r => ({
        id: r.role.id,
        name: r.role.name
      })),
      permissions,
      navigation: navigationItems,
      lastLogin: staffUser.lastLogin
    });

  } catch (error) {
    logger.error(`Get profile error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch user profile');
  }
};

/**
 * Change office user password
 */
/**
 * Change office user password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    // Unified Staff password change
    const staffUser = await prisma.staff.findUnique({
      where: { id: userId }
    });

    if (!staffUser) {
      throw new ApiError(404, 'User not found');
    }

    // Verify current password
    if (!staffUser.passwordHash) {
      throw new ApiError(400, 'Password not set on account');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, staffUser.passwordHash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.staff.update({
      where: { id: userId },
      data: {
        passwordHash,
        // passwordChangedAt: new Date()
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Staff',
      userId,
      AuditAction.PASSWORD_CHANGE,
      null,
      { id: userId }
    );

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error(`Change password error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to change password');
  }
};