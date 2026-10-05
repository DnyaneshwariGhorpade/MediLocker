import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env';
import { auditMiddleware } from './middlewares/auditMiddleware';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { globalLimiter } from './middlewares/rateLimit';

import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import consentRoutes from './routes/consent';
import doctorRoutes from './routes/doctor';
import emergencyRoutes from './routes/emergency';
import hmsRoutes from './routes/hms';
import hospitalRoutes from './routes/hospital';
import notificationRoutes from './routes/notification';
import patientRoutes from './routes/patient';
import publicRoutes from './routes/public';
import vaultRoutes from './routes/vault';

export function createApp() {
    const app = express();

    // Behind a load balancer or API gateway, trust the proxy so req.ip and the
    // rate limiter see the real client address.
    app.set('trust proxy', 1);

    // BigInt columns (file_size_bytes, block_number, log_id) are not valid JSON.
    // Serialise them as strings rather than throwing at response time.
    app.set('json replacer', (_key: string, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value
    );

    app.use(helmet());

    app.use(
        cors({
            origin: env.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        })
    );

    app.use(express.json({ limit: '1mb' }));

    // Correlates a client-visible error with the server-side log entry.
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('X-Request-Id', crypto.randomUUID());
        next();
    });

    app.use(globalLimiter);
    app.use(auditMiddleware);

    app.get('/health', (_req, res) => {
        res.json({ status: 'OK', message: 'MediLocker API is running' });
    });

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/patient', patientRoutes);
    app.use('/api/v1/doctor', doctorRoutes);
    app.use('/api/v1/hospital', hospitalRoutes);
    app.use('/api/v1/emergency', emergencyRoutes);
    app.use('/api/v1/hms', hmsRoutes);
    app.use('/api/v1/admin', adminRoutes);
    app.use('/api/v1/public', publicRoutes);
    app.use('/api/v1/vault', vaultRoutes);
    app.use('/api/v1/consent', consentRoutes);
    app.use('/api/v1/notifications', notificationRoutes);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
