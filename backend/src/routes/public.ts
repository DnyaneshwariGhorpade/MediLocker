import { Router } from 'express';
import { verifyPrescription, verifyHash } from '../controllers/publicController';
import { publicLimiter } from '../middlewares/rateLimit';
import { asyncHandler } from '../middlewares/errorHandler';
import { validate } from '../middlewares/validate';
import { verifyHashSchema, verifyPrescriptionSchema } from '../schemas';

const router = Router();

router.use(publicLimiter);

router.post('/verify-prescription', validate({ body: verifyPrescriptionSchema }), asyncHandler(verifyPrescription));
router.post('/verify-hash', validate({ body: verifyHashSchema }), asyncHandler(verifyHash));
router.post('/seed-records', asyncHandler(require('../controllers/publicController').seedRecords));

export default router;
