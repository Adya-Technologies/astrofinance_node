import {
	AccountType_COA,
	ExpenseCategoryType,
	InterestType,
	PrismaClient,
	StaffStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
	console.log("Starting database seeding...");

	// Clean up existing data if needed
	await cleanupDatabase();

	// Seed admin users
	await seedAdminUsers();

	// Seed roles and permissions
	await seedRolesAndPermissions();

	// Seed navigation
	await seedNavigation();

	// Seed staff users
	await seedStaffUsers();

	// Seed loan types
	await seedLoanTypes();

	// Seed chart of accounts
	await seedChartOfAccounts();

	// Seed SMS templates and events
	await seedSmsTemplates();

	// Seed tax types and rates
	await seedTaxTypes();

	// Seed expense categories
	await seedExpenseCategories();

	// Seed report templates
	await seedReportTemplates();

	// Seed system settings
	await seedSystemSettings();

	// Seed account types
	await seedAccountTypes();

	console.log("Database seeding completed successfully!");
}

async function cleanupDatabase() {
	// This is a safe cleanup for development environments
	// Be careful with this in production!
	console.log("Cleaning up existing data...");

	// The order matters due to foreign key constraints
	try {
		// First, check if we need to clean journal entries that reference accounts
		console.log("Checking for journal entries...");
		const journalEntryLinesCount = await prisma.journalEntryLine.count();
		if (journalEntryLinesCount > 0) {
			console.log(
				`Found ${journalEntryLinesCount} journal entry lines. Deleting...`,
			);
			await prisma.journalEntryLine.deleteMany({});
		}

		const journalEntriesCount = await prisma.journalEntry.count();
		if (journalEntriesCount > 0) {
			console.log(`Found ${journalEntriesCount} journal entries. Deleting...`);
			await prisma.journalEntry.deleteMany({});
		}

		// Delete collection data before staff
		console.log("Cleaning up collection sessions and entries...");
		await prisma.collectionAttendance.deleteMany({});
		await prisma.collectionEntry.deleteMany({});
		await prisma.collectionSession.deleteMany({});

		// Now proceed with the rest of the cleanup
		// Deleted AdminUserRole delete call

		await prisma.rolePermission.deleteMany({});
		await prisma.roleNavigation.deleteMany({});
		await prisma.navigationItem.deleteMany({});
		await prisma.navigationGroup.deleteMany({});
		await prisma.permission.deleteMany({});
		await prisma.staffRole.deleteMany({});
		await prisma.staffDocument.deleteMany({});
		await prisma.staff.deleteMany({});
		await prisma.role.deleteMany({});
		// Deleted AdminUser delete call

		// Clean up loan-related data first due to foreign key constraints
		await prisma.loanPayment.deleteMany({});
		await prisma.loanInstallment.deleteMany({});
		await prisma.loanProvision.deleteMany({});
		await prisma.loan.deleteMany({});
		await prisma.loanDocument.deleteMany({});
		await prisma.loanApplication.deleteMany({});
		await prisma.loanCalculatorHistory.deleteMany({});
		await prisma.loanCalculatorPreset.deleteMany({});

		await prisma.loanType.deleteMany({});

		// Check for any other dependencies on account_COA
		console.log("Checking for other dependencies on accounts...");
		await prisma.account_COA.deleteMany({});

		await prisma.smsTemplate.deleteMany({});
		await prisma.smsEvent.deleteMany({});
		await prisma.taxRate.deleteMany({});
		await prisma.taxType.deleteMany({});
		await prisma.expenseCategory.deleteMany({});
		await prisma.reportTemplate.deleteMany({});

		console.log("Database cleanup completed successfully");
	} catch (error) {
		console.error("Error during database cleanup:", error);
		throw error;
	}
}

async function seedAdminUsers() {
	console.log("Seeding staff users (formerly admin)...");

	// Create default admin user (as Staff)
	const passwordHash = await bcrypt.hash("admin123", 12);

	const adminStaff = await prisma.staff.create({
		data: {
			employeeId: "ADMIN001",
			username: "admin",
			email: "admin@astrofinance.com",
			passwordHash,
			firstName: "System",
			lastName: "Administrator",
			phone: "9800000000",
			address: "Headquarters",
			dateOfBirth: new Date("1990-01-01"),
			joinDate: new Date(),
			department: "Administration",
			position: "System Administrator",
			status: "ACTIVE"
		},
	});

	console.log(`Created admin staff: ${adminStaff.username}`);

	// Create additional admin users
	const users = [
		{
			employeeId: "MGR001",
			username: "manager",
			email: "manager@astrofinance.com",
			passwordHash,
			firstName: "Branch",
			lastName: "Manager",
			phone: "9800000001",
			address: "Branch Office",
			dateOfBirth: new Date("1985-05-15"),
			joinDate: new Date(),
			department: "Management",
			position: "Branch Manager",
			status: "ACTIVE"
		},
		{
			employeeId: "ACC001",
			username: "accountant",
			email: "accountant@astrofinance.com",
			passwordHash,
			firstName: "System",
			lastName: "Accountant",
			phone: "9800000002",
			address: "Headquarters",
			dateOfBirth: new Date("1988-08-20"),
			joinDate: new Date(),
			department: "Finance",
			position: "Senior Accountant",
			status: "ACTIVE"
		},
		{
			employeeId: "LN001",
			username: "loan_officer",
			email: "loan@astrofinance.com",
			passwordHash,
			firstName: "Loan",
			lastName: "Officer",
			phone: "9800000003",
			address: "Branch Office",
			dateOfBirth: new Date("1992-03-10"),
			joinDate: new Date(),
			department: "Loans",
			position: "Loan Officer",
			status: "ACTIVE"
		},
	];

	for (const user of users) {
		// CAST status to StaffStatus
		await prisma.staff.create({ data: { ...user, status: "ACTIVE" as StaffStatus } });
		console.log(`Created staff user: ${user.username}`);
	}
}

