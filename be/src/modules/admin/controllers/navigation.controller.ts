import { Request, Response } from 'express';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';

/**
 * Get all navigation groups
 */
export const getAllNavigationGroups = async (req: Request, res: Response) => {
  try {
    const groups = await prisma.navigationGroup.findMany({
      orderBy: {
        order: 'asc'
      }
    });

    return res.json(groups);
  } catch (error) {
    logger.error('Get all navigation groups error:', error);
    throw new ApiError(500, 'Failed to fetch navigation groups');
  }
};

/**
 * Get navigation group by ID
 */
export const getNavigationGroupById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.navigationGroup.findUnique({
      where: { id },
      include: {
        navigationItems: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    if (!group) {
      throw new ApiError(404, 'Navigation group not found');
    }

    return res.json(group);
  } catch (error) {
    logger.error('Get navigation group by ID error:', error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch navigation group');
  }
};

/**
 * Create navigation group
 */
export const createNavigationGroup = async (req: Request, res: Response) => {
  try {
    const { name, description, order, isActive = true } = req.body;

    // Check if group with same name already exists
    const existingGroup = await prisma.navigationGroup.findUnique({
      where: { name }
    });

    if (existingGroup) {
      throw new ApiError(409, `Navigation group with name '${name}' already exists`);
    }

    // Create new group
    const group = await prisma.navigationGroup.create({
      data: {
        name,
        description,
        order,
        isActive
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'NavigationGroup',
      group.id,
      AuditAction.CREATE,
      null,
      group
    );

    return res.status(201).json(group);
  } catch (error) {
    logger.error(`Create navigation group error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create navigation group');
  }
};

/**
 * Update navigation group
 */
export const updateNavigationGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, order, isActive } = req.body;

    // Check if group exists
    const existingGroup = await prisma.navigationGroup.findUnique({
      where: { id }
    });

    if (!existingGroup) {
      throw new ApiError(404, 'Navigation group not found');
    }

    // Check if name is already taken by another group
    if (name && name !== existingGroup.name) {
      const nameExists = await prisma.navigationGroup.findFirst({
        where: {
          name,
          id: { not: id }
        }
      });

      if (nameExists) {
        throw new ApiError(409, `Navigation group with name '${name}' already exists`);
      }
    }

    // Update group
    const updatedGroup = await prisma.navigationGroup.update({
      where: { id },
      data: {
        name: name || existingGroup.name,
        description: description !== undefined ? description : existingGroup.description,
        order: order !== undefined ? order : existingGroup.order,
        isActive: isActive !== undefined ? isActive : existingGroup.isActive
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'NavigationGroup',
      updatedGroup.id,
      AuditAction.UPDATE,
      existingGroup,
      updatedGroup
    );

    return res.json(updatedGroup);
  } catch (error) {
    logger.error(`Update navigation group error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update navigation group');
  }
};

/**
 * Delete navigation group
 */
export const deleteNavigationGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if group exists
    const existingGroup = await prisma.navigationGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            navigationItems: true
          }
        }
      }
    });

    if (!existingGroup) {
      throw new ApiError(404, 'Navigation group not found');
    }

    // Check if group has navigation items
    if (existingGroup._count.navigationItems > 0) {
      throw new ApiError(400, 'Cannot delete group that contains navigation items');
    }

    // Delete group
    await prisma.navigationGroup.delete({
      where: { id }
    });

    // Create audit log
    await createAuditLog(
      req,
      'NavigationGroup',
      id,
      AuditAction.DELETE,
      existingGroup,
      null
    );

    return res.json({ message: 'Navigation group deleted successfully' });
  } catch (error) {
    logger.error(`Delete navigation group error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete navigation group');
  }
};

/**
 * Get all navigation items
 */
export const getAllNavigationItems = async (req: Request, res: Response) => {
  try {
    const items = await prisma.navigationItem.findMany({
      include: {
        group: true,
        parent: {
          select: {
            id: true,
            label: true
          }
        }
      },
      orderBy: [
        { groupId: 'asc' },
        { parentId: 'asc' },
        { order: 'asc' }
      ]
    });

    return res.json(items);
  } catch (error) {
    logger.error('Get all navigation items error:', error);
    throw new ApiError(500, 'Failed to fetch navigation items');
  }
};

/**
 * Get navigation item by ID
 */
export const getNavigationItemById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const item = await prisma.navigationItem.findUnique({
      where: { id },
      include: {
        group: true,
        parent: {
          select: {
            id: true,
            label: true
          }
        },
        children: {
          orderBy: {
            order: 'asc'
          }
        },
        roleNavigation: {
          include: {
            role: true
          }
        }
      }
    });

    if (!item) {
      throw new ApiError(404, 'Navigation item not found');
    }

    return res.json(item);
  } catch (error) {
    logger.error('Get navigation item by ID error:', error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch navigation item');
  }
};

/**
 * Create navigation item
 */
export const createNavigationItem = async (req: Request, res: Response) => {
  try {
    const { label, icon, url, order, parentId, groupId, isActive = true } = req.body;

    // Validate parent if provided
    if (parentId) {
      const parentExists = await prisma.navigationItem.findUnique({
        where: { id: parentId }
      });

      if (!parentExists) {
        throw new ApiError(404, 'Parent navigation item not found');
      }
    }

    // Validate group if provided
    if (groupId) {
      const groupExists = await prisma.navigationGroup.findUnique({
        where: { id: groupId }
      });

      if (!groupExists) {
        throw new ApiError(404, 'Navigation group not found');
      }
    }

    // Create new item
    const item = await prisma.navigationItem.create({
      data: {
        label,
        icon,
        url,
        order,
        parentId,
        groupId,
        isActive
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'NavigationItem',
      item.id,
      AuditAction.CREATE,
      null,
      item
    );

    return res.status(201).json(item);
  } catch (error) {
    logger.error(`Create navigation item error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create navigation item');
  }
};

