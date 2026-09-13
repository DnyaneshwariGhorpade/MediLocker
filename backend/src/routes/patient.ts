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
import { validate } from '../middlewares/validate';
import { addVitalSchema, emergencySettingsSchema, updateProfileSchema } from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PATIENT'));

router.get('/dashboard-summary', getDashboardSummary);
router.get('/vitals/trends', getVitalsTrends);
router.get('/vitals', getVitals);
router.post('/vitals', validate({ body: addVitalSchema }), addVital);
router.get('/consultations', getConsultations);
router.get('/profile', getProfile);
router.put('/profile', validate({ body: updateProfileSchema }), updateProfile);
router.put('/emergency-settings', validate({ body: emergencySettingsSchema }), updateEmergencySettings);

export default router;
