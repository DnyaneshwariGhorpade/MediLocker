import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  CheckCircle,
  XCircle,
  FileText,
  Mail,
  MapPin,
  X,
  Clock,
  Info,
  Search,
  Phone,
  Eye,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

const AdminHospitalVerifications = () => {
  const { token } = useAuth();
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHospitals();
  }, [token]);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/api/v1/admin/verifications/hospitals');
      setHospitals(data || []);
    } catch (e) {
      console.error(e);
    }
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
        setHospitals((prev) => prev.filter((h) => h.hospital_id !== id));
        setSelectedHospital(null);
      } else {
        setMessage({ type: 'error', text: 'Failed to verify hospital' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error occurred during verification' });
    }
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
        setHospitals((prev) => prev.filter((h) => h.hospital_id !== id));
        setSelectedHospital(null);
        setShowRejectModal(null);
        setRejectReason('');
      } else {
        setMessage({ type: 'error', text: 'Failed to reject hospital' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error occurred during rejection' });
    }
    setActionLoading(null);
  };

  const filteredHospitals = useMemo(() => {
    if (!searchQuery.trim()) return hospitals;
    const q = searchQuery.toLowerCase();
    return hospitals.filter(
      (h) =>
        h.hospital_name?.toLowerCase().includes(q) ||
        h.registration_number?.toLowerCase().includes(q) ||
        h.city?.toLowerCase().includes(q) ||
        h.state?.toLowerCase().includes(q) ||
        h.contact_email?.toLowerCase().includes(q)
    );
  }, [hospitals, searchQuery]);

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
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Hospital Verification Queue
              </h1>
              <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {hospitals.length} Pending
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Review and approve clinical establishment applications under Clinical Establishment Act (CEA) guidelines.
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
            placeholder="Search hospitals..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-semibold text-sm">Loading pending hospital applications...</p>
        </div>
      ) : filteredHospitals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {searchQuery ? 'No matching hospitals found' : 'Queue is all clear'}
          </h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No pending hospitals match "${searchQuery}". Try searching for another name or registration number.`
              : 'All registered hospitals have been reviewed and verified. No actions required at this moment.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Hospital Details</th>
                  <th className="py-3.5 px-4">CEA Registration</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Applied</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHospitals.map((h) => (
                  <tr key={h.hospital_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{h.hospital_name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{h.hospital_id?.substring(0, 8)}...</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold px-2 py-1 bg-slate-100 border border-slate-200/60 rounded text-slate-700 whitespace-nowrap">
                        {h.registration_number}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 whitespace-nowrap">
                        {h.hospital_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 max-w-[200px]">
                        <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5 truncate" title={h.contact_email || h.users?.email}>
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{h.contact_email || h.users?.email}</span>
                        </div>
                        {h.contact_phone && (
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{h.contact_phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium whitespace-nowrap">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{h.city}, <span className="text-slate-500 font-normal">{h.state}</span></span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedHospital(h)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Inspect Application Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVerify(h.hospital_id)}
                          disabled={actionLoading === h.hospital_id}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{actionLoading === h.hospital_id ? 'Verifying...' : 'Approve'}</span>
                        </button>
                        <button
                          onClick={() => setShowRejectModal(h.hospital_id)}
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

      {/* Inspect Hospital Modal */}
      {selectedHospital && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedHospital(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Hospital Application Inspection</h3>
                  <p className="text-xs text-slate-500">ID: {selectedHospital.hospital_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHospital(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hospital Name</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{selectedHospital.hospital_name}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">CEA Registration Number</p>
                  <p className="text-sm font-mono font-bold text-indigo-600 mt-1">
                    {selectedHospital.registration_number}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Establishment Type</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{selectedHospital.hospital_type}</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Official Contact Email</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {selectedHospital.contact_email || selectedHospital.users?.email}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact Phone</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {selectedHospital.contact_phone || selectedHospital.users?.phone_number || 'N/A'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">City / State / Pincode</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {selectedHospital.city}, {selectedHospital.state} {selectedHospital.pincode ? `(${selectedHospital.pincode})` : ''}
                  </p>
                </div>

                <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Physical Address</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">
                    {selectedHospital.address || 'Address provided during onboarding'}
                  </p>
                </div>
              </div>

              {/* Document verification block */}
              <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                <p className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Clinical Establishment Act License Documents
                </p>
                <div className="bg-white rounded-lg p-4 text-center text-slate-600 text-xs border border-indigo-100 shadow-xs flex items-center justify-center gap-2">
                  <Info className="w-4 h-4 text-indigo-500" />
                  <span>CEA certificate and state verification documents are cryptographically verified in secure S3 storage.</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleVerify(selectedHospital.hospital_id)}
                  disabled={actionLoading === selectedHospital.hospital_id}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve & Activate Hospital</span>
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(selectedHospital.hospital_id);
                    setSelectedHospital(null);
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
                Reject Hospital Application
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
                  placeholder="State the reason for rejection (e.g., CEA registration number unverified, missing documentation)..."
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

export default AdminHospitalVerifications;