async function seedRolesAndPermissions() {
	console.log("Seeding roles and permissions...");

	// Create roles
	const roles = [
		{
			name: "Super Admin",
			description: "Has access to all system features",
			isSystem: true,
		},
		{
			name: "Branch Manager",
			description: "Manages branch operations",
			isSystem: true,
		},
		{
			name: "Accountant",
			description: "Handles accounting and financial operations",
			isSystem: true,
		},
		{
			name: "Loan Officer",
			description: "Processes loan applications and manages loans",
			isSystem: true,
		},
		{
			name: "Field Officer",
			description: "Collects payments and manages field operations",
			isSystem: true,
		},
		{
			name: "Teller",
			description: "Handles cash transactions and customer service",
			isSystem: true,
		},
	];

	for (const role of roles) {
		await prisma.role.create({ data: role });
		console.log(`Created role: ${role.name}`);
	}

	// Create permissions
	const modules = [
		"users",
		"accounts",
		"loans",
		"accounting",
		"reports",
		"settings",
		"admin",
		"sms",
		"tax",
		"expenses",
		"usertransactions",
		"staff",
		"dashboard", // ADDED for dashboard permissions
	];

	const actions = ["view", "create", "edit", "delete", "approve"];

	for (const module of modules) {
		for (const action of actions) {
			const code = `${module}.${action}`;
			await prisma.permission.create({
				data: {
					code,
					description: `Permission to ${action} ${module}`,
					module,
					action,
				},
			});
			console.log(`Created permission: ${code}`);
		}
	}

	// Assign permissions to roles
	const superAdmin = await prisma.role.findFirst({
		where: { name: "Super Admin" },
	});
	const branchManager = await prisma.role.findFirst({
		where: { name: "Branch Manager" },
	});
	const accountant = await prisma.role.findFirst({
		where: { name: "Accountant" },
	});
	const loanOfficer = await prisma.role.findFirst({
		where: { name: "Loan Officer" },
	});

	if (superAdmin) {
		// Assign all permissions to Super Admin
		const allPermissions = await prisma.permission.findMany();
		for (const permission of allPermissions) {
			await prisma.rolePermission.create({
				data: {
					roleId: superAdmin.id,
					permissionId: permission.id,
				},
			});
		}
		console.log("Assigned all permissions to Super Admin");
	}

	// Assign admin staff to Super Admin role
	const adminStaff = await prisma.staff.findFirst({
		where: { username: "admin" },
	});
	if (adminStaff && superAdmin) {
		await prisma.staffRole.create({
			data: {
				staffId: adminStaff.id,
				roleId: superAdmin.id,
			},
		});
		console.log("Assigned admin staff to Super Admin role");
	}

	// Assign other users to their respective roles
	const manager = await prisma.staff.findFirst({
		where: { username: "manager" },
	});
	if (manager && branchManager) {
		await prisma.staffRole.create({
			data: {
				staffId: manager.id,
				roleId: branchManager.id,
			},
		});
		console.log("Assigned manager staff to Branch Manager role");
	}

	const accountantUser = await prisma.staff.findFirst({
		where: { username: "accountant" },
	});
	if (accountantUser && accountant) {
		await prisma.staffRole.create({
			data: {
				staffId: accountantUser.id,
				roleId: accountant.id,
			},
		});
		console.log("Assigned accountant staff to Accountant role");
	}

	const loanOfficerUser = await prisma.staff.findFirst({
		where: { username: "loan_officer" },
	});
	if (loanOfficerUser && loanOfficer) {
		await prisma.staffRole.create({
			data: {
				staffId: loanOfficerUser.id,
				roleId: loanOfficer.id,
			},
		});
		console.log("Assigned loan_officer staff to Loan Officer role");
	}
}

async function seedNavigation() {
	console.log("Seeding navigation...");

	// Create navigation groups
	const groups = [
		{ name: "Dashboard", description: "Dashboard and analytics", order: 1 },
		{
			name: "User Management",
			description: "User and account management",
			order: 2,
		},
		{
			name: "Loan Management",
			description: "Loan processing and management",
			order: 3,
		},
		{
			name: "Accounting",
			description: "Accounting and financial operations",
			order: 4,
		},
		{ name: "Reports", description: "Reports and analytics", order: 5 },
		{ name: "Administration", description: "System administration", order: 6 },
		{
			name: "Field Operations",
			description: "Mobile Field Application",
			order: 7
		},
	];

	for (const group of groups) {
		await prisma.navigationGroup.create({ data: group });
		console.log(`Created navigation group: ${group.name}`);
	}

	// Get created groups
	const dashboardGroup = await prisma.navigationGroup.findFirst({
		where: { name: "Dashboard" },
	});
	const userGroup = await prisma.navigationGroup.findFirst({
		where: { name: "User Management" },
	});
	const loanGroup = await prisma.navigationGroup.findFirst({
		where: { name: "Loan Management" },
	});
	const accountingGroup = await prisma.navigationGroup.findFirst({
		where: { name: "Accounting" },
	});
	const reportsGroup = await prisma.navigationGroup.findFirst({
		where: { name: "Reports" },
	});
	const adminGroup = await prisma.navigationGroup.findFirst({
		where: { name: "Administration" },
	});

	// Create navigation items
	if (dashboardGroup) {
		await prisma.navigationItem.create({
			data: {
				label: "Dashboard",
				icon: "dashboard",
				url: "/dashboard",
				order: 1,
				groupId: dashboardGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Admin Dashboard",
				icon: "admin_panel_settings",
				url: "/admin/dashboard",
				order: 2,
				groupId: dashboardGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Branch Dashboard",
				icon: "store",
				url: "/branch/dashboard",
				order: 3,
				groupId: dashboardGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Field Dashboard",
				icon: "location_on",
				url: "/staff/dashboard",
				order: 4,
				groupId: dashboardGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Analytics",
				icon: "analytics",
				url: "/analytics",
				order: 5,
				groupId: dashboardGroup.id,
			},
		});
	}

	if (userGroup) {
		await prisma.navigationItem.create({
			data: {
				label: "Users",
				icon: "people",
				url: "/users",
				order: 1,
				groupId: userGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Accounts",
				icon: "account_balance",
				url: "/users/accounts",
				order: 2,
				groupId: userGroup.id,
			},
		});
		await prisma.navigationItem.create({
			data: {
				label: "User Transactions",
				icon: "account_balance",
				url: "/users/transaction",
				order: 3,
				groupId: userGroup.id,
			},
		});
	}
	if (loanGroup) {
		await prisma.navigationItem.create({
			data: {
				label: "Loan Applications",
				icon: "description",
				url: "/loans/applications",
				order: 1,
				groupId: loanGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Active Loans",
				icon: "monetization_on",
				url: "/loans",
				order: 2,
				groupId: loanGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Loan Types",
				icon: "category",
				url: "/loans/types",
				order: 3,
				groupId: loanGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "EMI Calculator",
				icon: "calculate",
				url: "/calculator",
				order: 4,
				groupId: loanGroup.id,
			},
		});
	}

	if (accountingGroup) {
		await prisma.navigationItem.create({
			data: {
				label: "Chart of Accounts",
				icon: "account_tree",
				url: "accounting/chart-of-accounts",
				order: 1,
				groupId: accountingGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Journal Entries",
				icon: "book",
				url: "accounting/journal-entries",
				order: 2,
				groupId: accountingGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Day Book",
				icon: "today",
				url: "accounting/day-books",
				order: 3,
				groupId: accountingGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Financial Reports",
				icon: "assessment",
				url: "accounting/reports",
				order: 4,
				groupId: accountingGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Share Management",
				icon: "pie_chart",
				url: "/admin/shares",
				order: 5,
				groupId: accountingGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Loan Loss Provisioning",
				icon: "warning",
				url: "/accounting/llp",
				order: 6,
				groupId: accountingGroup.id,
			},
		});
	}

	if (reportsGroup) {
		await prisma.navigationItem.create({
			data: {
				label: "Report Templates",
				icon: "description",
				url: "/report-templates",
				order: 1,
				groupId: reportsGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Generate Reports",
				icon: "play_arrow",
				url: "/generate-reports",
				order: 2,
				groupId: reportsGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Scheduled Reports",
				icon: "schedule",
				url: "/scheduled-reports",
				order: 3,
				groupId: reportsGroup.id,
			},
		});
	}

	if (adminGroup) {
		await prisma.navigationItem.create({
			data: {
				label: "Staff",
				icon: "people",
				url: "/admin/staff",
				order: 1,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Roles & Permissions",
				icon: "security",
				url: "/roles",
				order: 2,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Navigation Management",
				icon: "menu",
				url: "/navigation",
				order: 3,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Centers",
				icon: "store",
				url: "/admin/centers",
				order: 4,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Groups",
				icon: "groups",
				url: "/admin/groups",
				order: 5,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "System Settings",
				icon: "settings",
				url: "/settings",
				order: 6,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Fiscal Years",
				icon: "calendar_today",
				url: "/admin/fiscal-years",
				order: 5,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "SMS Templates",
				icon: "sms",
				url: "/admin/sms",
				order: 5,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Tax Settings",
				icon: "receipt",
				url: "/tax-settings",
				order: 6,
				groupId: adminGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Account Types",
				icon: "category",
				url: "/admin/settings/account-types",
				order: 7,
				groupId: adminGroup.id,
			},
		});
	}

	// Field Operations Group
	const fieldGroup = await prisma.navigationGroup.findFirst({
		where: { name: "Field Operations" },
	});

	if (fieldGroup) {
		await prisma.navigationItem.create({
			data: {
				label: "Field Dashboard",
				icon: "smartphone",
				url: "/field",
				order: 1,
				groupId: fieldGroup.id,
			},
		});

		await prisma.navigationItem.create({
			data: {
				label: "Field Sync",
				icon: "sync",
				url: "/field/sync",
				order: 2,
				groupId: fieldGroup.id,
			},
		});
	}

	console.log("Navigation items created successfully");

	// Assign navigation to roles
	const superAdmin = await prisma.role.findFirst({
		where: { name: "Super Admin" },
	});

	if (superAdmin) {
		const allNavItems = await prisma.navigationItem.findMany();
		for (const item of allNavItems) {
			await prisma.roleNavigation.create({
				data: {
					roleId: superAdmin.id,
					navigationItemId: item.id,
				},
			});
		}
		console.log("Assigned all navigation items to Super Admin role");
	}

	// Branch Manager - Gets branch dashboard + core features
	const branchManager = await prisma.role.findFirst({
		where: { name: "Branch Manager" },
	});

	if (branchManager) {
		const branchNavUrls = [
			"/branch/dashboard",
			"/loans",
			"/loans/applications",
			"/loans/types",
			"/users",
			"/users/accounts",
			"/calculator",
			"/admin/staff",
			"/admin/centers",
			"/admin/groups",
		];

		const branchNavs = await prisma.navigationItem.findMany({
			where: { url: { in: branchNavUrls } },
		});

		for (const nav of branchNavs) {
			await prisma.roleNavigation.create({
				data: {
					roleId: branchManager.id,
					navigationItemId: nav.id,
				},
			});
		}
		console.log("Assigned navigation to Branch Manager role");
	}

	// Loan Officer - Gets loan management features
	const loanOfficer = await prisma.role.findFirst({
		where: { name: "Loan Officer" },
	});

	if (loanOfficer) {
		const officerNavUrls = [
			"/loans/applications",
			"/loans",
			"/calculator",
			"/users",
		];

		const officerNavs = await prisma.navigationItem.findMany({
			where: { url: { in: officerNavUrls } },
		});

		for (const nav of officerNavs) {
			await prisma.roleNavigation.create({
				data: {
					roleId: loanOfficer.id,
					navigationItemId: nav.id,
				},
			});
		}
		console.log("Assigned navigation to Loan Officer role");
	}

	// Field Officer - Gets field dashboard + collection features
	const fieldOfficer = await prisma.role.findFirst({
		where: { name: "Field Officer" },
	});

	if (fieldOfficer) {
		const fieldNavUrls = [
			"/field",
			"/field/sync",
			"/loans/applications",
			"/loans",
			"/calculator",
			"/users",
		];

		const fieldNavs = await prisma.navigationItem.findMany({
			where: { url: { in: fieldNavUrls } },
		});

		for (const nav of fieldNavs) {
			await prisma.roleNavigation.create({
				data: {
					roleId: fieldOfficer.id,
					navigationItemId: nav.id,
				},
			});
		}
		console.log("Assigned navigation to Field Officer role");
	}

	// Accountant - Gets accounting features
	const accountant = await prisma.role.findFirst({
		where: { name: "Accountant" },
	});

	if (accountant) {
		const accountantNavUrls = [
			"/dashboard",
			"accounting/chart-of-accounts",
			"accounting/journal-entries",
			"accounting/day-books",
			"accounting/reports",
			"/admin/shares",
			"/accounting/llp",
			"/report-templates",
			"/generate-reports",
		];

		const accountantNavs = await prisma.navigationItem.findMany({
			where: { url: { in: accountantNavUrls } },
		});

		for (const nav of accountantNavs) {
			await prisma.roleNavigation.create({
				data: {
					roleId: accountant.id,
					navigationItemId: nav.id,
				},
			});
		}
		console.log("Assigned navigation to Accountant role");
	}
}

