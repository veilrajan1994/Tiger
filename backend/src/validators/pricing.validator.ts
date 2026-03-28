import Joi from 'joi';

export const updatePricingSchema = Joi.object({
  price: Joi.number().positive().optional(),
  productName: Joi.string().optional()
}).min(1);

export const searchPricingSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  storeId: Joi.string().uuid().optional(),
  sku: Joi.string().optional(),
  productName: Joi.string().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  minPrice: Joi.number().positive().optional(),
  maxPrice: Joi.number().positive().optional(),
  sortBy: Joi.string().valid('date', 'price', 'sku', 'productName').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional()
});
