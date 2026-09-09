import prisma from '../config/database';
import logger from '../config/logger';

/**
 * Script to check and fix navigation assignments
 * This ensures that all roles have navigation items assigned
 */
async function fixNavigation() {
  try {
    logger.info('Starting navigation fix script...');

    // Check if we have navigation items
    const navItems = await prisma.navigationItem.count();
    logger.info(`Found ${navItems} navigation items`);

    if (navItems === 0) {
      logger.error('No navigation items found. Please run the seed script first.');
      return;
    }

    // Get all roles
    const roles = await prisma.role.findMany();
    logger.info(`Found ${roles.length} roles`);

    // Get Super Admin role
    const superAdmin = roles.find(r => r.name === 'Super Admin');
    if (!superAdmin) {
      logger.error('Super Admin role not found');
      return;
    }

    // Check if Super Admin has navigation items
    const superAdminNavCount = await prisma.roleNavigation.count({
      where: { roleId: superAdmin.id }
    });

    logger.info(`Super Admin has ${superAdminNavCount} navigation items`);

    // If Super Admin has no navigation items, assign all items
    if (superAdminNavCount === 0) {
      logger.info('Assigning all navigation items to Super Admin role');

      const allNavItems = await prisma.navigationItem.findMany();
      for (const item of allNavItems) {
        await prisma.roleNavigation.create({
          data: {
            roleId: superAdmin.id,
            navigationItemId: item.id
          }
        });
      }

      logger.info(`Assigned ${allNavItems.length} navigation items to Super Admin role`);
    }

    // Check other roles
    for (const role of roles) {
      if (role.id === superAdmin.id) continue;

      const roleNavCount = await prisma.roleNavigation.count({
        where: { roleId: role.id }
      });

      logger.info(`Role ${role.name} has ${roleNavCount} navigation items`);

      // If role has no navigation items, assign basic items
      if (roleNavCount === 0) {
        logger.info(`Assigning basic navigation items to ${role.name} role`);

        // Get basic navigation items (Dashboard, Profile)
        const basicItems = await prisma.navigationItem.findMany({
          where: {
            OR: [
              { label: 'Dashboard' },
              { label: 'Profile' }
            ]
          }
        });

        if (basicItems.length > 0) {
          for (const item of basicItems) {
            await prisma.roleNavigation.create({
              data: {
                roleId: role.id,
                navigationItemId: item.id
              }
            });
          }

          logger.info(`Assigned ${basicItems.length} basic navigation items to ${role.name} role`);
        } else {
          logger.warn('No basic navigation items found');
        }
      }
    }

    // Check staff users who should have roles (e.g. those with username set)
    const staffUsers = await prisma.staff.findMany({
      where: {
        username: { not: null }
      },
      include: {
        roles: true
      }
    });

    logger.info(`Found ${staffUsers.length} staff users with login access`);

    // Ensure all staff users have at least one role
    for (const user of staffUsers) {
      if (user.roles.length === 0) {
        logger.info(`Staff user ${user.username} has no roles. Assigning Basic User role.`);

        // Find or create Basic User role
        let basicRole = await prisma.role.findFirst({
          where: { name: 'Basic User' }
        });

        if (!basicRole) {
          basicRole = await prisma.role.create({
            data: {
              name: 'Basic User',
              description: 'Basic user with limited access',
              isSystem: true
            }
          });

          logger.info('Created Basic User role');
        }

        // Assign role to user
        await prisma.staffRole.create({
          data: {
            staffId: user.id,
            roleId: basicRole.id
          }
        });

        logger.info(`Assigned Basic User role to staff user ${user.username}`);
      }
    }

    logger.info('Navigation fix completed successfully');
  } catch (error) {
    logger.error('Error fixing navigation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixNavigation().then(() => {
  logger.info('Script completed');
});