import { Router } from 'express';
import {
    getDashboardSummary,
    getDoctors,
    approveDoctor,
    revokeDoctor
} from '../controllers/hospitalController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { idParam } from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('HOSPITAL_ADMIN'));

router.get('/dashboard-summary', getDashboardSummary);
router.get('/doctors', getDoctors);
router.post('/doctors/:id/approve', validate({ params: idParam }), approveDoctor);
router.post('/doctors/:id/revoke', validate({ params: idParam }), revokeDoctor);

export default router;
