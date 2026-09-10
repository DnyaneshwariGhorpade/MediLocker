import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

// GET /api/v1/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;

        const notifications = await db.notifications.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: 50
        });

        res.json(notifications);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};

// PATCH /api/v1/notifications/:id/read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const notificationId = req.params.id;

        const notification = await db.notifications.findFirst({
            where: { notification_id: notificationId, user_id: userId }
        });

        if (!notification) {
            res.status(404).json({ message: 'Notification not found' });
            return;
        }

        await db.notifications.update({
            where: { notification_id: notificationId },
            data: { read_at: new Date() }
        });

        res.json({ message: 'Notification marked as read' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error marking notification as read', error: error.message });
    }
};

// POST /api/v1/notifications/mark-all-read
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;

        await db.notifications.updateMany({
            where: { user_id: userId, read_at: null },
            data: { read_at: new Date() }
        });

        res.json({ message: 'All notifications marked as read' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
    }
};
