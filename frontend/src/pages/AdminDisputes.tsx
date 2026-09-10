import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Building2, Stethoscope, AlertTriangle, Lock, Activity,
  LogOut, CheckCircle, XCircle, FileText, X, Clock, Eye,
  ChevronRight, ArrowRight, Flag, Search as SearchIcon
} from 'lucide-react';

const STATUS_TABS = ['ALL', 'FLAGGED', 'UNDER_REVIEW', 'RESOLVED'];
const STATUS_COLORS: Record<string, string> = {
  FLAGGED: 'bg-red-500/20 text-red-400 border-red-500/30',
  UNDER_REVIEW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  RESOLVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  NORMAL: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const AdminDisputes = () => {
  const { token, logout } = useAuth();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('FLAGGED');
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveForm, setResolveForm] = useState({ status: 'RESOLVED', action: 'VALIDATE_CORRECT', adminNotes: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchDisputes(); }, [token, activeTab]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/disputes?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDisputes(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleResolve = async () => {
    if (!selectedDispute) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/disputes/${selectedDispute.flag_id}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(resolveForm),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Dispute updated successfully. Patient and doctor notified via SMS/Email.' });
        setSelectedDispute(null);
        fetchDisputes();
      } else {
        setMessage({ type: 'error', text: 'Failed to update dispute' });
      }
    } catch (e) { setMessage({ type: 'error', text: 'Network error' }); }
    setActionLoading(false);
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
          <Link to="/admin/verifications/doctors" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Stethoscope className="w-5 h-5" /> Doctor Verifications
          </Link>
          <Link to="/admin/disputes" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-900/30">
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
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" /> Record Flagging & Dispute Resolution Center
            </h2>
            <div className="flex gap-2 flex-wrap">
              {STATUS_TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading disputes...</div>
          ) : disputes.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-300 font-bold">No disputes</p>
              <p className="text-slate-500 text-sm">No records match the selected filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map((d) => (
                <div key={d.flag_id} className="bg-slate-800 rounded-2xl border border-slate-700 p-5 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => { setSelectedDispute(d); setResolveForm({ status: d.flag_lifecycle_status === 'RESOLVED' ? 'RESOLVED' : 'UNDER_REVIEW', action: 'VALIDATE_CORRECT', adminNotes: d.admin_notes || '' }); }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${STATUS_COLORS[d.flag_lifecycle_status] || STATUS_COLORS.NORMAL}`}>
                          {d.flag_lifecycle_status}
                        </span>
                        <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-lg text-xs font-bold">{d.flag_reason}</span>
                      </div>
                      <h3 className="text-white font-bold mb-1">{d.medical_records?.record_title || 'Medical Record'}</h3>
                      <p className="text-slate-400 text-sm mb-2">{d.reason_details || 'No details provided'}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(d.created_at).toLocaleString()}</span>
                        <span>Patient: {d.medical_records?.patients?.first_name} {d.medical_records?.patients?.last_name}</span>
                        <span>Category: {d.medical_records?.category}</span>
                        {d.flagged_by && <span>Flagged by: {d.flagged_by.email} ({d.flagged_by.user_role})</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 shrink-0 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDispute && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedDispute(null)}>
              <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Flag className="w-5 h-5 text-amber-400" /> Dispute Adjudication Studio
                  </h3>
                  <button onClick={() => setSelectedDispute(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Record Details</h4>
                      <div className="bg-slate-700/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="text-xs text-slate-500">Record Title</p>
                          <p className="text-white font-bold">{selectedDispute.medical_records?.record_title}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Category</p>
                          <p className="text-white">{selectedDispute.medical_records?.category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Patient</p>
                          <p className="text-white">{selectedDispute.medical_records?.patients?.first_name} {selectedDispute.medical_records?.patients?.last_name} ({selectedDispute.medical_records?.patients?.vault_number})</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">File Hash (SHA-256)</p>
                          <p className="text-white font-mono text-xs break-all">{selectedDispute.medical_records?.file_sha256_hash}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Version</p>
                          <p className="text-white">v{selectedDispute.medical_records?.version}</p>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Submitter Notes</h4>
                      <div className="bg-slate-700/50 rounded-xl p-4">
                        <p className="text-white text-sm">{selectedDispute.reason_details || 'No notes provided'}</p>
                        <p className="text-slate-500 text-xs mt-2">Flagged by: {selectedDispute.flagged_by?.email} ({selectedDispute.flagged_by?.user_role}) on {new Date(selectedDispute.created_at).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Adjudication Actions</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-semibold text-slate-400 block mb-1">Target Status</label>
                          <select value={resolveForm.status} onChange={e => setResolveForm(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="FLAGGED">Re-Flag</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-400 block mb-1">Resolution Action</label>
                          <select value={resolveForm.action} onChange={e => setResolveForm(prev => ({ ...prev, action: e.target.value }))}
                            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                            <option value="VALIDATE_CORRECT">Validate as Correct</option>
                            <option value="REPLACE_VERSION">Replace Version</option>
                            <option value="REJECT_FLAG">Reject Flag</option>
                            <option value="ARCHIVE_RECORD">Archive Record</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-400 block mb-1">Admin Notes</label>
                          <textarea value={resolveForm.adminNotes} onChange={e => setResolveForm(prev => ({ ...prev, adminNotes: e.target.value }))}
                            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-24"
                            placeholder="Add adjudication notes..." />
                        </div>
                      </div>

                      <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600">
                        <p className="text-xs text-slate-500 mb-2">Status Lifecycle</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-1 rounded bg-slate-600 text-slate-300">Normal</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">Flagged</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400">Under Review</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Resolved</span>
                        </div>
                      </div>

                      <button onClick={handleResolve} disabled={actionLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                        {actionLoading ? 'Processing...' : 'Submit Adjudication'}
                      </button>
                    </div>
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

export default AdminDisputes;
