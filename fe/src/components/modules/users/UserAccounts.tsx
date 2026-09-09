import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import Table from "@/components/common/Table";
import Button from "@/components/common/Button";
import Badge from "@/components/common/Badge";
import { formatDate, formatCurrency } from "@/utils/dateUtils";
import { getUserAccounts, Account } from "@/services/user.service";
import { toast } from "react-toastify";
import { Column } from "react-table";

interface UserAccountsProps {
	userId: string;
}

const UserAccounts: React.FC<UserAccountsProps> = ({ userId }) => {
	const router = useRouter();
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (userId) {
			fetchUserAccounts();
		}
	}, [userId]);

	const fetchUserAccounts = async () => {
		try {
			setLoading(true);
			const response = await getUserAccounts(userId);
			setAccounts(response.data);
			setError(null);
		} catch (err) {
			console.error("Error fetching user accounts:", err);
			setError("Failed to load user accounts. Please try again later.");
			toast.error("Failed to load user accounts");
		} finally {
			setLoading(false);
		}
	};

	const accountColumns: Column<Account>[] = [
		{
			Header: "Account Number",
			accessor: "accountNumber",
		},
		{
			Header: "Account Type",
			accessor: "accountType",
			Cell: ({ value }: { value: string }) => (
				<Badge
					color={
						value === "SB"
							? "blue"
							: value === "BB"
								? "indigo"
								: value === "FD"
									? "green"
									: value === "SH"
										? "purple"
										: value === "LS"
											? "red"
											: "gray"
					}
					text={
						value === "SB"
							? "Sadharan Bachat"
							: value === "BB"
								? "Branch Bises Bachat"
								: value === "FD"
									? "Fixed Deposit"
									: value === "SH"
										? "Share"
										: value === "LS"
											? "Loan Share"
											: value
					}
				/>
			),
		},
		{
			Header: "Balance",
			accessor: "balance",
			Cell: ({ value }: { value: number }) => formatCurrency(value),
		},
		{
			Header: "Interest Rate",
			accessor: "interestRate",
			Cell: ({ value }: { value: number }) => `${value}%`,
		},
		{
			Header: "Opening Date",
			accessor: "openingDate",
			Cell: ({ value }: { value: string }) => formatDate(value),
		},
		{
			Header: "Status",
			accessor: "status",
			Cell: ({ value }: { value: string }) => (
				<Badge
					color={
						value === "ACTIVE"
							? "green"
							: value === "INACTIVE"
								? "yellow"
								: value === "CLOSED"
									? "gray"
									: "red"
					}
					text={value}
				/>
			),
		},
		{
			Header: "Actions",
			accessor: "id",
			Cell: ({ value }: { value: string }) => {
				const router = useRouter();
				return (
					<Button
						variant="outline"
						size="sm"
						onClick={() => router.push(`users/accounts/${value}`)}
					>
						View Details
					</Button>
				);
			},
		},
	];

	return (
		<div className="mt-6">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg font-medium text-gray-900">User Accounts</h2>
				<Button
					className="flex items-center"
					onClick={() => router.push(`/users/accounts/new?userId=${userId}`)}
				>
					<PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
					New Account
				</Button>
			</div>

			{loading ? (
				<div className="text-center py-10">
					<div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-primary-400 border-r-transparent"></div>
					<p className="mt-4 text-gray-700">Loading accounts...</p>
				</div>
			) : error ? (
				<div className="bg-red-50 p-4 rounded-md">
					<div className="flex">
						<div className="ml-3">
							<h3 className="text-sm font-medium text-red-800">Error</h3>
							<div className="mt-2 text-sm text-red-700">
								<p>{error}</p>
							</div>
						</div>
					</div>
				</div>
			) : accounts.length === 0 ? (
				<div className="text-center py-10 bg-gray-50 rounded-md">
					<p className="text-gray-500">No accounts found for this user.</p>
					<Button
						className="mt-4 flex items-center mx-auto"
						onClick={() => router.push(`/users/accounts/new?userId=${userId}`)}
					>
						<PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
						Create First Account
					</Button>
				</div>
			) : (
				<Table columns={accountColumns} data={accounts} keyField="id" />
			)}
		</div>
	);
};

export default UserAccounts;
