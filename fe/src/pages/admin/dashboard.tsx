import React from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import StatCard from '@/components/dashboard/StatCard';
import AlertList, { AlertItem } from '@/components/dashboard/AlertList';
import apiService from '@/services/api';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// Type definitions for API responses
interface PortfolioHealth {
  totalOutstanding: number;
  par1: number;
  par7: number;
  par30: number;
  collectionEfficiencyToday: number;
  collectionEfficiencyMTD: number;
  activeCenters: number;
  atRiskCenters: number;
}

interface DeterioratingCenter {
  centerId: string;
  centerName: string;
  trendScore: number;
  reasons: string[];
  lastMeetingDate: string | null;
  assignedOfficer: string;
}

interface FieldOperations {
  lateUploads: number;
  gpsAnomalies: number;
  cashVariances: number;
  lateUploadsList: any[];
  gpsAnomaliesList: any[];
  cashVariancesList: any[];
}

interface ComplianceMetrics {
  daysSinceReconciliation: number;
  unpostedJournals: number;
  auditExceptions: number;
  nrbReportReadiness: {
    status: 'READY' | 'INCOMPLETE';
    missingItems: string[];
  };
}

interface AdminDashboardData {
  portfolioHealth: PortfolioHealth;
  earlyWarning: {
    deterioratingCenters: DeterioratingCenter[];
  };
  fieldOperations: FieldOperations;
  compliance: ComplianceMetrics;
}

