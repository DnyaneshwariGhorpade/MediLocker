import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import RegisterPatient from './pages/RegisterPatient';
import RegisterDoctor from './pages/RegisterDoctor';
import RegisterHospital from './pages/RegisterHospital';
import VerifyDocument from './pages/VerifyDocument';
import PatientDashboard from './pages/PatientDashboard';
import PatientVitals from './pages/PatientVitals';
import PatientVault from './pages/PatientVault';
import PatientConsent from './pages/PatientConsent';
import PatientConsultations from './pages/PatientConsultations';
import PatientNotifications from './pages/PatientNotifications';
import PatientSettings from './pages/PatientSettings';
import DoctorDashboard from './pages/DoctorDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import HospitalDoctors from './pages/HospitalDoctors';
import HospitalApiConsole from './pages/HospitalApiConsole';
import HospitalEmergencyVerify from './pages/HospitalEmergencyVerify';
import EmergencyRequest from './pages/EmergencyRequest';
import EmergencySessionViewer from './pages/EmergencySessionViewer';
import AdminDashboard from './pages/AdminDashboard';
import AdminHospitalVerifications from './pages/AdminHospitalVerifications';
import AdminDoctorVerifications from './pages/AdminDoctorVerifications';
import AdminDisputes from './pages/AdminDisputes';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminSystemHealth from './pages/AdminSystemHealth';

import DoctorPatients from './pages/DoctorPatients';
import DoctorUpload from './pages/DoctorUpload';
import DoctorPrescriptions from './pages/DoctorPrescriptions';
import DoctorConsultations from './pages/DoctorConsultations';
import DoctorSearch from './pages/DoctorSearch';
import DoctorFlags from './pages/DoctorFlags';

const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles: string[] }) => {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (role && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register/patient" element={<RegisterPatient />} />
          <Route path="/register/doctor" element={<RegisterDoctor />} />
          <Route path="/register/hospital" element={<RegisterHospital />} />
          <Route path="/verify" element={<VerifyDocument />} />
          
          {/* Patient Routes */}
          <Route path="/patient/dashboard" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientDashboard />
            </ProtectedRoute>
          } />
          <Route path="/patient/vault" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientVault />
            </ProtectedRoute>
          } />
          <Route path="/patient/consent" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientConsent />
            </ProtectedRoute>
          } />
          <Route path="/patient/vitals" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientVitals />
            </ProtectedRoute>
          } />
          <Route path="/patient/consultations" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientConsultations />
            </ProtectedRoute>
          } />
          <Route path="/patient/notifications" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientNotifications />
            </ProtectedRoute>
          } />
          <Route path="/patient/settings" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientSettings />
            </ProtectedRoute>
          } />

          {/* Doctor Routes */}
          <Route path="/doctor/dashboard" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/doctor/patients" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorPatients />
            </ProtectedRoute>
          } />
          <Route path="/doctor/upload" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorUpload />
            </ProtectedRoute>
          } />
          <Route path="/doctor/prescriptions/new" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorPrescriptions />
            </ProtectedRoute>
          } />
          <Route path="/doctor/consultation/log" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorConsultations />
            </ProtectedRoute>
          } />
          <Route path="/doctor/search" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorSearch />
            </ProtectedRoute>
          } />
          <Route path="/doctor/flag" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorFlags />
            </ProtectedRoute>
          } />

          {/* Hospital Routes */}
          <Route path="/hospital/dashboard" element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN']}>
              <HospitalDashboard />
            </ProtectedRoute>
          } />
          <Route path="/hospital/doctors" element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN']}>
              <HospitalDoctors />
            </ProtectedRoute>
          } />
          <Route path="/hospital/api-console" element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN']}>
              <HospitalApiConsole />
            </ProtectedRoute>
          } />
          <Route path="/hospital/emergency-verify" element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN']}>
              <HospitalEmergencyVerify />
            </ProtectedRoute>
          } />

          {/* Emergency Routes */}
          <Route path="/emergency/request" element={
            <ProtectedRoute allowedRoles={['EMERGENCY_PHYSICIAN', 'DOCTOR']}>
              <EmergencyRequest />
            </ProtectedRoute>
          } />
          <Route path="/emergency/session/:sessionId" element={
            <ProtectedRoute allowedRoles={['EMERGENCY_PHYSICIAN', 'DOCTOR']}>
              <EmergencySessionViewer />
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/verifications/hospitals" element={
            <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
              <AdminHospitalVerifications />
            </ProtectedRoute>
          } />
          <Route path="/admin/verifications/doctors" element={
            <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
              <AdminDoctorVerifications />
            </ProtectedRoute>
          } />
          <Route path="/admin/disputes" element={
            <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
              <AdminDisputes />
            </ProtectedRoute>
          } />
          <Route path="/admin/audit-logs" element={
            <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
              <AdminAuditLogs />
            </ProtectedRoute>
          } />
          <Route path="/admin/system-health" element={
            <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
              <AdminSystemHealth />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
