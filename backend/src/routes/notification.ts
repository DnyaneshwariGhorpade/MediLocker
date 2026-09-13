import { Router } from 'express';
import {
    getNotifications,
    markAsRead,
    markAllAsRead
} from '../controllers/notificationController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { idParam } from '../schemas';

const router = Router();

router.use(authenticateToken); // Available to all roles, but restricted to own user_id

router.get('/', getNotifications);
router.patch('/:id/read', validate({ params: idParam }), markAsRead);
router.post('/mark-all-read', markAllAsRead);

export default router;
