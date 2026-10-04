import { Router, Request, Response } from 'express';

/**
 * TEMPORARY deployment helper. Runs the canonical seed in-process so the
 * result can be read over HTTP, because Render free-tier logs are not
 * readable through the API.
 *
 * Guarded by SEED_TOKEN and must be deleted once the database is seeded.
 */
const router = Router();

function describeError(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return { message: String(error) };
    }
    const e = error as Record<string, unknown>;
    return {
        name: typeof e.name === 'string' ? e.name : undefined,
        message: typeof e.message === 'string' ? e.message : String(error),
        code: e.code,
        meta: e.meta,
    };
}

router.post('/', async (req: Request, res: Response) => {
    const expected = process.env.SEED_TOKEN;
    if (!expected || req.header('x-seed-token') !== expected) {
        res.status(401).json({ message: 'Not authorised' });
        return;
    }

    try {
        const seed = await import('../seed.js');
        await seed.seedDatabase();
        res.json({ ok: true, message: 'Seed complete. Logins use password123.' });
    } catch (error) {
        res.status(500).json({ ok: false, error: describeError(error) });
    }
});

export default router;