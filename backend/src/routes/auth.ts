import { Router } from 'express';
import { 
    login, 
    verifyMfa, 
    registerPatient, 
    registerDoctor, 
    registerHospital,
    sendAadhaarOtp 
} from '../controllers/authController';

const router = Router();

// Registration
router.post('/register/patient', registerPatient);
router.post('/register/doctor', registerDoctor);
router.post('/register/hospital', registerHospital);

// Patient Specific
router.post('/patient/send-aadhaar-otp', sendAadhaarOtp);

// Doctor Specific (mocking upload since using multipart/form-data with actual files in a real app)
// For MVP we just pass a string in JSON, so we can use the same register endpoint or a separate one if needed.
// The requirements say [POST /api/v1/auth/doctor/upload-credentials], but we handle it in register.
// We'll add a dummy endpoint just to satisfy the API spec explicitly if front-end calls it.
router.post('/doctor/upload-credentials', (req, res) => {
    res.json({ message: 'Credentials uploaded successfully', url: 'mock-s3-url' });
});

// Login and MFA
router.post('/login', login);
router.post('/verify-mfa', verifyMfa);

export default router;
