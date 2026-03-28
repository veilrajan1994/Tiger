import { Response } from 'express';
import prisma from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const getStores = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { country, active = 'true' } = req.query;

    const where: any = {
      active: active === 'true'
    };

    if (country) {
      where.country = country;
    }

    // Store managers can only see their own store
    if (req.user?.role === 'STORE_MANAGER' && req.user.storeId) {
      where.id = req.user.storeId;
    }

    const stores = await prisma.store.findMany({
      where,
      orderBy: { storeName: 'asc' }
    });

    res.json({
      status: 'success',
      data: { stores }
    });
  }
);

export const getStore = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id }
    });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Store managers can only see their own store
    if (req.user?.role === 'STORE_MANAGER' && req.user.storeId !== id) {
      throw new AppError('Access denied', 403);
    }

    res.json({
      status: 'success',
      data: { store }
    });
  }
);
