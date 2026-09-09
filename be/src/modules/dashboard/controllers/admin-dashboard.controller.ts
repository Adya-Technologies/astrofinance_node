import { Request, Response } from 'express';
import * as portfolioService from '../services/portfolio-metrics.service';
import * as earlyWarningService from '../services/early-warning.service';
import * as fieldOpsService from '../services/field-operations.service';
import * as complianceService from '../services/compliance-metrics.service';

/**
 * GET /api/admin/dashboard/summary
 * Admin/Head Office Dashboard - Complete summary
 */
export const getAdminDashboardSummary = async (req: Request, res: Response) => {
    try {
        // Fetch all metrics in parallel
        const [
            portfolioHealth,
            deterioratingCenters,
            lateUploads,
            gpsAnomalies,
            cashVariances,
            complianceMetrics
        ] = await Promise.all([
            portfolioService.getPortfolioHealthMetrics(),
            earlyWarningService.getDeterioratingCenters(5),
            fieldOpsService.getLateUploads(24),
            fieldOpsService.getGPSAnomalies(),
            fieldOpsService.getCashVariances(),
            complianceService.getComplianceMetrics()
        ]);

        const response = {
            portfolioHealth: {
                totalOutstanding: portfolioHealth.totalOutstanding,
                par1: portfolioHealth.par1,
                par7: portfolioHealth.par7,
                par30: portfolioHealth.par30,
                collectionEfficiencyToday: portfolioHealth.collectionEfficiencyToday,
                collectionEfficiencyMTD: portfolioHealth.collectionEfficiencyMTD,
                activeCenters: portfolioHealth.activeCenters,
                atRiskCenters: portfolioHealth.atRiskCenters
            },
            earlyWarning: {
                deterioratingCenters: deterioratingCenters.map(center => ({
                    centerId: center.centerId,
                    centerName: center.centerName,
                    trendScore: center.trendScore,
                    reasons: center.reasons,
                    lastMeetingDate: center.lastMeetingDate,
                    assignedOfficer: center.assignedOfficer
                }))
            },
            fieldOperations: {
                lateUploads: lateUploads.length,
                gpsAnomalies: gpsAnomalies.length,
                cashVariances: cashVariances.length,
                lateUploadsList: lateUploads,
                gpsAnomaliesList: gpsAnomalies,
                cashVariancesList: cashVariances
            },
            compliance: {
                daysSinceReconciliation: complianceMetrics.daysSinceReconciliation,
                unpostedJournals: complianceMetrics.unpostedJournals,
                auditExceptions: complianceMetrics.auditExceptions,
                nrbReportReadiness: complianceMetrics.nrbReportReadiness
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({
            error: 'Failed to fetch admin dashboard data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * GET /api/admin/dashboard/portfolio
 * Portfolio Health Metrics only
 */
export const getPortfolioHealth = async (req: Request, res: Response) => {
    try {
        const metrics = await portfolioService.getPortfolioHealthMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching portfolio health:', error);
        res.status(500).json({
            error: 'Failed to fetch portfolio health metrics'
        });
    }
};

/**
 * GET /api/admin/dashboard/early-warning
 * Early Warning Radar only
 */
export const getEarlyWarning = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 5;
        const deterioratingCenters = await earlyWarningService.getDeterioratingCenters(limit);

        res.json({
            deterioratingCenters
        });
    } catch (error) {
        console.error('Error fetching early warning data:', error);
        res.status(500).json({
            error: 'Failed to fetch early warning data'
        });
    }
};

/**
 * GET /api/admin/dashboard/field-operations
 * Field Operations Integrity Panel
 */
export const getFieldOperations = async (req: Request, res: Response) => {
    try {
        const thresholdHours = parseInt(req.query.thresholdHours as string) || 24;

        const [lateUploads, gpsAnomalies, cashVariances] = await Promise.all([
            fieldOpsService.getLateUploads(thresholdHours),
            fieldOpsService.getGPSAnomalies(),
            fieldOpsService.getCashVariances()
        ]);

        res.json({
            lateUploads,
            gpsAnomalies,
            cashVariances
        });
    } catch (error) {
        console.error('Error fetching field operations data:', error);
        res.status(500).json({
            error: 'Failed to fetch field operations data'
        });
    }
};

/**
 * GET /api/admin/dashboard/compliance
 * Compliance & Audit Readiness
 */
export const getCompliance = async (req: Request, res: Response) => {
    try {
        const metrics = await complianceService.getComplianceMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching compliance metrics:', error);
        res.status(500).json({
            error: 'Failed to fetch compliance metrics'
        });
    }
};