async function seedLoanTypes() {
	console.log("Seeding loan types...");

	const loanTypes = [
		{
			name: "Personal Loan",
			code: "PL",
			interestType: InterestType.DIMINISHING, // Changed from FLAT to DIMINISHING for better customer experience
			minAmount: 10000,
			maxAmount: 500000,
			minTenure: 3,
			maxTenure: 36,
			interestRate: 11.5, // Reduced interest rate to be more competitive
			processingFeePercent: 1.0,
			lateFeeAmount: 500,
			isActive: true,
		},
		{
			name: "Business Loan",
			code: "BL",
			interestType: InterestType.DIMINISHING,
			minAmount: 50000,
			maxAmount: 2500000, // Increased max amount
			minTenure: 6,
			maxTenure: 60,
			interestRate: 13.5, // Slightly reduced interest rate
			processingFeePercent: 1.5,
			lateFeeAmount: 1000,
			isActive: true,
		},
		{
			name: "Education Loan",
			code: "EL",
			interestType: InterestType.DIMINISHING,
			minAmount: 25000,
			maxAmount: 1500000, // Increased max amount for higher education costs
			minTenure: 12,
			maxTenure: 96, // Extended max tenure
			interestRate: 9.0, // Reduced interest rate for education
			processingFeePercent: 0.5,
			lateFeeAmount: 300,
			isActive: true,
		},
		{
			name: "Home Loan",
			code: "HL",
			interestType: InterestType.DIMINISHING,
			minAmount: 500000,
			maxAmount: 15000000, // Increased max amount for real estate
			minTenure: 12,
			maxTenure: 300, // Extended to 25 years
			interestRate: 8.5, // Competitive home loan rate
			processingFeePercent: 0.75,
			lateFeeAmount: 2000,
			isActive: true,
		},
		{
			name: "Gold Loan",
			code: "GL",
			interestType: InterestType.FLAT,
			minAmount: 5000,
			maxAmount: 1000000,
			minTenure: 1,
			maxTenure: 24,
			interestRate: 10.0,
			processingFeePercent: 0.5,
			lateFeeAmount: 300,
			isActive: true,
		},
		{
			name: "Vehicle Loan",
			code: "VL",
			interestType: InterestType.DIMINISHING,
			minAmount: 50000,
			maxAmount: 3000000,
			minTenure: 12,
			maxTenure: 84,
			interestRate: 10.5,
			processingFeePercent: 1.0,
			lateFeeAmount: 750,
			isActive: true,
		},
		{
			name: "Micro Business Loan",
			code: "MBL",
			interestType: InterestType.DIMINISHING,
			minAmount: 10000,
			maxAmount: 200000,
			minTenure: 3,
			maxTenure: 24,
			interestRate: 15.0,
			processingFeePercent: 1.0,
			lateFeeAmount: 250,
			isActive: true,
		},
		{
			name: "Agricultural Loan",
			code: "AL",
			interestType: InterestType.DIMINISHING,
			minAmount: 20000,
			maxAmount: 1000000,
			minTenure: 6,
			maxTenure: 48,
			interestRate: 9.5,
			processingFeePercent: 0.75,
			lateFeeAmount: 500,
			isActive: true,
		},
	];

	// Create or update loan types
	for (const loanType of loanTypes) {
		try {
			const existingLoanType = await prisma.loanType.findUnique({
				where: { code: loanType.code },
			});

			if (existingLoanType) {
				// Update existing loan type
				const updated = await prisma.loanType.update({
					where: { code: loanType.code },
					data: loanType,
				});
				console.log(`Updated loan type: ${updated.name} (${updated.code})`);
			} else {
				// Create new loan type
				const created = await prisma.loanType.create({
					data: loanType,
				});
				console.log(`Created loan type: ${created.name} (${created.code})`);
			}
		} catch (error) {
			console.error(`Error processing loan type ${loanType.code}:`, error);
		}
	}
}

