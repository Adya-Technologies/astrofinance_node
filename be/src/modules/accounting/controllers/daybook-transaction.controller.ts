import { Request, Response } from "express";
import {
	AuditAction,
	DayBookTransactionType,
	PaymentMethod,
	JournalEntryStatus,
} from "@prisma/client";
import prisma from "../../../config/database";
import logger from "../../../config/logger";
import { createAuditLog } from "../../../common/utils/audit.util";
import { ApiError } from "../../../common/middleware/error.middleware";
import { generateJournalEntryNumber } from "../utils/accounting.utils";
import { prepareForJournalEntry } from "../../../common/utils/currency.util";

/**
 * Daybook transaction types to account mappings
 * This defines which accounts should be debited/credited for each transaction type
 */
const TRANSACTION_ACCOUNT_MAPPING = {
	CASH_RECEIPT: {
		debitAccount: "CASH", // Cash account
		creditAccount: "INCOME", // Income account (to be specified)
	},
	CASH_PAYMENT: {
		debitAccount: "EXPENSE", // Expense account (to be specified)
		creditAccount: "CASH", // Cash account
	},
	BANK_DEPOSIT: {
		debitAccount: "BANK", // Bank account
		creditAccount: "CASH", // Cash account
	},
	BANK_WITHDRAWAL: {
		debitAccount: "CASH", // Cash account
		creditAccount: "BANK", // Bank account
	},
	INTERNAL_TRANSFER: {
		debitAccount: "CASH", // Cash account (or destination account)
		creditAccount: "CASH", // Cash account (or source account)
	},
	LOAN_DISBURSEMENT: {
		debitAccount: "CASH", // Cash account
		creditAccount: "LOANS_PAYABLE", // Loans payable
	},
	LOAN_PAYMENT: {
		debitAccount: "LOANS_PAYABLE", // Loans payable
		creditAccount: "CASH", // Cash account
	},
	INTEREST_RECEIVED: {
		debitAccount: "CASH", // Cash account
		creditAccount: "INTEREST_INCOME", // Interest income
	},
	INTEREST_PAID: {
		debitAccount: "INTEREST_EXPENSE", // Interest expense
		creditAccount: "CASH", // Cash account
	},
	FEE_RECEIVED: {
		debitAccount: "CASH", // Cash account
		creditAccount: "FEE_INCOME", // Fee income
	},
	FEE_PAID: {
		debitAccount: "FEE_EXPENSE", // Fee expense
		creditAccount: "CASH", // Cash account
	},
	OTHER_INCOME: {
		debitAccount: "CASH", // Cash account
		creditAccount: "OTHER_INCOME", // Other income
	},
	OTHER_EXPENSE: {
		debitAccount: "OTHER_EXPENSE", // Other expense
		creditAccount: "CASH", // Cash account
	},
};

/**
 * Generate unique transaction number
 */
export const generateTransactionNumber = async (): Promise<string> => {
	const today = new Date();
	const year = today.getFullYear().toString().slice(-2);
	const month = (today.getMonth() + 1).toString().padStart(2, "0");
	const day = today.getDate().toString().padStart(2, "0");
	const prefix = `DBT${year}${month}${day}`;

	const transactionsCount = await prisma.dayBookTransaction.count({
		where: {
			transactionNumber: {
				startsWith: prefix,
			},
		},
	});

	const sequentialNumber = (transactionsCount + 1).toString().padStart(4, "0");
	return `${prefix}-${sequentialNumber}`;
};

/**
 * Generate unique daybook number
 */
export const generateDayBookNumber = async (): Promise<string> => {
	const today = new Date();
	const year = today.getFullYear().toString();
	const month = (today.getMonth() + 1).toString().padStart(2, "0");
	const day = today.getDate().toString().padStart(2, "0");
	const prefix = `DB${year}${month}${day}`;

	const dayBooksCount = await prisma.dayBook.count({
		where: {
			bookNumber: {
				startsWith: prefix,
			},
		},
	});

	const sequentialNumber = (dayBooksCount + 1).toString().padStart(2, "0");
	return `${prefix}-${sequentialNumber}`;
};

/**
 * Get default account ID by account code or type
 */
export const getDefaultAccountId = async (
	accountCode: string,
): Promise<string | null> => {
	const account = await prisma.account_COA.findFirst({
		where: {
			OR: [
				{ accountCode: accountCode },
				{ name: { contains: accountCode, mode: "insensitive" } },
			],
			isActive: true,
		},
	});

	return account?.id || null;
};

/**
 * Create automatic journal entry for daybook transaction
 */
