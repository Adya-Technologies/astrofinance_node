import { Request, Response } from 'express';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction, JournalEntryStatus } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';
import { generateJournalEntryNumber } from '../utils/accounting.utils';

/**
 * Get all journal entries
 */
export const getAllJournalEntries = async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      status,
      page = '1',
      limit = '10'
    } = req.query;

    // Parse pagination parameters
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter conditions
    const where: any = {};

    if (startDate && endDate) {
      where.entryDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    } else if (startDate) {
      where.entryDate = {
        gte: new Date(startDate as string)
      };
    } else if (endDate) {
      where.entryDate = {
        lte: new Date(endDate as string)
      };
    }

    if (status) {
      where.status = status;
    }

    // Get total count for pagination
    const totalCount = await prisma.journalEntry.count({ where });

    // Get journal entries with pagination
    const journalEntries = await prisma.journalEntry.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
            firstName: true, lastName: true
          }
        },
        journalEntryLines: true
      },
      orderBy: {
        entryDate: 'desc'
      },
      skip,
      take: limitNumber
    });

    return res.status(200).json({
      success: true,
      message: 'Journal entries retrieved successfully',
      data: journalEntries,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Get all journal entries error:', error);
    throw new ApiError(500, 'Failed to fetch journal entries');
  }
};

/**
 * Get journal entry by ID
 */
export const getJournalEntryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const journalEntry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        journalEntryLines: {
          include: {
            account: true
          }
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true, lastName: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
            firstName: true, lastName: true
          }
        }
      }
    });

    if (!journalEntry) {
      throw new ApiError(404, 'Journal entry not found');
    }

    return res.status(200).json({
      success: true,
      message: 'Journal entry retrieved successfully',
      data: journalEntry
    });
  } catch (error) {
    logger.error(`Get journal entry by ID error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch journal entry');
  }
};

/**
 * Create new journal entry
 */
export const createJournalEntry = async (req: Request, res: Response) => {
  try {
    const {
      entryDate,
      reference,
      description,
      debitEntries,
      creditEntries
    } = req.body;
    const adminUserId = req.staff?.id;

    // Validate debit and credit entries
    if (!Array.isArray(debitEntries) || debitEntries.length === 0) {
      throw new ApiError(400, 'At least one debit entry is required');
    }

    if (!Array.isArray(creditEntries) || creditEntries.length === 0) {
      throw new ApiError(400, 'At least one credit entry is required');
    }

    // Calculate total debit and credit amounts
    const totalDebit = debitEntries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    const totalCredit = creditEntries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);

    // Check if debits equal credits
    if (totalDebit !== totalCredit) {
      throw new ApiError(400, 'Total debit amount must equal total credit amount');
    }

    // Generate journal entry number
    const entryNumber = await generateJournalEntryNumber();

    // Create journal entry with entries in a transaction
    const journalEntry = await prisma.$transaction(async (tx) => {
      // Create journal entry
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          entryDate: new Date(entryDate),
          reference,
          narration: description,
          status: JournalEntryStatus.DRAFT,
          createdById: adminUserId
        }
      });

      // Create debit entries
      for (const debit of debitEntries) {
        // Check if account exists
        const account = await tx.account_COA.findUnique({
          where: { id: debit.accountId }
        });

        if (!account) {
          throw new ApiError(404, `Account with ID ${debit.accountId} not found`);
        }

        if (!account.isActive) {
          throw new ApiError(400, `Account ${account.name} is inactive`);
        }

        await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: debit.accountId,
            debitAmount: parseFloat(debit.amount),
            creditAmount: 0,
            description: debit.description
          }
        });
      }

      // Create credit entries
      for (const credit of creditEntries) {
        // Check if account exists
        const account = await tx.account_COA.findUnique({
          where: { id: credit.accountId }
        });

        if (!account) {
          throw new ApiError(404, `Account with ID ${credit.accountId} not found`);
        }

        if (!account.isActive) {
          throw new ApiError(400, `Account ${account.name} is inactive`);
        }

        await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: credit.accountId,
            debitAmount: 0,
            creditAmount: parseFloat(credit.amount),
            description: credit.description
          }
        });
      }

      return entry;
    });

    // Create audit log
    await createAuditLog(
      req,
      'JournalEntry',
      journalEntry.id,
      AuditAction.CREATE,
      null,
      {
        ...journalEntry,
        debitEntries,
        creditEntries
      }
    );

    // Get created journal entry with entries
    const createdJournalEntry = await prisma.journalEntry.findUnique({
      where: { id: journalEntry.id },
      include: {
        journalEntryLines: {
          include: {
            account: true
          }
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true, lastName: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Journal entry created successfully',
      data: createdJournalEntry
    });
  } catch (error) {
    logger.error(`Create journal entry error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create journal entry');
  }
};

/**
 * Update journal entry status
 */
export const updateJournalEntryStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const adminUserId = req.staff?.id;

    // Check if journal entry exists
    const existingJournalEntry = await prisma.journalEntry.findUnique({
      where: { id }
    });

    if (!existingJournalEntry) {
      throw new ApiError(404, 'Journal entry not found');
    }

    // Validate status transition
    const validStatuses = [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED, JournalEntryStatus.DRAFT];
    if (!validStatuses.includes(status as JournalEntryStatus)) {
      throw new ApiError(400, 'Invalid status');
    }

    // Validate status transition
    if (existingJournalEntry.status === JournalEntryStatus.POSTED || existingJournalEntry.status === JournalEntryStatus.REVERSED) {
      throw new ApiError(400, `Cannot change status of journal entry that is already ${existingJournalEntry.status}`);
    }

    // If rejecting, require rejection reason
    if (status === JournalEntryStatus.REVERSED && !rejectionReason) {
      throw new ApiError(400, 'Rejection reason is required');
    }

    // Update journal entry status
    const updatedJournalEntry = await prisma.journalEntry.update({
      where: { id },
      data: {
        status: status as JournalEntryStatus,
        approvedById: status === JournalEntryStatus.POSTED ? adminUserId : null
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'JournalEntry',
      updatedJournalEntry.id,
      status === JournalEntryStatus.POSTED ? AuditAction.APPROVE : AuditAction.REJECT,
      existingJournalEntry,
      updatedJournalEntry
    );

    return res.status(200).json({
      success: true,
      message: `Journal entry ${status === JournalEntryStatus.POSTED ? 'posted' : 'reversed'} successfully`,
      data: updatedJournalEntry
    });
  } catch (error) {
    logger.error(`Update journal entry status error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update journal entry status');
  }
};

/**
 * Delete journal entry
 */
export const deleteJournalEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if journal entry exists
    const existingJournalEntry = await prisma.journalEntry.findUnique({
      where: { id }
    });

    if (!existingJournalEntry) {
      throw new ApiError(404, 'Journal entry not found');
    }

    // Only pending journal entries can be deleted
    if (existingJournalEntry.status !== JournalEntryStatus.DRAFT) {
      throw new ApiError(400, `Cannot delete journal entry that is ${existingJournalEntry.status}`);
    }

    // Delete journal entry and related entries in a transaction
    await prisma.$transaction([
      prisma.journalEntryLine.deleteMany({
        where: { journalEntryId: id }
      }),
      prisma.journalEntry.delete({
        where: { id }
      })
    ]);

    // Create audit log
    await createAuditLog(
      req,
      'JournalEntry',
      id,
      AuditAction.DELETE,
      existingJournalEntry,
      null
    );

    return res.status(200).json({
      success: true,
      message: 'Journal entry deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete journal entry error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete journal entry');
  }
};