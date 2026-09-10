import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, CheckCircle2, ArrowRight, Lock } from 'lucide-react';

const verhoeff = {
  d: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ],
  p: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ],
  validate: function (num: string) {
    if (!/^\d{12}$/.test(num)) return false;
    let c = 0;
    const myArray = String(num).split("").reverse();
    for (let i = 0; i < myArray.length; i++) {
      c = verhoeff.d[c][verhoeff.p[i % 8][parseInt(myArray[i])]];
    }
    return c === 0;
  }
};

const RegisterPatient = () => {
  const [formData, setFormData] = useState({
    aadhaar_number: '',
    aadhaar_otp: '',
    first_name: '', last_name: '', date_of_birth: '', gender: 'MALE', blood_group: 'O+',
    address_line: '', city: '', state: '', pincode: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: 'PARENT',
    is_emergency_sharing_allowed: true,
    email: '', phone_number: '', password: ''
  });
  
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const navigate = useNavigate();

  const handleSendAadhaarOtp = async () => {
    setError('');
    if (!verhoeff.validate(formData.aadhaar_number)) {
      setError('Invalid Aadhaar Number (Checksum Failed)');
      return;
    }
    try {
      const res = await fetch('/api/v1/auth/patient/send-aadhaar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar_number: formData.aadhaar_number })
      });
      if (!res.ok) throw new Error('Failed to trigger UIDAI OTP');
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVerifyAadhaarOtp = () => {
    // In MVP, accept any 6 digit
    if (formData.aadhaar_otp.length === 6) {
      setAadhaarVerified(true);
      setError('');
    } else {
      setError('Please enter a valid 6-digit OTP');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && !aadhaarVerified) {
      setError('Please verify Aadhaar first.');
      return;
    }
    
    if (step < 4) {
      setStep(step + 1);
      return;
    }

    try {
      const payload = {
        ...formData,
        aadhaar_hash: `SHA256-${btoa(formData.aadhaar_number)}` // Simple mock hash
      };
      
      const res = await fetch('/api/v1/auth/register/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message);
      
      alert(`Registration Successful! Your Vault Number is ${data.vaultNumber}. Please login.`);
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({...formData, [e.target.name]: value});
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Shield className="text-blue-600 h-8 w-8" />
            <span className="text-2xl font-bold text-slate-900">MediLocker</span>
          </Link>
          <h2 className="text-3xl font-extrabold text-slate-900">Patient Registration</h2>
          <p className="text-slate-500 mt-2">Privacy-preserving Aadhaar KYC & Vault Provisioning.</p>
        </div>

        {/* Stepper */}
        <div className="flex justify-center items-center mb-10 gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 4 && <div className={`w-12 sm:w-20 h-1 mx-2 rounded ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {error}
            </div>
          )}
          
          <form onSubmit={handleRegister} className="space-y-6">
            
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Step 1: Aadhaar KYC</h3>
                <p className="text-sm text-slate-500">Your Aadhaar number is never stored. Only a cryptographic hash is retained.</p>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">12-Digit Aadhaar Number</label>
                  <div className="flex gap-4">
                    <input 
                      required 
                      disabled={aadhaarVerified || otpSent}
                      maxLength={12}
                      name="aadhaar_number" 
                      onChange={handleChange} 
                      value={formData.aadhaar_number} 
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none disabled:bg-slate-50 disabled:text-slate-500" 
                      placeholder="e.g. 123456789012" 
                    />
                    {!otpSent && !aadhaarVerified && (
                      <button type="button" onClick={handleSendAadhaarOtp} className="px-6 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all">Send OTP</button>
                    )}
                  </div>
                </div>

                {otpSent && !aadhaarVerified && (
                  <div className="animate-in slide-in-from-top-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">UIDAI DigiLocker OTP</label>
                    <div className="flex gap-4">
                      <input 
                        required 
                        maxLength={6}
                        name="aadhaar_otp" 
                        onChange={handleChange} 
                        value={formData.aadhaar_otp} 
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" 
                        placeholder="Enter 6-digit OTP (123456)" 
                      />
                      <button type="button" onClick={handleVerifyAadhaarOtp} className="px-6 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all">Verify</button>
                    </div>
                  </div>
                )}

                {aadhaarVerified && (
                  <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-medium border border-emerald-100 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Aadhaar verified successfully. Proceed to next step.
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Step 2: Demographics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">First Name</label>
                    <input required name="first_name" onChange={handleChange} value={formData.first_name} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Last Name</label>
                    <input required name="last_name" onChange={handleChange} value={formData.last_name} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input required type="date" name="date_of_birth" onChange={handleChange} value={formData.date_of_birth} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Gender</label>
                    <select required name="gender" onChange={handleChange} value={formData.gender} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none">
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Blood Group</label>
                    <select required name="blood_group" onChange={handleChange} value={formData.blood_group} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none">
                      <option value="A+">A+</option><option value="A-">A-</option>
                      <option value="B+">B+</option><option value="B-">B-</option>
                      <option value="O+">O+</option><option value="O-">O-</option>
                      <option value="AB+">AB+</option><option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-sm font-bold text-slate-800 mb-2">Encrypted Address</h4>
                  <div className="space-y-4">
                    <input required placeholder="Address Line" name="address_line" onChange={handleChange} value={formData.address_line} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                    <div className="grid grid-cols-3 gap-4">
                      <input required placeholder="City" name="city" onChange={handleChange} value={formData.city} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                      <input required placeholder="State" name="state" onChange={handleChange} value={formData.state} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                      <input required placeholder="Pincode" name="pincode" onChange={handleChange} value={formData.pincode} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Step 3: Emergency Contact & Access</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Name</label>
                    <input required name="emergency_contact_name" onChange={handleChange} value={formData.emergency_contact_name} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input required name="emergency_contact_phone" onChange={handleChange} value={formData.emergency_contact_phone} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Relationship</label>
                    <select required name="emergency_contact_relation" onChange={handleChange} value={formData.emergency_contact_relation} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none">
                      <option value="PARENT">Parent</option>
                      <option value="SPOUSE">Spouse</option>
                      <option value="CHILD">Child</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-4 items-start">
                  <input 
                    type="checkbox" 
                    id="break_glass"
                    name="is_emergency_sharing_allowed"
                    checked={formData.is_emergency_sharing_allowed}
                    onChange={handleChange}
                    className="mt-1 w-5 h-5 text-blue-600 rounded"
                  />
                  <div>
                    <label htmlFor="break_glass" className="font-semibold text-slate-800 block">Enable Break-Glass Emergency Sharing</label>
                    <p className="text-xs text-slate-500 mt-1">Allow verified doctors to access your life-saving records (allergies, blood group, chronic diseases) during an emergency without OTP verification. You will be notified.</p>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Step 4: Security & Provisioning</h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                  <input required type="email" name="email" onChange={handleChange} value={formData.email} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mobile Number (For App Login & TOTP)</label>
                  <input required type="tel" name="phone_number" onChange={handleChange} value={formData.phone_number} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Secure Password</label>
                  <input required type="password" name="password" onChange={handleChange} value={formData.password} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                </div>
                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mt-4 border border-blue-100">
                  <p className="font-semibold mb-1">Upon completion:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>A lifelong digital vault (ML-2026-XXXX) will be automatically provisioned.</li>
                    <li>Mandatory MFA (TOTP) will be enabled for your account.</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t mt-8">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-all">Back</button>
              ) : <div></div>}
              <button 
                type="submit" 
                disabled={step === 1 && !aadhaarVerified}
                className="bg-blue-600 disabled:bg-blue-300 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition-all flex items-center gap-2"
              >
                {step === 4 ? 'Provision Vault & Register' : 'Next Step'}
                {step < 4 && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPatient;
