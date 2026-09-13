import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Shield, Building2, Stethoscope, AlertTriangle, Lock, Activity, LogOut, CheckCircle, XCircle, FileText, Fingerprint, X, Info, Key } from 'lucide-react';

const AdminDoctorVerifications = () => {
  const { token, logout } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchDoctors(); }, [token]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      setDoctors(await api.get<any>('/api/v1/admin/verifications/doctors'));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleVerify = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.raw(`/api/v1/admin/doctors/${id}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Doctor verified and activated successfully' });
        setDoctors(prev => prev.filter(d => d.doctor_id !== id));
        setSelectedDoctor(null);
      } else {
        setMessage({ type: 'error', text: 'Failed to verify doctor' });
      }
    } catch (e) { setMessage({ type: 'error', text: 'Network error' }); }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.raw(`/api/v1/admin/doctors/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Doctor application rejected' });
        setDoctors(prev => prev.filter(d => d.doctor_id !== id));
        setSelectedDoctor(null);
        setShowRejectModal(null);
        setRejectReason('');
      } else {
        setMessage({ type: 'error', text: 'Failed to reject doctor' });
      }
    } catch (e) { setMessage({ type: 'error', text: 'Network error' }); }
    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Shield className="text-indigo-400 w-8 h-8" />
          <h1 className="text-xl font-extrabold text-white">MediLocker <span className="text-indigo-400">Admin</span></h1>
        </div>
        <button onClick={logout} className="text-slate-400 hover:text-slate-200"><LogOut className="w-5 h-5" /></button>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0 space-y-2">
          <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Activity className="w-5 h-5" /> Command Center
          </Link>
          <Link to="/admin/verifications/hospitals" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Building2 className="w-5 h-5" /> Hospital Verifications
          </Link>
          <Link to="/admin/verifications/doctors" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-900/30">
            <Stethoscope className="w-5 h-5" /> Doctor Verifications
          </Link>
          <Link to="/admin/disputes" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <AlertTriangle className="w-5 h-5" /> Disputes & Flags
          </Link>
          <Link to="/admin/audit-logs" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Lock className="w-5 h-5" /> Audit Logs
          </Link>
          <Link to="/admin/system-health" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Activity className="w-5 h-5" /> System Health
          </Link>
        </aside>

        <main className="flex-1 space-y-6">
          {message && (
            <div className={`p-4 rounded-xl font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-900/50 border border-emerald-700 text-emerald-300' : 'bg-red-900/50 border border-red-700 text-red-300'}`}>
              {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {message.text}
              <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          )}

          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                  <Stethoscope className="w-6 h-6 text-emerald-400" /> Doctor License Verification Queue
                </h2>
                <p className="text-slate-400 text-sm mt-1">Verify doctor Medical Registration Numbers (MRN) with State Medical Councils (FR02)</p>
              </div>
              <span className="bg-amber-500/20 text-amber-400 text-sm font-bold px-3 py-1 rounded-full">{doctors.length} Pending</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading pending doctors...</div>
          ) : doctors.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-300 font-bold">All clear!</p>
              <p className="text-slate-500 text-sm">No pending doctor verifications.</p>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/50 text-slate-300 text-left">
                      <th className="px-4 py-3 font-semibold">Doctor Name</th>
                      <th className="px-4 py-3 font-semibold">MRN</th>
                      <th className="px-4 py-3 font-semibold">State Medical Council</th>
                      <th className="px-4 py-3 font-semibold">Specialization</th>
                      <th className="px-4 py-3 font-semibold">Hospital</th>
                      <th className="px-4 py-3 font-semibold">Key Fingerprint</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((d) => (
                      <tr key={d.doctor_id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-white">Dr. {d.first_name} {d.last_name}</td>
                        <td className="px-4 py-3 text-slate-300 font-mono text-xs">{d.mrn}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{d.state_medical_council}</td>
                        <td className="px-4 py-3"><span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg text-xs font-bold">{d.specialization}</span></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{d.hospitals?.hospital_name || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs flex items-center gap-1">
                          <Fingerprint className="w-3 h-3" /> {d.key_fingerprint?.substring(0, 12)}...
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setSelectedDoctor(d)} className="text-indigo-400 hover:text-indigo-300 p-1" title="Inspect License">
                              <FileText className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleVerify(d.doctor_id)} disabled={actionLoading === d.doctor_id}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                              {actionLoading === d.doctor_id ? '...' : 'Verify'}
                            </button>
                            <button onClick={() => setShowRejectModal(d.doctor_id)}
                              className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedDoctor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedDoctor(null)}>
              <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" /> License Inspection
                  </h3>
                  <button onClick={() => setSelectedDoctor(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Full Name</p>
                      <p className="text-white font-bold">Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Medical Registration Number</p>
                      <p className="text-white font-mono">{selectedDoctor.mrn}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">State Medical Council</p>
                      <p className="text-white">{selectedDoctor.state_medical_council}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Specialization</p>
                      <p className="text-white">{selectedDoctor.specialization}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Qualification</p>
                      <p className="text-white">{selectedDoctor.qualification}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Experience</p>
                      <p className="text-white">{selectedDoctor.experience_years || 0} years</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 font-semibold">Affiliated Hospital</p>
                      <p className="text-white">{selectedDoctor.hospitals?.hospital_name || 'Not affiliated'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-semibold mb-2 flex items-center gap-1"><FileText className="w-3 h-3" /> Medical Council Certificate</p>
                      <div className="bg-slate-600/50 rounded-lg p-4 text-center text-slate-400 text-sm border border-dashed border-slate-500">
                        <Info className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                        Certificate uploaded to S3 vault
                      </div>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-semibold mb-2 flex items-center gap-1"><Key className="w-3 h-3" /> Government Photo ID</p>
                      <div className="bg-slate-600/50 rounded-lg p-4 text-center text-slate-400 text-sm border border-dashed border-slate-500">
                        <Info className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                        Govt. ID uploaded to S3 vault
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold mb-1">Public Key Fingerprint</p>
                    <p className="text-white font-mono text-xs break-all">{selectedDoctor.key_fingerprint}</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => handleVerify(selectedDoctor.doctor_id)} disabled={actionLoading === selectedDoctor.doctor_id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" /> Verify & Activate Doctor
                    </button>
                    <button onClick={() => { setShowRejectModal(selectedDoctor.doctor_id); setSelectedDoctor(null); }}
                      className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <XCircle className="w-5 h-5" /> Reject Application
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showRejectModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRejectModal(null)}>
              <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Reject Doctor Application</h3>
                  <button onClick={() => setShowRejectModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-400 block mb-2">Reason for Rejection</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-24"
                      placeholder="Provide reason for rejection..." />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowRejectModal(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors">Cancel</button>
                    <button onClick={() => handleReject(showRejectModal)} disabled={actionLoading === showRejectModal}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
                      {actionLoading === showRejectModal ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDoctorVerifications;
