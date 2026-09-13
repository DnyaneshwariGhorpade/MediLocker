import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Shield, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');

  // MFA State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (mfaRequired && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [mfaRequired, timer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await api.post<any>('/api/v1/auth/login', { loginId, password });

      if (data.requiresMfa) {
        setMfaRequired(true);
        setTempToken(data.tempToken);
        setTimer(60);
      } else {
        // Fallback if MFA isn't required
        login(data.token, data.role);
        routeUser(data.role);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const routeUser = (userRole: string) => {
    if (userRole === 'PATIENT') navigate('/patient/dashboard');
    else if (userRole === 'DOCTOR') navigate('/doctor/dashboard');
    else if (userRole === 'HOSPITAL_ADMIN') navigate('/hospital/dashboard');
    else if (userRole === 'PLATFORM_ADMIN') navigate('/admin/dashboard');
    else navigate('/');
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value !== '' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Check if fully entered
    if (newOtp.every(v => v !== '') && index === 5) {
      verifyMfa(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyMfa = async (otpValue: string) => {
    setError('');
    try {
      const data = await api.post<any>('/api/v1/auth/verify-mfa', { tempToken, otp: otpValue });

      login(data.token, data.role);
      routeUser(data.role);
    } catch (err: any) {
      setError(err.message);
      // Reset OTP on fail
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  const resendMfa = () => {
    setTimer(60);
    // In real app, trigger resend API here
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">

      {/* Hero Navigation Bar Integration (Simplified for Login page context) */}
      <nav className="absolute top-0 w-full p-6 flex justify-between items-center max-w-6xl">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="text-blue-600 h-8 w-8" />
          <span className="text-xl font-bold text-slate-900">MediLocker</span>
        </Link>
        <div className="flex gap-4">
          <Link to="/register/patient" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Patient Onboarding</Link>
          <Link to="/register/doctor" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">Doctor Portal</Link>
          <Link to="/verify" className="text-sm font-semibold bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">Verify Documents</Link>
        </div>
      </nav>

      <div className="max-w-md w-full mt-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Universal Portal</h2>
          <p className="text-slate-500 mt-2">Zero-trust authentication for all roles.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {error}
            </div>
          )}

          {!mfaRequired ? (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in zoom-in-95">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Login ID (Email, Phone, or ML-2026-XXXX)</label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                  placeholder="e.g. ML-2026-1234"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">Forgot password?</a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                Authenticate Identity
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-8">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Shield className="text-blue-600 w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Two-Step Verification</h3>
                <p className="text-sm text-slate-500 mt-2">Enter the 6-digit TOTP / SMS OTP sent to your registered device. (Use 123456 for testing)</p>
              </div>

              <div className="flex justify-center gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { otpRefs.current[idx] = el; }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-2xl font-bold rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                  />
                ))}
              </div>

              <div className="text-center text-sm">
                {timer > 0 ? (
                  <p className="text-slate-500">Resend code in <span className="font-semibold text-blue-600">{timer}s</span></p>
                ) : (
                  <button onClick={resendMfa} className="font-semibold text-blue-600 hover:text-blue-700">Resend Code</button>
                )}
              </div>

              <button
                onClick={() => verifyMfa(otp.join(''))}
                disabled={otp.join('').length !== 6}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Verify & Proceed
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-6 mt-8 text-sm font-semibold text-slate-500">
          <Link to="/register/patient" className="hover:text-blue-600">Patient Registration</Link>
          <Link to="/register/doctor" className="hover:text-blue-600">Doctor Registration</Link>
          <Link to="/register/hospital" className="hover:text-blue-600">Hospital Registration</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