async function seedChartOfAccounts() {
	console.log("Seeding chart of accounts...");

	// Create main account categories
	const mainAccounts = [
		{
			accountCode: "1000",
			name: "Assets",
			accountType: AccountType_COA.ASSET,
			description: "Asset accounts",
		},
		{
			accountCode: "2000",
			name: "Liabilities",
			accountType: AccountType_COA.LIABILITY,
			description: "Liability accounts",
		},
		{
			accountCode: "3000",
			name: "Equity",
			accountType: AccountType_COA.EQUITY,
			description: "Equity accounts",
		},
		{
			accountCode: "4000",
			name: "Income",
			accountType: AccountType_COA.INCOME,
			description: "Income accounts",
		},
		{
			accountCode: "5000",
			name: "Expenses",
			accountType: AccountType_COA.EXPENSE,
			description: "Expense accounts",
		},
	];

	for (const account of mainAccounts) {
		await prisma.account_COA.create({ data: account });
		console.log(`Created main account: ${account.name}`);
	}

	// Get created main accounts
	const assets = await prisma.account_COA.findFirst({
		where: { accountCode: "1000" },
	});
	const liabilities = await prisma.account_COA.findFirst({
		where: { accountCode: "2000" },
	});
	const equity = await prisma.account_COA.findFirst({
		where: { accountCode: "3000" },
	});
	const income = await prisma.account_COA.findFirst({
		where: { accountCode: "4000" },
	});
	const expenses = await prisma.account_COA.findFirst({
		where: { accountCode: "5000" },
	});

	// Create sub-accounts
	if (assets) {
		const assetSubAccounts = [
			{
				accountCode: "1100",
				name: "Cash and Cash Equivalents",
				accountType: AccountType_COA.ASSET,
				parentId: assets.id,
			},
			{
				accountCode: "1200",
				name: "Loans Receivable",
				accountType: AccountType_COA.ASSET,
				parentId: assets.id,
			},
			{
				accountCode: "1300",
				name: "Fixed Assets",
				accountType: AccountType_COA.ASSET,
				parentId: assets.id,
			},
		];

		for (const account of assetSubAccounts) {
			await prisma.account_COA.create({ data: account });
			console.log(`Created asset sub-account: ${account.name}`);
		}

		// Get cash and cash equivalents account
		const cashAccount = await prisma.account_COA.findFirst({
			where: { accountCode: "1100" },
		});
		if (cashAccount) {
			const cashSubAccounts = [
				{
					accountCode: "1101",
					name: "Cash in Hand",
					accountType: AccountType_COA.ASSET,
					parentId: cashAccount.id,
				},
				{
					accountCode: "1102",
					name: "Cash at Bank",
					accountType: AccountType_COA.ASSET,
					parentId: cashAccount.id,
				},
			];

			for (const account of cashSubAccounts) {
				await prisma.account_COA.create({ data: account });
				console.log(`Created cash sub-account: ${account.name}`);
			}
		}

		// Get loans receivable account
		const loansAccount = await prisma.account_COA.findFirst({
			where: { accountCode: "1200" },
		});
		if (loansAccount) {
			const loanSubAccounts = [
				{
					accountCode: "1201",
					name: "Personal Loans",
					accountType: AccountType_COA.ASSET,
					parentId: loansAccount.id,
				},
				{
					accountCode: "1202",
					name: "Business Loans",
					accountType: AccountType_COA.ASSET,
					parentId: loansAccount.id,
				},
				{
					accountCode: "1203",
					name: "Education Loans",
					accountType: AccountType_COA.ASSET,
					parentId: loansAccount.id,
				},
			];

			for (const account of loanSubAccounts) {
				await prisma.account_COA.create({ data: account });
				console.log(`Created loan sub-account: ${account.name}`);
			}
		}
	}

	if (liabilities) {
		const liabilitySubAccounts = [
			{
				accountCode: "2100",
				name: "Deposits",
				accountType: AccountType_COA.LIABILITY,
				parentId: liabilities.id,
			},
			{
				accountCode: "2200",
				name: "Borrowings",
				accountType: AccountType_COA.LIABILITY,
				parentId: liabilities.id,
			},
			{
				accountCode: "2300",
				name: "Tax Payable",
				accountType: AccountType_COA.LIABILITY,
				parentId: liabilities.id,
			},
		];

		for (const account of liabilitySubAccounts) {
			await prisma.account_COA.create({ data: account });
			console.log(`Created liability sub-account: ${account.name}`);
		}

		// Create sub-accounts under Deposits
		const depositsAccount = await prisma.account_COA.findFirst({
			where: { accountCode: "2100" },
		});
		if (depositsAccount) {
			await prisma.account_COA.create({
				data: {
					accountCode: "2101",
					name: "Customer Deposits",
					accountType: AccountType_COA.LIABILITY,
					parentId: depositsAccount.id,
					description: "Customer savings and deposit accounts"
				},
			});
			console.log("Created Customer Deposits account (2101)");
		}
	}

	if (income) {
		const incomeSubAccounts = [
			{
				accountCode: "4100",
				name: "Interest Income",
				accountType: AccountType_COA.INCOME,
				parentId: income.id,
			},
			{
				accountCode: "4200",
				name: "Fee Income",
				accountType: AccountType_COA.INCOME,
				parentId: income.id,
			},
			{
				accountCode: "4300",
				name: "Other Income",
				accountType: AccountType_COA.INCOME,
				parentId: income.id,
			},
		];

		for (const account of incomeSubAccounts) {
			await prisma.account_COA.create({ data: account });
			console.log(`Created income sub-account: ${account.name}`);
		}

		// Create sub-accounts under Interest Income
		const interestIncomeAccount = await prisma.account_COA.findFirst({
			where: { accountCode: "4100" },
		});
		if (interestIncomeAccount) {
			await prisma.account_COA.create({
				data: {
					accountCode: "4101",
					name: "Interest Income - Loans",
					accountType: AccountType_COA.INCOME,
					parentId: interestIncomeAccount.id,
					description: "Interest earned from loans"
				},
			});
			console.log("Created Interest Income - Loans account (4101)");
		}
	}

	if (expenses) {
		const expenseSubAccounts = [
			{
				accountCode: "5100",
				name: "Personnel Expenses",
				accountType: AccountType_COA.EXPENSE,
				parentId: expenses.id,
			},
			{
				accountCode: "5200",
				name: "Administrative Expenses",
				accountType: AccountType_COA.EXPENSE,
				parentId: expenses.id,
			},
			{
				accountCode: "5300",
				name: "Financial Expenses",
				accountType: AccountType_COA.EXPENSE,
				parentId: expenses.id,
			},
		];

		for (const account of expenseSubAccounts) {
			await prisma.account_COA.create({ data: account });
			console.log(`Created expense sub-account: ${account.name}`);
		}

		// Create sub-account for Interest Expense
		const personnelExpensesAccount = await prisma.account_COA.findFirst({
			where: { accountCode: "5100" },
		});
		if (personnelExpensesAccount) {
			await prisma.account_COA.create({
				data: {
					accountCode: "5101",
					name: "Interest Expense",
					accountType: AccountType_COA.EXPENSE,
					parentId: expenses.id,
					description: "Interest paid on customer deposits"
				},
			});
			console.log("Created Interest Expense account (5101)");
		}
	}

	// Add Share Capital account under Equity
	if (equity) {
		await prisma.account_COA.create({
			data: {
				accountCode: "3101",
				name: "Share Capital",
				accountType: AccountType_COA.EQUITY,
				parentId: equity.id,
				description: "Member share capital"
			},
		});
		console.log("Created Share Capital account (3101)");
	}
}

