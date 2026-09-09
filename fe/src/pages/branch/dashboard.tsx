import React from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import StatCard from '@/components/dashboard/StatCard';
import AlertList, { AlertItem } from '@/components/dashboard/AlertList';
import apiService from '@/services/api';
import {
    BanknotesIcon,
    ExclamationTriangleIcon,
    UserGroupIcon,
    ChartBarIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';

// Type definitions
interface TodaysCollections {
    plannedAmount: number;
    collectedAmount: number;
    missingCollections: number;
    officersNotSynced: number;
    cashMismatchCount: number;
    collectionRate: number;
    missingCollectionsList: MissingCollection[];
}

interface MissingCollection {
    userId: string;
    userName: string;
    expectedAmount: number;
    centerName: string;
    lastPaymentDate: Date | null;
}

interface CenterWatchlistItem {
    centerId: string;
    centerName: string;
    issue: 'ABSENCE_STREAK' | 'REPAYMENT_DECAY' | 'MULTIPLE_RESCHEDULES';
    severity: 'high' | 'medium' | 'low';
    details: string;
    lastMeetingDate: Date | null;
    assignedOfficer: string;
    suggestedAction: string;
}

interface OfficerActivity {
    lateUploads: number;
    cashVariances: number;
    lateUploadsList: any[];
    cashVariancesList: any[];
}

interface RiskForecast {
    expectedDefaults30Days: number;
    centersAtRiskPAR7: number;
    branchRiskScore?: number;
}

interface BranchDashboardData {
    todaysCollections: TodaysCollections;
    centerWatchlist: {
        items: CenterWatchlistItem[];
        totalCount: number;
        highSeverityCount: number;
    };
    officerActivity: OfficerActivity;
    riskForecast: RiskForecast;
}

const BranchDashboard = () => {
    const { isAuthenticated, isAdmin, isStaff, isLoading: authLoading } = useAuth();
    const router = useRouter();

    // Fetch dashboard data
    const { data, isLoading, error } = useQuery<BranchDashboardData>(
        'branchDashboardSummary',
        () => apiService.get('/dashboard/branch/summary'),
        {
            enabled: isAuthenticated && (isAdmin || isStaff),
            staleTime: 2 * 60 * 1000,
            refetchInterval: 5 * 60 * 1000,
        }
    );

    // Redirect if not authenticated or wrong role
    React.useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !isAuthenticated) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <MainLayout title="Branch Dashboard">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-red-900 mb-2">Failed to Load Dashboard</h3>
                    <p className="text-sm text-red-700">
                        {error instanceof Error ? error.message : 'Unknown error occurred'}
                    </p>
                </div>
            </MainLayout>
        );
    }

    const collections = data?.todaysCollections;
    const watchlist = data?.centerWatchlist;
    const officerActivity = data?.officerActivity;
    const riskForecast = data?.riskForecast;

    // Helper functions
    const getCollectionStatus = (rate: number): 'green' | 'yellow' | 'red' => {
        if (rate >= 90) return 'green';
        if (rate >= 70) return 'yellow';
        return 'red';
    };

    // Convert watchlist to alerts
    const watchlistAlerts: AlertItem[] = watchlist?.items.map(item => ({
        id: item.centerId,
        title: `${item.centerName} - ${item.issue.replace(/_/g, ' ')}`,
        subtitle: `${item.details} | Officer: ${item.assignedOfficer} | Action: ${item.suggestedAction}`,
        severity: item.severity === 'high' ? 'critical' : item.severity === 'medium' ? 'warning' : 'info',
        href: `/admin/centers/${item.centerId}`
    })) || [];

    // Convert missing collections to alerts
    const missingCollectionsAlerts: AlertItem[] = collections?.missingCollectionsList.slice(0, 5).map(item => ({
        id: item.userId,
        title: `${item.userName} - ${item.centerName}`,
        subtitle: `Expected: NPR ${item.expectedAmount.toLocaleString()} | Last Payment: ${item.lastPaymentDate ? new Date(item.lastPaymentDate).toLocaleDateString() : 'Never'
            }`,
        severity: 'warning',
        href: `/users/${item.userId}`
    })) || [];

    // Officer activity alerts
    const officerAlerts: AlertItem[] = [];
    if (officerActivity) {
        if (officerActivity.lateUploads > 0) {
            officerAlerts.push({
                id: 'late-uploads',
                title: `${officerActivity.lateUploads} officers have not synced today`,
                severity: 'warning',
                href: '/admin/staff'
            });
        }
        if (officerActivity.cashVariances > 0) {
            officerAlerts.push({
                id: 'cash-variances',
                title: `${officerActivity.cashVariances} officers with cash discrepancies`,
                severity: 'critical',
                href: '/admin/staff'
            });
        }
    }

    return (
        <MainLayout title="Branch Dashboard">
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Branch Operations</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Today's collections and center performance
                        </p>
                    </div>
                    <div className="text-sm text-gray-500">
                        Last updated: {new Date().toLocaleTimeString()}
                    </div>
                </div>

                {/* A. Today's Collections Summary */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <BanknotesIcon className="w-6 h-6 text-green-600 mr-2" />
                        Today's Collections
                    </h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
                        <StatCard
                            label="Collection Rate"
                            value={collections?.collectionRate || 0}
                            unit="%"
                            status={getCollectionStatus(collections?.collectionRate || 0)}
                            decimals={1}
                        />
                        <StatCard
                            label="Collected Today"
                            value={collections?.collectedAmount || 0}
                            unit="NPR"
                            status="green"
                            decimals={0}
                        />
                        <StatCard
                            label="Planned Amount"
                            value={collections?.plannedAmount || 0}
                            unit="NPR"
                            status="neutral"
                            decimals={0}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <StatCard
                            label="Missing Collections"
                            value={collections?.missingCollections || 0}
                            status={collections && collections.missingCollections > 0 ? 'red' : 'green'}
                            decimals={0}
                        />
                        <StatCard
                            label="Officers Not Synced"
                            value={collections?.officersNotSynced || 0}
                            status={collections && collections.officersNotSynced > 0 ? 'yellow' : 'green'}
                            decimals={0}
                        />
                        <StatCard
                            label="Cash Mismatches"
                            value={collections?.cashMismatchCount || 0}
                            status={collections && collections.cashMismatchCount > 0 ? 'red' : 'green'}
                            decimals={0}
                        />
                    </div>

                    {/* Missing Collections List */}
                    {missingCollectionsAlerts.length > 0 && (
                        <div className="mt-4 bg-white rounded-lg shadow p-4">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">
                                Top Missing Collections
                            </h3>
                            <AlertList
                                items={missingCollectionsAlerts}
                                emptyMessage="✓ All collections received"
                            />
                        </div>
                    )}
                </div>

                {/* B. Center Watchlist */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center mb-4">
                        <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 mr-2" />
                        <h2 className="text-lg font-semibold text-gray-900">Center Watchlist</h2>
                        {watchlist && watchlist.highSeverityCount > 0 && (
                            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {watchlist.highSeverityCount} High Priority
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Centers requiring immediate attention
                    </p>
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : (
                        <AlertList
                            items={watchlistAlerts}
                            emptyMessage="✓ All centers performing well"
                        />
                    )}
                </div>

                {/* C. Officer Activity & Risk Forecast Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Officer Activity */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center mb-4">
                            <UserGroupIcon className="w-6 h-6 text-blue-500 mr-2" />
                            <h2 className="text-lg font-semibold text-gray-900">Officer Activity</h2>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            Field officer status and anomalies
                        </p>
                        {isLoading ? (
                            <div className="text-center py-8 text-gray-500">Loading...</div>
                        ) : (
                            <AlertList
                                items={officerAlerts}
                                emptyMessage="✓ All officers synced and on track"
                            />
                        )}
                    </div>

                    {/* Short-Term Risk Forecast */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center mb-4">
                            <ChartBarIcon className="w-6 h-6 text-purple-500 mr-2" />
                            <h2 className="text-lg font-semibold text-gray-900">30-Day Risk Forecast</h2>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            Predicted defaults and at-risk centers
                        </p>
                        {isLoading ? (
                            <div className="text-center py-8 text-gray-500">Loading...</div>
                        ) : (
                            <div className="space-y-4">
                                <StatCard
                                    label="Expected Defaults (30 days)"
                                    value={riskForecast?.expectedDefaults30Days || 0}
                                    status={riskForecast && riskForecast.expectedDefaults30Days > 5 ? 'red' :
                                        riskForecast && riskForecast.expectedDefaults30Days > 2 ? 'yellow' : 'green'}
                                    decimals={0}
                                />
                                <StatCard
                                    label="Centers at Risk (PAR 7)"
                                    value={riskForecast?.centersAtRiskPAR7 || 0}
                                    status={riskForecast && riskForecast.centersAtRiskPAR7 > 3 ? 'red' :
                                        riskForecast && riskForecast.centersAtRiskPAR7 > 1 ? 'yellow' : 'green'}
                                    decimals={0}
                                />
                                {riskForecast?.branchRiskScore !== undefined && (
                                    <StatCard
                                        label="Branch Risk Score"
                                        value={riskForecast.branchRiskScore}
                                        unit="/100"
                                        status={riskForecast.branchRiskScore > 50 ? 'red' :
                                            riskForecast.branchRiskScore > 30 ? 'yellow' : 'green'}
                                        decimals={0}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export async function getServerSideProps({ locale }: { locale: string }) {
    return {
        props: {
            ...(await import('next-i18next/serverSideTranslations').then(m =>
                m.serverSideTranslations(locale, ['common', 'user', 'auth'])
            )),
        },
    };
}

export default BranchDashboard;
