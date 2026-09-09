import { Request, Response } from 'express';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction, ExpenseCategoryType } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';

/**
 * Get all expense categories
 */
export const getAllExpenseCategories = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    // Build filter conditions
    const where: any = {};

    if (type) {
      where.type = type;
    }

    const categories = await prisma.expenseCategory.findMany({
      where,
      orderBy: {
        name: 'asc'
      }
    });

    return res.json(categories);
  } catch (error) {
    logger.error('Get all expense categories error:', error);
    throw new ApiError(500, 'Failed to fetch expense categories');
  }
};

/**
 * Get expense category by ID
 */
export const getExpenseCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.expenseCategory.findUnique({
      where: { id }
    });

    if (!category) {
      throw new ApiError(404, 'Expense category not found');
    }

    return res.json(category);
  } catch (error) {
    logger.error(`Get expense category by ID error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch expense category');
  }
};

/**
 * Create new expense category
 */
export const createExpenseCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      type,
      accountId,
      isActive = true
    } = req.body;

    // Check if category with same name already exists
    const existingCategory = await prisma.expenseCategory.findFirst({
      where: { name }
    });

    if (existingCategory) {
      throw new ApiError(409, `Expense category with name '${name}' already exists`);
    }

    // Validate expense category type
    if (!Object.values(ExpenseCategoryType).includes(type as ExpenseCategoryType)) {
      throw new ApiError(400, 'Invalid expense category type');
    }

    // Check if account exists
    if (accountId) {
      const account = await prisma.account_COA.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new ApiError(404, 'Account not found');
      }
    }

    // Create new expense category
    const category = await prisma.expenseCategory.create({
      data: {
        name,
        description,
        categoryType: type as ExpenseCategoryType,
        isActive
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'ExpenseCategory',
      category.id,
      AuditAction.CREATE,
      null,
      category
    );

    return res.status(201).json(category);
  } catch (error) {
    logger.error(`Create expense category error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create expense category');
  }
};

/**
 * Update expense category
 */
export const updateExpenseCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      accountId,
      isActive
    } = req.body;

    // Check if expense category exists
    const existingCategory = await prisma.expenseCategory.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      throw new ApiError(404, 'Expense category not found');
    }

    // Check if name is already taken by another category
    if (name && name !== existingCategory.name) {
      const nameExists = await prisma.expenseCategory.findFirst({
        where: {
          name,
          id: { not: id }
        }
      });

      if (nameExists) {
        throw new ApiError(409, `Expense category with name '${name}' already exists`);
      }
    }

    // Validate expense category type if provided
    if (type && !Object.values(ExpenseCategoryType).includes(type as ExpenseCategoryType)) {
      throw new ApiError(400, 'Invalid expense category type');
    }

    // Check if account exists if provided
    if (accountId) {
      const account = await prisma.account_COA.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new ApiError(404, 'Account not found');
      }
    }

    // Update expense category
    const updatedCategory = await prisma.expenseCategory.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description || undefined,
        categoryType: type ? (type as ExpenseCategoryType) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'ExpenseCategory',
      updatedCategory.id,
      AuditAction.UPDATE,
      existingCategory,
      updatedCategory
    );

    return res.json(updatedCategory);
  } catch (error) {
    logger.error(`Update expense category error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update expense category');
  }
};

/**
 * Delete expense category
 */
export const deleteExpenseCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if expense category exists
    const existingCategory = await prisma.expenseCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            expenses: true
          }
        }
      }
    });

    if (!existingCategory) {
      throw new ApiError(404, 'Expense category not found');
    }

    // Check if category is used in expenses
    if (existingCategory._count.expenses > 0) {
      throw new ApiError(400, 'Cannot delete expense category that is used in expenses');
    }

    // Delete expense category
    await prisma.expenseCategory.delete({
      where: { id }
    });

    // Create audit log
    await createAuditLog(
      req,
      'ExpenseCategory',
      id,
      AuditAction.DELETE,
      existingCategory,
      null
    );

    return res.json({ message: 'Expense category deleted successfully' });
  } catch (error) {
    logger.error(`Delete expense category error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete expense category');
  }
};

/**
 * Get all expenses
 */
