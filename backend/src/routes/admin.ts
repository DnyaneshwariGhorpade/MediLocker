import { Router } from 'express';
import {
    getDashboard, getPendingHospitals, verifyHospital, rejectHospital,
    getPendingDoctors, verifyDoctor, rejectDoctor,
    getDisputes, resolveDispute,
    getAuditLogs, exportAuditLogs, verifyAuditChain,
    getSystemHealth, getBlockchainBlocks, verifyIntegrityLedger, runJobNow,
} from '../controllers/adminController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import { validate } from '../middlewares/validate';
import {
    auditExportQuerySchema,
    auditLogQuerySchema,
    idParam,
    rejectSchema,
    resolveDisputeSchema,
} from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PLATFORM_ADMIN'));

router.get('/dashboard', getDashboard);

router.get('/verifications/hospitals', getPendingHospitals);
router.post('/hospitals/:id/verify', validate({ params: idParam }), verifyHospital);
router.post('/hospitals/:id/reject', validate({ params: idParam, body: rejectSchema }), rejectHospital);

router.get('/verifications/doctors', getPendingDoctors);
router.post('/doctors/:id/verify', validate({ params: idParam }), verifyDoctor);
router.post('/doctors/:id/reject', validate({ params: idParam, body: rejectSchema }), rejectDoctor);

router.get('/disputes', getDisputes);
router.put('/disputes/:id/resolve', validate({ params: idParam, body: resolveDisputeSchema }), resolveDispute);

// Chain verification is declared before the parameterised export route so the
// literal path is not shadowed.
router.get('/audit-logs/verify-chain', asyncHandler(verifyAuditChain));
router.get('/audit-logs', validate({ query: auditLogQuerySchema }), getAuditLogs);
router.post('/audit-logs/export', validate({ query: auditExportQuerySchema }), exportAuditLogs);

router.get('/system-health', asyncHandler(getSystemHealth));
router.get('/ledger/verify', asyncHandler(verifyIntegrityLedger));
router.post('/jobs/:name/run', asyncHandler(runJobNow));
router.get('/blockchain/blocks', getBlockchainBlocks);

export default router;