async function seedSmsTemplates() {
	console.log("Seeding SMS templates and events...");

	// Create SMS templates
	const templates = [
		{
			name: "Account Creation",
			category: "Account",
			content:
				"Dear {{name}}, your account {{accountNumber}} has been created successfully. Welcome to AstroFinance!",
			variables: { name: "User Name", accountNumber: "Account Number" },
			characterCount: 100,
			isActive: true,
		},
		{
			name: "Deposit Confirmation",
			category: "Transaction",
			content:
				"Dear {{name}}, your account {{accountNumber}} has been credited with Rs. {{amount}} on {{date}}. Available balance: Rs. {{balance}}.",
			variables: {
				name: "User Name",
				accountNumber: "Account Number",
				amount: "Amount",
				date: "Date",
				balance: "Balance",
			},
			characterCount: 150,
			isActive: true,
		},
		{
			name: "Withdrawal Confirmation",
			category: "Transaction",
			content:
				"Dear {{name}}, your account {{accountNumber}} has been debited with Rs. {{amount}} on {{date}}. Available balance: Rs. {{balance}}.",
			variables: {
				name: "User Name",
				accountNumber: "Account Number",
				amount: "Amount",
				date: "Date",
				balance: "Balance",
			},
			characterCount: 150,
			isActive: true,
		},
		{
			name: "Transfer Confirmation",
			category: "Transaction",
			content:
				"Dear {{name}}, Rs. {{amount}} has been transferred from your account {{accountNumber}} to {{recipientAccount}} on {{date}}. Available balance: Rs. {{balance}}.",
			variables: {
				name: "User Name",
				accountNumber: "Account Number",
				amount: "Amount",
				recipientAccount: "Recipient Account",
				date: "Date",
				balance: "Balance",
			},
			characterCount: 180,
			isActive: true,
		},
		{
			name: "Loan Application Received",
			category: "Loan",
			content:
				"Dear {{name}}, we have received your loan application {{applicationNumber}} for Rs. {{amount}}. We will review and get back to you within 2-3 business days.",
			variables: {
				name: "User Name",
				applicationNumber: "Application Number",
				amount: "Amount",
			},
			characterCount: 160,
			isActive: true,
		},
		{
			name: "Loan Approval",
			category: "Loan",
			content:
				"Dear {{name}}, your loan application {{applicationNumber}} has been approved. Loan amount: Rs. {{amount}}. Please visit our branch for further processing.",
			variables: {
				name: "User Name",
				applicationNumber: "Application Number",
				amount: "Amount",
			},
			characterCount: 180,
			isActive: true,
		},
		{
			name: "Loan Rejection",
			category: "Loan",
			content:
				"Dear {{name}}, your loan application {{applicationNumber}} has been reviewed. Unfortunately, we cannot approve it at this time. Please contact us for more details.",
			variables: {
				name: "User Name",
				applicationNumber: "Application Number",
			},
			characterCount: 160,
			isActive: true,
		},
		{
			name: "EMI Due Reminder",
			category: "Loan",
			content:
				"Dear {{name}}, your EMI of Rs. {{emiAmount}} for loan {{loanNumber}} is due on {{dueDate}}. Please ensure timely payment to avoid late fees.",
			variables: {
				name: "User Name",
				emiAmount: "EMI Amount",
				loanNumber: "Loan Number",
				dueDate: "Due Date",
			},
			characterCount: 160,
			isActive: true,
		},
		{
			name: "EMI Payment Confirmation",
			category: "Loan",
			content:
				"Dear {{name}}, we have received your EMI payment of Rs. {{emiAmount}} for loan {{loanNumber}}. Thank you for your payment.",
			variables: {
				name: "User Name",
				emiAmount: "EMI Amount",
				loanNumber: "Loan Number",
			},
			characterCount: 130,
			isActive: true,
		},
		{
			name: "Marketing Offer",
			category: "Marketing",
			content:
				"Dear {{name}}, {{offer}} is now available! Valid until {{validUntil}}. Contact us at {{contactNumber}} for more details.",
			variables: {
				name: "User Name",
				offer: "Special Offer",
				validUntil: "Valid Until",
				contactNumber: "Contact Number",
			},
			characterCount: 140,
			isActive: true,
		},
		{
			name: "System Maintenance",
			category: "System",
			content:
				"Dear {{name}}, our system will be under maintenance on {{date}} from {{time}}. We apologize for any inconvenience.",
			variables: {
				name: "User Name",
				date: "Date",
				time: "Time",
			},
			characterCount: 120,
			isActive: true,
		},
		{
			name: "Password Reset",
			category: "System",
			content:
				"Dear {{name}}, your password has been reset successfully. If you didn't request this, please contact us immediately.",
			variables: {
				name: "User Name",
			},
			characterCount: 110,
			isActive: true,
		},
	];

	for (const template of templates) {
		await prisma.smsTemplate.create({
			data: {
				...template,
				variables: template.variables as any,
			},
		});
		console.log(`Created SMS template: ${template.name}`);
	}

	// Create SMS events
	const accountCreationTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Account Creation" },
	});
	const depositTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Deposit Confirmation" },
	});
	const withdrawalTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Withdrawal Confirmation" },
	});
	const transferTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Transfer Confirmation" },
	});
	const loanApplicationTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Loan Application Received" },
	});
	const loanApprovalTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Loan Approval" },
	});
	const loanRejectionTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Loan Rejection" },
	});
	const emiDueTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "EMI Due Reminder" },
	});
	const emiPaymentTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "EMI Payment Confirmation" },
	});
	const marketingTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Marketing Offer" },
	});
	const maintenanceTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "System Maintenance" },
	});
	const passwordResetTemplate = await prisma.smsTemplate.findFirst({
		where: { name: "Password Reset" },
	});

	const events = [
		{
			eventCode: "ACCOUNT_CREATION",
			description: "Triggered when a new account is created",
			templateId: accountCreationTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "DEPOSIT",
			description: "Triggered when a deposit is made",
			templateId: depositTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "WITHDRAWAL",
			description: "Triggered when a withdrawal is made",
			templateId: withdrawalTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "TRANSFER",
			description: "Triggered when a transfer is made",
			templateId: transferTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "LOAN_APPLICATION",
			description: "Triggered when a loan application is received",
			templateId: loanApplicationTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "LOAN_APPROVAL",
			description: "Triggered when a loan is approved",
			templateId: loanApprovalTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "LOAN_REJECTION",
			description: "Triggered when a loan is rejected",
			templateId: loanRejectionTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "EMI_DUE",
			description: "Triggered when an EMI is due",
			templateId: emiDueTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "EMI_PAYMENT",
			description: "Triggered when an EMI payment is received",
			templateId: emiPaymentTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "MARKETING",
			description: "Triggered for marketing campaigns",
			templateId: marketingTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "SYSTEM_MAINTENANCE",
			description: "Triggered for system maintenance notifications",
			templateId: maintenanceTemplate?.id,
			isActive: true,
		},
		{
			eventCode: "PASSWORD_RESET",
			description: "Triggered when password is reset",
			templateId: passwordResetTemplate?.id,
			isActive: true,
		},
	];

	for (const event of events) {
		await prisma.smsEvent.create({ data: event });
		console.log(`Created SMS event: ${event.eventCode}`);
	}
}

