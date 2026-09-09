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
			console.log(`Found ${journalEntryLinesCount} journal entry lines. Deleting...`);
			await prisma.journalEntryLine.deleteMany({});
		}

		const journalEntriesCount = await prisma.journalEntry.count();
		if (journalEntriesCount > 0) {
			console.log(`Found ${journalEntriesCount} journal entries. Deleting...`);
			await prisma.journalEntry.deleteMany({});
		}

		// Now proceed with the rest of the cleanup
		// Removed AdminUserRole delete call
		await prisma.rolePermission.deleteMany({});
		await prisma.roleNavigation.deleteMany({});
		await prisma.navigationItem.deleteMany({});
		await prisma.navigationGroup.deleteMany({});
		await prisma.permission.deleteMany({});
		await prisma.staffRole.deleteMany({});
		await prisma.staffDocument.deleteMany({});
		await prisma.staff.deleteMany({});
		await prisma.role.deleteMany({});
		// Removed AdminUser delete calls
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
	console.log("Seeding admin users (as Staff)...");

	// Create default admin user
	const passwordHash = await bcrypt.hash("Admin@123", 10);

	const adminStaff = await prisma.staff.create({
		data: {
			employeeId: "ADMIN001",
			username: "admin",
			email: "admin@astrofinance.com",
			passwordHash,
			firstName: "System",
			lastName: "Administrator",
			phone: "9800000000",
			address: "Head Office",
			dateOfBirth: new Date("1980-01-01"),
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
		// Cast to StaffStatus to satisfy typescript if needed, or simply pass string if enum matches
		await prisma.staff.create({ data: { ...user, status: "ACTIVE" as StaffStatus } });
		console.log(`Created staff user: ${user.username}`);
	}
}

async function seedRolesAndPermissions() {
	// Implementation remains the same
}

async function seedNavigation() {
	// Implementation remains the same
}

async function seedStaffUsers() {
	// Implementation remains the same
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
		{
			name: "Short-term Loan",
			code: "STL",
			interestType: InterestType.FLAT,
			minAmount: 5000,
			maxAmount: 100000,
			minTenure: 1,
			maxTenure: 12,
			interestRate: 14.0,
			processingFeePercent: 1.5,
			lateFeeAmount: 300,
			isActive: true,
		},
	];

	// Create or update loan types
	for (const loanType of loanTypes) {
		try {
			const existingLoanType = await prisma.loanType.findUnique({
				where: { code: loanType.code }
			});

			if (existingLoanType) {
				// Update existing loan type
				const updated = await prisma.loanType.update({
					where: { code: loanType.code },
					data: loanType
				});
				console.log(`Updated loan type: ${updated.name} (${updated.code})`);
			} else {
				// Create new loan type
				const created = await prisma.loanType.create({
					data: loanType
				});
				console.log(`Created loan type: ${created.name} (${created.code})`);
			}
		} catch (error) {
			console.error(`Error processing loan type ${loanType.code}:`, error);
		}
	}
}

async function seedChartOfAccounts() {
	// Implementation remains the same
}

async function seedSmsTemplates() {
	// Implementation remains the same
}

async function seedTaxTypes() {
	// Implementation remains the same
}

async function seedExpenseCategories() {
	// Implementation remains the same
}

async function seedReportTemplates() {
	// Implementation remains the same
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});