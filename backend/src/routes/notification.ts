import { Router } from 'express';
import { 
    getNotifications, 
    markAsRead, 
    markAllAsRead 
} from '../controllers/notificationController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken); // Available to all roles, but restricted to own user_id

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);

export default router;
