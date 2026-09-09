import { Request as ExpressRequest, Response } from 'express';

// Extend the Express Request interface to include adminUser
interface Request extends ExpressRequest {
  staff?: {
    id: string;
    roles: Array<{ id: string; name: string }>;
    [key: string]: any;
  };
}
import bcrypt from 'bcrypt';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction, StaffStatus } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';

/**
 * Get all staff members
 */
export const getAllStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        department: true,
        position: true,
        status: true,
        joinDate: true,
        // lastLogin: true,
        createdAt: true,
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
        employeeId: 'asc'
      }
    });

    return res.json(staff);
  } catch (error) {
    logger.error('Get all staff error:', error);
    throw new ApiError(500, 'Failed to fetch staff members');
  }
};

/**
 * Get staff member by ID
 */
export const getStaffById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const staffMember = await prisma.staff.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        joinDate: true,
        department: true,
        position: true,
        status: true,
        profileImage: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
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

    if (!staffMember) {
      throw new ApiError(404, 'Staff member not found');
    }

    return res.json(staffMember);
  } catch (error) {
    logger.error(`Get staff by ID error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch staff member');
  }
};

/**
 * Create new staff member
 */
export const createStaff = async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      address,
      dateOfBirth,
      joinDate,
      department,
      position,
      status = StaffStatus.ACTIVE,
      roleIds = []
    } = req.body;

    // Check if email already exists
    const existingStaffWithEmail = await prisma.staff.findUnique({
      where: { email }
    });

    if (existingStaffWithEmail) {
      throw new ApiError(409, `Email '${email}' is already registered`);
    }

    // Generate a new employee ID
    // Format: STAFF001, STAFF002, etc.
    const latestStaff = await prisma.staff.findFirst({
      orderBy: {
        employeeId: 'desc'
      }
    });

    let newEmployeeId = 'STAFF001';

    if (latestStaff && latestStaff.employeeId) {
      // Extract the numeric part and increment it
      const match = latestStaff.employeeId.match(/STAFF(\d+)/);
      if (match && match[1]) {
        const currentNumber = parseInt(match[1], 10);
        const nextNumber = currentNumber + 1;
        // Pad with leading zeros to maintain format (e.g., 001, 002, etc.)
        newEmployeeId = `STAFF${nextNumber.toString().padStart(3, '0')}`;
      }
    }

    // Log the generated employee ID
    logger.info(`Generated new employee ID: ${newEmployeeId}`);

    const employeeId = newEmployeeId;

    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Validate roles
    if (roleIds.length > 0) {
      const roles = await prisma.role.findMany({
        where: {
          id: {
            in: roleIds
          }
        }
      });

      if (roles.length !== roleIds.length) {
        throw new ApiError(400, 'One or more role IDs are invalid');
      }
    }

    // Create staff member with roles in a transaction
    const staffMember = await prisma.$transaction(async (tx) => {
      // Create staff
      const staff = await tx.staff.create({
        data: {
          employeeId,
          firstName,
          lastName,
          email,
          passwordHash,
          phone,
          address,
          dateOfBirth: new Date(dateOfBirth),
          joinDate: new Date(joinDate),
          department,
          position,
          status
        }
      });

      // Assign roles
      for (const roleId of roleIds) {
        await tx.staffRole.create({
          data: {
            staffId: staff.id,
            roleId
          }
        });
      }

      return staff;
    });

    // Get created staff with roles
    const createdStaff = await prisma.staff.findUnique({
      where: { id: staffMember.id },
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
      staffMember.id,
      AuditAction.CREATE,
      null,
      {
        employeeId,
        firstName,
        lastName,
        email,
        phone,
        department,
        position,
        status,
        roles: roleIds
      }
    );

    return res.status(201).json({
      id: createdStaff?.id,
      employeeId: createdStaff?.employeeId,
      firstName: createdStaff?.firstName,
      lastName: createdStaff?.lastName,
      email: createdStaff?.email,
      phone: createdStaff?.phone,
      department: createdStaff?.department,
      position: createdStaff?.position,
      status: createdStaff?.status,
      roles: createdStaff?.roles.map(r => ({
        id: r.role.id,
        name: r.role.name
      }))
    });
  } catch (error) {
    logger.error(`Create staff error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create staff member');
  }
};

/**
 * Update staff member
 */
