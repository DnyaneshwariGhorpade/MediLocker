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
import { asyncHandler } from '../middlewares/errorHandler';
import { validate } from '../middlewares/validate';
import {
    checkConsentSchema,
    consultationSchema,
    doctorSearchQuerySchema,
    flagRecordSchema,
    prescriptionSchema,
    requestConsentSchema
} from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('DOCTOR'));

router.get('/dashboard-summary', getDashboard);
router.post('/check-consent', validate({ body: checkConsentSchema }), checkConsent);
router.post('/request-consent', validate({ body: requestConsentSchema }), requestConsent);
router.get('/patient-records/:vaultNumber', asyncHandler(getPatientRecords));
router.post('/prescriptions/sign-and-issue', validate({ body: prescriptionSchema }), asyncHandler(signAndIssuePrescription));
router.post('/consultations', validate({ body: consultationSchema }), createConsultation);
router.get('/records/search', validate({ query: doctorSearchQuerySchema }), asyncHandler(searchRecords));
router.post('/records/flag', validate({ body: flagRecordSchema }), asyncHandler(flagRecord));

export default router;
