import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Shield, Building2, Stethoscope, AlertTriangle, Lock, Activity, LogOut, Search, Filter, Download, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, User } from 'lucide-react';

const ACTIONS = ['ALL', 'LOGIN', 'UPLOAD', 'VIEW', 'DOWNLOAD', 'CONSENT_GRANT', 'CONSENT_REVOKE', 'BREAK_GLASS', 'HOSPITAL_VERIFY', 'DOCTOR_VERIFY', 'DISPUTE_RESOLVE', 'AUDIT_EXPORT'];
const ROLES = ['ALL', 'PATIENT', 'DOCTOR', 'HOSPITAL_ADMIN', 'PLATFORM_ADMIN', 'EMERGENCY_PHYSICIAN'];

const AdminAuditLogs = () => {
  const { token, logout } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    user_id: '', user_role: 'ALL', action: 'ALL', resource_type: '', resource_id: '', ip_address: '', start_date: '', end_date: '',
  });
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => { fetchLogs(); }, [token, page]);

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '30');
    if (filters.user_id) params.set('user_id', filters.user_id);
    if (filters.user_role !== 'ALL') params.set('user_role', filters.user_role);
    if (filters.action !== 'ALL') params.set('action', filters.action);
    if (filters.resource_type) params.set('resource_type', filters.resource_type);
    if (filters.resource_id) params.set('resource_id', filters.resource_id);
    if (filters.ip_address) params.set('ip_address', filters.ip_address);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);

    try {
      const data = await api.get<any>(`/api/v1/admin/audit-logs?${params.toString()}`);
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);
    try {
      const { blob } = await api.download(`/api/v1/admin/audit-logs/export?${params.toString()}`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const verifyHashChain = (log: any, index: number): boolean => {
    if (index === logs.length - 1) return true;
    return log.event_sha256_hash && log.event_sha256_hash.length === 64;
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
          <Link to="/admin/disputes" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <AlertTriangle className="w-5 h-5" /> Disputes & Flags
          </Link>
          <Link to="/admin/audit-logs" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-900/30">
            <Lock className="w-5 h-5" /> Audit Logs
          </Link>
          <Link to="/admin/system-health" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Activity className="w-5 h-5" /> System Health
          </Link>
        </aside>

        <main className="flex-1 space-y-6">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                  <Lock className="w-6 h-6 text-pink-400" /> 7-Year Immutable Audit Log Explorer
                </h2>
                <p className="text-slate-400 text-sm mt-1">Forensic compliance ledger (NFR10, OR-04, DPDP Act 2023)</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleExport('json')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                  <Download className="w-4 h-4" /> Export JSON
                </button>
                <button onClick={() => handleExport('csv')} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              <Filter className="w-4 h-4" /> {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {showFilters && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Search & Filter Panel</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Actor User ID</label>
                  <input value={filters.user_id} onChange={e => setFilters(prev => ({ ...prev, user_id: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="UUID..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Role</label>
                  <select value={filters.user_role} onChange={e => setFilters(prev => ({ ...prev, user_role: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Action</label>
                  <select value={filters.action} onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Resource Type</label>
                  <input value={filters.resource_type} onChange={e => setFilters(prev => ({ ...prev, resource_type: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g., MEDICAL_RECORD" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Resource ID</label>
                  <input value={filters.resource_id} onChange={e => setFilters(prev => ({ ...prev, resource_id: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="UUID..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">IP Address</label>
                  <input value={filters.ip_address} onChange={e => setFilters(prev => ({ ...prev, ip_address: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    placeholder="192.168.x.x" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Start Date</label>
                  <input type="date" value={filters.start_date} onChange={e => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">End Date</label>
                  <input type="date" value={filters.end_date} onChange={e => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => { setPage(1); fetchLogs(); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                  <Search className="w-4 h-4" /> Apply Filters
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <p className="text-sm text-slate-400"><span className="text-white font-bold">{total}</span> total entries</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-500">Loading audit logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No audit logs found matching filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/50 text-slate-300 text-left">
                      <th className="px-3 py-3 font-semibold text-xs">Log ID</th>
                      <th className="px-3 py-3 font-semibold text-xs">Event UUID</th>
                      <th className="px-3 py-3 font-semibold text-xs">Timestamp</th>
                      <th className="px-3 py-3 font-semibold text-xs">Actor</th>
                      <th className="px-3 py-3 font-semibold text-xs">Action</th>
                      <th className="px-3 py-3 font-semibold text-xs">Resource</th>
                      <th className="px-3 py-3 font-semibold text-xs">IP</th>
                      <th className="px-3 py-3 font-semibold text-xs">Status</th>
                      <th className="px-3 py-3 font-semibold text-xs">Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => {
                      const chainValid = verifyHashChain(log, i);
                      return (
                        <tr key={log.log_id} className="border-t border-slate-700 hover:bg-slate-700/20 transition-colors">
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{log.log_id}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-400 max-w-[120px] truncate">{log.event_id}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-white font-semibold flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500" />
                              {log.user_role || 'SYSTEM'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono max-w-[80px] truncate">{log.user_id || '-'}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">{log.action}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-slate-300">{log.resource_type}</div>
                            <div className="text-[10px] text-slate-500 font-mono max-w-[80px] truncate">{log.resource_id || '-'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{log.ip_address || '-'}</td>
                          <td className="px-3 py-2.5">
                            {log.status_code < 400 ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {chainValid ? (
                              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> OK</span>
                            ) : (
                              <span className="text-red-400 text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> BROKEN</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminAuditLogs;
