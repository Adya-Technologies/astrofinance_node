import { Request, Response } from 'express';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { createAuditLog } from '../../../common/utils/audit.util';
import { AuditAction } from '@prisma/client';
import { ApiError } from '../../../common/middleware/error.middleware';

/**
 * Get all system settings
 */
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const { category, search, page = '1', limit = '50' } = req.query;

    // Parse pagination parameters
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter conditions
    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { key: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { value: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Get total count for pagination
    const totalCount = await prisma.systemSetting.count({ where });

    // Get settings with pagination
    const settings = await prisma.systemSetting.findMany({
      where,
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ],
      skip,
      take: limitNumber
    });

    return res.json({
      data: settings,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Get all settings error:', error);
    throw new ApiError(500, 'Failed to fetch settings');
  }
};

/**
 * Get setting by key
 */
export const getSettingByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const setting = await prisma.systemSetting.findUnique({
      where: { key },
      include: {
        updatedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!setting) {
      throw new ApiError(404, 'Setting not found');
    }

    return res.json(setting);
  } catch (error) {
    logger.error(`Get setting by key error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch setting');
  }
};

/**
 * Create new setting
 */
export const createSetting = async (req: Request, res: Response) => {
  try {
    const {
      key,
      value,
      description,
      category = 'GENERAL',
      isPublic = false,
      isEncrypted = false,
      dataType = 'STRING',
      validation
    } = req.body;

    // Check if setting already exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { key }
    });

    if (existingSetting) {
      throw new ApiError(400, 'Setting with this key already exists');
    }

    // Validate data type
    const validDataTypes = ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'EMAIL', 'URL', 'PHONE'];
    if (!validDataTypes.includes(dataType)) {
      throw new ApiError(400, 'Invalid data type');
    }

    // Validate value based on data type
    if (!validateSettingValue(value, dataType)) {
      throw new ApiError(400, `Invalid value for data type ${dataType}`);
    }

    // Create setting
    const setting = await prisma.systemSetting.create({
      data: {
        key,
        value: isEncrypted ? encryptValue(value) : value,
        description,
        category,
        isPublic,
        isEncrypted,
        dataType: dataType as any,
        validation,
        updatedById: req.user?.id
      },
      include: {
        updatedBy: {
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
      'SystemSetting',
      setting.id,
      AuditAction.CREATE,
      null,
      setting
    );

    return res.status(201).json(setting);
  } catch (error) {
    logger.error(`Create setting error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to create setting');
  }
};

/**
 * Update setting
 */
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const {
      value,
      description,
      category,
      isPublic,
      isEncrypted,
      dataType,
      validation
    } = req.body;

    // Check if setting exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { key }
    });

    if (!existingSetting) {
      throw new ApiError(404, 'Setting not found');
    }

    // Validate data type if provided
    if (dataType) {
      const validDataTypes = ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'EMAIL', 'URL', 'PHONE'];
      if (!validDataTypes.includes(dataType)) {
        throw new ApiError(400, 'Invalid data type');
      }
    }

    // Validate value if provided
    if (value !== undefined) {
      const currentDataType = dataType || existingSetting.dataType;
      if (!validateSettingValue(value, currentDataType)) {
        throw new ApiError(400, `Invalid value for data type ${currentDataType}`);
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (value !== undefined) {
      updateData.value = (isEncrypted !== undefined ? isEncrypted : existingSetting.isEncrypted)
        ? encryptValue(value)
        : value;
    }
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (isEncrypted !== undefined) updateData.isEncrypted = isEncrypted;
    if (dataType !== undefined) updateData.dataType = dataType;
    if (validation !== undefined) updateData.validation = validation;
    updateData.updatedById = req.user?.id;

    // Update setting
    const updatedSetting = await prisma.systemSetting.update({
      where: { key },
      data: updateData,
      include: {
        updatedBy: {
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
      'SystemSetting',
      updatedSetting.id,
      AuditAction.UPDATE,
      existingSetting,
      updatedSetting
    );

    return res.json(updatedSetting);
  } catch (error) {
    logger.error(`Update setting error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update setting');
  }
};

/**
 * Delete setting
 */
export const deleteSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    // Check if setting exists
    const existingSetting = await prisma.systemSetting.findUnique({
      where: { key }
    });

    if (!existingSetting) {
      throw new ApiError(404, 'Setting not found');
    }

    // Delete setting
    await prisma.systemSetting.delete({
      where: { key }
    });

    // Create audit log
    await createAuditLog(
      req,
      'SystemSetting',
      existingSetting.id,
      AuditAction.DELETE,
      existingSetting,
      null
    );

    return res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    logger.error(`Delete setting error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete setting');
  }
};

/**
 * Get setting categories
 */
export const getSettingCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.settingCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });

    return res.json(categories);
  } catch (error) {
    logger.error('Get setting categories error:', error);
    throw new ApiError(500, 'Failed to fetch setting categories');
  }
};

