import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Stethoscope,
  CheckCircle,
  XCircle,
  X,
  Fingerprint,
  Search,
  Eye,
  AlertCircle
} from 'lucide-react';

const AdminDoctorVerifications = () => {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDoctors();
  }, [token]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/api/v1/admin/verifications/doctors');
      setDoctors(data || []);
    } catch (e) {
      console.error(e);
    }
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
        setDoctors((prev) => prev.filter((d) => d.doctor_id !== id));
        setSelectedDoctor(null);
      } else {
        setMessage({ type: 'error', text: 'Failed to verify doctor' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error occurred during verification' });
    }
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
        setDoctors((prev) => prev.filter((d) => d.doctor_id !== id));
        setSelectedDoctor(null);
        setShowRejectModal(null);
        setRejectReason('');
      } else {
        setMessage({ type: 'error', text: 'Failed to reject doctor' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error occurred during rejection' });
    }
    setActionLoading(null);
  };

  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;
    const q = searchQuery.toLowerCase();
    return doctors.filter(
      (d) =>
        d.first_name?.toLowerCase().includes(q) ||
        d.last_name?.toLowerCase().includes(q) ||
        d.mrn?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q) ||
        d.state_medical_council?.toLowerCase().includes(q)
    );
  }, [doctors, searchQuery]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-2xl font-medium flex items-center gap-3 shadow-sm border transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-semibold flex-1">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Stethoscope className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Doctor License Verification Queue
              </h1>
              <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {doctors.length} Pending
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Verify Medical Registration Numbers (MRN) with State Medical Councils and inspect cryptographic ECDSA keys.
            </p>
          </div>
        </div>

        {/* Search filter */}
        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctors..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-semibold text-sm">Loading pending doctor licenses...</p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {searchQuery ? 'No matching doctors found' : 'Queue is all clear'}
          </h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No pending doctors match "${searchQuery}". Try searching for another name or MRN.`
              : 'All doctor licenses have been verified. No pending medical credentials in the queue.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Doctor Name</th>
                  <th className="py-3.5 px-4">MRN</th>
                  <th className="py-3.5 px-4">State Medical Council</th>
                  <th className="py-3.5 px-4">Specialization</th>
                  <th className="py-3.5 px-4">Affiliated Hospital</th>
                  <th className="py-3.5 px-4">Key Fingerprint</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDoctors.map((d) => (
                  <tr key={d.doctor_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">Dr. {d.first_name} {d.last_name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{d.doctor_id?.substring(0, 8)}...</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold px-2 py-1 bg-slate-100 border border-slate-200/60 rounded text-slate-700 whitespace-nowrap">
                        {d.mrn}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-xs text-slate-700 font-medium">{d.state_medical_council}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
                        {d.specialization}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-xs text-slate-600 font-medium">
                        {d.hospitals?.hospital_name || 'Independent Practice'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500" title={d.key_fingerprint}>
                        <Fingerprint className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{d.key_fingerprint?.substring(0, 10)}...</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedDoctor(d)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Inspect License & Keys"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVerify(d.doctor_id)}
                          disabled={actionLoading === d.doctor_id}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{actionLoading === d.doctor_id ? 'Verifying...' : 'Verify'}</span>
                        </button>
                        <button
                          onClick={() => setShowRejectModal(d.doctor_id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
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

      {/* Inspect Doctor Modal */}
      {selectedDoctor && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedDoctor(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Doctor License Inspection</h3>
                  <p className="text-xs text-slate-500">ID: {selectedDoctor.doctor_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Doctor Full Name</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Medical Registration Number</p>
                  <p className="text-sm font-mono font-bold text-emerald-600 mt-1">{selectedDoctor.mrn}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">State Medical Council</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{selectedDoctor.state_medical_council}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Specialization</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{selectedDoctor.specialization}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Qualification</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{selectedDoctor.qualification}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Clinical Experience</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{selectedDoctor.experience_years || 0} years</p>
                </div>

                <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Affiliated Hospital</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">
                    {selectedDoctor.hospitals?.hospital_name || 'Independent Practitioner'}
                  </p>
                </div>
              </div>

              {/* Cryptographic key verification */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-emerald-600" />
                  ECDSA P-256 Public Key Fingerprint (SHA-256)
                </p>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-mono text-slate-700 break-all select-all">
                  {selectedDoctor.key_fingerprint || 'No registered public key'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Used for verifying digital cryptographic signatures on electronic prescriptions (eRx).
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleVerify(selectedDoctor.doctor_id)}
                  disabled={actionLoading === selectedDoctor.doctor_id}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Verify & Activate License</span>
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(selectedDoctor.doctor_id);
                    setSelectedDoctor(null);
                  }}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Application</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowRejectModal(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
              <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Reject Doctor Application
              </h3>
              <button
                onClick={() => setShowRejectModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Reason for Rejection
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none h-24 text-sm"
                  placeholder="State the reason for rejection (e.g., MRN mismatch with State Council register, illegible documents)..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(showRejectModal)}
                  disabled={actionLoading === showRejectModal}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all text-sm shadow-sm"
                >
                  {actionLoading === showRejectModal ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDoctorVerifications;
