import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction } from '@prisma/client';

// JWT secret from environment variables
const JWT_SECRET: Secret = process.env.JWT_SECRET as string;

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Admin login controller (Now authenticates Staff with Admin access)
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Find staff by username or email
    const staff = await prisma.staff.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                },
                navigation: {
                  include: {
                    navigationItem: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Check if user exists
    if (!staff) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check if user is active
    if (staff.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact the administrator.' });
    }

    // Verify password (check passwordHash)
    // Note: Staff model might use different password field? Schema shows passwordHash.
    if (!staff.passwordHash) {
      return res.status(401).json({ message: 'Account not set up for password login' });
    }

    const isPasswordValid = await bcrypt.compare(password, staff.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Extract role names for the token
    const roleNames = staff.roles.map(r => r.role.name);

    // Generate JWT token (UserType ADMIN for backward compatibility with FE)
    const token = jwt.sign(
      {
        id: staff.id,
        username: staff.username,
        email: staff.email,
        userType: 'ADMIN',
        roles: roleNames
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    // Update last login timestamp
    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLogin: new Date() }
    });

    // Extract permissions and navigation items
    const permissions = new Set<string>();
    const navigationItems: any[] = [];

    staff.roles.forEach(roleAssignment => {
      // Add permissions
      roleAssignment.role.permissions.forEach(permissionAssignment => {
        permissions.add(permissionAssignment.permission.code);
      });

      // Add navigation items
      roleAssignment.role.navigation.forEach(navAssignment => {
        navigationItems.push(navAssignment.navigationItem);
      });
    });

    // Create audit log
    await createAuditLog(
      req,
      'Staff', // Changed from AdminUser
      staff.id,
      AuditAction.LOGIN,
      null,
      null,
      { method: 'username/password', interface: 'admin' }
    );

    // Return user data and token
    return res.json({
      user: {
        id: staff.id,
        username: staff.username,
        email: staff.email,
        fullName: `${staff.firstName} ${staff.lastName}`,
        userType: 'ADMIN', // Explicitly set userType for admin users
        isActive: staff.status === 'ACTIVE',
        roles: staff.roles.map(r => ({
          id: r.role.id,
          name: r.role.name
        })),
        permissions: Array.from(permissions),
      },
      token,
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ message: 'An error occurred during login' });
  }
};

/**
 * Admin logout controller
 */
export const logout = async (req: Request, res: Response) => {
  try {
    // Create audit log if user is authenticated
    if (req.staff) {
      await createAuditLog(
        req,
        'Staff',
        req.staff.id,
        AuditAction.LOGOUT,
        null,
        null
      );
    }

    // Note: JWT tokens are stateless, so we can't invalidate them server-side
    // The client should remove the token from storage

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({ message: 'An error occurred during logout' });
  }
};

/**
 * Get current admin user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    // User is already attached to request by auth middleware
    // req.staff is mapped to the Staff object in auth.middleware
    const staff = req.staff;

    // Extract permissions
    const permissions = new Set<string>();

    staff.roles.forEach((roleAssignment: any) => {
      roleAssignment.role.permissions.forEach((permissionAssignment: any) => {
        permissions.add(permissionAssignment.permission.code);
      });
    });

    // Return user data
    return res.json({
      id: staff.id,
      username: staff.username,
      email: staff.email,
      fullName: `${staff.firstName} ${staff.lastName}`,
      userType: 'ADMIN', // Explicitly set userType for admin users
      isActive: staff.status === 'ACTIVE',
      roles: staff.roles.map((r: any) => ({
        id: r.role.id,
        name: r.role.name
      })),
      permissions: Array.from(permissions),
      lastLogin: staff.lastLogin
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ message: 'An error occurred while fetching profile' });
  }
};

/**
 * Change admin user password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const staff = req.staff;

    if (!staff.passwordHash) {
      return res.status(400).json({ message: 'Password not set on account' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, staff.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date()
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Staff',
      staff.id,
      AuditAction.PASSWORD_CHANGE,
      null,
      null
    );

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    return res.status(500).json({ message: 'An error occurred while changing password' });
  }
};