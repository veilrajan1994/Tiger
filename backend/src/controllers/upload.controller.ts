import { Response } from 'express';
import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

interface CSVRow {
  'Store ID': string;
  'SKU': string;
  'Product Name': string;
  'Price': string;
  'Date': string;
}

interface ParseError {
  row?: number;
  batch?: number;
  error: string;
  data?: any;
}

// ─── Date parsing with multiple format support ───────────────────────────────

const DATE_FORMATS: Array<{ regex: RegExp; parse: (s: string) => Date }> = [
  {
    regex: /^\d{4}-\d{2}-\d{2}$/,
    parse: (s) => new Date(s)
  },
  {
    regex: /^\d{2}\/\d{2}\/\d{4}$/,
    parse: (s) => { const [d, m, y] = s.split('/'); return new Date(`${y}-${m}-${d}`); }
  },
  {
    regex: /^\d{2}-\d{2}-\d{4}$/,
    parse: (s) => { const [d, m, y] = s.split('-'); return new Date(`${y}-${m}-${d}`); }
  }
];

const parseDate = (dateStr: string): Date => {
  for (const fmt of DATE_FORMATS) {
    if (fmt.regex.test(dateStr)) {
      const date = fmt.parse(dateStr);
      if (!isNaN(date.getTime())) return date;
    }
  }
  throw new Error(`Invalid date format: ${dateStr}`);
};

// ─── Safe file cleanup ───────────────────────────────────────────────────────

const cleanupFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    logger.error(`Failed to cleanup file: ${filePath}`, err);
  }
};

// ─── CSV Processing (async, non-blocking) ────────────────────────────────────

const processCSV = async (
  filePath: string,
  uploadId: string,
  userId: string,
  userStoreId?: string
): Promise<void> => {
  const rows: any[] = [];
  const errors: ParseError[] = [];
  let totalRecords = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    // Parse CSV file
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: CSVRow) => {
          totalRecords++;
          try {
            if (!row['Store ID'] || !row['SKU'] || !row['Product Name'] || !row['Price'] || !row['Date']) {
              throw new Error('Missing required fields');
            }

            const price = parseFloat(row['Price']);
            if (isNaN(price) || price <= 0) throw new Error('Invalid price');

            const date = parseDate(row['Date']);

            rows.push({
              storeId: row['Store ID'].trim(),
              sku: row['SKU'].trim(),
              productName: row['Product Name'].trim(),
              price,
              date,
              createdBy: userId
            });
          } catch (error: any) {
            errorCount++;
            errors.push({ row: totalRecords, error: error.message, data: row });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Resolve store IDs in a single query
    const uniqueStoreIds = [...new Set(rows.map((r) => r.storeId))];
    const stores = await prisma.store.findMany({
      where: { storeId: { in: uniqueStoreIds } },
      select: { id: true, storeId: true }
    });
    const storeMap = new Map(stores.map((s) => [s.storeId, s.id]));

    // Validate store access and map IDs
    const validRows = rows.filter((row, idx) => {
      const storeUUID = storeMap.get(row.storeId);
      if (!storeUUID) {
        errorCount++;
        errors.push({ row: idx + 1, error: 'Store not found', data: row });
        return false;
      }
      if (userStoreId && storeUUID !== userStoreId) {
        errorCount++;
        errors.push({ row: idx + 1, error: 'Access denied to this store', data: row });
        return false;
      }
      row.storeId = storeUUID;
      return true;
    });

    // Batch upsert with transactions
    const BATCH_SIZE = 500;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(
          batch.map((row) =>
            prisma.pricingRecord.upsert({
              where: {
                storeId_sku_date: { storeId: row.storeId, sku: row.sku, date: row.date }
              },
              update: { productName: row.productName, price: row.price, updatedBy: userId },
              create: row
            })
          )
        );
        successCount += batch.length;
      } catch (error: any) {
        errorCount += batch.length;
        errors.push({ batch: Math.floor(i / BATCH_SIZE) + 1, error: error.message });
      }
    }

    // Determine final status
    const status = errorCount === 0
      ? 'COMPLETED'
      : errorCount < totalRecords ? 'PARTIAL' : 'FAILED';

    await prisma.uploadHistory.update({
      where: { id: uploadId },
      data: {
        status,
        totalRecords,
        successCount,
        errorCount,
        errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null, // Cap stored errors
        completedAt: new Date()
      }
    });

    logger.info(`CSV processing completed: ${uploadId} | Success: ${successCount} | Errors: ${errorCount}`);
  } catch (error: any) {
    logger.error(`CSV processing failed: ${uploadId}`, error);
    await prisma.uploadHistory.update({
      where: { id: uploadId },
      data: {
        status: 'FAILED',
        errors: JSON.stringify([{ error: error.message }]),
        completedAt: new Date()
      }
    }).catch((e) => logger.error('Failed to update upload status', e));
  } finally {
    cleanupFile(filePath);
  }
};

// ─── POST /upload/csv ────────────────────────────────────────────────────────

export const uploadCSV = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const uploadRecord = await prisma.uploadHistory.create({
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedBy: req.user!.id,
        status: 'PROCESSING'
      }
    });

    logger.info(`CSV upload started: ${req.file.originalname} by ${req.user?.email}`);

    // Process async — don't block the response
    processCSV(req.file.path, uploadRecord.id, req.user!.id, req.user!.storeId);

    res.json({
      status: 'success',
      message: 'File upload started',
      data: { uploadId: uploadRecord.id }
    });
  }
);

// ─── GET /upload/history ─────────────────────────────────────────────────────

export const getUploadHistory = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const pageNum = Math.max(1, parseInt(req.query.page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (req.user?.role === 'STORE_MANAGER') {
      where.uploadedBy = req.user.id;
    }

    const [uploads, total] = await Promise.all([
      prisma.uploadHistory.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { startedAt: 'desc' }
      }),
      prisma.uploadHistory.count({ where })
    ]);

    res.json({
      status: 'success',
      data: {
        uploads,
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

// ─── GET /upload/:id/status ──────────────────────────────────────────────────

export const getUploadStatus = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const upload = await prisma.uploadHistory.findUnique({
      where: { id: req.params.id }
    });

    if (!upload) {
      throw new AppError('Upload not found', 404);
    }

    if (req.user?.role === 'STORE_MANAGER' && upload.uploadedBy !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    res.json({ status: 'success', data: { upload } });
  }
);
