import { AuditAction } from "@prisma/client";
import type { Request, Response } from "express";
import { ApiError } from "../../../common/middleware/error.middleware";
import { createAuditLog } from "../../../common/utils/audit.util";
import prisma from "../../../config/database";
import logger from "../../../config/logger";
import { generateDayBookNumber } from "./daybook-transaction.controller";

/**
 * Get all day books with pagination and filtering
 */
export const getAllDayBooks = async (req: Request, res: Response) => {
	try {
		const {
			startDate,
			endDate,
			isReconciled,
			isClosed,
			page = "1",
			limit = "10",
		} = req.query;

		// Parse pagination parameters
		const pageNumber = parseInt(page as string, 10);
		const limitNumber = parseInt(limit as string, 10);
		const skip = (pageNumber - 1) * limitNumber;

		// Build filter conditions
		const where: any = {};

		if (startDate && endDate) {
			where.transactionDate = {
				gte: new Date(startDate as string),
				lte: new Date(endDate as string),
			};
		} else if (startDate) {
			where.transactionDate = {
				gte: new Date(startDate as string),
			};
		} else if (endDate) {
			where.transactionDate = {
				lte: new Date(endDate as string),
			};
		}

		if (isReconciled !== undefined) {
			where.isReconciled = isReconciled === "true";
		}

		if (isClosed !== undefined) {
			where.isClosed = isClosed === "true";
		}

		// Get total count for pagination
		const totalCount = await prisma.dayBook.count({ where });

		// Get day books with pagination
		const dayBooks = await prisma.dayBook.findMany({
			where,
			include: {
				closedBy: {
					select: {
						id: true,
						username: true,
						firstName: true,
						lastName: true,
					},
				},
				transactions: {
					select: {
						id: true,
						transactionType: true,
						amount: true,
						description: true,
					},
				},
				_count: {
					select: {
						transactions: true,
						journalEntries: true,
					},
				},
			},
			orderBy: {
				transactionDate: "desc",
			},
			skip,
			take: limitNumber,
		});

		return res.status(200).json({
			success: true,
			message: "Day books retrieved successfully",
			data: dayBooks,
			pagination: {
				total: totalCount,
				page: pageNumber,
				limit: limitNumber,
				pages: Math.ceil(totalCount / limitNumber),
			},
		});
	} catch (error) {
		logger.error("Get all day books error:", error);
		throw new ApiError(500, "Failed to fetch day books");
	}
};

/**
 * Get day book by ID
 */
export const getDayBookById = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		const dayBook = await prisma.dayBook.findUnique({
			where: { id },
			include: {
				closedBy: {
					select: {
						id: true,
						username: true,
						firstName: true,
						lastName: true,
					},
				},
				transactions: {
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
				},
				journalEntries: {
					include: {
						journalEntryLines: {
							include: {
								account: true,
							},
						},
					},
				},
			},
		});

		if (!dayBook) {
			throw new ApiError(404, "Day book not found");
		}

		return res.status(200).json({
			success: true,
			message: "Day book retrieved successfully",
			data: dayBook,
		});
	} catch (error) {
		logger.error(`Get day book by ID error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to fetch day book");
	}
};

/**
 * Create new day book
 */
export const createDayBook = async (req: Request, res: Response) => {
	try {
		const { transactionDate, openingBalance } = req.body;

		// Check if a day book already exists for this date
		const existingDayBook = await prisma.dayBook.findFirst({
			where: {
				transactionDate: new Date(transactionDate),
			},
		});

		if (existingDayBook) {
			throw new ApiError(
				400,
				`A day book already exists for ${transactionDate}`,
			);
		}

		// Get the previous day's closing balance if openingBalance not provided
		let calculatedOpeningBalance = 0;

		logger.info(`Creating daybook: openingBalance received = "${openingBalance}" (type: ${typeof openingBalance})`);

		if (openingBalance !== undefined && openingBalance !== null && openingBalance !== "") {
			calculatedOpeningBalance = parseFloat(openingBalance);
			logger.info(`Using provided opening balance: ${calculatedOpeningBalance}`);
		} else {
			// Find the most recent closed daybook before this date
			logger.info(`Looking for previous closed daybook before ${transactionDate}`);
			const previousDayBook = await prisma.dayBook.findFirst({
				where: {
					transactionDate: {
						lt: new Date(transactionDate),
					},
					isClosed: true,
				},
				orderBy: {
					transactionDate: "desc",
				},
			});

			if (previousDayBook) {
				calculatedOpeningBalance = Number(previousDayBook.closingBalance) || 0;
				logger.info(`Auto-carrying opening balance ${calculatedOpeningBalance} from previous daybook ${previousDayBook.bookNumber}`);
			} else {
				logger.info(`No previous closed daybook found, using 0`);
			}
		}

		// Generate unique book number
		const bookNumber = await generateDayBookNumber();

		// Create day book
		const dayBook = await prisma.dayBook.create({
			data: {
				bookNumber,
				transactionDate: new Date(transactionDate),
				openingBalance: calculatedOpeningBalance,
				closingBalance: calculatedOpeningBalance,
				systemCashBalance: calculatedOpeningBalance,
				isReconciled: false,
				isClosed: false,
			},
		});

		// Create audit log
		await createAuditLog(
			req,
			"DayBook",
			dayBook.id,
			AuditAction.CREATE,
			null,
			dayBook,
		);

		return res.status(201).json({
			success: true,
			message: "Day book created successfully",
			data: dayBook,
		});
	} catch (error) {
		logger.error(`Create day book error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to create day book");
	}
};

