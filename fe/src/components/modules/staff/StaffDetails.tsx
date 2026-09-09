import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PencilIcon, KeyIcon, TrashIcon } from '@heroicons/react/24/outline';
import { StaffProfile, deleteStaff } from '@/services/staff.service';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import { formatDate, formatDateTime } from '@/utils/dateUtils';
import { toast } from 'react-toastify';

interface StaffDetailsProps {
  staff: StaffProfile;
}

const StaffDetails: React.FC<StaffDetailsProps> = ({ staff }) => {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      await deleteStaff(staff.id);
      toast.success(`${staff.firstName} ${staff.lastName} has been deleted successfully`);
      // Redirect to staff list after successful deletion
      router.push('/office/staff');
    } catch (err: any) {
      console.error('Error deleting staff:', err);
      toast.error(err.message || 'Failed to delete staff member. Please try again.');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
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



  return (
    <>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Staff Information</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and role assignments.</p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => router.push(`/office/staff/${staff.id}/reset-password`)}
            >
              <KeyIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Reset Password
            </Button>
            <Button
              variant="primary"
              className="flex items-center"
              onClick={() => router.push(`/office/staff/${staff.id}/edit`)}
            >
              <PencilIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Edit
            </Button>
            <Button
              variant="danger"
              className="flex items-center"
              onClick={handleDeleteClick}
            >
              <TrashIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Employee ID</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{staff.employeeId}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Full name</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {staff.firstName} {staff.lastName}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {getStatusBadge(staff.status)}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Email address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{staff.email}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Phone number</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{staff.phone}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Department</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{staff.department}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Position</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{staff.position}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatDate(staff.dateOfBirth)}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Join Date</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatDate(staff.joinDate)}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Last Login</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {staff.lastLogin ? formatDateTime(staff.lastLogin) : 'Never logged in'}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{staff.address}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Roles</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
                  {staff.roles.length > 0 ? (
                    staff.roles.map((roleItem) => (
                      <li
                        key={roleItem.id}
                        className="pl-3 pr-4 py-3 flex items-center justify-between text-sm"
                      >
                        <div className="w-0 flex-1 flex items-center">
                          <span className="ml-2 flex-1 w-0 truncate">
                            {roleItem.role ? roleItem.role.name : 'Unknown Role'}
                          </span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                      <div className="w-0 flex-1 flex items-center">
                        <span className="ml-2 flex-1 w-0 truncate text-gray-500">No roles assigned</span>
                      </div>
                    </li>
                  )}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
          }
        }}
        title="Confirm Delete"
      >
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            Are you sure you want to delete {staff.firstName} {staff.lastName}?
            This action cannot be undone and will remove all associated data.
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
              }
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default StaffDetails;