import { Router, type Router as ExpressRouter } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import staffRoutes from './staff.routes';
import roleRoutes from './role.routes';
import navigationRoutes from './navigation.routes';
import dashboardRoutes from './dashboard.routes';
import settingsRoutes from './settings.routes';

const router: ExpressRouter = Router();

// Auth routes
router.use('/auth', authRoutes);

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

// Admin user routes (legacy)
router.use('/users', usersRoutes);

// Staff management routes
router.use('/staff', staffRoutes);

// Role routes
router.use('/roles', roleRoutes);

// Navigation routes
router.use('/navigation', navigationRoutes);

// Settings routes
router.use('/settings', settingsRoutes);

export default router;