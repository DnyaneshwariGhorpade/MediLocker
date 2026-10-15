import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
  ChevronRight,
  ArrowRight,
  Flag,
  AlertCircle
} from 'lucide-react';

const STATUS_TABS = ['ALL', 'FLAGGED', 'UNDER_REVIEW', 'RESOLVED'];
const STATUS_COLORS: Record<string, string> = {
  FLAGGED: 'bg-rose-50 text-rose-700 border-rose-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NORMAL: 'bg-slate-50 text-slate-700 border-slate-200',
};

const AdminDisputes = () => {
  const { token } = useAuth();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('FLAGGED');
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    status: 'RESOLVED',
    action: 'VALIDATE_CORRECT',
    adminNotes: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchDisputes();
  }, [token, activeTab]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      setDisputes(await api.get<any[]>(`/api/v1/admin/disputes?status=${activeTab}`));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleResolve = async () => {
    if (!selectedDispute) return;
    setActionLoading(true);
    try {
      const res = await api.raw(`/api/v1/admin/disputes/${selectedDispute.flag_id}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(resolveForm),
      });
      if (res.ok) {
        setMessage({
          type: 'success',
          text: 'Dispute updated successfully. Patient and doctor notified via SMS/Email.',
        });
        setSelectedDispute(null);
        fetchDisputes();
      } else {
        setMessage({ type: 'error', text: 'Failed to update dispute' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error occurred during resolution' });
    }
    setActionLoading(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {message && (
        <div
          className={`p-4 rounded-2xl font-medium flex items-center gap-3 shadow-sm border ${
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
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Dispute & Flag Adjudication Studio
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Review patient complaints, data inaccuracies, and cryptographic hash mismatch flags.
            </p>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-semibold text-sm">Loading records dispute ledger...</p>
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No disputes found</h3>
          <p className="text-slate-500 text-sm mt-1">No medical records match the "{activeTab}" filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div
              key={d.flag_id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => {
                setSelectedDispute(d);
                setResolveForm({
                  status: d.flag_lifecycle_status === 'RESOLVED' ? 'RESOLVED' : 'UNDER_REVIEW',
                  action: 'VALIDATE_CORRECT',
                  adminNotes: d.admin_notes || '',
                });
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        STATUS_COLORS[d.flag_lifecycle_status] || STATUS_COLORS.NORMAL
                      }`}
                    >
                      {d.flag_lifecycle_status}
                    </span>
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      {d.flag_reason}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {d.medical_records?.record_title || 'Medical Record'}
                  </h3>
                  <p className="text-slate-600 text-sm mb-3">{d.reason_details || 'No details provided'}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5" /> {new Date(d.created_at).toLocaleString()}
                    </span>
                    <span className="text-slate-600">
                      Patient:{' '}
                      <strong className="text-slate-700">
                        {d.medical_records?.patients?.first_name} {d.medical_records?.patients?.last_name}
                      </strong>
                    </span>
                    <span className="text-slate-600">Category: {d.medical_records?.category}</span>
                    {d.flagged_by && (
                      <span className="text-slate-500">
                        Flagged by: {d.flagged_by.email} ({d.flagged_by.user_role})
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjudication Modal */}
      {selectedDispute && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedDispute(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-600" /> Dispute Adjudication Studio
              </h3>
              <button
                onClick={() => setSelectedDispute(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Record Details</h4>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Record Title</p>
                      <p className="text-sm font-bold text-slate-900">{selectedDispute.medical_records?.record_title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Category</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedDispute.medical_records?.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Patient</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {selectedDispute.medical_records?.patients?.first_name}{' '}
                        {selectedDispute.medical_records?.patients?.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">File Hash (SHA-256)</p>
                      <p className="text-xs font-mono text-slate-700 break-all select-all mt-0.5">
                        {selectedDispute.medical_records?.file_sha256_hash}
                      </p>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Submitter Complaint</h4>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-800">{selectedDispute.reason_details || 'No notes provided'}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Submitted on {new Date(selectedDispute.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Adjudication Actions</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Target Status
                      </label>
                      <select
                        value={resolveForm.status}
                        onChange={(e) => setResolveForm((prev) => ({ ...prev, status: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="FLAGGED">Re-Flag</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Resolution Action
                      </label>
                      <select
                        value={resolveForm.action}
                        onChange={(e) => setResolveForm((prev) => ({ ...prev, action: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="VALIDATE_CORRECT">Validate as Correct</option>
                        <option value="REPLACE_VERSION">Replace Version</option>
                        <option value="REJECT_FLAG">Reject Flag</option>
                        <option value="ARCHIVE_RECORD">Archive Record</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Admin Adjudication Notes
                      </label>
                      <textarea
                        value={resolveForm.adminNotes}
                        onChange={(e) => setResolveForm((prev) => ({ ...prev, adminNotes: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none h-24"
                        placeholder="Add resolution details..."
                      />
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100 text-xs">
                    <p className="font-semibold text-indigo-900 mb-2">Status Lifecycle</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">Normal</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Flagged</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Under Review</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>
                    </div>
                  </div>

                  <button
                    onClick={handleResolve}
                    disabled={actionLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                  >
                    {actionLoading ? 'Processing...' : 'Submit Adjudication'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDisputes;
