import { Router } from 'express';
import {
    getActiveConsents,
    grantConsent,
    revokeConsent,
    getConsentHistory
} from '../controllers/consentController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/errorHandler';
import { grantConsentSchema, idParam } from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PATIENT'));

router.get('/active', asyncHandler(getActiveConsents));
router.post('/grant', validate({ body: grantConsentSchema }), asyncHandler(grantConsent));
router.post('/:id/revoke', validate({ params: idParam }), asyncHandler(revokeConsent));
router.get('/history', asyncHandler(getConsentHistory));

export default router;
