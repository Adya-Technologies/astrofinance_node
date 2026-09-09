import { Request, Response } from "express";
import { PrismaClient, AuditAction, Prisma } from "@prisma/client";
import { ApiError } from "../../../common/middleware/error.middleware";
import logger from "../../../config/logger";
import { createAuditLog } from "../../../common/utils/audit.util";
import { generateAccountNumber } from "../utils/account.utils";
import { calculateInterest, applyInterest } from "../utils/transaction.utils";

const prisma = new PrismaClient();

/**
 * Get all accounts for a user
 */
export const getUserAccounts = async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;
		const { accountType, status, page = 1, limit = 10 } = req.query;

		// Validate user exists
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new ApiError(404, `User with ID ${userId} not found`);
		}

		// Build filter conditions
		const where: any = { userId };

		if (accountType) {
			where.accountType = accountType;
		}

		if (status) {
			where.status = status;
		}

		// Calculate pagination
		const skip = (Number(page) - 1) * Number(limit);

		// Get accounts with pagination
		const [accounts, totalCount] = await Promise.all([
			prisma.userAccount.findMany({
				where,
				include: {
					bbAccountDetails: true,
					mbAccountDetails: true,
				},
				skip,
				take: Number(limit),
				orderBy: { createdAt: "desc" },
			}),
			prisma.userAccount.count({ where }),
		]);

		// Calculate pagination metadata
		const totalPages = Math.ceil(totalCount / Number(limit));

		return res.status(200).json({
			data: accounts,
			meta: {
				page: Number(page),
				limit: Number(limit),
				totalCount,
				totalPages,
			},
		});
	} catch (error) {
		logger.error(`Get user accounts error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to fetch user accounts");
	}
};

/**
 * Get account by ID
 */
export const getAccountById = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		const account = await prisma.userAccount.findUnique({
			where: { id },
			include: {
				bbAccountDetails: true,
				mbAccountDetails: true,
				user: {
					select: {
						id: true,
						fullName: true,
						contactNumber: true,
						email: true,
						userType: true,
					},
				},
			},
		});

		if (!account) {
			throw new ApiError(404, `Account with ID ${id} not found`);
		}

		return res.status(200).json(account);
	} catch (error) {
		logger.error(`Get account by ID error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to fetch account details");
	}
};

/**
 * Create new account
 */
