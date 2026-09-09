import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  KeyIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import Table from '@/components/common/Table';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import { getAllStaff, StaffProfile, deleteStaff } from '@/services/staff.service';
import { formatDate } from '@/utils/dateUtils';
import { toast } from 'react-toastify';
import { Column } from 'react-table';

const StaffListPage: React.FC = () => {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        const data = await getAllStaff();
        setStaff(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching staff:', err);
        setError('Failed to load staff data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, []);

  const handleDeleteClick = (staffMember: StaffProfile) => {
    setStaffToDelete(staffMember);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!staffToDelete) return;

    try {
      setIsDeleting(true);
      await deleteStaff(staffToDelete.id);

      // Update the staff list by removing the deleted staff
      setStaff(prevStaff => prevStaff.filter(s => s.id !== staffToDelete.id));

      toast.success(`${staffToDelete.firstName} ${staffToDelete.lastName} has been deleted successfully`);
      setIsDeleteModalOpen(false);
      setStaffToDelete(null);
    } catch (err: any) {
      console.error('Error deleting staff:', err);
      toast.error(err.message || 'Failed to delete staff member. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge color="green" text="Active" />;
      case 'INACTIVE':
        return <Badge color="gray" text="Inactive" />;
      case 'ON_LEAVE':
        return <Badge color="yellow" text="On Leave" />;
      case 'TERMINATED':
        return <Badge color="red" text="Terminated" />;
      default:
        return <Badge color="gray" text={status} />;
    }
  };

  // Import Column type from Table component

  const columns: Column<StaffProfile>[] = [
    {
      Header: 'Employee ID',
      accessor: 'employeeId',
      Cell: ({ row }: { row: { original: StaffProfile } }) => row.original.employeeId,
    },
    {
      Header: 'Name',
      accessor: 'firstName',
      Cell: ({ row }: { row: { original: StaffProfile } }) => `${row.original.firstName} ${row.original.lastName}`,
    },
    {
      Header: 'Email',
      accessor: 'email',
      Cell: ({ row }: { row: { original: StaffProfile } }) => row.original.email,
    },
    {
      Header: 'Department',
      accessor: 'department',
      Cell: ({ row }: { row: { original: StaffProfile } }) => row.original.department,
    },
    {
      Header: 'Position',
      accessor: 'position',
      Cell: ({ row }: { row: { original: StaffProfile } }) => row.original.position,
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ row }: { row: { original: StaffProfile } }) => getStatusBadge(row.original.status),
    },
    {
      Header: 'Join Date',
      accessor: 'joinDate',
      Cell: ({ row }: { row: { original: StaffProfile } }) => formatDate(row.original.joinDate),
    },
    {
      Header: 'Actions',
      accessor: 'id',
      Cell: ({ row }: { row: { original: StaffProfile } }) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="p-1"
            title="View Details"
            onClick={() => router.push(`/office/staff/${row.original.id}`)}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="p-1"
            title="Edit Staff"
            onClick={() => router.push(`/office/staff/${row.original.id}/edit`)}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="p-1"
            title="Reset Password"
            onClick={() => router.push(`/office/staff/${row.original.id}/reset-password`)}
          >
            <KeyIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="p-1 text-red-600 hover:bg-red-50"
            title="Delete Staff"
            onClick={() => handleDeleteClick(row.original)}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <ProtectedRoute adminOnly>
      <MainLayout>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="sm:flex sm:items-center mb-6">
            <div className="sm:flex-auto">
              <h1 className="text-2xl font-semibold text-gray-900">Staff Management</h1>
              <p className="mt-2 text-sm text-gray-700">
                A list of all staff members in the system including their details and status.
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <Button
                variant="primary"
                className="flex items-center"
                onClick={() => router.push('/office/staff/create')}
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Add Staff
              </Button>
            </div>
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

          <div className="mt-4">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <div className="bg-white">
                    {loading ? (
                      <div className="p-6 text-center">Loading staff data...</div>
                    ) : staff.length === 0 ? (
                      <div className="p-6 text-center">No staff members found.</div>
                    ) : (
                      <Table
                        columns={columns}
                        data={staff}
                        pagination={true}
                        pageSize={10}
                        keyField="id"
                        isLoading={loading}
                        emptyMessage="No staff members found."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setStaffToDelete(null);
            }
          }}
          title="Confirm Delete"
        >
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete {staffToDelete?.firstName} {staffToDelete?.lastName}?
              This action cannot be undone.
            </p>
          </div>

          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <Button
              variant="danger"
              className="w-full sm:w-auto sm:ml-3"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            <Button
              variant="outline"
              className="mt-3 w-full sm:mt-0 sm:w-auto"
              onClick={() => {
                if (!isDeleting) {
                  setIsDeleteModalOpen(false);
                  setStaffToDelete(null);
                }
              }}
              disabled={isDeleting}
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

export default StaffListPage;
