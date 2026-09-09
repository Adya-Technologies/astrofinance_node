import { Request, Response } from 'express';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';
import path from 'path';
import fs from 'fs';

/**
 * Get all documents for a loan application
 */
export const getLoanDocuments = async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;

    // Check if application exists
    const application = await prisma.loanApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    // Get documents for the application
    const documents = await prisma.loanDocument.findMany({
      where: { loanApplicationId: applicationId },
      include: {
        verifiedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        uploadDate: 'desc'
      }
    });

    return res.json(documents);
  } catch (error) {
    logger.error(`Get loan documents error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch loan documents');
  }
};

/**
 * Upload a document for a loan application
 */
export const uploadLoanDocument = async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;
    const { documentType, documentName } = req.body;
    const file = req.file;

    // Check if application exists
    const application = await prisma.loanApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    if (!file) {
      throw new ApiError(400, 'No file uploaded');
    }

    // Create document record
    const document = await prisma.loanDocument.create({
      data: {
        loanApplicationId: applicationId,
        documentType,
        documentName: documentName || file.originalname,
        documentUrl: `/uploads/loans/documents/${file.filename}`,
        uploadDate: new Date(),
        status: 'PENDING'
      },
      include: {
        verifiedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'LoanDocument',
      document.id,
      AuditAction.CREATE,
      null,
      document
    );

    return res.status(201).json(document);
  } catch (error) {
    logger.error(`Upload loan document error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to upload loan document');
  }
};

/**
 * Verify a loan document
 */
export const verifyLoanDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { status, verificationNotes } = req.body;
    const adminUserId = req.staff?.id;

    // Check if document exists
    const existingDocument = await prisma.loanDocument.findUnique({
      where: { id: documentId }
    });

    if (!existingDocument) {
      throw new ApiError(404, 'Document not found');
    }

    // Update document
    const updatedDocument = await prisma.loanDocument.update({
      where: { id: documentId },
      data: {
        status,
        verificationDate: new Date(),
        verificationNotes,
        verifiedById: adminUserId
      },
      include: {
        verifiedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Create audit log
    await createAuditLog(
      req,
      'LoanDocument',
      updatedDocument.id,
      AuditAction.UPDATE,
      existingDocument,
      updatedDocument
    );

    return res.json(updatedDocument);
  } catch (error) {
    logger.error(`Verify loan document error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to verify loan document');
  }
};

/**
 * Delete a loan document
 */
export const deleteLoanDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;

    // Check if document exists
    const existingDocument = await prisma.loanDocument.findUnique({
      where: { id: documentId }
    });

    if (!existingDocument) {
      throw new ApiError(404, 'Document not found');
    }

    // Delete document
    await prisma.loanDocument.delete({
      where: { id: documentId }
    });

    // Try to delete the actual file
    try {
      const filePath = path.join(__dirname, '../../../../uploads', existingDocument.documentUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      logger.warn(`Failed to delete document file: ${fileError}`);
      // Continue even if file deletion fails
    }

    // Create audit log
    await createAuditLog(
      req,
      'LoanDocument',
      documentId,
      AuditAction.DELETE,
      existingDocument,
      null
    );

    return res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error(`Delete loan document error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete loan document');
  }
};