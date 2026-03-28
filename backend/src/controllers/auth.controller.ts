import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const generateToken = (payload: any, expiresIn: string = '24h'): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as SignOptions);
};

const generateRefreshToken = (payload: any): string => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn } as SignOptions);
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role, storeId } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  if (storeId) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new AppError('Invalid store ID', 400);
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'STORE_MANAGER',
      storeId
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      storeId: true
    }
  });

  logger.info(`User registered: ${email}`);

  const token = generateToken({ 
    id: user.id, 
    email: user.email, 
    role: user.role,
    storeId: user.storeId 
  });
  const refreshToken = generateRefreshToken({ id: user.id });

  res.status(201).json({
    status: 'success',
    data: { user, token, refreshToken }
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  logger.info(`User logged in: ${email}`);

  const token = generateToken({ 
    id: user.id, 
    email: user.email, 
    role: user.role,
    storeId: user.storeId 
  });
  const refreshToken = generateRefreshToken({ id: user.id });

  res.json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        storeId: user.storeId
      },
      token,
      refreshToken
    }
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    
    const user = await prisma.user.findUnique({ 
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        storeId: true,
        active: true
      }
    });

    if (!user || !user.active) {
      throw new AppError('Invalid refresh token', 401);
    }

    const newToken = generateToken({ 
      id: user.id, 
      email: user.email, 
      role: user.role,
      storeId: user.storeId 
    });
    const newRefreshToken = generateRefreshToken({ id: user.id });

    res.json({
      status: 'success',
      data: { token: newToken, refreshToken: newRefreshToken }
    });
  } catch (error) {
    throw new AppError('Invalid refresh token', 401);
  }
});
