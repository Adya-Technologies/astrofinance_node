import { Router } from 'express';
import * as adminDashboardController from './controllers/admin-dashboard.controller';
import * as branchDashboardController from './controllers/branch-dashboard.controller';
import { authenticate } from '../../common/middleware/auth.middleware';

const router: Router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Admin Dashboard Routes
router.get('/admin/summary', adminDashboardController.getAdminDashboardSummary);
router.get('/admin/portfolio', adminDashboardController.getPortfolioHealth);
router.get('/admin/early-warning', adminDashboardController.getEarlyWarning);
router.get('/admin/field-operations', adminDashboardController.getFieldOperations);
router.get('/admin/compliance', adminDashboardController.getCompliance);

// Branch Manager Dashboard Routes
router.get('/branch/summary', branchDashboardController.getBranchDashboardSummary);
router.get('/branch/collections', branchDashboardController.getTodaysCollections);
router.get('/branch/watchlist', branchDashboardController.getCenterWatchlist);
router.get('/branch/risk-forecast', branchDashboardController.getRiskForecast);

export default router;
