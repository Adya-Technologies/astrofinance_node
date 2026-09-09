import prisma from '../../../config/database';
import logger from '../../../config/logger';

// Define interfaces for navigation items and groups
interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  url?: string;
  order: number;
  parentId?: string | null;
  groupId?: string | null;
  children: NavigationItem[];
}

interface NavigationGroup {
  id: string;
  name: string;
  order: number;
  items: NavigationItem[];
}

/**
 * Get navigation items for a user based on their roles, organized by navigation groups
 * @param userId User ID
 * @param userType User type (ADMIN or STAFF)
 * @returns Array of navigation groups, each containing navigation items
 */
export const getUserNavigation = async (userId: string, userType: 'ADMIN' | 'STAFF') => {
  try {
    // Get user roles based on user type (Unified to Staff)
    let userRoles: { roleId: string }[] = [];

    // Both ADMIN and STAFF are now in the Staff table
    const staffUser = await prisma.staff.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: { isActive: true }
        }
      }
    });

    if (!staffUser) {
      // If authenticating as ADMIN but not found in Staff, it might be a migration issue or invalid ID
      throw new Error('User not found');
    }

    userRoles = staffUser.roles.map(role => ({ roleId: role.roleId }));

    if (userRoles.length === 0) {
      return [];
    }

    // Get role IDs
    const roleIds = userRoles.map(role => role.roleId);

    // Get navigation items for these roles
    const roleNavigation = await prisma.roleNavigation.findMany({
      where: {
        roleId: { in: roleIds }
      },
      include: {
        navigationItem: {
          include: {
            group: true,
            children: true
          }
        }
      }
    });

    // Debug log
    logger.debug(`Found ${roleNavigation.length} navigation items for roles: ${roleIds.join(', ')}`);

    // Do not fallback to Super Admin or all items; return empty if none assigned
    if (roleNavigation.length === 0) {
      logger.warn(`No navigation items assigned for roles: ${roleIds.join(', ')}`);
      return [];
    }

    // Extract unique navigation items and organize by groups
    const navigationItemMap = new Map<string, NavigationItem>();
    const navigationGroupMap = new Map<string, NavigationGroup>();

    // Log the raw data for debugging
    logger.debug(`Raw navigation data: ${JSON.stringify(roleNavigation.slice(0, 1))}`);

    for (const rn of roleNavigation) {
      try {
        if (!rn.navigationItem) {
          logger.warn(`Navigation item not found for role navigation: ${rn.id}`);
          continue;
        }

        const item = rn.navigationItem;

        // Skip inactive items
        if (item.isActive === false) {
          logger.debug(`Skipping inactive navigation item: ${item.label}`);
          continue;
        }

        if (!navigationItemMap.has(item.id)) {
          // Debug log for each navigation item
          logger.debug(`Processing navigation item: ${item.label}, icon: ${item.icon}, url: ${item.url}, parentId: ${item.parentId}, groupId: ${item.groupId}`);

          navigationItemMap.set(item.id, {
            id: item.id,
            label: item.label,
            icon: item.icon ?? undefined,
            url: item.url ?? undefined,
            order: item.order,
            parentId: item.parentId,
            groupId: item.groupId,
            children: []
          });

          // Create or update group if this item belongs to a group
          if (item.groupId && item.group) {
            if (!navigationGroupMap.has(item.groupId)) {
              navigationGroupMap.set(item.groupId, {
                id: item.groupId,
                name: item.group.name,
                order: item.group.order,
                items: []
              });
            }
          }
        }
      } catch (error) {
        logger.error(`Error processing navigation item: ${error}`);
      }
    }

    // Add children to parent items
    navigationItemMap.forEach(item => {
      if (item.parentId && navigationItemMap.has(item.parentId)) {
        const parent = navigationItemMap.get(item.parentId);
        if (parent) {
          parent.children.push(item);
        }
      }
    });

    // Organize items into their groups
    navigationItemMap.forEach(item => {
      // Only process top-level items (not children)
      if (!item.parentId) {
        if (item.groupId && navigationGroupMap.has(item.groupId)) {
          // Add to group if it belongs to one
          const group = navigationGroupMap.get(item.groupId);
          if (group) {
            group.items.push(item);
          }
        }
      }
    });

    // Sort items within each group
    navigationGroupMap.forEach(group => {
      group.items.sort((a, b) => a.order - b.order);

      // Sort children within each item
      group.items.forEach(item => {
        if (item.children.length > 0) {
          item.children.sort((a, b) => a.order - b.order);
        }
      });
    });

    // Convert groups to array and sort by order
    const navigationGroups = Array.from(navigationGroupMap.values())
      .sort((a, b) => a.order - b.order);

    // Debug log
    logger.debug(`Returning ${navigationGroups.length} navigation groups with their items`);

    return navigationGroups;
  } catch (error) {
    logger.error('Error fetching user navigation:', error);
    throw error;
  }
};

