import { Router } from 'express';
import {
    changePassword,
    confirmMfaEnrolment,
    getSessions,
    login,
    logout,
    registerDoctor,
    registerHospital,
    registerPatient,
    revokeOtherSessions,
    revokeSessionById,
    sendAadhaarOtp,
    startMfaEnrolment,
    verifyMfa
} from '../controllers/authController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorHandler';
import { validate } from '../middlewares/validate';
import { authLimiter } from '../middlewares/rateLimit';
import {
    aadhaarOtpSchema,
    changePasswordSchema,
    idParam,
    loginSchema,
    mfaConfirmSchema,
    registerDoctorSchema,
    registerHospitalSchema,
    registerPatientSchema,
    verifyMfaSchema
} from '../schemas';

const router = Router();

// ------------------------------------------------------------- registration
router.post('/register/patient', authLimiter, validate({ body: registerPatientSchema }), asyncHandler(registerPatient));
router.post('/register/doctor', authLimiter, validate({ body: registerDoctorSchema }), asyncHandler(registerDoctor));
router.post('/register/hospital', authLimiter, validate({ body: registerHospitalSchema }), asyncHandler(registerHospital));

router.post('/patient/send-aadhaar-otp', authLimiter, validate({ body: aadhaarOtpSchema }), asyncHandler(sendAadhaarOtp));

// PLACEHOLDER: credential documents are not stored yet. Doctor identity
// documents move onto the encrypted pipeline as a follow-up; the endpoint stays
// available because the sign-up flow calls it, and is explicit that nothing is
// retained.
router.post('/doctor/upload-credentials', authLimiter, (_req, res) => {
    res.json({
        simulated: true,
        message: 'Credential document storage is not implemented; no document was retained.',
        url: null
    });
});

// ------------------------------------------------------------------- sign-in
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(login));
router.post('/verify-mfa', authLimiter, validate({ body: verifyMfaSchema }), asyncHandler(verifyMfa));

// --------------------------------------------------- authenticated account
router.use(authenticateToken);

router.post('/mfa/enroll', asyncHandler(startMfaEnrolment));
router.post('/mfa/confirm', validate({ body: mfaConfirmSchema }), asyncHandler(confirmMfaEnrolment));

router.post('/password', validate({ body: changePasswordSchema }), asyncHandler(changePassword));

router.get('/sessions', asyncHandler(getSessions));
router.delete('/sessions/:id', validate({ params: idParam }), asyncHandler(revokeSessionById));
router.post('/sessions/revoke-others', asyncHandler(revokeOtherSessions));
router.post('/logout', asyncHandler(logout));

export default router;
