import { Router } from 'express';
import { getStores, getStore } from '../controllers/store.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getStores);
router.get('/:id', getStore);

export default router;
