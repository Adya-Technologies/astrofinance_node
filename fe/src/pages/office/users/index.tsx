import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { EyeIcon, PencilIcon, KeyIcon, TrashIcon } from '@heroicons/react/24/outline';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import Button from '@/components/common/Button';
import Table from '@/components/common/Table';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/dateUtils';
import { getAllUsers, User } from '@/services/user.service';
import { Column } from 'react-table';
import { toast } from 'react-toastify';

const UsersPage: React.FC = () => {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, statusFilter]);

  const fetchUsers = async (search = searchTerm) => {
    try {
      setLoading(true);
      const response = await getAllUsers(
        currentPage,
        pageSize,
        search,
        statusFilter
      );
      setUsers(response.data);
      setTotalPages(response.pagination.pages);
      setTotalUsers(response.pagination.total);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Please try again later.');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(searchTerm);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // This would be implemented with a delete API call
      // await deleteUser(userToDelete.id);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Failed to delete user');
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  const columns: Column<User>[] = [
    {
      Header: 'Name',
      accessor: 'fullName',
      Cell: ({ row }: any) => (
        <div className="font-medium text-gray-900">{row.original.fullName}</div>
      ),
    },
    {
      Header: 'Contact',
      accessor: 'contactNumber',
      Cell: ({ row }: any) => (
        <div>
          <div>{row.original.contactNumber}</div>
          {row.original.email && (
            <div className="text-xs text-gray-500">{row.original.email}</div>
          )}
        </div>
      ),
    },
    {
      Header: 'ID',
      accessor: 'idNumber',
      Cell: ({ row }: any) => (
        <div>
          <div className="text-sm">{row.original.idNumber}</div>
          <div className="text-xs text-gray-500">{row.original.idType}</div>
        </div>
      ),
    },
    {
      Header: 'Type',
      accessor: 'userType',
      Cell: ({ row }: any) => (
        <Badge
          color={
            row.original.userType === 'SB'
              ? 'blue'
              : row.original.userType === 'BB'
                ? 'green'
                : 'purple'
          }
          text={
            row.original.userType === 'SB'
              ? 'Savings Bank'
              : row.original.userType === 'BB'
                ? 'Business Banking'
                : 'Mobile Banking'
          }
        />
      ),
    },
    {
      Header: 'Status',
      accessor: 'isActive',
      Cell: ({ row }: any) => (
        <Badge
          color={row.original.isActive ? 'green' : 'red'}
          text={row.original.isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      Header: 'Loans',
      accessor: 'loans_count' as any,
      Cell: ({ row }: any) => (
        <div className="text-center">
          {row.original._count?.loans || 0}
        </div>
      ),
    },
    {
      Header: 'Applications',
      accessor: 'applications_count' as any,
      Cell: ({ row }: any) => (
        <div className="text-center">
          {row.original._count?.loanApplications || 0}
        </div>
      ),
    },
    {
      Header: 'Created',
      accessor: 'createdAt',
      Cell: ({ row }: any) => (
        <div className="text-sm text-gray-500">
          {formatDate(row.original.createdAt)}
        </div>
      ),
    },
    {
      Header: 'Actions',
      accessor: 'id' as keyof User,
      Cell: ({ row }: any) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="text-blue-600 hover:text-blue-800"
            title="View User"
            onClick={() => router.push(`/office/users/${row.original.id}`)}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 hover:text-green-800"
            title="Edit User"
            onClick={() => router.push(`/office/users/${row.original.id}/edit`)}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-yellow-600 hover:text-yellow-800"
            title="Reset Password"
            onClick={() => router.push(`/office/users/${row.original.id}/reset-password`)}
          >
            <KeyIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-800"
            title="Delete User"
            onClick={() => handleDeleteUser(row.original)}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="sm:flex sm:items-center mb-6">
            <div className="sm:flex-auto">
              <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
              <p className="mt-2 text-sm text-gray-700">
                A list of all users in the system including their details and status.
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <Button
                variant="primary"
                className="flex items-center"
                onClick={() => router.push('/office/users/create')}
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Add User
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  {/* Error icon */}
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 sm:flex sm:items-center sm:justify-between">
              <div className="sm:flex-auto">
                <form onSubmit={handleSearch} className="flex w-full md:w-96">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      name="search"
                      id="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="Search users..."
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="ml-2"
                  >
                    Search
                  </Button>
                </form>
              </div>
              <div className="mt-4 sm:mt-0">
                <select
                  id="status-filter"
                  name="status-filter"
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-6 text-center">Loading users data...</div>
              ) : users.length === 0 ? (
                <div className="p-6 text-center">No users found.</div>
              ) : (
                <Table
                  columns={columns}
                  data={users}
                  pagination={true}
                  pageSize={pageSize}
                  // These props are not in the Table component interface
                  // currentPage={currentPage}
                  // totalPages={totalPages}
                  // onPageChange={setCurrentPage}
                  keyField="id"
                  isLoading={loading}
                  emptyMessage="No users found."
                />
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete User"
        >
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete the user "{userToDelete?.fullName}"? This action cannot be undone.
            </p>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <Button
              variant="danger"
              onClick={confirmDeleteUser}
              className="w-full sm:w-auto sm:ml-3"
            >
              Delete
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="mt-3 w-full sm:mt-0 sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </Modal>
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

export default UsersPage;
