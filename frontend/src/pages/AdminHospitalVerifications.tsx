import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Shield, Building2, Stethoscope, AlertTriangle, Lock, Activity, LogOut, CheckCircle, XCircle, FileText, Mail, MapPin, X, Clock, Info } from 'lucide-react';

const AdminHospitalVerifications = () => {
  const { token, logout } = useAuth();
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchHospitals(); }, [token]);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      setHospitals(await api.get<any>('/api/v1/admin/verifications/hospitals'));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleVerify = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.raw(`/api/v1/admin/hospitals/${id}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Hospital verified and activated successfully' });
        setHospitals(prev => prev.filter(h => h.hospital_id !== id));
        setSelectedHospital(null);
      } else {
        setMessage({ type: 'error', text: 'Failed to verify hospital' });
      }
    } catch (e) { setMessage({ type: 'error', text: 'Network error' }); }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.raw(`/api/v1/admin/hospitals/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Hospital application rejected' });
        setHospitals(prev => prev.filter(h => h.hospital_id !== id));
        setSelectedHospital(null);
        setShowRejectModal(null);
        setRejectReason('');
      } else {
        setMessage({ type: 'error', text: 'Failed to reject hospital' });
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
          <Link to="/admin/verifications/hospitals" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-900/30">
            <Building2 className="w-5 h-5" /> Hospital Verifications
          </Link>
          <Link to="/admin/verifications/doctors" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
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
                  <Building2 className="w-6 h-6 text-indigo-400" /> Hospital Verification Queue
                </h2>
                <p className="text-slate-400 text-sm mt-1">Review and approve registered hospitals and clinical establishments (FR03)</p>
              </div>
              <span className="bg-amber-500/20 text-amber-400 text-sm font-bold px-3 py-1 rounded-full">{hospitals.length} Pending</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading pending hospitals...</div>
          ) : hospitals.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-300 font-bold">All clear!</p>
              <p className="text-slate-500 text-sm">No pending hospital verifications.</p>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/50 text-slate-300 text-left">
                      <th className="px-4 py-3 font-semibold">Hospital Name</th>
                      <th className="px-4 py-3 font-semibold">CEA Registration ID</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">City</th>
                      <th className="px-4 py-3 font-semibold">State</th>
                      <th className="px-4 py-3 font-semibold">Applied</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospitals.map((h) => (
                      <tr key={h.hospital_id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-white">{h.hospital_name}</td>
                        <td className="px-4 py-3 text-slate-300 font-mono text-xs">{h.registration_number}</td>
                        <td className="px-4 py-3"><span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg text-xs font-bold">{h.hospital_type}</span></td>
                        <td className="px-4 py-3 text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {h.contact_email || h.users?.email}</td>
                        <td className="px-4 py-3 text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {h.city}</td>
                        <td className="px-4 py-3 text-slate-400">{h.state}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(h.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setSelectedHospital(h)} className="text-indigo-400 hover:text-indigo-300 p-1" title="Inspect Details">
                              <FileText className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleVerify(h.hospital_id)} disabled={actionLoading === h.hospital_id}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                              {actionLoading === h.hospital_id ? '...' : 'Approve'}
                            </button>
                            <button onClick={() => setShowRejectModal(h.hospital_id)}
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

          {selectedHospital && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedHospital(null)}>
              <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" /> Hospital Inspection
                  </h3>
                  <button onClick={() => setSelectedHospital(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Hospital Name</p>
                      <p className="text-white font-bold">{selectedHospital.hospital_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Registration Number</p>
                      <p className="text-white font-mono">{selectedHospital.registration_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Hospital Type</p>
                      <p className="text-white">{selectedHospital.hospital_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Contact Email</p>
                      <p className="text-white">{selectedHospital.contact_email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Phone</p>
                      <p className="text-white">{selectedHospital.contact_phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">City / State</p>
                      <p className="text-white">{selectedHospital.city}, {selectedHospital.state}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500 font-semibold">Address</p>
                      <p className="text-white">{selectedHospital.address || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold mb-2 flex items-center gap-1"><FileText className="w-3 h-3" /> Clinical Establishment Act License Documents</p>
                    <div className="bg-slate-600/50 rounded-lg p-4 text-center text-slate-400 text-sm border border-dashed border-slate-500">
                      <Info className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                      License documents available for review in S3 vault
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { handleVerify(selectedHospital.hospital_id); }} disabled={actionLoading === selectedHospital.hospital_id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" /> Approve & Activate
                    </button>
                    <button onClick={() => { setShowRejectModal(selectedHospital.hospital_id); setSelectedHospital(null); }}
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
                  <h3 className="text-lg font-bold text-white">Reject Application</h3>
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

export default AdminHospitalVerifications;
