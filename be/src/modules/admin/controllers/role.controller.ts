import { Request, Response } from 'express';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';

/**
 * Get all roles
 */
export const getAllRoles = async (req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            permissions: true,
            staffRoles: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return res.json(roles);
  } catch (error) {
    logger.error('Get all roles error:', error);
    throw new ApiError(500, 'Failed to fetch roles');
  }
};

/**
 * Get role by ID
 */
export const getRoleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
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
        },
        staffRoles: {
          include: {
            staff: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!role) {
      throw new ApiError(404, 'Role not found');
    }

    return res.json(role);
  } catch (error) {
    logger.error(`Get role by ID error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch role');
  }
};

/**
 * Create new role
 */
export const createRole = async (req: Request, res: Response) => {
  try {
    const { name, description, isSystem = false } = req.body;

    // Check if role with same name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name }
    });

    if (existingRole) {
      throw new ApiError(409, `Role with name '${name}' already exists`);
    }

    // Create new role
    const role = await prisma.role.create({
      data: {
        name,
        description,
        isSystem
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Role',
      role.id,
      AuditAction.CREATE,
      null,
      role
    );

    return res.status(201).json(role);
  } catch (error) {
    logger.error(`Create role error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create role');
  }
};

/**
 * Update role
 */
export const updateRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id }
    });

    if (!existingRole) {
      throw new ApiError(404, 'Role not found');
    }

    // Check if system role
    if (existingRole.isSystem && (req.staff as any)?.username !== 'admin') {
      throw new ApiError(403, 'System roles can only be modified by super admin');
    }

    // Check if name is already taken by another role
    if (name && name !== existingRole.name) {
      const nameExists = await prisma.role.findFirst({
        where: {
          name,
          id: { not: id }
        }
      });

      if (nameExists) {
        throw new ApiError(409, `Role with name '${name}' already exists`);
      }
    }

    // Update role
    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: name || existingRole.name,
        description: description !== undefined ? description : existingRole.description
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Role',
      updatedRole.id,
      AuditAction.UPDATE,
      existingRole,
      updatedRole
    );

    return res.json(updatedRole);
  } catch (error) {
    logger.error(`Update role error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update role');
  }
};

/**
 * Delete role
 */
export const deleteRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            staffRoles: true
          }
        }
      }
    });

    if (!existingRole) {
      throw new ApiError(404, 'Role not found');
    }

    // Check if system role
    if (existingRole.isSystem) {
      throw new ApiError(403, 'System roles cannot be deleted');
    }

    // Check if role is assigned to users
    if (existingRole._count.staffRoles > 0) {
      throw new ApiError(400, 'Cannot delete role that is assigned to users');
    }

    // Delete role permissions and navigation assignments first
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: { roleId: id }
      }),
      prisma.roleNavigation.deleteMany({
        where: { roleId: id }
      }),
      prisma.role.delete({
        where: { id }
      })
    ]);

    // Create audit log
    await createAuditLog(
      req,
      'Role',
      id,
      AuditAction.DELETE,
      existingRole,
      null
    );

    return res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    logger.error(`Delete role error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete role');
  }
};

/**
 * Update role permissions
 */
export const updateRolePermissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;
    console.log(permissionIds, " this is permissionIds");
    if (!Array.isArray(permissionIds)) {
      throw new ApiError(400, 'permissionIds must be an array');
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true
      }
    });

    if (!existingRole) {
      throw new ApiError(404, 'Role not found');
    }

    // Get existing permission IDs
    const existingPermissionIds = existingRole.permissions.map(p => p.permissionId);

    // Perform update in a transaction
    await prisma.$transaction(async (tx) => {
      // Remove permissions that are not in the new list
      await tx.rolePermission.deleteMany({
        where: {
          roleId: id,
          permissionId: {
            notIn: permissionIds
          }
        }
      });

      // Add new permissions
      const newPermissionIds = permissionIds.filter(
        permId => !existingPermissionIds.includes(permId)
      );

      for (const permissionId of newPermissionIds) {
        // Check if permission exists
        const permissionExists = await tx.permission.findUnique({
          where: { id: permissionId }
        });

        if (!permissionExists) {
          throw new ApiError(404, `Permission with ID ${permissionId} not found`);
        }

        await tx.rolePermission.create({
          data: {
            roleId: id,
            permissionId
          }
        });
      }
    });

    // Get updated role with permissions
    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Role',
      id,
      AuditAction.PERMISSION_CHANGE,
      { permissions: existingPermissionIds },
      { permissions: permissionIds }
    );

    return res.json(updatedRole);
  } catch (error) {
    logger.error(`Update role permissions error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update role permissions');
  }
};

/**
 * Get all permissions
 */
export const getAllPermissions = async (req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { action: 'asc' }
      ]
    });

    // Group permissions by module
    const groupedPermissions = permissions.reduce((acc: any, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {});

    return res.json(groupedPermissions);
  } catch (error) {
    logger.error('Get all permissions error:', error);
    throw new ApiError(500, 'Failed to fetch permissions');
  }
};