export const createJournalEntryForTransaction = async (
	transaction: any,
	debitAccountId: string,
	creditAccountId: string,
	adminUserId: string,
	journalAmount: number,
): Promise<string> => {
	const entryNumber = await generateJournalEntryNumber();

	const journalEntry = await prisma.journalEntry.create({
		data: {
			entryNumber,
			entryDate: new Date(),
			narration: `${transaction.transactionType}: ${transaction.description}`,
			reference: transaction.referenceNumber || transaction.transactionNumber,
			status: JournalEntryStatus.POSTED,
			dayBookId: transaction.dayBookId,
			createdById: adminUserId,
			approvedById: adminUserId,
			journalEntryLines: {
				create: [
					{
						accountId: debitAccountId,
						debitAmount: journalAmount,
						creditAmount: 0,
						description: `${transaction.transactionType} - Debit`,
					},
					{
						accountId: creditAccountId,
						debitAmount: 0,
						creditAmount: journalAmount,
						description: `${transaction.transactionType} - Credit`,
					},
				],
			},
		},
		include: {
			journalEntryLines: true,
		},
	});

	return journalEntry.id;
};

/**
 * Add transaction to daybook
 */
export const addTransactionToDayBook = async (req: Request, res: Response) => {
	try {
		const { dayBookId } = req.params;
		const {
			transactionType,
			amount,
			description,
			referenceNumber,
			counterparty,
			paymentMethod = PaymentMethod.CASH,
			debitAccountId,
			creditAccountId,
		} = req.body;

		const adminUserId = req.staff?.id;

		// Check if daybook exists and is not closed
		const dayBook = await prisma.dayBook.findUnique({
			where: { id: dayBookId },
			include: { transactions: true },
		});

		if (!dayBook) {
			throw new ApiError(404, "Daybook not found");
		}

		if (dayBook.isClosed) {
			throw new ApiError(400, "Cannot add transactions to a closed daybook");
		}

		// Generate transaction number
		const transactionNumber = await generateTransactionNumber();

		// Get default accounts if not provided
		let finalDebitAccountId = debitAccountId;
		let finalCreditAccountId = creditAccountId;

		if (!finalDebitAccountId || !finalCreditAccountId) {
			const mapping =
				TRANSACTION_ACCOUNT_MAPPING[transactionType as DayBookTransactionType];
			if (!mapping) {
				throw new ApiError(400, "Invalid transaction type");
			}

			if (!finalDebitAccountId) {
				finalDebitAccountId = await getDefaultAccountId(mapping.debitAccount);
				if (!finalDebitAccountId) {
					throw new ApiError(
						400,
						`Default debit account not found for ${mapping.debitAccount}`,
					);
				}
			}

			if (!finalCreditAccountId) {
				finalCreditAccountId = await getDefaultAccountId(mapping.creditAccount);
				if (!finalCreditAccountId) {
					throw new ApiError(
						400,
						`Default credit account not found for ${mapping.creditAccount}`,
					);
				}
			}
		}

		// Validate accounts exist
		const [debitAccount, creditAccount] = await Promise.all([
			prisma.account_COA.findUnique({ where: { id: finalDebitAccountId } }),
			prisma.account_COA.findUnique({ where: { id: finalCreditAccountId } }),
		]);

		if (!debitAccount || !creditAccount) {
			throw new ApiError(400, "One or more specified accounts not found");
		}

		if (!debitAccount.isActive || !creditAccount.isActive) {
			throw new ApiError(400, "One or more specified accounts are inactive");
		}

		// Convert amount for journal entry (amount is already in rupees)
		const journalAmount = prepareForJournalEntry(amount, false);

		// Create transaction and journal entry in a database transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create daybook transaction
			const transaction = await tx.dayBookTransaction.create({
				data: {
					dayBookId,
					transactionNumber,
					transactionType: transactionType as DayBookTransactionType,
					amount: parseFloat(amount),
					description,
					referenceNumber,
					counterparty,
					paymentMethod: paymentMethod as PaymentMethod,
					createdById: adminUserId,
				},
			});

			// Create automatic journal entry
			const journalEntryId = await createJournalEntryForTransaction(
				{ ...transaction, dayBookId },
				finalDebitAccountId,
				finalCreditAccountId,
				adminUserId,
				journalAmount,
			);

			// Update transaction with journal entry reference
			const updatedTransaction = await tx.dayBookTransaction.update({
				where: { id: transaction.id },
				data: { journalEntryId },
			});

			// Update daybook closing balance
			let balanceChange = 0;
			if (
				transaction.transactionType === DayBookTransactionType.CASH_RECEIPT ||
				transaction.transactionType === DayBookTransactionType.BANK_WITHDRAWAL ||
				transaction.transactionType === DayBookTransactionType.LOAN_DISBURSEMENT ||
				transaction.transactionType === DayBookTransactionType.INTEREST_RECEIVED ||
				transaction.transactionType === DayBookTransactionType.FEE_RECEIVED ||
				transaction.transactionType === DayBookTransactionType.OTHER_INCOME
			) {
				balanceChange = journalAmount;
			} else {
				balanceChange = -journalAmount;
			}

			const updatedDayBook = await tx.dayBook.update({
				where: { id: dayBookId },
				data: {
					closingBalance: {
						increment: balanceChange,
					},
					systemCashBalance: {
						increment: balanceChange,
					},
				},
			});

			return { transaction: updatedTransaction, dayBook: updatedDayBook };
		});

		// Create audit log
		await createAuditLog(
			req,
			"DayBookTransaction",
			result.transaction.id,
			AuditAction.CREATE,
			null,
			result.transaction,
		);

		// Get complete transaction data
		const completeTransaction = await prisma.dayBookTransaction.findUnique({
			where: { id: result.transaction.id },
			include: {
				journalEntry: {
					include: {
						journalEntryLines: {
							include: {
								account: true,
							},
						},
					},
				},
				createdBy: {
					select: {
						id: true,
						username: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		return res.status(201).json({
			success: true,
			message: "Transaction added to daybook successfully",
			data: completeTransaction,
		});
	} catch (error) {
		logger.error(`Add transaction to daybook error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to add transaction to daybook");
	}
};

/**
 * Get daybook transactions
 */
export const getDayBookTransactions = async (req: Request, res: Response) => {
	try {
		const { dayBookId } = req.params;
		const {
			transactionType,
			startDate,
			endDate,
			page = "1",
			limit = "10",
		} = req.query;

		// Parse pagination parameters
		const pageNumber = parseInt(page as string, 10);
		const limitNumber = parseInt(limit as string, 10);
		const skip = (pageNumber - 1) * limitNumber;

		// Build filter conditions
		const where: any = { dayBookId };

		if (transactionType) {
			where.transactionType = transactionType;
		}

		if (startDate && endDate) {
			where.createdAt = {
				gte: new Date(startDate as string),
				lte: new Date(endDate as string),
			};
		}

		// Get total count
		const totalCount = await prisma.dayBookTransaction.count({ where });

		// Get transactions
		const transactions = await prisma.dayBookTransaction.findMany({
			where,
			include: {
				journalEntry: {
					include: {
						journalEntryLines: {
							include: {
								account: true,
							},
						},
					},
				},
				createdBy: {
					select: {
						id: true,
						username: true,
						firstName: true, lastName: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
			skip,
			take: limitNumber,
		});

		return res.status(200).json({
			success: true,
			message: "Daybook transactions retrieved successfully",
			data: transactions,
			pagination: {
				total: totalCount,
				page: pageNumber,
				limit: limitNumber,
				pages: Math.ceil(totalCount / limitNumber),
			},
		});
	} catch (error) {
		logger.error(`Get daybook transactions error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to retrieve daybook transactions");
	}
};

/**
 * Delete daybook transaction
 */
export const deleteDayBookTransaction = async (req: Request, res: Response) => {
	try {
		const { transactionId } = req.params;

		// Get transaction
		const transaction = await prisma.dayBookTransaction.findUnique({
			where: { id: transactionId },
			include: {
				dayBook: true,
				journalEntry: true,
			},
		});

		if (!transaction) {
			throw new ApiError(404, "Transaction not found");
		}

		// Check if daybook is closed
		if (transaction.dayBook.isClosed) {
			throw new ApiError(
				400,
				"Cannot delete transactions from a closed daybook",
			);
		}

		// Delete transaction and related journal entry in a database transaction
		await prisma.$transaction(async (tx) => {
			// Delete journal entry lines first
			if (transaction.journalEntryId) {
				await tx.journalEntryLine.deleteMany({
					where: { journalEntryId: transaction.journalEntryId },
				});

				// Delete journal entry
				await tx.journalEntry.delete({
					where: { id: transaction.journalEntryId },
				});
			}

			// Delete transaction
			await tx.dayBookTransaction.delete({
				where: { id: transactionId },
			});

			// Update daybook balance
			let balanceChange = 0;
			if (
				transaction.transactionType === DayBookTransactionType.CASH_RECEIPT ||
				transaction.transactionType ===
				DayBookTransactionType.BANK_WITHDRAWAL ||
				transaction.transactionType ===
				DayBookTransactionType.LOAN_DISBURSEMENT ||
				transaction.transactionType ===
				DayBookTransactionType.INTEREST_RECEIVED ||
				transaction.transactionType === DayBookTransactionType.FEE_RECEIVED ||
				transaction.transactionType === DayBookTransactionType.OTHER_INCOME
			) {
				balanceChange = -prepareForJournalEntry(transaction.amount, false);
			} else {
				balanceChange = prepareForJournalEntry(transaction.amount, false);
			}

			await tx.dayBook.update({
				where: { id: transaction.dayBookId },
				data: {
					closingBalance: {
						increment: balanceChange,
					},
					systemCashBalance: {
						increment: balanceChange,
					},
				},
			});
		});

		// Create audit log
		await createAuditLog(
			req,
			"DayBookTransaction",
			transactionId,
			AuditAction.DELETE,
			transaction,
			null,
		);

		return res.status(200).json({
			success: true,
			message: "Transaction deleted successfully",
		});
	} catch (error) {
		logger.error(`Delete daybook transaction error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to delete transaction");
	}
};
