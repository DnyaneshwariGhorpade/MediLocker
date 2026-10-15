import { Router } from 'express';
import {
    getDashboardSummary,
    getVitals,
    getVitalsTrends,
    addVital,
    getConsultations,
    getProfile,
    updateProfile,
    updateEmergencySettings,
    getVerifiedDoctors,
    seedSampleVitals
} from '../controllers/patientController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/errorHandler';
import { addVitalSchema, emergencySettingsSchema, updateProfileSchema } from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PATIENT'));

router.get('/dashboard-summary', asyncHandler(getDashboardSummary));
router.get('/vitals/trends', asyncHandler(getVitalsTrends));
router.get('/vitals', asyncHandler(getVitals));
router.post('/vitals', validate({ body: addVitalSchema }), asyncHandler(addVital));
router.post('/vitals/sample', asyncHandler(seedSampleVitals));
router.get('/consultations', asyncHandler(getConsultations));
router.get('/profile', asyncHandler(getProfile));
router.put('/profile', validate({ body: updateProfileSchema }), asyncHandler(updateProfile));
router.put('/emergency-settings', validate({ body: emergencySettingsSchema }), asyncHandler(updateEmergencySettings));
router.get('/doctors', asyncHandler(getVerifiedDoctors));

export default router;
