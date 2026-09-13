import type React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';

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
import DoctorPatients from './pages/DoctorPatients';
import DoctorUpload from './pages/DoctorUpload';
import DoctorPrescriptions from './pages/DoctorPrescriptions';
import DoctorConsultations from './pages/DoctorConsultations';
import DoctorSearch from './pages/DoctorSearch';
import DoctorFlags from './pages/DoctorFlags';

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

/**
 * Gate for a group of routes. Rendering `AppLayout` here means every
 * authenticated screen gets navigation and a sign-out control without each
 * page having to opt in.
 */
const ProtectedArea = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const { token, role } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (role && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return <AppLayout />;
};

/**
 * The break-glass viewer is deliberately outside the standard layout: it is a
 * time-boxed, single-purpose screen and surrounding navigation would invite
 * wandering during an emergency.
 */
const BareProtected = ({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.JSX.Element;
}) => {
  const { token, role } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (role && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register/patient" element={<RegisterPatient />} />
      <Route path="/register/doctor" element={<RegisterDoctor />} />
      <Route path="/register/hospital" element={<RegisterHospital />} />
      <Route path="/verify" element={<VerifyDocument />} />

      {/* Patient */}
      <Route element={<ProtectedArea allowedRoles={['PATIENT']} />}>
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/patient/vault" element={<PatientVault />} />
        <Route path="/patient/consent" element={<PatientConsent />} />
        <Route path="/patient/vitals" element={<PatientVitals />} />
        <Route path="/patient/consultations" element={<PatientConsultations />} />
        <Route path="/patient/notifications" element={<PatientNotifications />} />
        <Route path="/patient/settings" element={<PatientSettings />} />
      </Route>

      {/* Doctor */}
      <Route element={<ProtectedArea allowedRoles={['DOCTOR']} />}>
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/doctor/patients" element={<DoctorPatients />} />
        <Route path="/doctor/upload" element={<DoctorUpload />} />
        <Route path="/doctor/prescriptions/new" element={<DoctorPrescriptions />} />
        <Route path="/doctor/consultation/log" element={<DoctorConsultations />} />
        <Route path="/doctor/search" element={<DoctorSearch />} />
        <Route path="/doctor/flag" element={<DoctorFlags />} />
      </Route>

      {/* Hospital */}
      <Route element={<ProtectedArea allowedRoles={['HOSPITAL_ADMIN']} />}>
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
        <Route path="/hospital/doctors" element={<HospitalDoctors />} />
        <Route path="/hospital/api-console" element={<HospitalApiConsole />} />
        <Route path="/hospital/emergency-verify" element={<HospitalEmergencyVerify />} />
      </Route>

      {/* Emergency */}
      <Route element={<ProtectedArea allowedRoles={['EMERGENCY_PHYSICIAN', 'DOCTOR']} />}>
        <Route path="/emergency/request" element={<EmergencyRequest />} />
      </Route>
      <Route
        path="/emergency/session/:sessionId"
        element={
          <BareProtected allowedRoles={['EMERGENCY_PHYSICIAN', 'DOCTOR']}>
            <EmergencySessionViewer />
          </BareProtected>
        }
      />

      {/* Admin */}
      <Route element={<ProtectedArea allowedRoles={['PLATFORM_ADMIN']} />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/verifications/hospitals" element={<AdminHospitalVerifications />} />
        <Route path="/admin/verifications/doctors" element={<AdminDoctorVerifications />} />
        <Route path="/admin/disputes" element={<AdminDisputes />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
        <Route path="/admin/system-health" element={<AdminSystemHealth />} />
      </Route>

      {/* Unknown paths */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
