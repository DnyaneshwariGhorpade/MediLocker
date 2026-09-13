import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../utils/http';

/**
 * Wraps an async handler so a rejected promise reaches the error handler
 * instead of hanging the request.
 */
export const asyncHandler =
    <T extends Request>(handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(handler(req as unknown as T, res, next)).catch(next);
    };

/** Route fallthrough — anything unmatched is a 404, not an empty hang. */
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
};

interface Translated {
    status: number;
    message: string;
    details?: unknown;
}

function translate(error: unknown): Translated {
    if (error instanceof HttpError) {
        return { status: error.status, message: error.message, details: error.details };
    }

    if (error instanceof ZodError) {
        return {
            status: 400,
            message: 'Request validation failed',
            details: error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
            })),
        };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2025': // Record required by the operation was not found.
                return { status: 404, message: 'Resource not found' };
            case 'P2002': // Unique constraint violation.
                return {
                    status: 409,
                    message: 'A record with these details already exists',
                    details: { fields: (error.meta as { target?: string[] } | undefined)?.target },
                };
            case 'P2003': // Foreign key constraint violation.
                return { status: 400, message: 'Referenced record does not exist' };
            case 'P2000': // Value too long for column.
                return { status: 400, message: 'A submitted value is too long' };
            default:
                break;
        }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
        return { status: 400, message: 'Invalid query for the requested resource' };
    }

    return { status: 500, message: 'Internal server error' };
}

/**
 * Central error handler. Client-facing responses never contain a raw exception
 * message or stack in production; the full error is logged server-side with the
 * request id so it remains diagnosable.
 */
export const errorHandler = (
    error: unknown,
    req: Request,
    res: Response,
    // Express identifies error handlers by arity, so `next` must stay declared.
    _next: NextFunction
): void => {
    const { status, message, details } = translate(error);
    const requestId = res.getHeader('X-Request-Id');

    if (status >= 500) {
        console.error(`[${requestId}] ${req.method} ${req.originalUrl} failed:`, error);
    } else if (!env.isProduction) {
        console.warn(`[${requestId}] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
    }

    const body: Record<string, unknown> = { message };
    if (details !== undefined) body['details'] = details;
    if (requestId) body['requestId'] = requestId;

    // Outside production, attach the underlying message to keep local debugging
    // workable. It is never sent in production.
    if (!env.isProduction && status >= 500 && error instanceof Error) {
        body['error'] = error.message;
    }

    res.status(status).json(body);
};
