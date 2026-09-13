import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Fingerprint, Clock, Activity, CheckCircle2, AlertTriangle, PlayCircle } from 'lucide-react';

const HospitalEmergencyVerify = () => {
  const { token } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const [otp, setOtp] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [token]);

  const fetchRequests = async () => {
    try {
      setRequests(await api.get<any>('/api/v1/emergency/pending-requests'));
    } catch (e) { console.error(e); }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !otp) return;
    setIsApproving(true);
    try {
      const res = await api.raw('/api/v1/emergency/approve', {
        method: 'POST',
        body: JSON.stringify({ session_id: selectedRequest.session_id, otp })
      });
      if (res.ok) {
        setSelectedRequest(null);
        setOtp('');
        fetchRequests();
        alert("Emergency Session Approved (4-Hour Validity). Patient Notified.");
      } else {
        alert("Invalid OTP or error approving.");
      }
    } catch (e) { console.error(e); }
    setIsApproving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-600 animate-pulse" />
            Emergency Break-Glass Approvals
          </h1>
          <p className="text-slate-500 mt-2">Authorize critical, time-limited overrides for unresponsive patients.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests.map(req => (
            <div key={req.session_id} className="bg-white p-6 rounded-3xl border-2 border-rose-100 shadow-sm flex flex-col hover:border-rose-300 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3" /> Action Required
                </span>
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(req.session_start_at).toLocaleTimeString()}</span>
              </div>

              <div className="space-y-2 mb-4 flex-1">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Patient Details</p>
                <p className="text-lg font-bold text-slate-800">{req.patients.first_name} {req.patients.last_name}</p>
                <p className="font-mono text-sm text-slate-600 bg-slate-50 px-2 py-1 rounded border inline-block">Vault: {req.patients.patient_vaults?.vault_number}</p>

                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-4">Requesting ER Physician</p>
                <p className="text-base font-semibold text-slate-800 flex items-center gap-2">Dr. {req.doctors.first_name} {req.doctors.last_name} <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label="Verified Staff" /></p>

                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 mt-4">
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">Clinical Justification</p>
                  <p className="text-sm text-rose-900 font-medium italic">"{req.emergency_reason}"</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRequest(req)}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 shadow-md transition-colors"
              >
                Review & Authorize
              </button>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 border-dashed">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-30 text-emerald-500" />
              <p className="font-semibold text-lg text-slate-700">No Pending Emergency Requests</p>
              <p className="text-sm mt-1 text-slate-400">All queues clear. ER is operating normally.</p>
            </div>
          )}
        </div>

      </div>

      {/* 2FA Approval Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleApprove} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>

             <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mb-2">
               <Fingerprint className="w-6 h-6 text-rose-600" /> 2-Factor Authorization
             </h2>
             <p className="text-sm text-slate-500 mb-6 leading-relaxed">
               By approving this request, you are granting Dr. {selectedRequest.doctors.last_name} a <strong className="text-rose-600">4-Hour Temporary Session</strong> to bypass patient consent for life-saving measures. An immutable audit log will be generated.
             </p>

             <div className="space-y-4 mb-6">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Administrator OTP (Mock: 123456)</label>
                 <input
                   required autoFocus
                   value={otp} onChange={e => setOtp(e.target.value)}
                   placeholder="Enter 6-digit TOTP"
                   className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-rose-500 focus:ring-0 outline-none text-center font-mono text-2xl tracking-[0.5em] font-bold text-slate-800"
                   maxLength={6}
                 />
               </div>
             </div>

             <div className="flex gap-3">
               <button type="button" onClick={() => { setSelectedRequest(null); setOtp(''); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                 Cancel
               </button>
               <button type="submit" disabled={isApproving} className="flex-[2] bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                 {isApproving ? 'Authorizing...' : <><PlayCircle className="w-5 h-5"/> Grant Access</>}
               </button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default HospitalEmergencyVerify;
