import multer from 'multer';
import { HttpError } from '../utils/http';
import { env } from '../config/env';

/** MIME types accepted for a medical record. */
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/tiff',
    'application/dicom',
]);

/**
 * Receives the upload into memory so it can be encrypted before anything
 * touches disk. Plaintext is never written to a temporary file.
 */
export const uploadSingleFile = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: env.maxUploadBytes,
        files: 1,
    },
    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            callback(
                HttpError.badRequest(
                    `Unsupported file type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`
                )
            );
            return;
        }
        callback(null, true);
    },
}).single('file');

/** Translates multer's own errors into the standard HTTP error shape. */
export const handleUploadErrors = (
    error: unknown,
    _req: unknown,
    _res: unknown,
    next: (err?: unknown) => void
): void => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            next(
                HttpError.badRequest(
                    `File exceeds the maximum size of ${Math.floor(env.maxUploadBytes / (1024 * 1024))} MB.`
                )
            );
            return;
        }
        next(HttpError.badRequest(`Upload rejected: ${error.message}`));
        return;
    }
    next(error);
};
