import { Request, Response } from 'express';
import * as branchCollectionsService from '../services/branch-collections.service';
import * as centerWatchlistService from '../services/center-watchlist.service';
import * as fieldOpsService from '../services/field-operations.service';
import * as riskForecastService from '../services/risk-forecast.service';

/**
 * GET /api/dashboard/branch/summary
 * Branch Manager Dashboard - Complete summary
 */
export const getBranchDashboardSummary = async (req: Request, res: Response) => {
    try {
        // In a real system, get branchId from authenticated user
        const branchId = req.query.branchId as string | undefined;

        // Fetch all metrics in parallel
        const [
            todaysCollections,
            missingCollections,
            centerWatchlist,
            officerPerformances,
            riskForecast
        ] = await Promise.all([
            branchCollectionsService.getTodaysCollectionsSummary(branchId),
            branchCollectionsService.getMissingCollections(branchId),
            centerWatchlistService.getCenterWatchlist(branchId),
            // Get performance for all officers (simplified)
            Promise.resolve([]), // Would call fieldOpsService.getOfficerPerformance for each officer
            riskForecastService.getRiskForecast(branchId)
        ]);

        // Get officer activity summary
        const [lateUploads, cashVariances] = await Promise.all([
            fieldOpsService.getLateUploads(24),
            fieldOpsService.getCashVariances()
        ]);

        const response = {
            todaysCollections: {
                plannedAmount: todaysCollections.plannedAmount,
                collectedAmount: todaysCollections.collectedAmount,
                missingCollections: todaysCollections.missingCollections,
                officersNotSynced: todaysCollections.officersNotSynced,
                cashMismatchCount: todaysCollections.cashMismatchCount,
                collectionRate: todaysCollections.collectionRate,
                missingCollectionsList: missingCollections
            },
            centerWatchlist: {
                items: centerWatchlist,
                totalCount: centerWatchlist.length,
                highSeverityCount: centerWatchlist.filter(c => c.severity === 'high').length
            },
            officerActivity: {
                lateUploads: lateUploads.length,
                cashVariances: cashVariances.length,
                lateUploadsList: lateUploads,
                cashVariancesList: cashVariances
            },
            riskForecast: {
                expectedDefaults30Days: riskForecast.expectedDefaults30Days,
                centersAtRiskPAR7: riskForecast.centersAtRiskPAR7,
                branchRiskScore: riskForecast.branchRiskScore
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching branch dashboard:', error);
        res.status(500).json({
            error: 'Failed to fetch branch dashboard data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * GET /api/dashboard/branch/collections
 * Today's Collections only
 */
export const getTodaysCollections = async (req: Request, res: Response) => {
    try {
        const branchId = req.query.branchId as string | undefined;

        const [summary, missing] = await Promise.all([
            branchCollectionsService.getTodaysCollectionsSummary(branchId),
            branchCollectionsService.getMissingCollections(branchId)
        ]);

        res.json({
            ...summary,
            missingCollectionsList: missing
        });
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({
            error: 'Failed to fetch collections data'
        });
    }
};

/**
 * GET /api/dashboard/branch/watchlist
 * Center Watchlist only
 */
export const getCenterWatchlist = async (req: Request, res: Response) => {
    try {
        const branchId = req.query.branchId as string | undefined;
        const watchlist = await centerWatchlistService.getCenterWatchlist(branchId);

        res.json({
            items: watchlist,
            totalCount: watchlist.length,
            highSeverityCount: watchlist.filter(c => c.severity === 'high').length
        });
    } catch (error) {
        console.error('Error fetching center watchlist:', error);
        res.status(500).json({
            error: 'Failed to fetch center watchlist'
        });
    }
};

/**
 * GET /api/dashboard/branch/risk-forecast
 * Short-Term Risk Forecast only
 */
export const getRiskForecast = async (req: Request, res: Response) => {
    try {
        const branchId = req.query.branchId as string | undefined;
        const forecast = await riskForecastService.getRiskForecast(branchId);

        res.json(forecast);
    } catch (error) {
        console.error('Error fetching risk forecast:', error);
        res.status(500).json({
            error: 'Failed to fetch risk forecast'
        });
    }
};
