import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle,
  XCircle
} from 'lucide-react';

const ACTIONS = [
  'ALL',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'RECORD_UPLOAD',
  'RECORD_VIEW',
  'RECORD_FLAG',
  'RECORD_DELETE',
  'CONSENT_GRANT',
  'CONSENT_REVOKE',
  'EMERGENCY_ACCESS_INITIATED',
  'PRESCRIPTION_ISSUED',
  'HOSPITAL_VERIFIED',
  'DOCTOR_VERIFIED',
];

const ROLES = ['ALL', 'PATIENT', 'DOCTOR', 'HOSPITAL_ADMIN', 'PLATFORM_ADMIN', 'EMERGENCY_PHYSICIAN'];

const AdminAuditLogs = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    user_id: '',
    user_role: 'ALL',
    action: 'ALL',
    resource_type: '',
    resource_id: '',
    ip_address: '',
    start_date: '',
    end_date: '',
  });

  const limit = 20;
  const totalPages = Math.ceil(total / limit) || 1;

  useEffect(() => {
    fetchLogs();
  }, [token, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.user_role !== 'ALL') params.append('user_role', filters.user_role);
      if (filters.action !== 'ALL') params.append('action', filters.action);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.resource_id) params.append('resource_id', filters.resource_id);
      if (filters.ip_address) params.append('ip_address', filters.ip_address);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const res = await api.get<any>(`/api/v1/admin/audit-logs?${params.toString()}`);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await api.raw(`/api/v1/admin/audit-logs/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medilocker-audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const verifyHashChain = (log: any, index: number): boolean => {
    if (index === logs.length - 1) return true;
    return log.event_sha256_hash && log.event_sha256_hash.length === 64;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              7-Year Cryptographic Audit Trail
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Append-only immutable compliance ledger (NFR10, OR-04, DPDP Act 2023).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport('json')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" /> Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
              showFilters
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" /> {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4 animate-in fade-in">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search & Filter Ledger</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Actor User ID</label>
              <input
                value={filters.user_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, user_id: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="UUID..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Role</label>
              <select
                value={filters.user_role}
                onChange={(e) => setFilters((prev) => ({ ...prev, user_role: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Resource Type</label>
              <input
                value={filters.resource_type}
                onChange={(e) => setFilters((prev) => ({ ...prev, resource_type: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="e.g., MEDICAL_RECORD"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Resource ID</label>
              <input
                value={filters.resource_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, resource_id: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="UUID..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">IP Address</label>
              <input
                value={filters.ip_address}
                onChange={(e) => setFilters((prev) => ({ ...prev, ip_address: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="192.168.x.x"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setPage(1);
                fetchLogs();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Search className="w-4 h-4" /> Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Logs Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <p className="text-xs font-semibold text-slate-500">
            <span className="text-slate-900 font-bold">{total}</span> total compliance records
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 rounded-lg transition-colors text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-600 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 rounded-lg transition-colors text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <div className="w-10 h-10 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600 font-semibold text-sm">Verifying cryptographic log chain...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm">No audit logs found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Log ID</th>
                  <th className="py-3 px-3">Event UUID</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Actor</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Resource</th>
                  <th className="py-3 px-3">IP Address</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Chain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log, i) => {
                  const chainValid = verifyHashChain(log, i);
                  return (
                    <tr key={log.log_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500 font-semibold">#{log.log_id}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-400 max-w-[110px] truncate" title={log.event_id}>
                        {log.event_id}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-xs text-slate-900 font-semibold flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {log.user_role || 'SYSTEM'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono max-w-[90px] truncate">
                          {log.user_id || '-'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 whitespace-nowrap">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-xs text-slate-700 font-medium">{log.resource_type}</div>
                        <div className="text-[10px] text-slate-400 font-mono max-w-[90px] truncate">
                          {log.resource_id || '-'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 font-mono">{log.ip_address || '-'}</td>
                      <td className="py-2.5 px-3">
                        {log.status_code < 400 ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {chainValid ? (
                          <span className="text-emerald-700 text-xs font-bold inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> OK
                          </span>
                        ) : (
                          <span className="text-rose-700 text-xs font-bold inline-flex items-center gap-1 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3 text-rose-600" /> BROKEN
                          </span>
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
    </div>
  );
};

export default AdminAuditLogs;
