import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  Link2,
  Users,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DEGRADED: 'bg-amber-50 text-amber-700 border-amber-200',
  DOWN: 'bg-rose-50 text-rose-700 border-rose-200',
};

const AdminSystemHealth = () => {
  const { token } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, token]);

  const fetchData = async () => {
    try {
      const [healthRes, blocksRes] = await Promise.all([
        api.raw('/api/v1/admin/system-health', {}),
        api.raw('/api/v1/admin/blockchain/blocks', {}),
      ]);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (blocksRes.ok) setBlocks(await blocksRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading)
    return (
      <div className="p-16 text-center">
        <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-semibold text-sm">Measuring platform infrastructure health...</p>
      </div>
    );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Infrastructure & Blockchain Ledger Health
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Real-time telemetry, KMS key management, and cryptographic blockchain anchors.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchData()}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {autoRefresh ? '● Auto-Refresh ON' : '○ Auto-Refresh OFF'}
          </button>
        </div>
      </div>

      {/* Deployment reality */}
      {health?.deployment && (
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Deployment Architecture: {health.deployment.topology}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{health.deployment.note}</p>
          </div>
        </section>
      )}

      {/* Measured platform metrics */}
      {health?.process && (
        <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <Cpu className="w-5 h-5 text-blue-600 mb-2" />
            <p className="text-xl font-extrabold text-slate-900">{health.deployment.nodeVersion}</p>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Node.js Engine</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <HardDrive className="w-5 h-5 text-indigo-600 mb-2" />
            <p className="text-xl font-extrabold text-slate-900">{health.process.heapUsedMB} MB</p>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Heap Used</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <Database className="w-5 h-5 text-emerald-600 mb-2" />
            <p className="text-xl font-extrabold text-slate-900">{health.database.latencyMs} ms</p>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">DB Latency</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <Users className="w-5 h-5 text-cyan-600 mb-2" />
            <p className="text-xl font-extrabold text-slate-900">{health.counts.totalUsers}</p>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Active Users</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <Database className="w-5 h-5 text-amber-600 mb-2" />
            <p className="text-xl font-extrabold text-slate-900">{health.counts.totalRecords}</p>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Vault Records</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <Link2 className="w-5 h-5 text-pink-600 mb-2" />
            <p className="text-xl font-extrabold text-slate-900">{health.counts.totalAnchors}</p>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Ledger Anchors</p>
          </div>
        </section>
      )}

      {/* Attention / Alerts */}
      {health?.alerts &&
        (health.alerts.integrityMismatches > 0 ||
          health.alerts.failedNotifications > 0 ||
          health.alerts.ledgerBroken) && (
          <section className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-rose-900 font-bold flex items-center gap-2 text-sm mb-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" /> Attention Required
            </h3>
            <ul className="text-xs text-rose-800 space-y-1">
              {health.alerts.ledgerBroken && <li>Integrity ledger verification FAILED.</li>}
              {health.alerts.integrityMismatches > 0 && (
                <li>{health.alerts.integrityMismatches} record(s) failed the integrity sweep.</li>
              )}
              {health.alerts.failedNotifications > 0 && (
                <li>{health.alerts.failedNotifications} notification(s) could not be delivered.</li>
              )}
            </ul>
          </section>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consent Cache */}
        {health?.cache && (
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Consent Cache Engine
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  STATUS_COLORS[health.cache.status] || STATUS_COLORS.HEALTHY
                }`}
              >
                {health.cache.driver}
              </span>
            </div>

            {!health.cache.distributed && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                In-process memory cache. Not shared between scaled instances — configure Redis for distributed consensus.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium">Cache Status</span>
                <p className="font-bold text-slate-800 mt-0.5">{health.cache.status}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium">Driver</span>
                <p className="font-bold text-slate-800 mt-0.5">{health.cache.driver}</p>
              </div>
            </div>
          </section>
        )}

        {/* Encrypted Storage & KMS */}
        {health?.storage && (
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <HardDrive className="w-4 h-4 text-indigo-600" /> Vault Storage & KMS Key Hierarchy
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium">Storage Engine</span>
                <p className="font-bold text-slate-800 mt-0.5">{health.storage.driver}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium">Key Management</span>
                <p className="font-bold text-slate-800 mt-0.5">{health.storage.keyProvider}</p>
              </div>
            </div>
            {health.storage.keyProvider === 'LOCAL' && (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200/60 rounded-xl p-3 mt-3">
                Master envelope keys derived from hardware-isolated process environment. Set KEY_PROVIDER=KMS for cloud HSM isolation.
              </p>
            )}
          </section>
        )}

        {/* Notification Delivery */}
        {health?.notifications && (
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Wifi className="w-4 h-4 text-emerald-600" /> Notification Telemetry
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium">Pending Delivery</span>
                <p className="font-bold text-slate-900 text-base mt-0.5">{health.notifications.pending}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium">Failed</span>
                <p
                  className={`font-bold text-base mt-0.5 ${
                    health.notifications.failed > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {health.notifications.failed}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Event Bus */}
        {health?.eventBus && (
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-slate-400" /> Event Bus Status
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {health.eventBus.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{health.eventBus.note}</p>
            </div>
          </section>
        )}
      </div>

      {/* Integrity Blockchain Ledger Table */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-cyan-600" /> Blockchain Cryptographic Anchor Proofs
          </h3>
        </div>
        {blocks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No blockchain anchors recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Anchor ID</th>
                  <th className="py-3 px-3">Record Details</th>
                  <th className="py-3 px-3">Document SHA-256</th>
                  <th className="py-3 px-3">Tx Hash</th>
                  <th className="py-3 px-3">Block #</th>
                  <th className="py-3 px-3">Network</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Anchored</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {blocks.slice(0, 20).map((b) => (
                  <tr key={b.anchor_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500 font-semibold">
                      {b.anchor_id.substring(0, 8)}...
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-xs font-bold text-slate-900">{b.medical_records?.record_title || 'N/A'}</p>
                      <p className="text-[10px] text-slate-400">{b.medical_records?.category}</p>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 max-w-[100px] truncate" title={b.document_sha256}>
                      {b.document_sha256}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 max-w-[100px] truncate" title={b.transaction_tx_id || 'PENDING'}>
                      {b.transaction_tx_id || 'PENDING'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-900 font-bold">{b.block_number?.toString() || '-'}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-500 font-medium">{b.blockchain_network}</td>
                    <td className="py-2.5 px-3">
                      {b.anchor_status === 'CONFIRMED' ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> CONFIRMED
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-amber-600" /> {b.anchor_status}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500 text-right whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminSystemHealth;
