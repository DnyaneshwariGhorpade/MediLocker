import { Router } from 'express';
import { 
    getDashboardSummary,
    getDoctors,
    approveDoctor,
    revokeDoctor
} from '../controllers/hospitalController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('HOSPITAL_ADMIN'));

router.get('/dashboard-summary', getDashboardSummary);
router.get('/doctors', getDoctors);
router.post('/doctors/:id/approve', approveDoctor);
router.post('/doctors/:id/revoke', revokeDoctor);

export default router;