export const createAccount = async (req: Request, res: Response) => {
	try {
		const {
			userId,
			accountType,
			interestRate,
			openingDate = new Date(),
			balance = 0,
			bbAccountDetails,
			mbAccountDetails,
		} = req.body;

		// Validate user exists
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new ApiError(404, `User with ID ${userId} not found`);
		}

		// Validate account type exists (by ID or Code)
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountType);

		const accountTypeConfig = await prisma.accountTypeConfig.findUnique({
			where: isUuid ? { id: accountType } : { code: accountType },
		});

		if (!accountTypeConfig) {
			throw new ApiError(400, "Invalid account type selected");
		}

		// Generate account number
		const accountNumber = await generateAccountNumber(accountTypeConfig.code);

		// Ensure unique account number
		let finalAccountNumber = accountNumber;
		let isUnique = false;
		let counter = 0;

		while (!isUnique) {
			const existingAccount = await prisma.userAccount.findUnique({
				where: { accountNumber: finalAccountNumber },
			});

			if (!existingAccount) {
				isUnique = true;
			} else {
				counter++;
				finalAccountNumber = `${accountNumber}${counter}`;
			}
		}

		// Create account with transaction to ensure all related data is created atomically
		const account = await prisma.$transaction(async (prisma) => {
			// Create the main account
			const newAccount = await prisma.userAccount.create({
				data: {
					accountNumber: finalAccountNumber,
					userId,
					accountType: accountTypeConfig.code, // Legacy string field
					accountTypeConfigId: accountTypeConfig.id, // Relation field
					interestRate: parseFloat(interestRate),
					balance: parseFloat(balance),
					openingDate: new Date(openingDate),
					status: "ACTIVE",
				},
			});

			// Create BB account details if provided
			if (
				accountType === "BB" &&
				bbAccountDetails &&
				bbAccountDetails.guardianName &&
				bbAccountDetails.guardianRelation
			) {
				try {
					logger.info(
						`Attempting to create BB account details for account ${newAccount.id} with data: ${JSON.stringify(
							{
								guardianName: bbAccountDetails.guardianName,
								guardianRelation: bbAccountDetails.guardianRelation,
								guardianContact: bbAccountDetails.guardianContact || "",
								guardianIdType:
									bbAccountDetails.guardianIdType || "NATIONAL_ID",
								guardianIdNumber: bbAccountDetails.guardianIdNumber || "",
							},
						)}`,
					);

					const bbDetails = await prisma.bbAccountDetails.create({
						data: {
							accountId: newAccount.id,
							guardianName: bbAccountDetails.guardianName,
							guardianRelation: bbAccountDetails.guardianRelation,
							guardianContact: bbAccountDetails.guardianContact || "",
							guardianIdType: bbAccountDetails.guardianIdType || "NATIONAL_ID",
							guardianIdNumber: bbAccountDetails.guardianIdNumber || "",
							maturityDate: bbAccountDetails.maturityDate
								? new Date(bbAccountDetails.maturityDate)
								: null,
						},
					});

					logger.info(
						`Successfully created BB account details for account ${newAccount.id}`,
					);
				} catch (error: any) {
					logger.error(`Error creating BB account details: ${error}`);
					throw new Error(
						`Failed to create BB account details: ${error.message || "Unknown error"}`,
					);
				}
			}

			// Create FD account details if provided
			if (
				accountType === "FD" &&
				mbAccountDetails &&
				mbAccountDetails.monthlyDepositAmount &&
				mbAccountDetails.termMonths
			) {
				try {
					// Calculate maturity date if not provided
					let maturityDate: Date;
					if (mbAccountDetails.maturityDate) {
						maturityDate = new Date(mbAccountDetails.maturityDate);
					} else {
						maturityDate = new Date(openingDate);
						const termMonths =
							typeof mbAccountDetails.termMonths === "string"
								? parseInt(mbAccountDetails.termMonths)
								: mbAccountDetails.termMonths;
						maturityDate.setMonth(maturityDate.getMonth() + termMonths);
					}

					const monthlyAmount =
						typeof mbAccountDetails.monthlyDepositAmount === "string"
							? parseFloat(mbAccountDetails.monthlyDepositAmount)
							: mbAccountDetails.monthlyDepositAmount;

					const depositDayValue =
						typeof mbAccountDetails.depositDay === "string"
							? parseInt(mbAccountDetails.depositDay)
							: mbAccountDetails.depositDay || 1;

					const termMonthsValue =
						typeof mbAccountDetails.termMonths === "string"
							? parseInt(mbAccountDetails.termMonths)
							: mbAccountDetails.termMonths;

					logger.info(
						`Attempting to create MB account details for account ${newAccount.id} with data: ${JSON.stringify(
							{
								monthlyDepositAmount: monthlyAmount,
								depositDay: depositDayValue,
								termMonths: termMonthsValue,
								maturityDate: maturityDate.toISOString(),
							},
						)}`,
					);

					const mbDetails = await prisma.mbAccountDetails.create({
						data: {
							accountId: newAccount.id,
							monthlyDepositAmount: monthlyAmount,
							depositDay: depositDayValue,
							termMonths: termMonthsValue,
							missedDeposits: 0,
							maturityDate: maturityDate,
						},
					});

					logger.info(
						`Successfully created MB account details for account ${newAccount.id}`,
					);
				} catch (error: any) {
					logger.error(`Error creating MB account details: ${error}`);
					throw new Error(
						`Failed to create MB account details: ${error.message || "Unknown error"}`,
					);
				}
			}

			return prisma.userAccount.findUnique({
				where: { id: newAccount.id },
				include: {
					bbAccountDetails: true,
					mbAccountDetails: true,
				},
			});
		});

		// Create audit log
		if (account) {
			await createAuditLog(
				req,
				"Account",
				account.id,
				AuditAction.CREATE,
				null,
				account,
			);
		}

		return res.status(201).json(account);
	} catch (error: any) {
		logger.error(`Create account error: ${error}`);

		// Log detailed error information
		if (error.code) {
			logger.error(`Prisma error code: ${error.code}`);
		}

		if (error.meta) {
			logger.error(`Error metadata: ${JSON.stringify(error.meta)}`);
		}

		if (error instanceof ApiError) {
			return res.status(error.statusCode).json({ message: error.message });
		}

		return res.status(500).json({
			message: "Failed to create account",
			details: error.message || "Unknown error",
		});
	}
};

/**
 * Update account
 */
