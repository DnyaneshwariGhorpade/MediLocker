import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Shield, Building2, Stethoscope, AlertTriangle, Lock, Activity, LogOut, Server, Database, Cpu, HardDrive, Wifi, Zap, Link2, Users } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  HEALTHY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  DEGRADED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DOWN: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const AdminSystemHealth = () => {
  const { token, logout } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => { fetchData(); }, [token]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, token]);

  const fetchData = async () => {
    try {
      const [healthRes, blocksRes] = await Promise.all([
        api.raw('/api/v1/admin/system-health', { }),
        api.raw('/api/v1/admin/blockchain/blocks', { }),
      ]);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (blocksRes.ok) setBlocks(await blocksRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500">Loading system health...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Shield className="text-indigo-400 w-8 h-8" />
          <h1 className="text-xl font-extrabold text-white">MediLocker <span className="text-indigo-400">Admin</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${autoRefresh ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
            {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </button>
          <button onClick={logout} className="text-slate-400 hover:text-slate-200"><LogOut className="w-5 h-5" /></button>
        </div>
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
          <Link to="/admin/audit-logs" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Lock className="w-5 h-5" /> Audit Logs
          </Link>
          <Link to="/admin/system-health" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-900/30">
            <Activity className="w-5 h-5" /> System Health
          </Link>
        </aside>

        <main className="flex-1 space-y-6">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-400" /> System Health, Kafka & Blockchain Ledger Explorer
            </h2>
            <p className="text-slate-400 text-sm mt-1">Measured values only. Components that are not deployed are labelled as such.</p>
          </div>

          {/* Deployment reality */}
          {health?.deployment && (
            <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Deployment: {health.deployment.topology}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">{health.deployment.note}</p>
                </div>
              </div>
            </section>
          )}

          {/* Measured platform metrics */}
          {health?.process && (
            <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Cpu className="w-6 h-6 text-blue-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.deployment.nodeVersion}</p>
                <p className="text-xs font-semibold text-slate-400">Node.js</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <HardDrive className="w-6 h-6 text-indigo-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.process.heapUsedMB} MB</p>
                <p className="text-xs font-semibold text-slate-400">Heap Used</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Database className="w-6 h-6 text-emerald-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.database.latencyMs} ms</p>
                <p className="text-xs font-semibold text-slate-400">DB Latency</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Users className="w-6 h-6 text-cyan-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.counts.totalUsers}</p>
                <p className="text-xs font-semibold text-slate-400">Total Users</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Database className="w-6 h-6 text-amber-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.counts.totalRecords}</p>
                <p className="text-xs font-semibold text-slate-400">Medical Records</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Link2 className="w-6 h-6 text-pink-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.counts.totalAnchors}</p>
                <p className="text-xs font-semibold text-slate-400">Ledger Anchors</p>
              </div>
            </section>
          )}

          {/* Alerts first: these need action. */}
          {health?.alerts && (health.alerts.integrityMismatches > 0 || health.alerts.failedNotifications > 0 || health.alerts.ledgerBroken) && (
            <section className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-red-300 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" /> Attention required
              </h3>
              <ul className="text-sm text-red-200 space-y-1">
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
            {/* Consent cache — measured, not simulated */}
            {health?.cache && (
              <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-red-400" /> Consent Cache
                  <span className={`ml-auto px-2 py-0.5 rounded-lg text-xs font-bold border ${STATUS_COLORS[health.cache.status] || STATUS_COLORS.HEALTHY}`}>
                    {health.cache.driver}
                  </span>
                </h3>

                {!health.cache.distributed && (
                  <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                    In-process cache. Not shared between instances — set REDIS_URL for a distributed cache.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Hit Ratio</p>
                    <p className="text-lg font-extrabold text-white">
                      {health.cache.hitRatioPercent === null ? 'no data' : `${health.cache.hitRatioPercent}%`}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Avg Evaluation</p>
                    <p className={`text-lg font-extrabold ${
                      health.cache.avgConsentLatencyMs !== null && health.cache.avgConsentLatencyMs < health.cache.targetMs
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}>
                      {health.cache.avgConsentLatencyMs === null ? 'no data' : `${health.cache.avgConsentLatencyMs} ms`}
                    </p>
                    <p className="text-[10px] text-slate-500">Target: {'<'}{health.cache.targetMs}ms (NFR06)</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Hits / Misses</p>
                    <p className="text-lg font-extrabold text-white">{health.cache.hits} / {health.cache.misses}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Samples</p>
                    <p className="text-lg font-extrabold text-white">{health.cache.samples}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Scheduled jobs */}
            {health?.jobs && (
              <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-emerald-400" /> Scheduled Jobs
                  <span className={`ml-auto px-2 py-0.5 rounded-lg text-xs font-bold border ${
                    health.jobs.enabled ? STATUS_COLORS.HEALTHY : STATUS_COLORS.DEGRADED
                  }`}>
                    {health.jobs.enabled ? 'RUNNING' : 'DISABLED'}
                  </span>
                </h3>

                {health.jobs.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">No job has run since this instance started.</p>
                ) : (
                  <div className="space-y-2">
                    {health.jobs.recent.map((job: any) => (
                      <div key={job.name} className="bg-slate-700/50 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-white font-mono">{job.name}</span>
                          <span className="text-xs text-slate-400">{job.durationMs} ms</span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono break-all">
                          {JSON.stringify(job.summary)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {new Date(job.ranAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Storage and key provider */}
            {health?.storage && (
              <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <HardDrive className="w-5 h-5 text-blue-400" /> Storage &amp; Keys
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Object Storage</p>
                    <p className="text-lg font-extrabold text-white">{health.storage.driver}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Key Provider</p>
                    <p className="text-lg font-extrabold text-white">{health.storage.keyProvider}</p>
                  </div>
                </div>
                {health.storage.keyProvider === 'LOCAL' && (
                  <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4">
                    The master key lives in this process&apos;s environment, so a database administrator with host
                    access could decrypt records. Set KEY_PROVIDER=KMS for the separation the architecture
                    document describes.
                  </p>
                )}
              </section>
            )}

            {/* Notification delivery */}
            {health?.notifications && (
              <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Wifi className="w-5 h-5 text-orange-400" /> Notification Delivery
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Pending</p>
                    <p className="text-lg font-extrabold text-white">{health.notifications.pending}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Failed</p>
                    <p className={`text-lg font-extrabold ${health.notifications.failed > 0 ? 'text-red-400' : 'text-white'}`}>
                      {health.notifications.failed}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">Email</p>
                    <p className="text-sm font-bold text-white">
                      {health.notifications.emailConfigured ? 'Configured' : 'Simulated'}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">SMS</p>
                    <p className="text-sm font-bold text-white">
                      {health.notifications.smsConfigured ? 'Configured' : 'Simulated'}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Components that are declared but not deployed */}
          {health?.eventBus && (
            <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <Wifi className="w-5 h-5 text-slate-500" /> Event Bus
                <span className="ml-auto px-2 py-0.5 rounded-lg text-xs font-bold border bg-slate-700 text-slate-400 border-slate-600">
                  {health.eventBus.status}
                </span>
              </h3>
              <p className="text-sm text-slate-400">{health.eventBus.note}</p>
            </section>
          )}

          {/* Integrity Ledger */}
          <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Link2 className="w-5 h-5 text-cyan-400" /> Integrity Ledger
            </h3>
            {blocks.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No blockchain anchors found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/50 text-slate-300 text-left">
                      <th className="px-4 py-3 font-semibold text-xs">Anchor ID</th>
                      <th className="px-4 py-3 font-semibold text-xs">Record</th>
                      <th className="px-4 py-3 font-semibold text-xs">Document SHA-256</th>
                      <th className="px-4 py-3 font-semibold text-xs">TX ID</th>
                      <th className="px-4 py-3 font-semibold text-xs">Block #</th>
                      <th className="px-4 py-3 font-semibold text-xs">Network</th>
                      <th className="px-4 py-3 font-semibold text-xs">Status</th>
                      <th className="px-4 py-3 font-semibold text-xs">Anchored</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.slice(0, 20).map((b) => (
                      <tr key={b.anchor_id} className="border-t border-slate-700 hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{b.anchor_id.substring(0, 8)}...</td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs text-white">{b.medical_records?.record_title || 'N/A'}</p>
                          <p className="text-[10px] text-slate-500">{b.medical_records?.category}</p>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400 max-w-[100px] truncate">{b.document_sha256}</td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400 max-w-[100px] truncate">{b.transaction_tx_id || 'PENDING'}</td>
                        <td className="px-4 py-2.5 text-xs text-white font-bold">{b.block_number?.toString() || '-'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{b.blockchain_network}</td>
                        <td className="px-4 py-2.5">
                          {b.anchor_status === 'CONFIRMED' ? (
                            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold border border-emerald-500/30">CONFIRMED</span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs font-bold border border-amber-500/30">{b.anchor_status}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminSystemHealth;
