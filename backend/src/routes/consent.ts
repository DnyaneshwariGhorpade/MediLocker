import { Router } from 'express';
import { 
    getActiveConsents, 
    grantConsent, 
    revokeConsent, 
    getConsentHistory 
} from '../controllers/consentController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PATIENT'));

router.get('/active', getActiveConsents);
router.post('/grant', grantConsent);
router.post('/:id/revoke', revokeConsent);
router.get('/history', getConsentHistory);

export default router;