export const getAllExpenses = async (req: Request, res: Response) => {
  try {
    const {
      category,
      startDate,
      endDate,
      page = '1',
      limit = '10'
    } = req.query;

    // Parse pagination parameters
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter conditions
    const where: any = {};

    if (category) {
      where.categoryId = category;
    }

    if (startDate || endDate) {
      where.expenseDate = {};

      if (startDate) {
        where.expenseDate.gte = new Date(startDate as string);
      }

      if (endDate) {
        where.expenseDate.lte = new Date(endDate as string);
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.expense.count({ where });

    // Get expenses with pagination
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: true
      },
      orderBy: {
        expenseDate: 'desc'
      },
      skip,
      take: limitNumber
    });

    return res.json({
      data: expenses,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Get all expenses error:', error);
    throw new ApiError(500, 'Failed to fetch expenses');
  }
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!expense) {
      throw new ApiError(404, 'Expense not found');
    }

    return res.json(expense);
  } catch (error) {
    logger.error(`Get expense by ID error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch expense');
  }
};

/**
 * Create new expense
 */
export const createExpense = async (req: Request, res: Response) => {
  try {
    const {
      categoryId,
      amount,
      description,
      expenseDate,
      reference,
      paymentMethod,
      status = 'PENDING'
    } = req.body;

    // Check if expense category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new ApiError(404, 'Expense category not found');
    }

    // Generate expense number
    const today = new Date();
    const expenseNumber = `EXP-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Calculate tax amount (assuming 0 for now)
    const taxAmount = 0;
    const amountValue = parseFloat(amount as any);
    const totalAmount = amountValue + taxAmount;

    // Create new expense
    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        categoryId,
        amount: amountValue,
        taxAmount,
        totalAmount,
        description,
        expenseDate: new Date(expenseDate),
        referenceNumber: reference,
        paymentMethod,
        status,
        createdById: req.staff?.id
      },
      include: {
        category: true
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Expense',
      expense.id,
      AuditAction.CREATE,
      null,
      expense
    );

    return res.status(201).json(expense);
  } catch (error) {
    logger.error(`Create expense error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create expense');
  }
};

/**
 * Update expense
 */
export const updateExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      amount,
      description,
      expenseDate,
      reference,
      paymentMethod
    } = req.body;

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      throw new ApiError(404, 'Expense not found');
    }

    // Check if expense is already approved
    if (existingExpense.status === 'APPROVED') {
      throw new ApiError(400, 'Cannot update approved expense');
    }

    // Check if expense category exists if provided
    if (categoryId && categoryId !== existingExpense.categoryId) {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        throw new ApiError(404, 'Expense category not found');
      }
    }

    // Update expense
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        categoryId: categoryId || undefined,
        amount: amount ? parseFloat(amount as any) : undefined,
        description: description || undefined,
        expenseDate: expenseDate ? new Date(expenseDate) : undefined,
        referenceNumber: reference || undefined,
        paymentMethod: paymentMethod || undefined
      },
      include: {
        category: true
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Expense',
      updatedExpense.id,
      AuditAction.UPDATE,
      existingExpense,
      updatedExpense
    );

    return res.json(updatedExpense);
  } catch (error) {
    logger.error(`Update expense error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update expense');
  }
};

/**
 * Approve expense
 */
export const approveExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      throw new ApiError(404, 'Expense not found');
    }

    // Check if expense is already approved
    if (existingExpense.status === 'APPROVED') {
      throw new ApiError(400, 'Expense is already approved');
    }

    // Update expense status
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        status: 'APPROVED',
        rejectionReason: notes, // Using rejectionReason field for notes
        approvedById: req.staff?.id,
        approvedAt: new Date()
      },
      include: {
        category: true
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Expense',
      updatedExpense.id,
      AuditAction.APPROVE,
      existingExpense,
      updatedExpense
    );

    return res.json(updatedExpense);
  } catch (error) {
    logger.error(`Approve expense error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to approve expense');
  }
};

/**
 * Reject expense
 */
export const rejectExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      throw new ApiError(404, 'Expense not found');
    }

    // Check if expense is already approved or rejected
    if (existingExpense.status === 'APPROVED' || existingExpense.status === 'REJECTED') {
      throw new ApiError(400, `Expense is already ${existingExpense.status.toLowerCase()}`);
    }

    // Update expense status
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: notes,
        approvedById: req.staff?.id,
        approvedAt: new Date()
      },
      include: {
        category: true
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Expense',
      updatedExpense.id,
      AuditAction.REJECT,
      existingExpense,
      updatedExpense
    );

    return res.json(updatedExpense);
  } catch (error) {
    logger.error(`Reject expense error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to reject expense');
  }
};

/**
 * Delete expense
 */
export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id }
    });

    if (!existingExpense) {
      throw new ApiError(404, 'Expense not found');
    }

    // Check if expense is already approved
    if (existingExpense.status === 'APPROVED') {
      throw new ApiError(400, 'Cannot delete approved expense');
    }

    // Delete expense
    await prisma.expense.delete({
      where: { id }
    });

    // Create audit log
    await createAuditLog(
      req,
      'Expense',
      id,
      AuditAction.DELETE,
      existingExpense,
      null
    );

    return res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    logger.error(`Delete expense error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete expense');
  }
};