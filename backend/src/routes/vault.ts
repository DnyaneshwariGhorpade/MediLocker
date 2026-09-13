import { Router } from 'express';
import {
    getRecords,
    decryptRecord,
    downloadRecord,
    getBlockchainProof,
    uploadRecord,
    anchorBlockchain
} from '../controllers/vaultController';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import { handleUploadErrors, uploadSingleFile } from '../middlewares/upload';
import { validate } from '../middlewares/validate';
import {
    anchorBlockchainSchema,
    idParam,
    uploadRecordSchema,
    vaultRecordsQuerySchema
} from '../schemas';

const router = Router();

router.use(authenticateToken);
// Doctors upload into a vault they do not own, so this router cannot be
// patient-only. Per-handler ownership and consent checks decide who reads what.
router.use(authorizeRoles('PATIENT', 'DOCTOR'));

router.get('/records', validate({ query: vaultRecordsQuerySchema }), asyncHandler(getRecords));
router.post('/records/:id/decrypt', validate({ params: idParam }), asyncHandler(decryptRecord));
router.get('/records/:id/download', validate({ params: idParam }), asyncHandler(downloadRecord));
router.get('/records/:id/blockchain-proof', validate({ params: idParam }), asyncHandler(getBlockchainProof));

// multipart/form-data: the file arrives under the "file" field and metadata as
// ordinary form fields, so validation runs after multer has parsed the body.
router.post(
    '/upload',
    uploadSingleFile,
    handleUploadErrors,
    validate({ body: uploadRecordSchema }),
    asyncHandler(uploadRecord)
);

router.post('/anchor-blockchain', validate({ body: anchorBlockchainSchema }), asyncHandler(anchorBlockchain));

export default router;
