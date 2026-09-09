import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction, StaffStatus } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';

/**
 * Get all admin users (Now mapped to Staff)
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const staffUsers = await prisma.staff.findMany({
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    });

    const mappedUsers = staffUsers.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
      isActive: user.status === 'ACTIVE',
      lastLogin: user.lastLogin,
      createdAt: user.joinDate,
      roles: user.roles
    }));

    return res.json(mappedUsers);
  } catch (error) {
    logger.error('Get all admin users error:', error);
    throw new ApiError(500, 'Failed to fetch admin users');
  }
};

/**
 * Get admin user by ID
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.staff.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const mappedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
      isActive: user.status === 'ACTIVE',
      lastLogin: user.lastLogin,
      createdAt: user.joinDate,
      updatedAt: user.joinDate, // approximated
      roles: user.roles
    };

    return res.json(mappedUser);
  } catch (error) {
    logger.error(`Get admin user by ID error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch user');
  }
};

/**
 * Create new admin user (Creates a Staff record)
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, fullName, isActive = true, roleIds = [] } = req.body;

    // Check if username or email already exists
    const existingUser = await prisma.staff.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ApiError(409, `Username '${username}' is already taken`);
      } else {
        throw new ApiError(409, `Email '${email}' is already registered`);
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Split fullName
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Staff';

    // Generate pseudo-random employeeId if not provided (Assuming logic)
    const employeeId = `EMP${Date.now().toString().slice(-6)}`;

    // Create staff user with roles in a transaction
    const newStaff = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.staff.create({
        data: {
          employeeId,
          username,
          email,
          passwordHash,
          firstName,
          lastName,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          phone: '', // Required field, need default
          address: '', // Required field, need default
          dateOfBirth: new Date(), // Required field
          joinDate: new Date(),
          department: 'Administration',
          position: 'Admin Staff'
        }
      });

      // Assign roles
      for (const roleId of roleIds) {
        await tx.staffRole.create({
          data: {
            staffId: user.id,
            roleId
          }
        });
      }

      return user;
    });

    // Get created user with roles
    const createdUser = await prisma.staff.findUnique({
      where: { id: newStaff.id },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Staff',
      newStaff.id,
      AuditAction.CREATE,
      null,
      {
        username,
        email,
        fullName,
        isActive,
        roles: roleIds
      }
    );

    return res.status(201).json({
      id: createdUser?.id,
      username: createdUser?.username,
      email: createdUser?.email,
      fullName: `${createdUser?.firstName} ${createdUser?.lastName}`,
      isActive: createdUser?.status === 'ACTIVE',
      roles: createdUser?.roles.map(r => ({
        id: r.role.id,
        name: r.role.name
      }))
    });
  } catch (error) {
    logger.error(`Create admin user error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create admin user');
  }
};

/**
 * Update admin user (Updates Staff)
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, fullName, isActive, roleIds } = req.body;

    // Check if user exists
    const existingUser = await prisma.staff.findUnique({
      where: { id },
      include: {
        roles: true
      }
    });

    if (!existingUser) {
      throw new ApiError(404, 'User not found');
    }

    // Prevent deactivating the main admin account
    if (existingUser.username === 'admin' && isActive === false) {
      throw new ApiError(403, 'The main admin account cannot be deactivated');
    }

    // Check if email is already taken by another user
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.staff.findFirst({
        where: {
          email,
          id: { not: id }
        }
      });

      if (emailExists) {
        throw new ApiError(409, `Email '${email}' is already registered`);
      }
    }

    let firstName: string | undefined, lastName: string | undefined;
    if (fullName) {
      const nameParts = fullName.trim().split(' ');
      firstName = nameParts[0];
      lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : existingUser.lastName;
    }

    // Update user in a transaction
    await prisma.$transaction(async (tx) => {
      // Update user details
      await tx.staff.update({
        where: { id },
        data: {
          email: email || existingUser.email,
          firstName: firstName || existingUser.firstName,
          lastName: lastName || existingUser.lastName,
          status: isActive !== undefined ? (isActive ? 'ACTIVE' : 'INACTIVE') : existingUser.status
        }
      });

      // Update roles if provided
      if (roleIds && Array.isArray(roleIds)) {
        // Get existing role IDs
        const existingRoleIds = existingUser.roles.map(r => r.roleId);

        // Remove roles that are not in the new list
        await tx.staffRole.deleteMany({
          where: {
            staffId: id,
            roleId: {
              notIn: roleIds
            }
          }
        });

        // Add new roles
        const newRoleIds = roleIds.filter(
          roleId => !existingRoleIds.includes(roleId)
        );

        for (const roleId of newRoleIds) {
          await tx.staffRole.create({
            data: {
              staffId: id,
              roleId
            }
          });
        }
      }
    });

    // Get updated user with roles
    const updatedUser = await prisma.staff.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Staff',
      id,
      AuditAction.UPDATE,
      {
        email: existingUser.email,
        fullName: `${existingUser.firstName} ${existingUser.lastName}`,
        isActive: existingUser.status === 'ACTIVE',
        roles: existingUser.roles.map(r => r.roleId)
      },
      {
        email: email || existingUser.email,
        fullName: fullName || `${existingUser.firstName} ${existingUser.lastName}`,
        isActive: isActive !== undefined ? isActive : existingUser.status === 'ACTIVE',
        roles: roleIds || existingUser.roles.map(r => r.roleId)
      }
    );

    return res.json({
      id: updatedUser?.id,
      username: updatedUser?.username,
      email: updatedUser?.email,
      fullName: `${updatedUser?.firstName} ${updatedUser?.lastName}`,
      isActive: updatedUser?.status === 'ACTIVE',
      roles: updatedUser?.roles.map(r => ({
        id: r.role.id,
        name: r.role.name
      }))
    });
  } catch (error) {
    logger.error(`Update admin user error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update user');
  }
};

/**
 * Reset admin user password
 */
export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Check if user exists
    const existingUser = await prisma.staff.findUnique({
      where: { id }
    });

    if (!existingUser) {
      throw new ApiError(404, 'User not found');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.staff.update({
      where: { id },
      data: { passwordHash }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Staff',
      id,
      AuditAction.PASSWORD_CHANGE,
      null,
      null,
      { resetByAdmin: req.user?.id || 'unknown' } // Logged in admin
    );

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error(`Reset admin user password error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to reset password');
  }
};