export const updateAccount = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Log the entire request body for debugging
		logger.info(`Update account request body: ${JSON.stringify(req.body)}`);

		const { interestRate, status, bbAccountDetails, mbAccountDetails } =
			req.body;

		// Log the extracted values
		logger.info(
			`Extracted values - interestRate: ${interestRate}, status: ${status}`,
		);
		logger.info(`BB Account Details: ${JSON.stringify(bbAccountDetails)}`);
		logger.info(`MB Account Details: ${JSON.stringify(mbAccountDetails)}`);

		// Check if account exists
		const existingAccount = await prisma.userAccount.findUnique({
			where: { id },
			include: {
				bbAccountDetails: true,
				mbAccountDetails: true,
			},
		});

		// Log the existing account details
		logger.info(`Existing account: ${JSON.stringify(existingAccount)}`);
		logger.info(
			`Existing BB account details: ${JSON.stringify(existingAccount?.bbAccountDetails)}`,
		);
		logger.info(
			`Existing MB account details: ${JSON.stringify(existingAccount?.mbAccountDetails)}`,
		);

		if (!existingAccount) {
			throw new ApiError(404, `Account with ID ${id} not found`);
		}

		// Update account with transaction to ensure all related data is updated atomically
		const updatedAccount = await prisma.$transaction(async (prisma) => {
			// Update main account
			const accountData: any = {};

			if (interestRate !== undefined) {
				accountData.interestRate = parseFloat(interestRate);
			}

			if (status !== undefined) {
				accountData.status = status;
			}

			// Only update if there are changes
			if (Object.keys(accountData).length > 0) {
				await prisma.userAccount.update({
					where: { id },
					data: accountData,
				});
			}

			// Handle BB account details if provided
			if (bbAccountDetails) {
				try {
					logger.info(
						`Processing BB account details for account ${id}: ${JSON.stringify(bbAccountDetails)}`,
					);

					if (existingAccount.bbAccountDetails) {
						// Update existing BB account details
						logger.info(
							`Updating existing BB account details for account ${id}`,
						);

						const bbData: any = {};

						if (bbAccountDetails.guardianName !== undefined) {
							bbData.guardianName = bbAccountDetails.guardianName;
						}

						if (bbAccountDetails.guardianRelation !== undefined) {
							bbData.guardianRelation = bbAccountDetails.guardianRelation;
						}

						if (bbAccountDetails.guardianContact !== undefined) {
							bbData.guardianContact = bbAccountDetails.guardianContact;
						}

						if (bbAccountDetails.guardianIdType !== undefined) {
							bbData.guardianIdType = bbAccountDetails.guardianIdType;
						}

						if (bbAccountDetails.guardianIdNumber !== undefined) {
							bbData.guardianIdNumber = bbAccountDetails.guardianIdNumber;
						}

						if (bbAccountDetails.maturityDate !== undefined) {
							bbData.maturityDate = bbAccountDetails.maturityDate
								? new Date(bbAccountDetails.maturityDate)
								: null;
						}

						// Only update if there are changes
						if (Object.keys(bbData).length > 0) {
							const updatedBbDetails = await prisma.bbAccountDetails.update({
								where: { accountId: id },
								data: bbData,
							});

							logger.info(
								`Successfully updated BB account details: ${JSON.stringify(updatedBbDetails)}`,
							);
						}
					} else if (
						existingAccount.accountType === "BB" ||
						existingAccount.accountType === "SB"
					) {
						// Check if we have the required fields
						logger.info(
							`Checking if we can create BB account details - guardianName: ${bbAccountDetails.guardianName}, guardianRelation: ${bbAccountDetails.guardianRelation}`,
						);

						if (
							bbAccountDetails.guardianName &&
							bbAccountDetails.guardianRelation
						) {
							// Create new BB account details if they don't exist
							logger.info(`Creating new BB account details for account ${id}`);

							try {
								const bbData = {
									accountId: id,
									guardianName: bbAccountDetails.guardianName,
									guardianRelation: bbAccountDetails.guardianRelation,
									guardianContact: bbAccountDetails.guardianContact || "",
									guardianIdType:
										bbAccountDetails.guardianIdType || "NATIONAL_ID",
									guardianIdNumber: bbAccountDetails.guardianIdNumber || "",
									maturityDate: bbAccountDetails.maturityDate
										? new Date(bbAccountDetails.maturityDate)
										: null,
								};

								logger.info(
									`BB account data to be created: ${JSON.stringify(bbData)}`,
								);

								const newBbDetails = await prisma.bbAccountDetails.create({
									data: bbData,
								});

								logger.info(
									`Successfully created BB account details: ${JSON.stringify(newBbDetails)}`,
								);
							} catch (createError: any) {
								logger.error(
									`Error creating BB account details: ${createError}`,
								);
								logger.error(`Error details: ${createError.message}`);
								if (createError.code) {
									logger.error(`Prisma error code: ${createError.code}`);
								}
								if (createError.meta) {
									logger.error(
										`Error metadata: ${JSON.stringify(createError.meta)}`,
									);
								}
								throw createError;
							}
						} else {
							logger.warn(
								`Cannot create BB account details - missing required fields. guardianName: ${bbAccountDetails.guardianName}, guardianRelation: ${bbAccountDetails.guardianRelation}`,
							);
						}
					}
				} catch (error: any) {
					logger.error(`Error processing BB account details: ${error}`);
					throw new Error(
						`Failed to process BB account details: ${error.message || "Unknown error"}`,
					);
				}
			}

			// Handle MB account details if provided
			if (mbAccountDetails) {
				try {
					logger.info(
						`Processing MB account details for account ${id}: ${JSON.stringify(mbAccountDetails)}`,
					);

					if (existingAccount.mbAccountDetails) {
						// Update existing MB account details
						logger.info(
							`Updating existing MB account details for account ${id}`,
						);

						const mbData: any = {};

						if (mbAccountDetails.monthlyDepositAmount !== undefined) {
							mbData.monthlyDepositAmount =
								typeof mbAccountDetails.monthlyDepositAmount === "string"
									? parseFloat(mbAccountDetails.monthlyDepositAmount)
									: mbAccountDetails.monthlyDepositAmount;
						}

						if (mbAccountDetails.depositDay !== undefined) {
							mbData.depositDay =
								typeof mbAccountDetails.depositDay === "string"
									? parseInt(mbAccountDetails.depositDay)
									: mbAccountDetails.depositDay;
						}

						if (mbAccountDetails.termMonths !== undefined) {
							mbData.termMonths =
								typeof mbAccountDetails.termMonths === "string"
									? parseInt(mbAccountDetails.termMonths)
									: mbAccountDetails.termMonths;
						}

						if (mbAccountDetails.maturityDate !== undefined) {
							mbData.maturityDate = new Date(mbAccountDetails.maturityDate);
						}

						// Only update if there are changes
						if (Object.keys(mbData).length > 0) {
							const updatedMbDetails = await prisma.mbAccountDetails.update({
								where: { accountId: id },
								data: mbData,
							});

							logger.info(
								`Successfully updated MB account details: ${JSON.stringify(updatedMbDetails)}`,
							);
						}
					} else if (
						existingAccount.accountType === "FD" &&
						mbAccountDetails.monthlyDepositAmount &&
						mbAccountDetails.termMonths
					) {
						// Create new MB account details if they don't exist
						logger.info(`Creating new MB account details for account ${id}`);

						// Calculate maturity date if not provided
						let maturityDate: Date;
						if (mbAccountDetails.maturityDate) {
							maturityDate = new Date(mbAccountDetails.maturityDate);
						} else {
							maturityDate = new Date();
							const termMonths =
								typeof mbAccountDetails.termMonths === "string"
									? parseInt(mbAccountDetails.termMonths)
									: mbAccountDetails.termMonths;
							maturityDate.setMonth(maturityDate.getMonth() + termMonths);
						}

						const monthlyAmount =
							typeof mbAccountDetails.monthlyDepositAmount === "string"
								? parseFloat(mbAccountDetails.monthlyDepositAmount)
								: mbAccountDetails.monthlyDepositAmount;

						const depositDayValue =
							typeof mbAccountDetails.depositDay === "string"
								? parseInt(mbAccountDetails.depositDay)
								: mbAccountDetails.depositDay || 1;

						const termMonthsValue =
							typeof mbAccountDetails.termMonths === "string"
								? parseInt(mbAccountDetails.termMonths)
								: mbAccountDetails.termMonths;

						const newMbDetails = await prisma.mbAccountDetails.create({
							data: {
								accountId: id,
								monthlyDepositAmount: monthlyAmount,
								depositDay: depositDayValue,
								termMonths: termMonthsValue,
								missedDeposits: 0,
								maturityDate: maturityDate,
							},
						});

						logger.info(
							`Successfully created MB account details: ${JSON.stringify(newMbDetails)}`,
						);
					}
				} catch (error: any) {
					logger.error(`Error processing MB account details: ${error}`);
					throw new Error(
						`Failed to process MB account details: ${error.message || "Unknown error"}`,
					);
				}
			}

			return prisma.userAccount.findUnique({
				where: { id },
				include: {
					bbAccountDetails: true,
					mbAccountDetails: true,
				},
			});
		});

		// Create audit log
		await createAuditLog(
			req,
			"Account",
			id,
			AuditAction.UPDATE,
			existingAccount,
			updatedAccount,
		);

		// Get the latest account data to ensure we return the most up-to-date information
		const finalAccount = await prisma.userAccount.findUnique({
			where: { id },
			include: {
				bbAccountDetails: true,
				mbAccountDetails: true,
			},
		});

		logger.info(
			`Final account data being returned: ${JSON.stringify(finalAccount)}`,
		);

		return res.status(200).json(finalAccount || updatedAccount);
	} catch (error: any) {
		logger.error(`Update account error: ${error}`);

		// Log detailed error information
		if (error.code) {
			logger.error(`Prisma error code: ${error.code}`);
		}

		if (error.meta) {
			logger.error(`Error metadata: ${JSON.stringify(error.meta)}`);
		}

		if (error instanceof ApiError) {
			return res.status(error.statusCode).json({ message: error.message });
		}

		return res.status(500).json({
			message: "Failed to update account",
			details: error.message || "Unknown error",
		});
	}
};

