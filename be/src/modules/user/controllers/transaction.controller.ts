import type { Request, Response } from "express";
import { PrismaClient, TransactionType, AccountStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
	createTransactionSchema,
	getTransactionsByAccountSchema,
	getTransactionByIdSchema,
	cancelTransactionSchema,
} from "../validations/transaction.validation";
import {
	addUserTransactionToDayBook,
	removeUserTransactionFromDayBook,
} from "../../../common/utils/daybook-integration.util";
import { createJournalEntryForUserTransaction } from "../utils/journal-entry-mapping.util";
import { prepareDateForDb } from "../../../utils/date-converter.util";

const prisma = new PrismaClient();

/**
 * Create a new transaction for a user account
 * @route POST /api/user/accounts/:accountId/transactions
 */
export const createTransaction = async (req: Request, res: Response) => {
	try {
		// Validate request body
		const { error, value } = createTransactionSchema.validate({
			...req.body,
			accountId: req.params.accountId,
		});

		if (error) {
			return res.status(400).json({
				success: false,
				message: "Validation error",
				errors: error.details,
			});
		}

		const {
			accountId,
			transactionType,
			amount,
			description,
			referenceNumber,
			transactionMethod,
			transactionDate = new Date(),
			transactionDate_bs,
		} = value;

		// Process transaction date (accept either AD or BS)
		const dateDates = prepareDateForDb(
			transactionDate || transactionDate_bs,
			"transactionDate",
			!!transactionDate_bs && !transactionDate
		);
		const finalTransactionDate = dateDates.adDate || new Date();

		// Get the admin user ID from the authenticated user
		const adminUserId = req.user?.id;
		if (!adminUserId) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized. Admin user ID not found.",
			});
		}

		// Check if account exists and is active
		const account = await prisma.userAccount.findUnique({
			where: { id: accountId },
			include: { user: true },
		});

		if (!account) {
			return res.status(404).json({
				success: false,
				message: "Account not found",
			});
		}

		if (account.status !== AccountStatus.ACTIVE) {
			return res.status(400).json({
				success: false,
				message: `Cannot perform transactions on an account with status: ${account.status}`,
			});
		}

		// Validate transaction based on type
		if (
			transactionType === TransactionType.WITHDRAWAL &&
			account.balance < amount
		) {
			return res.status(400).json({
				success: false,
				message: "Insufficient balance for withdrawal",
			});
		}

		// Calculate new balance based on transaction type
		let newBalance: Decimal = account.balance;
		const decimalAmount = new Decimal(amount.toString());

		if (
			transactionType === TransactionType.DEPOSIT ||
			transactionType === TransactionType.INTEREST_CREDIT ||
			transactionType === TransactionType.TRANSFER_IN
		) {
			newBalance = account.balance.add(decimalAmount);
		} else if (
			transactionType === TransactionType.WITHDRAWAL ||
			transactionType === TransactionType.FEE_DEBIT ||
			transactionType === TransactionType.TRANSFER_OUT
		) {
			newBalance = account.balance.sub(decimalAmount);
		} else if (transactionType === TransactionType.ADJUSTMENT) {
			// For adjustments, the amount can be positive or negative
			newBalance = account.balance.add(decimalAmount);
		}

		// Create transaction and update account balance in a transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create the transaction
			const transaction = await tx.userAccountTransaction.create({
				data: {
					accountId,
					transactionType,
					amount,
					description: description || `${transactionType} transaction`,
					referenceNumber,
					transactionDate: finalTransactionDate,
					transactionDate_bs: dateDates.bsDate,
					runningBalance: newBalance,
					performedById: adminUserId,
					transactionMethod: transactionMethod || "CASH",
				},
			});

			// Create automatic journal entry for the transaction
			let journalEntryId: string | null = null;
			try {
				journalEntryId = await createJournalEntryForUserTransaction(
					{
						...transaction,
						transactionDate,
					},
					adminUserId,
				);

				// Update transaction with journal entry reference
				await tx.userAccountTransaction.update({
					where: { id: transaction.id },
					data: { journalEntryId },
				});
			} catch (journalError) {
				// Log error but don't fail the transaction
				console.error(
					"Error creating journal entry for transaction:",
					journalError,
				);
			}

			// Update account balance and last transaction date
			const updatedAccount = await tx.userAccount.update({
				where: { id: accountId },
				data: {
					balance: newBalance,
					lastTransactionDate: finalTransactionDate,
					lastTransactionDate_bs: dateDates.bsDate,
				},
			});

			return { transaction, updatedAccount, journalEntryId };
		});

		// Add transaction to daybook
		try {
			await addUserTransactionToDayBook(
				{
					...result.transaction,
					amount: Number(result.transaction.amount),
				},
				adminUserId,
			);
		} catch (dayBookError) {
			// Log error but don't fail the transaction
			console.error("Error adding transaction to daybook:", dayBookError);
		}

		return res.status(201).json({
			success: true,
			message: "Transaction created successfully",
			data: {
				transaction: result.transaction,
				newBalance: result.updatedAccount.balance,
			},
		});
	} catch (error) {
		console.error("Error creating transaction:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

/**
 * Get transactions for a specific account with pagination and filtering
 * @route GET /api/user/accounts/:accountId/transactions
 */
export const getTransactionsByAccount = async (req: Request, res: Response) => {
	try {
		// Validate request parameters
		const { error, value } = getTransactionsByAccountSchema.validate({
			...req.query,
			accountId: req.params.accountId,
		});

		if (error) {
			return res.status(400).json({
				success: false,
				message: "Validation error",
				errors: error.details,
			});
		}

		const {
			accountId,
			page = 1,
			limit = 10,
			startDate,
			endDate,
			transactionType,
		} = value;

		// Check if account exists
		const account = await prisma.userAccount.findUnique({
			where: { id: accountId },
			include: { user: true },
		});

		if (!account) {
			return res.status(404).json({
				success: false,
				message: "Account not found",
			});
		}

		// Build filter conditions
		const where: Record<string, unknown> = { accountId };

		if (startDate && endDate) {
			where.transactionDate = {
				gte: new Date(startDate),
				lte: new Date(endDate),
			};
		} else if (startDate) {
			where.transactionDate = {
				gte: new Date(startDate),
			};
		} else if (endDate) {
			where.transactionDate = {
				lte: new Date(endDate),
			};
		}

		if (transactionType) {
			where.transactionType = transactionType;
		}

		// Get total count for pagination
		const totalCount = await prisma.userAccountTransaction.count({ where });

		// Get transactions with pagination
		const transactions = await prisma.userAccountTransaction.findMany({
			where,
			orderBy: { transactionDate: "desc" },
			skip: (page - 1) * limit,
			take: limit,
			include: {
				performedBy: {
					select: {
						id: true,
						username: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		return res.status(200).json({
			success: true,
			message: "Transactions retrieved successfully",
			data: {
				transactions,
				pagination: {
					total: totalCount,
					page,
					limit,
					pages: Math.ceil(totalCount / limit),
				},
				accountInfo: {
					accountNumber: account.accountNumber,
					accountType: account.accountType,
					balance: account.balance,
					userName: account.user.fullName,
				},
			},
		});
	} catch (error) {
		console.error("Error getting transactions:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

/**
 * Get a specific transaction by ID
 * @route GET /api/user/transactions/:id
 */
export const getTransactionById = async (req: Request, res: Response) => {
	try {
		// Validate request parameters
		const { error, value } = getTransactionByIdSchema.validate({
			id: req.params.id,
		});

		if (error) {
			return res.status(400).json({
				success: false,
				message: "Validation error",
				errors: error.details,
			});
		}

		const { id } = value;

		// Get transaction with related data
		const transaction = await prisma.userAccountTransaction.findUnique({
			where: { id },
			include: {
				account: {
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								contactNumber: true,
							},
						},
					},
				},
				performedBy: {
					select: {
						id: true,
						username: true,
						firstName: true,
						lastName: true,
					},
				},
				journalEntry: true,
			},
		});

		if (!transaction) {
			return res.status(404).json({
				success: false,
				message: "Transaction not found",
			});
		}

		return res.status(200).json({
			success: true,
			message: "Transaction retrieved successfully",
			data: transaction,
		});
	} catch (error) {
		console.error("Error getting transaction:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

/**
 * Cancel/reverse a transaction
 * @route POST /api/user/transactions/:id/cancel
 */
export const cancelTransaction = async (req: Request, res: Response) => {
	try {
		// Validate request parameters and body
		const { error, value } = cancelTransactionSchema.validate({
			...req.body,
			id: req.params.id,
		});

		if (error) {
			return res.status(400).json({
				success: false,
				message: "Validation error",
				errors: error.details,
			});
		}

		const { id, reason } = value;

		// Get the admin user ID from the authenticated user
		const adminUserId = req.user?.id;
		if (!adminUserId) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized. Admin user ID not found.",
			});
		}

		// Get the transaction to cancel
		const transaction = await prisma.userAccountTransaction.findUnique({
			where: { id },
			include: {
				account: true,
			},
		});

		if (!transaction) {
			return res.status(404).json({
				success: false,
				message: "Transaction not found",
			});
		}

		// Check if the transaction is recent (e.g., within 24 hours)
		const transactionTime = new Date(transaction.transactionDate).getTime();
		const currentTime = Date.now();
		const hoursSinceTransaction =
			(currentTime - transactionTime) / (1000 * 60 * 60);

		if (hoursSinceTransaction > 24) {
			return res.status(400).json({
				success: false,
				message: "Cannot cancel transactions older than 24 hours",
			});
		}

		// Determine the reversal transaction type and amount
		let reversalType: TransactionType = TransactionType.ADJUSTMENT; // Default value
		let reversalAmount: Decimal = transaction.amount;
		let negateAmount = false;

		switch (transaction.transactionType) {
			case TransactionType.DEPOSIT:
				reversalType = TransactionType.WITHDRAWAL;
				break;
			case TransactionType.WITHDRAWAL:
				reversalType = TransactionType.DEPOSIT;
				break;
			case TransactionType.INTEREST_CREDIT:
				reversalType = TransactionType.ADJUSTMENT;
				negateAmount = true;
				break;
			case TransactionType.FEE_DEBIT:
				reversalType = TransactionType.ADJUSTMENT;
				break;
			case TransactionType.TRANSFER_IN:
				reversalType = TransactionType.TRANSFER_OUT;
				break;
			case TransactionType.TRANSFER_OUT:
				reversalType = TransactionType.TRANSFER_IN;
				break;
			case TransactionType.ADJUSTMENT:
				reversalType = TransactionType.ADJUSTMENT;
				negateAmount = true;
				break;
			default:
				// This should never happen as we've covered all transaction types,
				// but TypeScript requires a default case
				reversalType = TransactionType.ADJUSTMENT;
				console.warn(
					`Unexpected transaction type: ${transaction.transactionType}`,
				);
		}

		// If we need to negate the amount, create a new Decimal with the negative value
		if (negateAmount) {
			// Convert to string, negate, and create a new Decimal
			const amountStr = transaction.amount.toString();
			const negatedAmountStr = amountStr.startsWith("-")
				? amountStr.substring(1)
				: `-${amountStr}`;
			reversalAmount = new Decimal(negatedAmountStr);
		}

		// Calculate new balance
		let newBalance: Decimal;

		// Determine if this is a credit or debit to the account
		if (
			reversalType === TransactionType.DEPOSIT ||
			reversalType === TransactionType.TRANSFER_IN
		) {
			// These are credits to the account
			newBalance = transaction.account.balance.add(reversalAmount);
		} else if (
			reversalType === TransactionType.WITHDRAWAL ||
			reversalType === TransactionType.TRANSFER_OUT
		) {
			// These are debits from the account
			newBalance = transaction.account.balance.sub(reversalAmount);
		} else {
			// For ADJUSTMENT type, the amount already has the correct sign
			newBalance = transaction.account.balance.add(reversalAmount);
		}

		// Create reversal transaction and update account balance in a transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create the reversal transaction
			const reversalTransaction = await tx.userAccountTransaction.create({
				data: {
					accountId: transaction.accountId,
					transactionType: reversalType,
					amount: reversalAmount,
					description: `Reversal of transaction ${transaction.id}: ${reason}`,
					referenceNumber: `REV-${transaction.id.substring(0, 8)}`,
					runningBalance: newBalance,
					performedById: adminUserId,
					transactionMethod: "SYSTEM",
				},
			});

			// Update account balance
			const updatedAccount = await tx.userAccount.update({
				where: { id: transaction.accountId },
				data: {
					balance: newBalance,
					lastTransactionDate: new Date(),
				},
			});

			return { reversalTransaction, updatedAccount };
		});

		// Remove original transaction from daybook
		try {
			await removeUserTransactionFromDayBook(transaction.id, adminUserId);
		} catch (dayBookError) {
			// Log error but don't fail the cancellation
			console.error("Error removing transaction from daybook:", dayBookError);
		}

		// Add reversal transaction to daybook
		try {
			await addUserTransactionToDayBook(
				result.reversalTransaction,
				adminUserId,
			);
		} catch (dayBookError) {
			// Log error but don't fail the cancellation
			console.error(
				"Error adding reversal transaction to daybook:",
				dayBookError,
			);
		}

		return res.status(200).json({
			success: true,
			message: "Transaction canceled successfully",
			data: {
				originalTransaction: transaction,
				reversalTransaction: result.reversalTransaction,
				newBalance: result.updatedAccount.balance,
			},
		});
	} catch (error) {
		console.error("Error canceling transaction:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

/**
 * Get transaction summary for an account
 * @route GET /api/user/accounts/:accountId/transactions/summary
 */
export const getTransactionSummary = async (req: Request, res: Response) => {
	try {
		const accountId = req.params.accountId;

		// Check if account exists
		const account = await prisma.userAccount.findUnique({
			where: { id: accountId },
			include: { user: true },
		});

		if (!account) {
			return res.status(404).json({
				success: false,
				message: "Account not found",
			});
		}

		// Get current month's start and end dates
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(
			now.getFullYear(),
			now.getMonth() + 1,
			0,
			23,
			59,
			59,
		);

		// Get transaction summary for current month
		const currentMonthTransactions =
			await prisma.userAccountTransaction.findMany({
				where: {
					accountId,
					transactionDate: {
						gte: startOfMonth,
						lte: endOfMonth,
					},
				},
			});

		// Calculate summary statistics
		let totalDeposits = new Decimal(0);
		let totalWithdrawals = new Decimal(0);
		let totalInterestEarned = new Decimal(0);
		let totalFees = new Decimal(0);

		currentMonthTransactions.forEach((transaction) => {
			switch (transaction.transactionType) {
				case TransactionType.DEPOSIT:
				case TransactionType.TRANSFER_IN:
					totalDeposits = totalDeposits.add(transaction.amount);
					break;
				case TransactionType.WITHDRAWAL:
				case TransactionType.TRANSFER_OUT:
					totalWithdrawals = totalWithdrawals.add(transaction.amount);
					break;
				case TransactionType.INTEREST_CREDIT:
					totalInterestEarned = totalInterestEarned.add(transaction.amount);
					break;
				case TransactionType.FEE_DEBIT:
					totalFees = totalFees.add(transaction.amount);
					break;
			}
		});

		const summary = {
			totalDeposits: Number(totalDeposits.toFixed(2)),
			totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
			totalInterestEarned: Number(totalInterestEarned.toFixed(2)),
			totalFees: Number(totalFees.toFixed(2)),
			transactionCount: currentMonthTransactions.length,
			lastTransactionDate: account.lastTransactionDate,
		};

		return res.status(200).json({
			success: true,
			message: "Transaction summary retrieved successfully",
			data: {
				accountInfo: {
					accountNumber: account.accountNumber,
					accountType: account.accountType,
					balance: account.balance,
					userName: account.user.fullName,
				},
				summary,
				period: {
					startDate: startOfMonth,
					endDate: endOfMonth,
				},
			},
		});
	} catch (error) {
		console.error("Error getting transaction summary:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

/**
 * Get all transactions with pagination and filtering
 * @route GET /api/user/transactions
 */
export const getAllTransactions = async (req: Request, res: Response) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const skip = (page - 1) * limit;

		const startDate = req.query.startDate
			? new Date(req.query.startDate as string)
			: undefined;
		const endDate = req.query.endDate
			? new Date(req.query.endDate as string)
			: undefined;
		const transactionType = req.query.transactionType as string;
		const accountId = req.query.accountId as string;
		const accountNumber = req.query.accountNumber as string;

		// Build where clause for filtering
		const whereClause: Record<string, unknown> = {};

		if (startDate) {
			const existingDate = whereClause.transactionDate as
				| Record<string, unknown>
				| undefined;
			whereClause.transactionDate = {
				...(existingDate || {}),
				gte: startDate,
			};
		}

		if (endDate) {
			const existingDate = whereClause.transactionDate as
				| Record<string, unknown>
				| undefined;
			whereClause.transactionDate = {
				...(existingDate || {}),
				lte: endDate,
			};
		}

		if (transactionType) {
			whereClause.transactionType = transactionType;
		}

		if (accountId) {
			whereClause.accountId = accountId;
		}

		// If accountNumber is provided, find the account and use its ID
		if (accountNumber) {
			const account = await prisma.userAccount.findFirst({
				where: { accountNumber },
			});

			if (account) {
				whereClause.accountId = account.id;
			} else {
				// If no account found with this number, return empty result
				return res.status(200).json({
					success: true,
					message: "Transactions retrieved successfully",
					data: [],
					pagination: {
						total: 0,
						page,
						limit,
						pages: 0,
					},
				});
			}
		}

		// Get total count for pagination
		const totalCount = await prisma.userAccountTransaction.count({
			where: whereClause,
		});

		// Get transactions with pagination
		const transactions = await prisma.userAccountTransaction.findMany({
			where: whereClause,
			include: {
				account: {
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
							},
						},
					},
				},
			},
			orderBy: {
				transactionDate: "desc",
			},
			skip,
			take: limit,
		});

		return res.status(200).json({
			success: true,
			message: "Transactions retrieved successfully",
			data: transactions,
			pagination: {
				total: totalCount,
				page,
				limit,
				pages: Math.ceil(totalCount / limit),
			},
		});
	} catch (error) {
		console.error("Error getting all transactions:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

/**
 * Get summary for all transactions or filtered by accountId
 * @route GET /api/user/transactions/summary
 */
export const getAllTransactionsSummary = async (
	req: Request,
	res: Response,
) => {
	try {
		const accountId = req.query.accountId as string;
		const accountNumber = req.query.accountNumber as string;

		// Get current month's start and end dates
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(
			now.getFullYear(),
			now.getMonth() + 1,
			0,
			23,
			59,
			59,
		);

		// Build where clause for filtering
		const whereClause: Record<string, unknown> = {
			transactionDate: {
				gte: startOfMonth,
				lte: endOfMonth,
			},
		};

		if (accountId) {
			whereClause.accountId = accountId;
		}

		// If accountNumber is provided, find the account and use its ID
		if (accountNumber) {
			const account = await prisma.userAccount.findFirst({
				where: { accountNumber },
			});

			if (account) {
				whereClause.accountId = account.id;
			} else {
				// If no account found with this number, return empty summary
				return res.status(200).json({
					success: true,
					message: "Transaction summary retrieved successfully",
					data: {
						summary: {
							totalDeposits: 0,
							totalWithdrawals: 0,
							totalInterestEarned: 0,
							totalFees: 0,
							transactionCount: 0,
						},
						period: {
							startDate: startOfMonth,
							endDate: endOfMonth,
						},
					},
				});
			}
		}

		// Get transactions for the current month
		const currentMonthTransactions =
			await prisma.userAccountTransaction.findMany({
				where: whereClause,
			});

		// Calculate summary
		let totalDeposits = new Decimal(0);
		let totalWithdrawals = new Decimal(0);
		let totalInterestEarned = new Decimal(0);
		let totalFees = new Decimal(0);

		currentMonthTransactions.forEach((transaction) => {
			const amount = new Decimal(transaction.amount);

			switch (transaction.transactionType) {
				case "DEPOSIT":
				case "TRANSFER_IN":
					totalDeposits = totalDeposits.add(amount);
					break;
				case "WITHDRAWAL":
				case "TRANSFER_OUT":
					totalWithdrawals = totalWithdrawals.add(amount);
					break;
				case "INTEREST_CREDIT":
					totalInterestEarned = totalInterestEarned.add(amount);
					break;
				case "FEE_DEBIT":
					totalFees = totalFees.add(amount);
					break;
			}
		});

		// Get the last transaction date
		let lastTransactionDate = null;
		if (currentMonthTransactions.length > 0) {
			lastTransactionDate = currentMonthTransactions[0].transactionDate;
		}

		const summary = {
			totalDeposits: Number(totalDeposits.toFixed(2)),
			totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
			totalInterestEarned: Number(totalInterestEarned.toFixed(2)),
			totalFees: Number(totalFees.toFixed(2)),
			transactionCount: currentMonthTransactions.length,
			lastTransactionDate,
		};

		return res.status(200).json({
			success: true,
			message: "Transaction summary retrieved successfully",
			data: {
				summary,
				period: {
					startDate: startOfMonth,
					endDate: endOfMonth,
				},
			},
		});
	} catch (error) {
		console.error("Error getting transaction summary:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
};

export default {
	createTransaction,
	getTransactionsByAccount,
	getTransactionById,
	cancelTransaction,
	getTransactionSummary,
	getAllTransactions,
	getAllTransactionsSummary,
};
