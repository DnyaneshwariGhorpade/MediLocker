import { Router } from 'express';
import {
    getActiveConsents,
    grantConsent,
    revokeConsent,
    getConsentHistory
} from '../controllers/consentController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { grantConsentSchema, idParam } from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PATIENT'));

router.get('/active', getActiveConsents);
router.post('/grant', validate({ body: grantConsentSchema }), grantConsent);
router.post('/:id/revoke', validate({ params: idParam }), revokeConsent);
router.get('/history', getConsentHistory);

export default router;
