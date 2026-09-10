import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield, Building2, Stethoscope, AlertTriangle, Lock, Activity,
  LogOut, Server, Database, Cpu, HardDrive, Wifi, Zap,
  CheckCircle, XCircle, Globe, Link2, ArrowUpRight, Users
} from 'lucide-react';

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
        fetch('/api/v1/admin/system-health', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/admin/blockchain/blocks', { headers: { Authorization: `Bearer ${token}` } }),
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
            <p className="text-slate-400 text-sm mt-1">Real-time infrastructure health (NFR07, NFR08, NFR09)</p>
          </div>

          {/* Platform Overview */}
          {health?.platform && (
            <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Cpu className="w-6 h-6 text-blue-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.platform.nodeVersion}</p>
                <p className="text-xs font-semibold text-slate-400">Node.js</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <HardDrive className="w-6 h-6 text-indigo-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.platform.memoryUsageMB} MB</p>
                <p className="text-xs font-semibold text-slate-400">Heap Memory</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Globe className="w-6 h-6 text-emerald-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.platform.region}</p>
                <p className="text-xs font-semibold text-slate-400">AWS Region</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Users className="w-6 h-6 text-cyan-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.platform.totalUsers}</p>
                <p className="text-xs font-semibold text-slate-400">Total Users</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Database className="w-6 h-6 text-amber-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.platform.totalRecords}</p>
                <p className="text-xs font-semibold text-slate-400">Medical Records</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <Link2 className="w-6 h-6 text-pink-400 mb-2" />
                <p className="text-xl font-extrabold text-white">{health.platform.totalBlockchainAnchors}</p>
                <p className="text-xs font-semibold text-slate-400">Blockchain Anchors</p>
              </div>
            </section>
          )}

          {/* 8 Microservices Status Grid */}
          {health?.services && (
            <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-indigo-400" /> Microservices Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {health.services.map((svc: any, i: number) => (
                  <div key={i} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-white">{svc.name}</h4>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${STATUS_COLORS[svc.status] || STATUS_COLORS.HEALTHY}`}>
                        {svc.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                        <span className="text-white font-semibold">{svc.cpu}%</span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, parseFloat(svc.cpu))}%` }}></div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 flex items-center gap-1"><HardDrive className="w-3 h-3" /> RAM</span>
                        <span className="text-white font-semibold">{svc.ram} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 flex items-center gap-1"><Server className="w-3 h-3" /> Pods</span>
                        <span className="text-white font-semibold">{svc.podReplicas}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Redis Telemetry */}
            {health?.redis && (
              <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-red-400" /> Redis Cache Telemetry
                </h3>
                <div className="space-y-4">
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Cache Hit Ratio</span>
                      <span className={`text-xl font-extrabold ${parseFloat(health.redis.cacheHitRatio) >= 98 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {health.redis.cacheHitRatio}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div className={`h-2 rounded-full ${parseFloat(health.redis.cacheHitRatio) >= 98 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${health.redis.cacheHitRatio}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Target: {'>'}98% (NFR06)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-700/50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Avg Latency</p>
                      <p className={`text-lg font-extrabold ${parseFloat(health.redis.avgLatencyMs) < 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {health.redis.avgLatencyMs} ms
                      </p>
                      <p className="text-[10px] text-slate-500">Target: {'<'}10ms</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Connected Clients</p>
                      <p className="text-lg font-extrabold text-white">{health.redis.connectedClients}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-xl p-3 col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Memory Used</p>
                      <p className="text-lg font-extrabold text-white">{health.redis.memoryUsedMB} MB</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Kafka Topic Stream */}
            {health?.kafka && (
              <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Wifi className="w-5 h-5 text-orange-400" /> Kafka Topic Stream
                </h3>
                <div className="space-y-3">
                  {health.kafka.topics.map((topic: any, i: number) => (
                    <div key={i} className="bg-slate-700/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white font-mono">{topic.name}</span>
                        <span className="text-xs text-slate-400">{topic.partitions} partitions</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500">Throughput (24h)</p>
                          <p className="text-white font-bold">{topic.throughput24h.toLocaleString()} msgs</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Consumer Lag</p>
                          <p className={`font-bold ${topic.consumerLag > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {topic.consumerLag} msgs
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Hyperledger Fabric Block Explorer */}
          <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Link2 className="w-5 h-5 text-cyan-400" /> Hyperledger Fabric Block Explorer
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