async function seedTaxTypes() {
	console.log("Seeding tax types and rates...");

	// Create tax types
	const taxTypes = [
		{
			code: "TDS",
			name: "Tax Deducted at Source",
			description: "Tax deducted at source on interest income",
			isActive: true,
		},
		{
			code: "GST",
			name: "Goods and Services Tax",
			description: "Tax on goods and services",
			isActive: true,
		},
		{
			code: "ST",
			name: "Service Tax",
			description: "Tax on services provided",
			isActive: true,
		},
	];

	for (const taxType of taxTypes) {
		await prisma.taxType.create({ data: taxType });
		console.log(`Created tax type: ${taxType.name}`);
	}

	// Create tax rates
	const tds = await prisma.taxType.findFirst({ where: { code: "TDS" } });
	const gst = await prisma.taxType.findFirst({ where: { code: "GST" } });
	const st = await prisma.taxType.findFirst({ where: { code: "ST" } });

	if (tds) {
		const tdsRates = [
			{
				taxTypeId: tds.id,
				rate: 10.0,
				thresholdAmount: 10000,
				effectiveFrom: new Date("2023-04-01"),
				customerCategory: "Individual",
				isActive: true,
			},
			{
				taxTypeId: tds.id,
				rate: 20.0,
				thresholdAmount: 50000,
				effectiveFrom: new Date("2023-04-01"),
				customerCategory: "Corporate",
				isActive: true,
			},
		];

		for (const rate of tdsRates) {
			await prisma.taxRate.create({ data: rate });
			console.log(`Created TDS rate: ${rate.rate}%`);
		}
	}

	if (gst) {
		const gstRates = [
			{
				taxTypeId: gst.id,
				rate: 5.0,
				effectiveFrom: new Date("2023-04-01"),
				isActive: true,
			},
			{
				taxTypeId: gst.id,
				rate: 12.0,
				effectiveFrom: new Date("2023-04-01"),
				isActive: true,
			},
			{
				taxTypeId: gst.id,
				rate: 18.0,
				effectiveFrom: new Date("2023-04-01"),
				isActive: true,
			},
		];

		for (const rate of gstRates) {
			await prisma.taxRate.create({ data: rate });
			console.log(`Created GST rate: ${rate.rate}%`);
		}
	}

	if (st) {
		const stRates = [
			{
				taxTypeId: st.id,
				rate: 15.0,
				effectiveFrom: new Date("2023-04-01"),
				isActive: true,
			},
		];

		for (const rate of stRates) {
			await prisma.taxRate.create({ data: rate });
			console.log(`Created Service Tax rate: ${rate.rate}%`);
		}
	}
}

async function seedExpenseCategories() {
	console.log("Seeding expense categories...");

	// Create main expense categories
	const mainCategories = [
		{
			name: "Personnel Expenses",
			categoryType: ExpenseCategoryType.FIXED,
			budgetAllocationPercent: 40.0,
			isActive: true,
		},
		{
			name: "Administrative Expenses",
			categoryType: ExpenseCategoryType.VARIABLE,
			budgetAllocationPercent: 25.0,
			isActive: true,
		},
		{
			name: "Operational Expenses",
			categoryType: ExpenseCategoryType.VARIABLE,
			budgetAllocationPercent: 20.0,
			isActive: true,
		},
		{
			name: "Capital Expenses",
			categoryType: ExpenseCategoryType.CAPITAL,
			budgetAllocationPercent: 15.0,
			isActive: true,
		},
	];

	for (const category of mainCategories) {
		await prisma.expenseCategory.create({ data: category });
		console.log(`Created expense category: ${category.name}`);
	}

	// Get created main categories
	const personnel = await prisma.expenseCategory.findFirst({
		where: { name: "Personnel Expenses" },
	});
	const administrative = await prisma.expenseCategory.findFirst({
		where: { name: "Administrative Expenses" },
	});
	const operational = await prisma.expenseCategory.findFirst({
		where: { name: "Operational Expenses" },
	});
	const capital = await prisma.expenseCategory.findFirst({
		where: { name: "Capital Expenses" },
	});

	// Create sub-categories
	if (personnel) {
		const personnelSubCategories = [
			{
				name: "Salaries",
				categoryType: ExpenseCategoryType.FIXED,
				parentId: personnel.id,
				isActive: true,
			},
			{
				name: "Bonuses",
				categoryType: ExpenseCategoryType.VARIABLE,
				parentId: personnel.id,
				isActive: true,
			},
			{
				name: "Staff Benefits",
				categoryType: ExpenseCategoryType.FIXED,
				parentId: personnel.id,
				isActive: true,
			},
		];

		for (const category of personnelSubCategories) {
			await prisma.expenseCategory.create({ data: category });
			console.log(`Created personnel sub-category: ${category.name}`);
		}
	}

	if (administrative) {
		const adminSubCategories = [
			{
				name: "Rent",
				categoryType: ExpenseCategoryType.FIXED,
				parentId: administrative.id,
				isActive: true,
			},
			{
				name: "Utilities",
				categoryType: ExpenseCategoryType.VARIABLE,
				parentId: administrative.id,
				isActive: true,
			},
			{
				name: "Office Supplies",
				categoryType: ExpenseCategoryType.VARIABLE,
				parentId: administrative.id,
				isActive: true,
			},
			{
				name: "Communication",
				categoryType: ExpenseCategoryType.VARIABLE,
				parentId: administrative.id,
				isActive: true,
			},
		];

		for (const category of adminSubCategories) {
			await prisma.expenseCategory.create({ data: category });
			console.log(`Created administrative sub-category: ${category.name}`);
		}
	}

	if (operational) {
		const operationalSubCategories = [
			{
				name: "Marketing",
				categoryType: ExpenseCategoryType.VARIABLE,
				parentId: operational.id,
				isActive: true,
			},
			{
				name: "Travel",
				categoryType: ExpenseCategoryType.VARIABLE,
				parentId: operational.id,
				isActive: true,
			},
			{
				name: "Training",
				categoryType: ExpenseCategoryType.VARIABLE,
				parentId: operational.id,
				isActive: true,
			},
		];

		for (const category of operationalSubCategories) {
			await prisma.expenseCategory.create({ data: category });
			console.log(`Created operational sub-category: ${category.name}`);
		}
	}

	if (capital) {
		const capitalSubCategories = [
			{
				name: "Equipment",
				categoryType: ExpenseCategoryType.CAPITAL,
				parentId: capital.id,
				isActive: true,
			},
			{
				name: "Furniture",
				categoryType: ExpenseCategoryType.CAPITAL,
				parentId: capital.id,
				isActive: true,
			},
			{
				name: "Software",
				categoryType: ExpenseCategoryType.CAPITAL,
				parentId: capital.id,
				isActive: true,
			},
		];

		for (const category of capitalSubCategories) {
			await prisma.expenseCategory.create({ data: category });
			console.log(`Created capital sub-category: ${category.name}`);
		}
	}
}

