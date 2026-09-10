import { Router } from 'express';
import { 
    getDashboard, 
    checkConsent, 
    requestConsent, 
    getPatientRecords,
    signAndIssuePrescription,
    createConsultation,
    searchRecords,
    flagRecord
} from '../controllers/doctorController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('DOCTOR'));

router.get('/dashboard-summary', getDashboard);
router.post('/check-consent', checkConsent);
router.post('/request-consent', requestConsent);
router.get('/patient-records/:vaultNumber', getPatientRecords);
router.post('/prescriptions/sign-and-issue', signAndIssuePrescription);
router.post('/consultations', createConsultation);
router.get('/records/search', searchRecords);
router.post('/records/flag', flagRecord);

export default router;
