import { Router } from 'express';
import {
    initiateRequest,
    getPendingRequests,
    approveRequest,
    terminateSession,
    getSessionData
} from '../controllers/emergencyController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import { validate } from '../middlewares/validate';
import {
    approveEmergencySchema,
    idParam,
    initiateEmergencySchema,
    terminateEmergencySchema
} from '../schemas';

const router = Router();

router.use(authenticateToken);
// Emergency physicians and ordinary doctors both initiate break-glass; a
// hospital admin is the required second approver.

router.post(
    '/initiate-request',
    authorizeRoles('DOCTOR', 'EMERGENCY_PHYSICIAN'),
    validate({ body: initiateEmergencySchema }),
    asyncHandler(initiateRequest)
);
router.get('/pending-requests', authorizeRoles('HOSPITAL_ADMIN'), asyncHandler(getPendingRequests));
router.post(
    '/approve',
    authorizeRoles('HOSPITAL_ADMIN'),
    validate({ body: approveEmergencySchema }),
    asyncHandler(approveRequest)
);
router.post(
    '/terminate',
    authorizeRoles('HOSPITAL_ADMIN', 'DOCTOR', 'EMERGENCY_PHYSICIAN'),
    validate({ body: terminateEmergencySchema }),
    asyncHandler(terminateSession)
);
router.get(
    '/session/:id/data',
    authorizeRoles('DOCTOR', 'EMERGENCY_PHYSICIAN'),
    validate({ params: idParam }),
    asyncHandler(getSessionData)
);

export default router;
