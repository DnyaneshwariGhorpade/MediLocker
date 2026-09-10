import { Router } from 'express';
import { 
    initiateRequest,
    getPendingRequests,
    approveRequest,
    terminateSession,
    getSessionData
} from '../controllers/emergencyController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
// EMERGENCY_PHYSICIAN role is just a DOCTOR acting under emergency or a specific role. 
// We will allow DOCTOR and EMERGENCY_PHYSICIAN to initiate.
// HOSPITAL_ADMIN is allowed to fetch pending, approve, and terminate.

router.post('/initiate-request', authorizeRoles('DOCTOR', 'EMERGENCY_PHYSICIAN'), initiateRequest);
router.get('/pending-requests', authorizeRoles('HOSPITAL_ADMIN'), getPendingRequests);
router.post('/approve', authorizeRoles('HOSPITAL_ADMIN'), approveRequest);
router.post('/terminate', authorizeRoles('HOSPITAL_ADMIN', 'DOCTOR', 'EMERGENCY_PHYSICIAN'), terminateSession);
router.get('/session/:id/data', authorizeRoles('DOCTOR', 'EMERGENCY_PHYSICIAN'), getSessionData);

export default router;
