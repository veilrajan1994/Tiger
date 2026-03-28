import { Router } from 'express';
import {
  getPricingRecords,
  getPricingRecord,
  updatePricingRecord,
  deletePricingRecord
} from '../controllers/pricing.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { updatePricingSchema, searchPricingSchema } from '../validators/pricing.validator';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(searchPricingSchema), getPricingRecords);
router.get('/:id', getPricingRecord);
router.put('/:id', validate(updatePricingSchema), updatePricingRecord);
router.delete('/:id', authorize('ADMIN'), deletePricingRecord);

export default router;
