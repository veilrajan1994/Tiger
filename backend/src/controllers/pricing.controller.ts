import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { createAuditLog } from '../services/audit.service';

// Reusable select for store includes — avoids fetching unnecessary columns
const STORE_SELECT = {
  select: { storeId: true, storeName: true, country: true }
} as const;

// ─── Build where clause (extracted for testability) ──────────────────────────

const buildPricingWhere = (
  query: Record<string, any>,
  userRole?: string,
  userStoreId?: string
): Prisma.PricingRecordWhereInput => {
  const where: Prisma.PricingRecordWhereInput = {};

  // Store managers are scoped to their store
  if (userRole === 'STORE_MANAGER' && userStoreId) {
    where.storeId = userStoreId;
  } else if (query.storeId) {
    where.storeId = query.storeId as string;
  }

  if (query.sku) {
    where.sku = { contains: query.sku as string };
  }

  if (query.productName) {
    where.productName = { contains: query.productName as string };
  }

  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom as string);
    if (query.dateTo) where.date.lte = new Date(query.dateTo as string);
  }

  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice) where.price.gte = parseFloat(query.minPrice as string);
    if (query.maxPrice) where.price.lte = parseFloat(query.maxPrice as string);
  }

  return where;
};

// ─── GET /pricing ────────────────────────────────────────────────────────────

export const getPricingRecords = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const {
      page = '1',
      limit = '50',
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = buildPricingWhere(req.query, req.user?.role, req.user?.storeId);

    // Parallel query for records + count
    const [records, total] = await Promise.all([
      prisma.pricingRecord.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: sortOrder },
        include: { store: STORE_SELECT }
      }),
      prisma.pricingRecord.count({ where })
    ]);

    res.json({
      status: 'success',
      data: {
        records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  }
);

// ─── GET /pricing/:id ────────────────────────────────────────────────────────

export const getPricingRecord = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const record = await prisma.pricingRecord.findUnique({
      where: { id: req.params.id },
      include: { store: STORE_SELECT }
    });

    if (!record) {
      throw new AppError('Pricing record not found', 404);
    }

    if (req.user?.role === 'STORE_MANAGER' && req.user.storeId !== record.storeId) {
      throw new AppError('Access denied', 403);
    }

    res.json({ status: 'success', data: { record } });
  }
);

// ─── PUT /pricing/:id ────────────────────────────────────────────────────────

export const updatePricingRecord = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { price, productName } = req.body;

    const existingRecord = await prisma.pricingRecord.findUnique({ where: { id } });

    if (!existingRecord) {
      throw new AppError('Pricing record not found', 404);
    }

    if (req.user?.role === 'STORE_MANAGER' && req.user.storeId !== existingRecord.storeId) {
      throw new AppError('Access denied', 403);
    }

    // Only update fields that were actually provided
    const updateData: Prisma.PricingRecordUpdateInput = { updatedBy: req.user?.id };
    if (price !== undefined) updateData.price = price;
    if (productName !== undefined) updateData.productName = productName;

    const updatedRecord = await prisma.pricingRecord.update({
      where: { id },
      data: updateData,
      include: { store: STORE_SELECT }
    });

    // Fire-and-forget audit log (non-blocking)
    createAuditLog({
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'PricingRecord',
      entityId: id,
      oldValue: existingRecord,
      newValue: updatedRecord,
      ipAddress: req.ip
    });

    logger.info(`Pricing record updated: ${id} by ${req.user?.email}`);

    res.json({ status: 'success', data: { record: updatedRecord } });
  }
);

// ─── DELETE /pricing/:id ─────────────────────────────────────────────────────

export const deletePricingRecord = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (req.user?.role !== 'ADMIN') {
      throw new AppError('Only admins can delete records', 403);
    }

    const existingRecord = await prisma.pricingRecord.findUnique({ where: { id } });

    if (!existingRecord) {
      throw new AppError('Pricing record not found', 404);
    }

    await prisma.pricingRecord.delete({ where: { id } });

    createAuditLog({
      userId: req.user!.id,
      action: 'DELETE',
      entity: 'PricingRecord',
      entityId: id,
      oldValue: existingRecord,
      newValue: null,
      ipAddress: req.ip
    });

    logger.info(`Pricing record deleted: ${id} by ${req.user?.email}`);

    res.json({ status: 'success', message: 'Record deleted successfully' });
  }
);
