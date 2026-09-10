import { Router } from 'express';
import {
    getDashboard, getPendingHospitals, verifyHospital, rejectHospital,
    getPendingDoctors, verifyDoctor, rejectDoctor,
    getDisputes, resolveDispute,
    getAuditLogs, exportAuditLogs,
    getSystemHealth, getBlockchainBlocks,
} from '../controllers/adminController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('PLATFORM_ADMIN'));

router.get('/dashboard', getDashboard);

router.get('/verifications/hospitals', getPendingHospitals);
router.post('/hospitals/:id/verify', verifyHospital);
router.post('/hospitals/:id/reject', rejectHospital);

router.get('/verifications/doctors', getPendingDoctors);
router.post('/doctors/:id/verify', verifyDoctor);
router.post('/doctors/:id/reject', rejectDoctor);

router.get('/disputes', getDisputes);
router.put('/disputes/:id/resolve', resolveDispute);

router.get('/audit-logs', getAuditLogs);
router.post('/audit-logs/export', exportAuditLogs);

router.get('/system-health', getSystemHealth);
router.get('/blockchain/blocks', getBlockchainBlocks);

export default router;
