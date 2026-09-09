import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeftIcon, PencilIcon, KeyIcon } from '@heroicons/react/24/outline';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Tabs from '@/components/common/Tabs';
import Table from '@/components/common/Table';
import UserAccounts from '@/components/modules/users/UserAccounts';
import UserDocuments from '@/components/modules/users/UserDocuments';
import { formatDate, formatCurrency } from '@/utils/dateUtils';
import { getUserById, getUserLoans, getUserLoanApplications, User, UserLoan, UserLoanApplication } from '@/services/user.service';
import { Column } from 'react-table';
import { toast } from 'react-toastify';

const UserDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState<User | null>(null);
  const [loans, setLoans] = useState<UserLoan[]>([]);
  const [loanApplications, setLoanApplications] = useState<UserLoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loansLoading, setLoansLoading] = useState(false);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchUserDetails(id);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'loans' && user) {
      fetchUserLoans(user.id);
    } else if (activeTab === 'applications' && user) {
      fetchUserLoanApplications(user.id);
    }
  }, [activeTab, user]);

  const fetchUserDetails = async (userId: string) => {
    try {
      setLoading(true);
      const data = await getUserById(userId);
      setUser(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching user details:', err);
      setError('Failed to load user details. Please try again later.');
      toast.error('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLoans = async (userId: string) => {
    try {
      setLoansLoading(true);
      const response = await getUserLoans(userId);
      setLoans(response.data);
    } catch (err) {
      console.error('Error fetching user loans:', err);
      toast.error('Failed to load user loans');
    } finally {
      setLoansLoading(false);
    }
  };

  const fetchUserLoanApplications = async (userId: string) => {
    try {
      setApplicationsLoading(true);
      const response = await getUserLoanApplications(userId);
      setLoanApplications(response.data);
    } catch (err) {
      console.error('Error fetching user loan applications:', err);
      toast.error('Failed to load user loan applications');
    } finally {
      setApplicationsLoading(false);
    }
  };

  const loanColumns: Column<UserLoan>[] = [
    {
      Header: 'Account Number',
      accessor: 'accountNumber',
    },
    {
      Header: 'Loan Type',
      accessor: 'loanType' as keyof UserLoan,
      Cell: ({ row }: any) => (
        <span>{row.original.loanType?.name || 'Unknown'}</span>
      ),
    },
    {
      Header: 'Amount',
      accessor: 'amount',
      Cell: ({ value }: { value: number }) => formatCurrency(value),
    },
    {
      Header: 'Disbursement Date',
      accessor: 'disbursementDate',
      Cell: ({ value }: { value: string }) => formatDate(value),
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ value }: { value: string }) => (
        <Badge
          color={
            value === 'ACTIVE' ? 'green' :
              value === 'CLOSED' ? 'gray' :
                value === 'DEFAULTED' ? 'red' : 'yellow'
          }
          text={value}
        />
      ),
    },
    {
      Header: 'Actions',
      accessor: 'id',
      Cell: ({ value }: { value: string }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/loans/${value}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const applicationColumns: Column<UserLoanApplication>[] = [
    {
      Header: 'Application Number',
      accessor: 'applicationNumber',
    },
    {
      Header: 'Loan Type',
      accessor: 'loanType' as keyof UserLoanApplication,
      Cell: ({ row }: any) => (
        <span>{row.original.loanType?.name || 'Unknown'}</span>
      ),
    },
    {
      Header: 'Amount',
      accessor: 'amount',
      Cell: ({ value }: { value: number }) => formatCurrency(value),
    },
    {
      Header: 'Applied Date',
      accessor: 'appliedDate',
      Cell: ({ value }: { value: string }) => formatDate(value),
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ value }: { value: string }) => (
        <Badge
          color={
            value === 'PENDING' ? 'yellow' :
              value === 'APPROVED' ? 'green' :
                value === 'REJECTED' ? 'red' : 'blue'
          }
          text={value}
        />
      ),
    },
    {
      Header: 'Actions',
      accessor: 'id',
      Cell: ({ value }: { value: string }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/loan-applications/${value}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const tabs = [
    { id: 'details', label: 'User Details' },
    { id: 'documents', label: 'Documents' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'loans', label: 'Loans' },
    { id: 'applications', label: 'Loan Applications' },
  ];

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => router.push('/users')}
            >
              <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Back to Users List
            </Button>
          </div>

          {error && (
            <div className="mt-6 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-primary-400 border-r-transparent"></div>
              <p className="mt-4 text-gray-700">Loading user details...</p>
            </div>
          ) : user ? (
            <div>
              <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      User Information
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                      Personal details and account information.
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      className="flex items-center"
                      onClick={() => router.push(`/users/${user.id}/edit`)}
                    >
                      <PencilIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                      Edit
                    </Button>
                  </div>
                </div>

                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

                {activeTab === 'details' && (
                  <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                    <dl className="sm:divide-y sm:divide-gray-200">
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Full name</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.fullName}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Contact number</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.contactNumber}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Email address</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.email || 'Not provided'}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Date of birth</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.dateOfBirth ? formatDate(user.dateOfBirth) : 'Not provided'}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Gender</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.gender || 'Not specified'}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Address</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.address}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">ID Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.idType}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">ID Number</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.idNumber}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">User Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <Badge
                            color={
                              user.userType === 'SB' ? 'blue' :
                                user.userType === 'BB' ? 'green' : 'purple'
                            }
                            text={
                              user.userType === 'SB' ? 'Savings Bank' :
                                user.userType === 'BB' ? 'Business Banking' : 'Mobile Banking'
                            }
                          />
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          <Badge
                            color={user.isActive ? 'green' : 'red'}
                            text={user.isActive ? 'Active' : 'Inactive'}
                          />
                        </dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Created At</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(user.createdAt)}</dd>
                      </div>
                      <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(user.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="px-4 py-5">
                    {user && <UserDocuments userId={user.id} />}
                  </div>
                )}

                {activeTab === 'loans' && (
                  <div className="px-4 py-5">
                    {loansLoading ? (
                      <div className="text-center py-10">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-primary-400 border-r-transparent"></div>
                        <p className="mt-4 text-gray-700">Loading loans...</p>
                      </div>
                    ) : loans.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-gray-500">No loans found for this user.</p>
                      </div>
                    ) : (
                      <Table
                        columns={loanColumns}
                        data={loans}
                        keyField="id"
                      />
                    )}
                  </div>
                )}

                {activeTab === 'accounts' && (
                  <div className="px-4 py-5">
                    {user && <UserAccounts userId={user.id} />}
                  </div>
                )}

                {activeTab === 'applications' && (
                  <div className="px-4 py-5">
                    {applicationsLoading ? (
                      <div className="text-center py-10">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-primary-400 border-r-transparent"></div>
                        <p className="mt-4 text-gray-700">Loading loan applications...</p>
                      </div>
                    ) : loanApplications.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-gray-500">No loan applications found for this user.</p>
                      </div>
                    ) : (
                      <Table
                        columns={applicationColumns}
                        data={loanApplications}
                        keyField="id"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-700">User not found.</p>
            </div>
          )}
        </div>
      </MainLayout>
    </ProtectedRoute>
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

export default UserDetailPage;
