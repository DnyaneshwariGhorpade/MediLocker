import { Router } from 'express';
import { 
    getDashboardSummary, 
    getVitals, 
    getVitalsTrends,
    addVital,
    getConsultations,
    getProfile,
    updateProfile,
    updateEmergencySettings
} from '../controllers/patientController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PATIENT'));

router.get('/dashboard-summary', getDashboardSummary);
router.get('/vitals/trends', getVitalsTrends);
router.get('/vitals', getVitals);
router.post('/vitals', addVital);
router.get('/consultations', getConsultations);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/emergency-settings', updateEmergencySettings);

export default router;