/**
 * Update navigation item
 */
export const updateNavigationItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { label, icon, url, order, parentId, groupId, isActive } = req.body;

    // Check if item exists
    const existingItem = await prisma.navigationItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      throw new ApiError(404, 'Navigation item not found');
    }

    // Validate parent if provided
    if (parentId && parentId !== existingItem.parentId) {
      // Prevent circular reference
      if (parentId === id) {
        throw new ApiError(400, 'Navigation item cannot be its own parent');
      }

      const parentExists = await prisma.navigationItem.findUnique({
        where: { id: parentId }
      });

      if (!parentExists) {
        throw new ApiError(404, 'Parent navigation item not found');
      }
    }

    // Validate group if provided
    if (groupId && groupId !== existingItem.groupId) {
      const groupExists = await prisma.navigationGroup.findUnique({
        where: { id: groupId }
      });

      if (!groupExists) {
        throw new ApiError(404, 'Navigation group not found');
      }
    }

    // Update item
    const updatedItem = await prisma.navigationItem.update({
      where: { id },
      data: {
        label: label || existingItem.label,
        icon: icon !== undefined ? icon : existingItem.icon,
        url: url !== undefined ? url : existingItem.url,
        order: order !== undefined ? order : existingItem.order,
        parentId: parentId !== undefined ? parentId : existingItem.parentId,
        groupId: groupId !== undefined ? groupId : existingItem.groupId,
        isActive: isActive !== undefined ? isActive : existingItem.isActive
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'NavigationItem',
      updatedItem.id,
      AuditAction.UPDATE,
      existingItem,
      updatedItem
    );

    return res.json(updatedItem);
  } catch (error) {
    logger.error(`Update navigation item error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update navigation item');
  }
};

/**
 * Delete navigation item
 */
export const deleteNavigationItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if item exists
    const existingItem = await prisma.navigationItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true
          }
        }
      }
    });

    if (!existingItem) {
      throw new ApiError(404, 'Navigation item not found');
    }

    // Check if item has children
    if (existingItem._count.children > 0) {
      throw new ApiError(400, 'Cannot delete item that has children');
    }

    // Delete role navigation assignments first
    await prisma.$transaction([
      prisma.roleNavigation.deleteMany({
        where: { navigationItemId: id }
      }),
      prisma.navigationItem.delete({
        where: { id }
      })
    ]);

    // Create audit log
    await createAuditLog(
      req,
      'NavigationItem',
      id,
      AuditAction.DELETE,
      existingItem,
      null
    );

    return res.json({ message: 'Navigation item deleted successfully' });
  } catch (error) {
    logger.error(`Delete navigation item error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete navigation item');
  }
};

/**
 * Get navigation structure
 */
export const getNavigationStructure = async (req: Request, res: Response) => {
  try {
    // Get all navigation groups with their items
    const groups = await prisma.navigationGroup.findMany({
      where: {
        isActive: true
      },
      include: {
        navigationItems: {
          where: {
            isActive: true,
            parentId: null // Only top-level items
          },
          include: {
            children: {
              where: {
                isActive: true
              },
              include: {
                children: {
                  where: {
                    isActive: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    });

    return res.json(groups);
  } catch (error) {
    logger.error('Get navigation structure error:', error);
    throw new ApiError(500, 'Failed to fetch navigation structure');
  }
};

/**
 * Get navigation for current user
 */
export const getUserNavigation = async (req: Request, res: Response) => {
  try {
    const adminUser = req.staff;

    // Get all role IDs for the user
    const roleIds = adminUser.roles.map((r: any) => r.roleId);

    // Get all navigation item IDs assigned to these roles
    const roleNavigations = await prisma.roleNavigation.findMany({
      where: {
        roleId: {
          in: roleIds
        }
      },
      select: {
        navigationItemId: true
      }
    });

    const navigationItemIds = roleNavigations.map(rn => rn.navigationItemId);

    // Get all navigation groups with their items that are assigned to the user
    const groups = await prisma.navigationGroup.findMany({
      where: {
        isActive: true
      },
      include: {
        navigationItems: {
          where: {
            isActive: true,
            parentId: null, // Only top-level items
            id: {
              in: navigationItemIds
            }
          },
          include: {
            children: {
              where: {
                isActive: true,
                id: {
                  in: navigationItemIds
                }
              },
              include: {
                children: {
                  where: {
                    isActive: true,
                    id: {
                      in: navigationItemIds
                    }
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    });

    // Filter out empty groups
    const filteredGroups = groups.filter(group => group.navigationItems.length > 0);

    return res.json(filteredGroups);
  } catch (error) {
    logger.error('Get user navigation error:', error);
    throw new ApiError(500, 'Failed to fetch user navigation');
  }
};

/**
 * Update role navigation
 */
export const updateRoleNavigation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { navigationItemIds } = req.body;

    if (!Array.isArray(navigationItemIds)) {
      throw new ApiError(400, 'navigationItemIds must be an array');
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        navigation: true
      }
    });

    if (!existingRole) {
      throw new ApiError(404, 'Role not found');
    }

    // Get existing navigation item IDs
    const existingNavItemIds = existingRole.navigation.map(n => n.navigationItemId);

    // Perform update in a transaction
    await prisma.$transaction(async (tx) => {
      // Remove navigation items that are not in the new list
      await tx.roleNavigation.deleteMany({
        where: {
          roleId: id,
          navigationItemId: {
            notIn: navigationItemIds
          }
        }
      });

      // Add new navigation items
      const newNavItemIds = navigationItemIds.filter(
        navId => !existingNavItemIds.includes(navId)
      );

      for (const navigationItemId of newNavItemIds) {
        // Check if navigation item exists
        const navItemExists = await tx.navigationItem.findUnique({
          where: { id: navigationItemId }
        });

        if (!navItemExists) {
          throw new ApiError(404, `Navigation item with ID ${navigationItemId} not found`);
        }

        await tx.roleNavigation.create({
          data: {
            roleId: id,
            navigationItemId
          }
        });
      }
    });

    // Get updated role with navigation
    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: {
        navigation: {
          include: {
            navigationItem: true
          }
        }
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Role',
      id,
      AuditAction.UPDATE,
      { navigation: existingNavItemIds },
      { navigation: navigationItemIds }
    );

    return res.json(updatedRole);
  } catch (error) {
    logger.error(`Update role navigation error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update role navigation');
  }
};