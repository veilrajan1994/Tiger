import { Router } from 'express';
import { aiSearch, getInsights, validateCSV, generateAIReport } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/search', aiSearch);
router.get('/insights', getInsights);
router.post('/validate-csv', validateCSV);
router.post('/report', generateAIReport);

export default router;
