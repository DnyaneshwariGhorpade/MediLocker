import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

const RegisterHospital = () => {
  const [formData, setFormData] = useState({
    email: '', phone_number: '', password: '',
    hospital_name: '', registration_number: '', hospital_type: 'MULTI_SPECIALTY',
    contact_email: '', contact_phone: '',
    city: '', state: '', pincode: '',
    license_url: '' // mock S3
  });

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    try {
      await api.post<any>('/api/v1/auth/register/hospital', formData);

      setRegistrationComplete(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      setTimeout(() => {
        setFormData({ ...formData, license_url: `https://mock-s3.com/licenses/${e.target.files![0].name}` });
        setIsUploading(false);
      }, 1500);
    }
  };

  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-slate-100">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Registration Submitted</h2>
          <p className="text-slate-600 mb-6">
            Your Clinical Establishment Act (CEA) registration is under review by platform administrators.
          </p>
          <Link to="/" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all inline-block w-full">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Shield className="text-blue-600 h-8 w-8" />
            <span className="text-2xl font-bold text-slate-900">MediLocker</span>
          </Link>
          <h2 className="text-3xl font-extrabold text-slate-900">Clinical Establishment Registration</h2>
          <p className="text-slate-500 mt-2">Register your hospital under the Clinical Establishment Act.</p>
        </div>

        <div className="flex justify-center items-center mb-10 gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-16 sm:w-24 h-1 mx-2 rounded ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Institution Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Hospital / Clinic Name</label>
                    <input required name="hospital_name" onChange={handleChange} value={formData.hospital_name} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">CEA Registration ID</label>
                    <input required name="registration_number" onChange={handleChange} value={formData.registration_number} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Facility Type</label>
                    <select required name="hospital_type" onChange={handleChange} value={formData.hospital_type} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none">
                      <option value="MULTI_SPECIALTY">Multi-Specialty Hospital</option>
                      <option value="PRIVATE_HOSPITAL">Private Hospital</option>
                      <option value="GOVERNMENT">Government Hospital</option>
                      <option value="CLINIC">Independent Clinic</option>
                      <option value="DIAGNOSTIC_LAB">Diagnostic Lab</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Official Email</label>
                    <input required type="email" name="contact_email" onChange={handleChange} value={formData.contact_email} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Reception / Main Phone</label>
                    <input required type="tel" name="contact_phone" onChange={handleChange} value={formData.contact_phone} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div className="sm:col-span-2 grid grid-cols-3 gap-4">
                    <input required placeholder="City" name="city" onChange={handleChange} value={formData.city} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                    <input required placeholder="State" name="state" onChange={handleChange} value={formData.state} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                    <input required placeholder="Pincode" name="pincode" onChange={handleChange} value={formData.pincode} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Establishment Licenses</h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Upload CEA / Trade Licenses</label>

                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 text-lg">Upload Licenses</p>
                        <p className="text-slate-500 text-sm mt-1">PDF or image formats (Max 10MB)</p>
                      </div>
                    </div>
                  </div>

                  {isUploading && (
                    <div className="mt-4 flex items-center gap-3 text-blue-600 font-medium">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Uploading securely...
                    </div>
                  )}

                  {formData.license_url && !isUploading && (
                    <div className="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-between border border-emerald-100">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-5 h-5" />
                        Licenses uploaded successfully
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Administrator Account</h3>
                <p className="text-sm text-slate-500 mb-4">Set up the credentials for the Hospital Administrator.</p>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Admin Email Address</label>
                  <input required type="email" name="email" onChange={handleChange} value={formData.email} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Admin Mobile Number</label>
                  <input required type="tel" name="phone_number" onChange={handleChange} value={formData.phone_number} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Secure Password</label>
                  <input
                    required
                    type="password"
                    name="password"
                    minLength={12}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                    title="At least 12 characters, including an uppercase letter, a lowercase letter, a digit and a symbol."
                    onChange={handleChange}
                    value={formData.password}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    At least 12 characters, with an uppercase letter, a lowercase letter, a digit and a symbol.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t mt-8">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="px-6 py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-all">Back</button>
              ) : <div></div>}
              <button
                type="submit"
                disabled={step === 2 && !formData.license_url}
                className="bg-blue-600 disabled:bg-blue-300 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition-all"
              >
                {step === 3 ? 'Submit for Verification' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterHospital;