const AdminDashboardV2 = () => {
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Fetch dashboard data
  const { data, isLoading, error } = useQuery<AdminDashboardData>(
    'adminDashboardV2',
    () => apiService.get('/dashboard/admin/summary'),
    {
      enabled: isAuthenticated && isAdmin,
      staleTime: 2 * 60 * 1000, // 2 minutes
      refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    }
  );

  // Redirect if not authenticated or not admin
  React.useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/login?type=admin');
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  if (authLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <MainLayout title="Admin Dashboard">
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

  const portfolio = data?.portfolioHealth;
  const earlyWarning = data?.earlyWarning;
  const fieldOps = data?.fieldOperations;
  const compliance = data?.compliance;

  // Determine PAR status colors
  const getPARStatus = (par: number): 'green' | 'yellow' | 'red' => {
    if (par < 2) return 'green';
    if (par < 5) return 'yellow';
    return 'red';
  };

  const getCollectionEfficiencyStatus = (efficiency: number): 'green' | 'yellow' | 'red' => {
    if (efficiency >= 90) return 'green';
    if (efficiency >= 75) return 'yellow';
    return 'red';
  };

  const getComplianceStatus = (days: number): 'green' | 'yellow' | 'red' => {
    if (days <= 1) return 'green';
    if (days <= 3) return 'yellow';
    return 'red';
  };

  // Convert deteriorating centers to alert items
  const earlyWarningAlerts: AlertItem[] = earlyWarning?.deterioratingCenters.map(center => ({
    id: center.centerId,
    title: `${center.centerName} - Trend Score: ${center.trendScore}`,
    subtitle: `Reasons: ${center.reasons.map(r => r.replace(/_/g, ' ')).join(', ')} | Officer: ${center.assignedOfficer}`,
    severity: center.trendScore > 60 ? 'critical' : center.trendScore > 30 ? 'warning' : 'info',
    href: `/admin/centers/${center.centerId}`
  })) || [];

  // Field operations alerts
  const fieldOperationsAlerts: AlertItem[] = [];
  if (fieldOps) {
    if (fieldOps.lateUploads > 0) {
      fieldOperationsAlerts.push({
        id: 'late-uploads',
        title: `${fieldOps.lateUploads} officers have not uploaded data`,
        severity: 'warning',
        href: '/admin/staff'
      });
    }
    if (fieldOps.gpsAnomalies > 0) {
      fieldOperationsAlerts.push({
        id: 'gps-anomalies',
        title: `${fieldOps.gpsAnomalies} GPS anomalies detected`,
        severity: 'critical',
        href: '/admin/staff'
      });
    }
    if (fieldOps.cashVariances > 0) {
      fieldOperationsAlerts.push({
        id: 'cash-variances',
        title: `${fieldOps.cashVariances} officers with cash discrepancies`,
        severity: 'critical',
        href: '/admin/staff'
      });
    }
  }

  // Compliance alerts
  const complianceAlerts: AlertItem[] = [];
  if (compliance) {
    if (compliance.unpostedJournals > 0) {
      complianceAlerts.push({
        id: 'unposted-journals',
        title: `${compliance.unpostedJournals} unposted journal entries`,
        severity: 'warning',
        href: '/accounting/journal-entries'
      });
    }
    if (compliance.auditExceptions > 0) {
      complianceAlerts.push({
        id: 'audit-exceptions',
        title: `${compliance.auditExceptions} audit exceptions found`,
        severity: 'critical',
        href: '/accounting/reports'
      });
    }
    if (compliance.nrbReportReadiness.status === 'INCOMPLETE') {
      complianceAlerts.push({
        id: 'nrb-readiness',
        title: 'NRB Report Not Ready',
        subtitle: compliance.nrbReportReadiness.missingItems.join('; '),
        severity: 'warning',
        href: '/admin/reports'
      });
    }
  }

  return (
    <MainLayout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Overview</h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time analytics and early warnings
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* A. Portfolio Health Snapshot - Top Strip (No Scrolling) */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Health</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Outstanding"
              value={portfolio?.totalOutstanding || 0}
              unit="NPR"
              decimals={0}
              status="green"
            />
            <StatCard
              label="PAR 1"
              value={portfolio?.par1 || 0}
              unit="%"
              status={getPARStatus(portfolio?.par1 || 0)}
            />
            <StatCard
              label="PAR 7"
              value={portfolio?.par7 || 0}
              unit="%"
              status={getPARStatus(portfolio?.par7 || 0)}
            />
            <StatCard
              label="PAR 30"
              value={portfolio?.par30 || 0}
              unit="%"
              status={getPARStatus(portfolio?.par30 || 0)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            <StatCard
              label="Collection Efficiency (Today)"
              value={portfolio?.collectionEfficiencyToday || 0}
              unit="%"
              status={getCollectionEfficiencyStatus(portfolio?.collectionEfficiencyToday || 0)}
            />
            <StatCard
              label="Collection Efficiency (MTD)"
              value={portfolio?.collectionEfficiencyMTD || 0}
              unit="%"
              status={getCollectionEfficiencyStatus(portfolio?.collectionEfficiencyMTD || 0)}
            />
            <StatCard
              label="Active Centers"
              value={portfolio?.activeCenters || 0}
              status="green"
              decimals={0}
            />
            <StatCard
              label="At-Risk Centers"
              value={portfolio?.atRiskCenters || 0}
              status={portfolio && portfolio.atRiskCenters > 0 ? 'red' : 'green'}
              decimals={0}
              onClick={() => router.push('/admin/centers')}
            />
          </div>
        </div>

        {/* B. Early Warning Radar - Killer Feature */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Early Warning Radar</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Centers with deteriorating trends - prioritize interventions here
          </p>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <AlertList
              items={earlyWarningAlerts}
              emptyMessage="✓ No deteriorating centers detected"
            />
          )}
        </div>

        {/* C. Field Operations Integrity Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <ClockIcon className="w-6 h-6 text-blue-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Field Operations Integrity</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Officer upload status and anomalies
          </p>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <AlertList
              items={fieldOperationsAlerts}
              emptyMessage="✓ All field operations normal"
            />
          )}
        </div>

        {/* D. Compliance & Audit Readiness */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <CheckCircleIcon className="w-6 h-6 text-green-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Compliance & Audit Readiness</h2>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                <StatCard
                  label="Days Since Reconciliation"
                  value={compliance?.daysSinceReconciliation || 0}
                  status={getComplianceStatus(compliance?.daysSinceReconciliation || 0)}
                  decimals={0}
                />
                <StatCard
                  label="Unposted Journals"
                  value={compliance?.unpostedJournals || 0}
                  status={compliance && compliance.unpostedJournals > 0 ? 'yellow' : 'green'}
                  decimals={0}
                />
                <StatCard
                  label="Audit Exceptions"
                  value={compliance?.auditExceptions || 0}
                  status={compliance && compliance.auditExceptions > 0 ? 'red' : 'green'}
                  decimals={0}
                />
              </div>

              <AlertList
                items={complianceAlerts}
                emptyMessage="✓ Ready for audit - all checks passed"
              />
            </>
          )}
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

export default AdminDashboardV2;
