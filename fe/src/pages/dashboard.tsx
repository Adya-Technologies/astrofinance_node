import React from 'react';
import { useQuery } from 'react-query';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import Card from '@/components/common/Card';
import apiService from '@/services/api';
import { BanknotesIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon, CalculatorIcon } from '@heroicons/react/24/outline';

// Types for the dashboard data
interface LoanSummary {
  activeLoans: number;
  totalLoanAmount: number;
  pendingApplications: number;
  upcomingPayments: number;
}

interface UpcomingPayment {
  id: string;
  loanNumber: string;
  dueDate: string;
  amount: number;
  status: string;
}

// Service to fetch dashboard data
const fetchDashboardData = async (): Promise<LoanSummary> => {
  // This would be replaced with an actual API call
  // return apiService.get<LoanSummary>('/user/dashboard/summary');

  // Mock data for now
  return {
    activeLoans: 2,
    totalLoanAmount: 15000,
    pendingApplications: 1,
    upcomingPayments: 3,
  };
};

const fetchUpcomingPayments = async (): Promise<UpcomingPayment[]> => {
  // This would be replaced with an actual API call
  // return apiService.get<UpcomingPayment[]>('/user/dashboard/upcoming-payments');

  // Mock data for now
  return [
    {
      id: '1',
      loanNumber: 'L-2023-001',
      dueDate: '2023-12-15',
      amount: 1250,
      status: 'PENDING',
    },
    {
      id: '2',
      loanNumber: 'L-2023-002',
      dueDate: '2023-12-20',
      amount: 850,
      status: 'PENDING',
    },
    {
      id: '3',
      loanNumber: 'L-2023-001',
      dueDate: '2024-01-15',
      amount: 1250,
      status: 'UPCOMING',
    },
  ];
};

const Dashboard = () => {
  const { isAuthenticated, isAdmin, isStaff, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Fetch dashboard data
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<LoanSummary>(
    'dashboardSummary',
    fetchDashboardData,
    {
      enabled: isAuthenticated && !isAdmin && !isStaff,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const { data: upcomingPayments, isLoading: isPaymentsLoading } = useQuery<UpcomingPayment[]>(
    'upcomingPayments',
    fetchUpcomingPayments,
    {
      enabled: isAuthenticated && !isAdmin && !isStaff,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Redirect based on role
  React.useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (isAdmin) {
        router.push('/admin/dashboard');
      } else if (isStaff) {
        router.push('/staff/dashboard');
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, isStaff, router]);

  if (authLoading || !isAuthenticated || isAdmin || isStaff) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BanknotesIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Loans</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">
                        {isSummaryLoading ? '...' : summaryData?.activeLoans}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <a href="/loans" className="font-medium text-primary-700 hover:text-primary-900">
                  View all
                </a>
              </div>
            </div>
          </Card>

          <Card className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Applications</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">
                        {isSummaryLoading ? '...' : summaryData?.pendingApplications}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <a href="/loans/applications" className="font-medium text-primary-700 hover:text-primary-900">
                  View all
                </a>
              </div>
            </div>
          </Card>

          <Card className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Loan Amount</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">
                        {isSummaryLoading ? '...' : `$${summaryData?.totalLoanAmount.toLocaleString()}`}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <a href="/loans" className="font-medium text-primary-700 hover:text-primary-900">
                  View details
                </a>
              </div>
            </div>
          </Card>

          <Card className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationCircleIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Upcoming Payments</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">
                        {isSummaryLoading ? '...' : summaryData?.upcomingPayments}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <a href="/payments" className="font-medium text-primary-700 hover:text-primary-900">
                  View all
                </a>
              </div>
            </div>
          </Card>
        </div>

        {/* Upcoming Payments */}
        <Card title="Upcoming Payments">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Loan Number
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Due Date
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isPaymentsLoading ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : upcomingPayments && upcomingPayments.length > 0 ? (
                  upcomingPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {payment.loanNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(payment.dueDate).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        ${payment.amount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${payment.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : payment.status === 'PAID'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                            }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <a href={`/payments/${payment.id}`} className="text-primary-600 hover:text-primary-900">
                          {payment.status === 'PENDING' ? 'Pay Now' : 'View'}
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-gray-500">
                      No upcoming payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/loans/apply"
              className="inline-block rounded-md bg-white px-4 py-6 text-center shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <BanknotesIcon className="mx-auto h-8 w-8 text-primary-600" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">Apply for a Loan</h3>
              <p className="mt-1 text-sm text-gray-500">Start a new loan application process</p>
            </a>

            <a
              href="/payments"
              className="inline-block rounded-md bg-white px-4 py-6 text-center shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <ClockIcon className="mx-auto h-8 w-8 text-primary-600" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">Make a Payment</h3>
              <p className="mt-1 text-sm text-gray-500">Pay your upcoming or overdue installments</p>
            </a>

            <a
              href="/calculator"
              className="inline-block rounded-md bg-white px-4 py-6 text-center shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <CalculatorIcon className="mx-auto h-8 w-8 text-primary-600" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">Loan Calculator</h3>
              <p className="mt-1 text-sm text-gray-500">Calculate EMI for different loan amounts</p>
            </a>
          </div>
        </Card>
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

export default Dashboard;