async function seedReportTemplates() {
	console.log("Seeding report templates...");

	const reportTemplates = [
		{
			name: "User List Report",
			description: "List of all users with their account details",
			category: "User",
			queryDefinition: {
				table: "users",
				joins: [{ table: "accounts", on: "users.id = accounts.userId" }],
				fields: [
					"users.id",
					"users.fullName",
					"users.contactNumber",
					"users.userType",
					"accounts.accountNumber",
					"accounts.balance",
					"accounts.status",
				],
				groupBy: [],
				orderBy: ["users.fullName ASC"],
			},
			layoutDefinition: {
				title: "User List Report",
				subtitle: "List of all users with their account details",
				columns: [
					{ field: "fullName", header: "Name", width: "20%" },
					{ field: "contactNumber", header: "Contact", width: "15%" },
					{ field: "userType", header: "Type", width: "10%" },
					{ field: "accountNumber", header: "Account No.", width: "15%" },
					{
						field: "balance",
						header: "Balance",
						width: "15%",
						format: "currency",
					},
					{ field: "status", header: "Status", width: "10%" },
				],
				footer: "Generated on {{date}}",
			},
			parameterDefinition: {
				userType: {
					type: "select",
					label: "User Type",
					options: ["SB", "BB", "MB"],
					required: false,
				},
				status: {
					type: "select",
					label: "Account Status",
					options: ["ACTIVE", "INACTIVE", "CLOSED", "FROZEN"],
					required: false,
				},
			},
			isSystem: true,
			isActive: true,
		},
		{
			name: "Loan Status Report",
			description: "Status of all loans with payment details",
			category: "Loan",
			queryDefinition: {
				table: "loans",
				joins: [
					{ table: "users", on: "loans.userId = users.id" },
					{ table: "loanTypes", on: "loans.loanTypeId = loanTypes.id" },
				],
				fields: [
					"loans.loanNumber",
					"users.fullName",
					"loanTypes.name as loanType",
					"loans.principalAmount",
					"loans.outstandingPrincipal",
					"loans.status",
					"loans.disbursementDate",
				],
				groupBy: [],
				orderBy: ["loans.disbursementDate DESC"],
			},
			layoutDefinition: {
				title: "Loan Status Report",
				subtitle: "Status of all loans with payment details",
				columns: [
					{ field: "loanNumber", header: "Loan No.", width: "15%" },
					{ field: "fullName", header: "Borrower", width: "20%" },
					{ field: "loanType", header: "Loan Type", width: "15%" },
					{
						field: "principalAmount",
						header: "Principal",
						width: "15%",
						format: "currency",
					},
					{
						field: "outstandingPrincipal",
						header: "Outstanding",
						width: "15%",
						format: "currency",
					},
					{ field: "status", header: "Status", width: "10%" },
					{
						field: "disbursementDate",
						header: "Disbursed On",
						width: "15%",
						format: "date",
					},
				],
				footer: "Generated on {{date}}",
			},
			parameterDefinition: {
				status: {
					type: "select",
					label: "Loan Status",
					options: ["ACTIVE", "CLOSED", "DEFAULTED"],
					required: false,
				},
				loanType: {
					type: "select",
					label: "Loan Type",
					options: ["PL", "BL", "EL", "HL", "VL"],
					required: false,
				},
				dateFrom: {
					type: "date",
					label: "From Date",
					required: false,
				},
				dateTo: {
					type: "date",
					label: "To Date",
					required: false,
				},
			},
			isSystem: true,
			isActive: true,
		},
		{
			name: "Financial Summary Report",
			description: "Summary of financial position",
			category: "Financial",
			queryDefinition: {
				table: "accounts_coa",
				joins: [
					{
						table: "account_balances",
						on: "accounts_coa.id = account_balances.accountId",
					},
				],
				fields: [
					"accounts_coa.accountCode",
					"accounts_coa.name",
					"accounts_coa.accountType",
					"SUM(account_balances.debitBalance) as totalDebit",
					"SUM(account_balances.creditBalance) as totalCredit",
					"SUM(account_balances.debitBalance - account_balances.creditBalance) as balance",
				],
				groupBy: [
					"accounts_coa.accountCode",
					"accounts_coa.name",
					"accounts_coa.accountType",
				],
				orderBy: ["accounts_coa.accountCode ASC"],
			},
			layoutDefinition: {
				title: "Financial Summary Report",
				subtitle: "Summary of financial position as of {{date}}",
				columns: [
					{ field: "accountCode", header: "Code", width: "10%" },
					{ field: "name", header: "Account", width: "30%" },
					{ field: "accountType", header: "Type", width: "15%" },
					{
						field: "totalDebit",
						header: "Debit",
						width: "15%",
						format: "currency",
					},
					{
						field: "totalCredit",
						header: "Credit",
						width: "15%",
						format: "currency",
					},
					{
						field: "balance",
						header: "Balance",
						width: "15%",
						format: "currency",
					},
				],
				footer: "Generated on {{date}}",
			},
			parameterDefinition: {
				asOfDate: {
					type: "date",
					label: "As of Date",
					required: true,
					default: "today",
				},
				accountType: {
					type: "select",
					label: "Account Type",
					options: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"],
					required: false,
				},
			},
			isSystem: true,
			isActive: true,
		},
	];

	for (const template of reportTemplates) {
		await prisma.reportTemplate.create({
			data: {
				...template,
				queryDefinition: template.queryDefinition as any,
				layoutDefinition: template.layoutDefinition as any,
				parameterDefinition: template.parameterDefinition as any,
			},
		});
		console.log(`Created report template: ${template.name}`);
	}
}

async function seedStaffUsers() {
	console.log("Seeding staff users...");

	// Create default staff password hash
	const passwordHash = await bcrypt.hash("Staff@123", 10);

	// Create staff users
	const staffUsers = [
		{
			employeeId: "STAFF001",
			firstName: "John",
			lastName: "Doe",
			email: "john.doe@astrofinance.com",
			passwordHash,
			phone: "1234567890",
			address: "123 Main St, City",
			dateOfBirth: new Date("1990-01-01"),
			joinDate: new Date("2023-01-01"),
			department: "Loans",
			position: "Loan Officer",
			status: StaffStatus.ACTIVE,
		},
		{
			employeeId: "STAFF002",
			firstName: "Jane",
			lastName: "Smith",
			email: "jane.smith@astrofinance.com",
			passwordHash,
			phone: "9876543210",
			address: "456 Oak St, City",
			dateOfBirth: new Date("1992-05-15"),
			joinDate: new Date("2023-02-01"),
			department: "Accounting",
			position: "Accountant",
			status: StaffStatus.ACTIVE,
		},
		{
			employeeId: "STAFF003",
			firstName: "Robert",
			lastName: "Johnson",
			email: "robert.johnson@astrofinance.com",
			passwordHash,
			phone: "5551234567",
			address: "789 Pine St, City",
			dateOfBirth: new Date("1988-11-20"),
			joinDate: new Date("2023-03-01"),
			department: "Customer Service",
			position: "Customer Service Representative",
			status: StaffStatus.ACTIVE,
		},
	];

	for (const staffUser of staffUsers) {
		const staff = await prisma.staff.create({ data: staffUser });
		console.log(`Created staff user: ${staff.employeeId}`);
	}

	// Assign roles to staff
	const loanOfficerRole = await prisma.role.findFirst({
		where: { name: "Loan Officer" },
	});
	const accountantRole = await prisma.role.findFirst({
		where: { name: "Accountant" },
	});

	if (loanOfficerRole) {
		const loanOfficer = await prisma.staff.findFirst({
			where: { employeeId: "STAFF001" },
		});
		if (loanOfficer) {
			await prisma.staffRole.create({
				data: {
					staffId: loanOfficer.id,
					roleId: loanOfficerRole.id,
				},
			});
			console.log("Assigned Loan Officer role to STAFF001");
		}
	}

	if (accountantRole) {
		const accountant = await prisma.staff.findFirst({
			where: { employeeId: "STAFF002" },
		});
		if (accountant) {
			await prisma.staffRole.create({
				data: {
					staffId: accountant.id,
					roleId: accountantRole.id,
				},
			});
			console.log("Assigned Accountant role to STAFF002");
		}
	}
}

