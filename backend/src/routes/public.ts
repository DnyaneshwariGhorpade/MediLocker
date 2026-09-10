import { Router } from 'express';
import { verifyPrescription, verifyHash } from '../controllers/publicController';

const router = Router();

router.post('/verify-prescription', verifyPrescription);
router.post('/verify-hash', verifyHash);

export default router;