/**
 * Close account
 */
export const closeAccount = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { closureReason } = req.body;

		// Check if account exists
		const existingAccount = await prisma.userAccount.findUnique({
			where: { id },
		});

		if (!existingAccount) {
			throw new ApiError(404, `Account with ID ${id} not found`);
		}

		// Validate account can be closed (e.g., zero balance for savings)
		if (
			(existingAccount.accountType === "SB" ||
				existingAccount.accountType === "BB" ||
				existingAccount.accountType === "FD") &&
			Number(existingAccount.balance) > 0
		) {
			throw new ApiError(400, "Cannot close account with positive balance");
		}

		// Update account status to CLOSED
		const updatedAccount = await prisma.userAccount.update({
			where: { id },
			data: {
				status: "CLOSED",
				updatedAt: new Date(),
			},
			include: {
				bbAccountDetails: true,
				mbAccountDetails: true,
			},
		});

		// Create audit log
		await createAuditLog(
			req,
			"Account",
			id,
			AuditAction.UPDATE,
			existingAccount,
			updatedAccount,
			{ closureReason },
		);

		return res.status(200).json(updatedAccount);
	} catch (error) {
		logger.error(`Close account error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to close account");
	}
};

/**
 * Get all accounts (admin function)
 */
export const getAllAccounts = async (req: Request, res: Response) => {
	try {
		const {
			search,
			accountType,
			status,
			userType,
			page = 1,
			limit = 10,
		} = req.query;

		// Build filter conditions
		const where: any = {};

		if (search) {
			where.OR = [
				{ accountNumber: { contains: search as string, mode: "insensitive" } },
				{
					user: {
						fullName: { contains: search as string, mode: "insensitive" },
					},
				},
				{
					user: {
						contactNumber: { contains: search as string, mode: "insensitive" },
					},
				},
			];
		}

		if (accountType) {
			where.accountType = accountType;
		}

		if (status) {
			where.status = status;
		}

		if (userType) {
			where.user = { userType };
		}

		// Calculate pagination
		const skip = (Number(page) - 1) * Number(limit);

		// Get accounts with pagination
		const [accounts, totalCount] = await Promise.all([
			prisma.userAccount.findMany({
				where,
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							contactNumber: true,
							email: true,
							userType: true,
						},
					},
					bbAccountDetails: true,
					mbAccountDetails: true,
				},
				skip,
				take: Number(limit),
				orderBy: { createdAt: "desc" },
			}),
			prisma.userAccount.count({ where }),
		]);

		// Calculate pagination metadata
		const totalPages = Math.ceil(totalCount / Number(limit));

		return res.status(200).json({
			data: accounts,
			meta: {
				page: Number(page),
				limit: Number(limit),
				totalCount,
				totalPages,
			},
		});
	} catch (error) {
		logger.error(`Get all accounts error: ${error}`);
		if (error instanceof ApiError) throw error;
		throw new ApiError(500, "Failed to fetch accounts");
	}
};