/**
 * Reconcile day book
 */
export const reconcileDayBook = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { physicalCashBalance, discrepancyNotes, denominations } = req.body;

		// Check if day book exists
		const existingDayBook = await prisma.dayBook.findUnique({
			where: { id },
		});

		if (!existingDayBook) {
			throw new ApiError(404, "Day book not found");
		}

		// Check if day book is already closed
		if (existingDayBook.isClosed) {
			throw new ApiError(400, "Cannot reconcile a closed day book");
		}

		// Calculate discrepancy amount
		const systemCashBalance = parseFloat(
			existingDayBook.systemCashBalance.toString(),
		);
		const physicalCashValue = parseFloat(physicalCashBalance);
		const discrepancyAmount = physicalCashValue - systemCashBalance;

		// Update day book with reconciliation data
		const updatedDayBook = await prisma.dayBook.update({
			where: { id },
			data: {
				physicalCashBalance: physicalCashValue,
				discrepancyAmount,
				discrepancyNotes,
				denominations,
				isReconciled: true,
			},
		});

		// Create audit log
		await createAuditLog(
			req,
			"DayBook",
			updatedDayBook.id,
			AuditAction.UPDATE,
			existingDayBook,
			updatedDayBook,
		);

		return res.status(200).json({
			success: true,
			message: "Day book reconciled successfully",
			data: updatedDayBook,
		});
	} catch (error) {
		logger.error(`Reconcile day book error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to reconcile day book");
	}
};

/**
 * Close day book
 */
export const closeDayBook = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const adminUserId = req.staff?.id;

		// Check if day book exists
		const existingDayBook = await prisma.dayBook.findUnique({
			where: { id },
		});

		if (!existingDayBook) {
			throw new ApiError(404, "Day book not found");
		}

		// Check if day book is already closed
		if (existingDayBook.isClosed) {
			throw new ApiError(400, "Day book is already closed");
		}

		// Check if day book is reconciled
		if (!existingDayBook.isReconciled) {
			throw new ApiError(400, "Day book must be reconciled before closing");
		}

		// Update day book status
		const updatedDayBook = await prisma.dayBook.update({
			where: { id },
			data: {
				isClosed: true,
				closedById: adminUserId,
				closedAt: new Date(),
			},
		});

		// Create audit log
		await createAuditLog(
			req,
			"DayBook",
			updatedDayBook.id,
			AuditAction.UPDATE,
			existingDayBook,
			updatedDayBook,
		);

		return res.status(200).json({
			success: true,
			message: "Day book closed successfully",
			data: updatedDayBook,
		});
	} catch (error) {
		logger.error(`Close day book error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to close day book");
	}
};

/**
 * Get day book summary
 */
export const getDayBookSummary = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Check if day book exists
		const dayBook = await prisma.dayBook.findUnique({
			where: { id },
		});

		if (!dayBook) {
			throw new ApiError(404, "Day book not found");
		}

		// Get all journal entries for the day
		const journalEntries = await prisma.journalEntry.findMany({
			where: {
				entryDate: {
					gte: new Date(dayBook.transactionDate.setHours(0, 0, 0, 0)),
					lt: new Date(dayBook.transactionDate.setHours(23, 59, 59, 999)),
				},
				status: "POSTED",
			},
			include: {
				journalEntryLines: {
					include: {
						account: true,
					},
				},
			},
		});

		// Calculate summary statistics
		const totalEntries = journalEntries.length;

		// Calculate total debits and credits
		let totalDebits = 0;
		let totalCredits = 0;

		journalEntries.forEach((entry) => {
			entry.journalEntryLines.forEach((line) => {
				totalDebits += parseFloat(line.debitAmount.toString());
				totalCredits += parseFloat(line.creditAmount.toString());
			});
		});

		// Group by account type
		const accountTypeSummary: Record<
			string,
			{ debits: number; credits: number }
		> = {};

		journalEntries.forEach((entry) => {
			entry.journalEntryLines.forEach((line) => {
				const accountType = line.account.accountType;

				if (!accountTypeSummary[accountType]) {
					accountTypeSummary[accountType] = { debits: 0, credits: 0 };
				}

				accountTypeSummary[accountType].debits += parseFloat(
					line.debitAmount.toString(),
				);
				accountTypeSummary[accountType].credits += parseFloat(
					line.creditAmount.toString(),
				);
			});
		});

		return res.status(200).json({
			success: true,
			message: "Day book summary retrieved successfully",
			data: {
				dayBook: {
					id: dayBook.id,
					transactionDate: dayBook.transactionDate,
					isReconciled: dayBook.isReconciled,
					isClosed: dayBook.isClosed,
					systemCashBalance: dayBook.systemCashBalance,
					physicalCashBalance: dayBook.physicalCashBalance,
					discrepancyAmount: dayBook.discrepancyAmount,
				},
				summary: {
					totalEntries,
					totalDebits,
					totalCredits,
					accountTypeSummary,
				},
				journalEntries,
			},
		});
	} catch (error) {
		logger.error(`Get day book summary error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to get day book summary");
	}
};
