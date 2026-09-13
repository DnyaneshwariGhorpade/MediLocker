import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';

export interface RequestSchemas {
    body?: ZodType;
    query?: ZodType;
    params?: ZodType;
}

/**
 * Validates and narrows the request against Zod schemas. Parsed output replaces
 * the raw input, so handlers receive coerced, trimmed values and unknown fields
 * are stripped rather than silently forwarded to Prisma.
 *
 * `req.query` is a getter in Express 5, so the parsed result is stored on
 * `res.locals.query` and read back via `validatedQuery(res)`.
 */
export const validate = (schemas: RequestSchemas): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            if (schemas.params) {
                Object.assign(req.params, schemas.params.parse(req.params));
            }
            if (schemas.query) {
                res.locals['query'] = schemas.query.parse(req.query);
            }
            if (schemas.body) {
                req.body = schemas.body.parse(req.body ?? {});
            }
            next();
        } catch (error) {
            next(error);
        }
    };
};

/** Reads the query object produced by `validate({ query })`. */
export const validatedQuery = <T>(res: Response): T => (res.locals['query'] ?? {}) as T;