/**
 * Get user permissions based on their roles
 * @param userId User ID
 * @param userType User type (ADMIN or STAFF)
 * @returns Array of permission codes
 */
/**
 * Get all navigation items organized by groups for testing purposes
 * This is for internal use only
 * @returns Array of navigation groups, each containing navigation items
 */
export const fetchAllNavigationItems = async () => {
  try {
    const navigationItems = await prisma.navigationItem.findMany({
      where: {
        isActive: true
      },
      include: {
        group: true,
        children: {
          where: {
            isActive: true
          }
        }
      },
      orderBy: [
        {
          order: 'asc'
        }
      ]
    });

    logger.debug(`Found ${navigationItems.length} total navigation items in database`);

    // Create maps for items and groups
    const itemMap = new Map<string, NavigationItem>();
    const groupMap = new Map<string, NavigationGroup>();

    // Process all navigation items
    navigationItems.forEach(item => {
      // Create navigation item
      itemMap.set(item.id, {
        id: item.id,
        label: item.label,
        icon: item.icon || undefined,
        url: item.url || undefined,
        order: item.order,
        parentId: item.parentId || undefined,
        groupId: item.groupId || undefined,
        children: []
      });

      // Create or update group if this item belongs to a group
      if (item.groupId && item.group) {
        if (!groupMap.has(item.groupId)) {
          groupMap.set(item.groupId, {
            id: item.groupId,
            name: item.group.name,
            order: item.group.order,
            items: []
          });
        }
      }
    });

    // Add children to parent items
    itemMap.forEach(item => {
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId);
        if (parent) {
          parent.children.push(item);
        }
      }
    });

    // Organize items into their groups
    itemMap.forEach(item => {
      // Only process top-level items (not children)
      if (!item.parentId) {
        if (item.groupId && groupMap.has(item.groupId)) {
          // Add to group if it belongs to one
          const group = groupMap.get(item.groupId);
          if (group) {
            group.items.push(item);
          }
        }
      }
    });

    // Sort items within each group
    groupMap.forEach(group => {
      group.items.sort((a, b) => a.order - b.order);

      // Sort children within each item
      group.items.forEach(item => {
        if (item.children.length > 0) {
          item.children.sort((a, b) => a.order - b.order);
        }
      });
    });

    // Convert groups to array and sort by order
    const navigationGroups = Array.from(groupMap.values())
      .sort((a, b) => a.order - b.order);

    logger.debug(`Organized into ${navigationGroups.length} navigation groups`);
    return navigationGroups;
  } catch (error) {
    logger.error('Error fetching all navigation items:', error);
    throw error;
  }
};

export const getUserPermissions = async (userId: string, userType: 'ADMIN' | 'STAFF') => {
  try {
    // Get user roles based on user type (Unified to Staff)
    let userRoles: { roleId: string }[] = [];

    // Both ADMIN and STAFF are now in the Staff table
    const staffUser = await prisma.staff.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: { isActive: true }
        }
      }
    });

    if (!staffUser) {
      throw new Error('User not found');
    }

    userRoles = staffUser.roles.map(role => ({ roleId: role.roleId }));

    if (userRoles.length === 0) {
      return [];
    }

    // Get role IDs
    const roleIds = userRoles.map(role => role.roleId);

    // Get permissions for these roles
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        roleId: { in: roleIds }
      },
      include: {
        permission: true
      }
    });

    // Extract unique permission codes
    const permissionCodes = new Set<string>();

    rolePermissions.forEach(rp => {
      permissionCodes.add(rp.permission.code);
    });

    return Array.from(permissionCodes);
  } catch (error) {
    logger.error('Error fetching user permissions:', error);
    throw error;
  }
};