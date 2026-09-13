/**
 * Error carrying an HTTP status. Thrown by controllers and translated into a
 * response by the central error handler.
 */
export class HttpError extends Error {
    readonly status: number;
    readonly details: unknown;

    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.details = details;
    }

    static badRequest(message: string, details?: unknown): HttpError {
        return new HttpError(400, message, details);
    }

    static unauthorized(message = 'Authentication required'): HttpError {
        return new HttpError(401, message);
    }

    static forbidden(message = 'Access denied'): HttpError {
        return new HttpError(403, message);
    }

    static notFound(message = 'Resource not found'): HttpError {
        return new HttpError(404, message);
    }
}