export const updateStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      department,
      position,
      status,
      roleIds
    } = req.body;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
      include: {
        roles: true
      }
    });

    if (!existingStaff) {
      throw new ApiError(404, 'Staff member not found');
    }

    // Check if email is already taken by another staff
    if (email && email !== existingStaff.email) {
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

    // Validate roles if provided
    if (roleIds && Array.isArray(roleIds)) {
      const roles = await prisma.role.findMany({
        where: {
          id: {
            in: roleIds
          }
        }
      });

      if (roles.length !== roleIds.length) {
        throw new ApiError(400, 'One or more role IDs are invalid');
      }
    }

    // Update staff in a transaction
    await prisma.$transaction(async (tx) => {
      // Update staff details
      await tx.staff.update({
        where: { id },
        data: {
          firstName: firstName || existingStaff.firstName,
          lastName: lastName || existingStaff.lastName,
          email: email || existingStaff.email,
          phone: phone || existingStaff.phone,
          address: address || existingStaff.address,
          department: department || existingStaff.department,
          position: position || existingStaff.position,
          status: status !== undefined ? status : existingStaff.status
        }
      });

      // Update roles if provided
      if (roleIds && Array.isArray(roleIds)) {
        // Get existing role IDs
        const existingRoleIds = existingStaff.roles.map(r => r.roleId);

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

    // Get updated staff with roles
    const updatedStaff = await prisma.staff.findUnique({
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
        firstName: existingStaff.firstName,
        lastName: existingStaff.lastName,
        email: existingStaff.email,
        phone: existingStaff.phone,
        department: existingStaff.department,
        position: existingStaff.position,
        status: existingStaff.status,
        roles: existingStaff.roles.map(r => r.roleId)
      },
      {
        firstName: firstName || existingStaff.firstName,
        lastName: lastName || existingStaff.lastName,
        email: email || existingStaff.email,
        phone: phone || existingStaff.phone,
        department: department || existingStaff.department,
        position: position || existingStaff.position,
        status: status !== undefined ? status : existingStaff.status,
        roles: roleIds || existingStaff.roles.map(r => r.roleId)
      }
    );

    return res.json({
      id: updatedStaff?.id,
      employeeId: updatedStaff?.employeeId,
      firstName: updatedStaff?.firstName,
      lastName: updatedStaff?.lastName,
      email: updatedStaff?.email,
      phone: updatedStaff?.phone,
      department: updatedStaff?.department,
      position: updatedStaff?.position,
      status: updatedStaff?.status,
      roles: updatedStaff?.roles.map(r => ({
        id: r.role.id,
        name: r.role.name
      }))
    });
  } catch (error) {
    logger.error(`Update staff error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update staff member');
  }
};

/**
 * Reset staff password
 */
export const resetStaffPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id }
    });

    if (!existingStaff) {
      throw new ApiError(404, 'Staff member not found');
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
      { resetByAdmin: req.staff?.id || 'unknown' }
    );

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error(`Reset staff password error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to reset password');
  }
};

/**
 * Delete staff member
 */
export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
      include: {
        roles: true,
        documents: true,
        performanceReviews: true,
        attendance: true,
        leaves: true
      }
    });

    if (!existingStaff) {
      throw new ApiError(404, 'Staff member not found');
    }

    // Delete staff and related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records first
      await tx.staffRole.deleteMany({
        where: { staffId: id }
      });

      await tx.staffDocument.deleteMany({
        where: { staffId: id }
      });

      await tx.performanceReview.deleteMany({
        where: { staffId: id }
      });

      await tx.attendance.deleteMany({
        where: { staffId: id }
      });

      await tx.leave.deleteMany({
        where: { staffId: id }
      });

      // Finally delete the staff record
      await tx.staff.delete({
        where: { id }
      });
    });

    // Create audit log
    await createAuditLog(
      req,
      'Staff',
      id,
      AuditAction.DELETE,
      {
        employeeId: existingStaff.employeeId,
        firstName: existingStaff.firstName,
        lastName: existingStaff.lastName,
        email: existingStaff.email,
        department: existingStaff.department,
        position: existingStaff.position
      },
      null
    );

    return res.json({
      message: 'Staff member deleted successfully',
      id
    });
  } catch (error) {
    logger.error(`Delete staff error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete staff member');
  }
};