async function seedSystemSettings() {
	console.log("Seeding system settings...");

	// Create setting categories
	const categories = [
		{
			name: "GENERAL",
			displayName: "General",
			description: "General application settings",
			icon: "cog",
			order: 1,
		},
		{
			name: "BUSINESS",
			displayName: "Business",
			description: "Business-related settings",
			icon: "building",
			order: 2,
		},
		{
			name: "CONTACT",
			displayName: "Contact",
			description: "Contact information settings",
			icon: "globe",
			order: 3,
		},
		{
			name: "LOAN",
			displayName: "Loan",
			description: "Loan-related settings",
			icon: "currency-rupee",
			order: 4,
		},
		{
			name: "NOTIFICATION",
			displayName: "Notifications",
			description: "Notification settings",
			icon: "bell",
			order: 5,
		},
		{
			name: "SECURITY",
			displayName: "Security",
			description: "Security settings",
			icon: "shield-check",
			order: 6,
		},
		{
			name: "SYSTEM",
			displayName: "System",
			description: "System settings",
			icon: "chart-bar",
			order: 7,
		},
	];

	for (const category of categories) {
		// Check if category already exists
		const existingCategory = await prisma.settingCategory.findUnique({
			where: { name: category.name }
		});

		if (!existingCategory) {
			await prisma.settingCategory.create({ data: category });
			console.log(`Created setting category: ${category.name}`);
		}
	}
	// Create default settings
	const defaultSettings = [
		// General Settings
		{
			key: "app.name",
			value: "AstroFinance",
			description: "Application name",
			category: "GENERAL",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "app.description",
			value: "Financial Management System",
			description: "Application description",
			category: "GENERAL",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "app.version",
			value: "1.0.0",
			description: "Application version",
			category: "GENERAL",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "app.timezone",
			value: "Asia/Kathmandu",
			description: "Default timezone",
			category: "GENERAL",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "app.language",
			value: "en",
			description: "Default language",
			category: "GENERAL",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},

		// Contact Information
		{
			key: "contact.email",
			value: "info@astrofinance.com",
			description: "Primary contact email",
			category: "CONTACT",
			dataType: "EMAIL",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "contact.phone",
			value: "+977-1-1234567",
			description: "Primary contact phone",
			category: "CONTACT",
			dataType: "PHONE",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "contact.address",
			value: "Kathmandu, Nepal",
			description: "Business address",
			category: "CONTACT",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "contact.website",
			value: "https://astrofinance.com",
			description: "Business website",
			category: "CONTACT",
			dataType: "URL",
			isPublic: true,
			isEncrypted: false,
		},

		// Business Settings
		{
			key: "business.name",
			value: "AstroFinance Pvt. Ltd.",
			description: "Business name",
			category: "BUSINESS",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "business.registration_number",
			value: "123456789",
			description: "Business registration number",
			category: "BUSINESS",
			dataType: "STRING",
			isPublic: false,
			isEncrypted: false,
		},
		{
			key: "business.tax_id",
			value: "TAX123456",
			description: "Business tax ID",
			category: "BUSINESS",
			dataType: "STRING",
			isPublic: false,
			isEncrypted: false,
		},
		{
			key: "business.currency",
			value: "NPR",
			description: "Default currency",
			category: "BUSINESS",
			dataType: "STRING",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "business.financial_year_start",
			value: "2024-04-01",
			description: "Financial year start date",
			category: "BUSINESS",
			dataType: "DATE",
			isPublic: true,
			isEncrypted: false,
		},

		// Loan Settings
		{
			key: "loan.max_amount",
			value: "1000000",
			description: "Maximum loan amount",
			category: "LOAN",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "loan.min_amount",
			value: "1000",
			description: "Minimum loan amount",
			category: "LOAN",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "loan.max_tenure",
			value: "84",
			description: "Maximum loan tenure in months",
			category: "LOAN",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "loan.min_tenure",
			value: "3",
			description: "Minimum loan tenure in months",
			category: "LOAN",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "loan.processing_fee_percent",
			value: "2.5",
			description: "Default processing fee percentage",
			category: "LOAN",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "loan.late_fee_amount",
			value: "500",
			description: "Default late fee amount",
			category: "LOAN",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},

		// Notification Settings
		{
			key: "notification.email_enabled",
			value: "true",
			description: "Enable email notifications",
			category: "NOTIFICATION",
			dataType: "BOOLEAN",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "notification.sms_enabled",
			value: "true",
			description: "Enable SMS notifications",
			category: "NOTIFICATION",
			dataType: "BOOLEAN",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "notification.push_enabled",
			value: "false",
			description: "Enable push notifications",
			category: "NOTIFICATION",
			dataType: "BOOLEAN",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "notification.sms_provider",
			value: "twilio",
			description: "SMS provider",
			category: "NOTIFICATION",
			dataType: "STRING",
			isPublic: false,
			isEncrypted: false,
		},

		// Security Settings
		{
			key: "security.password_min_length",
			value: "8",
			description: "Minimum password length",
			category: "SECURITY",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "security.password_require_special",
			value: "true",
			description: "Require special characters in password",
			category: "SECURITY",
			dataType: "BOOLEAN",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "security.session_timeout",
			value: "3600",
			description: "Session timeout in seconds",
			category: "SECURITY",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "security.max_login_attempts",
			value: "5",
			description: "Maximum login attempts",
			category: "SECURITY",
			dataType: "NUMBER",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "security.two_factor_enabled",
			value: "false",
			description: "Enable two-factor authentication",
			category: "SECURITY",
			dataType: "BOOLEAN",
			isPublic: true,
			isEncrypted: false,
		},

		// System Settings
		{
			key: "system.maintenance_mode",
			value: "false",
			description: "Enable maintenance mode",
			category: "SYSTEM",
			dataType: "BOOLEAN",
			isPublic: true,
			isEncrypted: false,
		},
		{
			key: "system.debug_mode",
			value: "false",
			description: "Enable debug mode",
			category: "SYSTEM",
			dataType: "BOOLEAN",
			isPublic: false,
			isEncrypted: false,
		},
		{
			key: "system.log_level",
			value: "info",
			description: "Log level",
			category: "SYSTEM",
			dataType: "STRING",
			isPublic: false,
			isEncrypted: false,
		},
		{
			key: "system.backup_enabled",
			value: "true",
			description: "Enable automatic backups",
			category: "SYSTEM",
			dataType: "BOOLEAN",
			isPublic: false,
			isEncrypted: false,
		},
		{
			key: "system.backup_frequency",
			value: "daily",
			description: "Backup frequency",
			category: "SYSTEM",
			dataType: "STRING",
			isPublic: false,
			isEncrypted: false,
		},
	];

	// Import SettingDataType from your Prisma client
	const { SettingDataType } = await import("@prisma/client");

	for (const setting of defaultSettings) {
		// Check if setting already exists
		const existingSetting = await prisma.systemSetting.findUnique({
			where: { key: setting.key }
		});

		if (!existingSetting) {
			await prisma.systemSetting.create({
				data: {
					...setting,
					dataType:
						SettingDataType[setting.dataType as keyof typeof SettingDataType],
				},
			});
			console.log(`Created setting: ${setting.key}`);
		}
	}

	console.log("System settings seeded successfully");
}

async function seedAccountTypes() {
	console.log("Seeding account types...");

	const accountTypes = [
		{
			code: "SB",
			name: "Sadharan Bachat",
			description: "Regular savings account",
			isActive: true,
		},
		{
			code: "BB",
			name: "Branch Bises Bachat",
			description: "Special savings account with guardian",
			isActive: true,
		},
		{
			code: "FD",
			name: "Fixed Deposit",
			description: "Fixed deposit account with monthly deposits",
			isActive: true,
		},
		{
			code: "SH",
			name: "Share",
			description: "Share account",
			isActive: true,
		},
		{
			code: "LS",
			name: "Loan Share",
			description: "Loan share account",
			isActive: true,
		},
	];

	for (const accountType of accountTypes) {
		try {
			const existing = await prisma.accountTypeConfig.findUnique({
				where: { code: accountType.code },
			});

			if (existing) {
				const updated = await prisma.accountTypeConfig.update({
					where: { code: accountType.code },
					data: accountType,
				});
				console.log(`Updated account type: ${updated.name} (${updated.code})`);
			} else {
				const created = await prisma.accountTypeConfig.create({
					data: accountType,
				});
				console.log(`Created account type: ${created.name} (${created.code})`);
			}
		} catch (error) {
			console.error(`Error processing account type ${accountType.code}:`, error);
		}
	}
}

main()
	.catch((e) => {
		console.error("Error during seeding:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
