import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import patientRoutes from './routes/patient';
import doctorRoutes from './routes/doctor';
import hospitalRoutes from './routes/hospital';
import emergencyRoutes from './routes/emergency';
import hmsRoutes from './routes/hms';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import vaultRoutes from './routes/vault';
import consentRoutes from './routes/consent';
import notificationRoutes from './routes/notification';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// In a real project use actual cors configuration
app.use(cors());

// Routes updated to /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patient', patientRoutes);
app.use('/api/v1/doctor', doctorRoutes);
app.use('/api/v1/hospital', hospitalRoutes);
app.use('/api/v1/emergency', emergencyRoutes);
app.use('/api/v1/hms', hmsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/consent', consentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Maintain legacy /api routes for compatibility if frontend still uses them elsewhere
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'MediLocker API is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
