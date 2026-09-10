import { Router } from 'express';
import { 
    getRecords, 
    decryptRecord, 
    getBlockchainProof,
    uploadRecord,
    anchorBlockchain
} from '../controllers/vaultController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
// We need to allow doctors to upload to vault as well, so we can't restrict just to PATIENT
// Or we can create specific sub-routes. Let's just authorize PATIENT and DOCTOR.
router.use(authorizeRoles('PATIENT', 'DOCTOR'));

router.get('/records', getRecords);
router.post('/records/:id/decrypt', decryptRecord);
router.get('/records/:id/blockchain-proof', getBlockchainProof);
router.post('/upload', uploadRecord);
router.post('/anchor-blockchain', anchorBlockchain);

export default router;
