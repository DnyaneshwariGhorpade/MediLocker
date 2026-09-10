import { Router } from 'express';
import { 
    getClients,
    generateKey,
    updateIpWhitelist
} from '../controllers/hmsController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRoles('HOSPITAL_ADMIN'));

router.get('/clients', getClients);
router.post('/clients/generate-key', generateKey);
router.put('/clients/ip-whitelist', updateIpWhitelist);

export default router;