/**
 * Get public settings
 */
export const getPublicSettings = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    const where: any = { isPublic: true };
    if (category) {
      where.category = category;
    }

    const settings = await prisma.systemSetting.findMany({
      where,
      select: {
        key: true,
        value: true,
        category: true,
        dataType: true
      },
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    });

    return res.json(settings);
  } catch (error) {
    logger.error('Get public settings error:', error);
    throw new ApiError(500, 'Failed to fetch public settings');
  }
};

/**
 * Bulk update settings
 */
export const bulkUpdateSettings = async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      throw new ApiError(400, 'Settings must be an array');
    }

    const results = [];

    for (const settingData of settings) {
      const { key, value, description } = settingData;

      if (!key) {
        results.push({ key, success: false, error: 'Key is required' });
        continue;
      }

      try {
        const existingSetting = await prisma.systemSetting.findUnique({
          where: { key }
        });

        if (!existingSetting) {
          results.push({ key, success: false, error: 'Setting not found' });
          continue;
        }

        // Validate value
        if (value !== undefined && !validateSettingValue(value, existingSetting.dataType)) {
          results.push({ key, success: false, error: `Invalid value for data type ${existingSetting.dataType}` });
          continue;
        }

        // Update setting
        const updatedSetting = await prisma.systemSetting.update({
          where: { key },
          data: {
            value: value !== undefined ? (existingSetting.isEncrypted ? encryptValue(value) : value) : undefined,
            description: description !== undefined ? description : undefined,
            updatedById: req.user?.id
          }
        });

        // Create audit log
        await createAuditLog(
          req,
          'SystemSetting',
          updatedSetting.id,
          AuditAction.UPDATE,
          existingSetting,
          updatedSetting
        );

        results.push({ key, success: true });
      } catch (error) {
        results.push({ key, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return res.json({ results });
  } catch (error) {
    logger.error(`Bulk update settings error: ${error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to bulk update settings');
  }
};

/**
 * Get setting audit logs
 */
export const getSettingAuditLogs = async (req: Request, res: Response) => {
  try {
    const { key, page = '1', limit = '20' } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const where: any = {};
    if (key) {
      const keyString = key as string;
      const setting = await prisma.systemSetting.findUnique({ where: { key: keyString } });
      if (setting) {
        where.settingId = setting.id;
      }
    }

    const totalCount = await prisma.settingAuditLog.count({ where });

    const auditLogs = await prisma.settingAuditLog.findMany({
      where,
      include: {
        setting: {
          select: {
            key: true,
            category: true
          }
        },
        changedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { changedAt: 'desc' },
      skip,
      take: limitNumber
    });

    return res.json({
      data: auditLogs,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(totalCount / limitNumber)
      }
    });
  } catch (error) {
    logger.error('Get setting audit logs error:', error);
    throw new ApiError(500, 'Failed to fetch setting audit logs');
  }
};

// Helper functions
function validateSettingValue(value: any, dataType: string): boolean {
  switch (dataType) {
    case 'STRING':
      return typeof value === 'string';
    case 'NUMBER':
      return typeof value === 'number' && !isNaN(value);
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'JSON':
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case 'DATE':
      return !isNaN(Date.parse(value));
    case 'EMAIL': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    }
    case 'URL': {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }
    case 'PHONE': {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
    }
    default:
      return true;
  }
}

function encryptValue(value: string): string {
  // Simple encryption for demo - in production, use proper encryption
  return Buffer.from(value).toString('base64');
}

function decryptValue(encryptedValue: string): string {
  // Simple decryption for demo - in production, use proper decryption
  return Buffer.from(encryptedValue, 'base64').toString();
}
