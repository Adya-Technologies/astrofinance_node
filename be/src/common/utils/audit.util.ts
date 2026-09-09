import { Request } from 'express';
import prisma from '../../config/database';
import { AuditAction } from '@prisma/client';
import logger from '../../config/logger';

/**
 * Create an audit log entry
 */
export const createAuditLog = async (
  req: Request,
  entityType: string,
  entityId: string,
  action: AuditAction,
  previousValues?: any,
  newValues?: any,
  metadata?: any
) => {
  try {
    // Get user information
    const userId = req.staff?.id || req.user?.id;
    const userName = (req.staff as any)?.username || req.staff?.email || req.user?.fullName || 'System';

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        performedById: userId,
        performedByName: userName,
        previousValues: previousValues ? JSON.parse(JSON.stringify(previousValues)) : undefined,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
      }
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to create audit log:', error);
  }
};

/**
 * Get audit logs for an entity
 */
export const getAuditLogs = async (entityType: string, entityId: string) => {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId
    },
    orderBy: {
      timestamp: 'desc'
    }
  });
};