import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PencilIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import MainLayout from '../../../../components/layout/MainLayout';
import ProtectedRoute from '../../../../components/common/ProtectedRoute';
import Button from '../../../../components/common/Button';
import Badge from '../../../../components/common/Badge';
import chartOfAccountsService, { Account } from '../../../../services/chart-of-accounts.service';

const AccountDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [account, setAccount] = useState<Account | null>(null);
  const [parentAccount, setParentAccount] = useState<Account | null>(null);
  const [childAccounts, setChildAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (router.isReady && id && typeof id === 'string') {
      fetchAccountDetails(id);
    }
  }, [router.isReady, id]);

  const fetchAccountDetails = async (accountId: string) => {
    setLoading(true);
    try {
      const accountData = await chartOfAccountsService.getAccountById(accountId);
      setAccount(accountData);

      // Fetch parent account if exists
      if (accountData.parentId) {
        try {
          const parent = await chartOfAccountsService.getAccountById(accountData.parentId);
          setParentAccount(parent);
        } catch (error) {
          console.error('Error fetching parent account:', error);
        }
      }

      // Fetch child accounts
      try {
        const allAccounts = await chartOfAccountsService.getAllAccounts();
        const children = allAccounts.filter(a => a.parentId === accountId);
        setChildAccounts(children);
      } catch (error) {
        console.error('Error fetching child accounts:', error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch account details');
      router.push('/accounting/chart-of-accounts');
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeBadge = (type: string) => {
    switch (type) {
      case 'ASSET':
        return <Badge color="blue" text="Asset" />;
      case 'LIABILITY':
        return <Badge color="red" text="Liability" />;
      case 'EQUITY':
        return <Badge color="green" text="Equity" />;
      case 'INCOME':
        return <Badge color="purple" text="Income" />;
      case 'EXPENSE':
        return <Badge color="yellow" text="Expense" />;
      default:
        return <Badge color="gray" text={type} />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">Loading account details...</div>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  if (!account) {
    return (
      <ProtectedRoute>
        <MainLayout>
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">Account not found</div>
          </div>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <Button
                variant="secondary"
                className="mr-4"
                onClick={() => router.push('/accounting/chart-of-accounts')}
              >
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Back to Chart of Accounts
              </Button>
              <h1 className="text-2xl font-semibold text-gray-900">
                Account Details
              </h1>
            </div>
            <Button
              variant="primary"
              className="flex items-center"
              onClick={() => router.push(`/accounting/chart-of-accounts/${account.id}/edit`)}
            >
              <PencilIcon className="h-5 w-5 mr-1" />
              Edit Account
            </Button>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {account.accountCode} - {account.name}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {account.description || 'No description provided'}
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
              <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Account Code</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {account.accountCode}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Account Name</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {account.name}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Account Type</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {getAccountTypeBadge(account.accountType)}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Parent Account</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {parentAccount ? (
                      <Link
                        href={`/accounting/chart-of-accounts/${parentAccount.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {parentAccount.accountCode} - {parentAccount.name}
                      </Link>
                    ) : (
                      'None (Top Level Account)'
                    )}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {account.isActive ? (
                      <Badge color="green" text="Active" />
                    ) : (
                      <Badge color="gray" text="Inactive" />
                    )}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDate(account.createdAt)}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDate(account.updatedAt)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {childAccounts.length > 0 && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Child Accounts
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Accounts that have this account as their parent
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Code
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">View</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {childAccounts.map(child => (
                      <tr key={child.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {child.accountCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {child.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getAccountTypeBadge(child.accountType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {child.isActive ? (
                            <Badge color="green" text="Active" />
                          ) : (
                            <Badge color="gray" text="Inactive" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/accounting/chart-of-accounts/${child.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

export default AccountDetailPage;
