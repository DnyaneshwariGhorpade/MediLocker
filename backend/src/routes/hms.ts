import { Router } from 'express';
import {
    getClients,
    generateKey,
    updateIpWhitelist
} from '../controllers/hmsController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { generateApiKeySchema, ipWhitelistSchema } from '../schemas';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('HOSPITAL_ADMIN'));

router.get('/clients', getClients);
router.post('/clients/generate-key', validate({ body: generateApiKeySchema }), generateKey);
router.put('/clients/ip-whitelist', validate({ body: ipWhitelistSchema }), updateIpWhitelist);

export default router;
