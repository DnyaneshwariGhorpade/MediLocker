import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, Building2, Stethoscope, Link2, AlertTriangle, Activity, LogOut, Clock, TrendingUp, FileCheck, UserCheck, Server, Eye, Lock, HardDrive } from 'lucide-react';
import Chart from 'chart.js/auto';

const AdminDashboard = () => {
  const { token, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  useEffect(() => {
    if (data?.dailyUploads && chartRef.current) {
      if (chartInstance.current) chartInstance.current.destroy();
      const labels = data.dailyUploads.map((d: any) => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      });
      const counts = data.dailyUploads.map((d: any) => d.count);
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Daily Uploads',
            data: counts,
            borderColor: '#818cf8',
            backgroundColor: 'rgba(129,140,248,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#818cf8',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' } },
            y: { grid: { color: 'rgba(148,163,184,0.1)' }, ticks: { color: '#94a3b8' }, beginAtZero: true },
          },
        },
      });
    }
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [data]);

  const fetchDashboard = async () => {
    try {
      setData(await api.get<any>('/api/v1/admin/dashboard'));
    } catch (e) { console.error(e); }
  };

  if (!data) return <div className="p-8 text-center text-slate-500 font-medium">Loading platform command center...</div>;

  const s = data.stats;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Shield className="text-indigo-400 w-8 h-8" />
          <h1 className="text-xl font-extrabold text-white">MediLocker <span className="text-indigo-400">Admin</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-bold text-white">Platform Admin</p>
              <p className="text-xs font-medium text-slate-400">Superuser Access</p>
            </div>
          </div>
          <button onClick={logout} className="text-slate-400 hover:text-slate-200"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">

        <aside className="w-full lg:w-64 shrink-0 space-y-2">
          <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-900/30">
            <Server className="w-5 h-5" /> Command Center
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
          <Link to="/admin/system-health" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-semibold transition-colors">
            <Activity className="w-5 h-5" /> System Health
          </Link>
        </aside>

        <main className="flex-1 space-y-8">

          <section className="bg-gradient-to-r from-indigo-900/80 to-slate-800 rounded-3xl p-8 shadow-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-6 h-6 text-indigo-400" />
              <h2 className="text-2xl font-extrabold text-white">Platform Administration</h2>
            </div>
            <p className="text-slate-400">System Status: <span className="text-emerald-400 font-semibold">ALL SYSTEMS NOMINAL</span></p>
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <Users className="w-7 h-7 text-blue-400 mb-2" />
              <p className="text-3xl font-extrabold text-blue-400">{s.totalUsers}</p>
              <p className="text-xs font-semibold text-slate-400">Registered Patients</p>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <Building2 className="w-7 h-7 text-indigo-400 mb-2" />
              <p className="text-3xl font-extrabold text-indigo-400">{s.verifiedHospitals}</p>
              <p className="text-xs font-semibold text-slate-400">Verified Hospitals</p>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <Stethoscope className="w-7 h-7 text-emerald-400 mb-2" />
              <p className="text-3xl font-extrabold text-emerald-400">{s.verifiedDoctors}</p>
              <p className="text-xs font-semibold text-slate-400">Verified Doctors</p>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <HardDrive className="w-7 h-7 text-amber-400 mb-2" />
              <p className="text-3xl font-extrabold text-amber-400">{s.totalStorageGB}</p>
              <p className="text-xs font-semibold text-slate-400">AWS S3 Storage (GB)</p>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <Link2 className="w-7 h-7 text-cyan-400 mb-2" />
              <p className="text-3xl font-extrabold text-cyan-400">{s.totalBlockchainAnchors}</p>
              <p className="text-xs font-semibold text-slate-400">Blockchain Anchors</p>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <Clock className="w-7 h-7 text-rose-400 mb-2" />
              <p className="text-3xl font-extrabold text-rose-400">{s.pendingVerifications}</p>
              <p className="text-xs font-semibold text-slate-400">Pending Verifications</p>
            </div>
          </section>

          {(s.flaggedRecords > 0 || s.failedEmergencyAttempts > 0) && (
            <section className="bg-red-950/50 border border-red-800 rounded-2xl p-6">
              <h3 className="text-red-400 font-bold flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" /> Security Incident Alerts
              </h3>
              <div className="space-y-2 text-sm">
                {s.flaggedRecords > 0 && (
                  <div className="flex items-center gap-2 text-red-300">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    {s.flaggedRecords} record(s) flagged for integrity review
                  </div>
                )}
                {s.underReviewRecords > 0 && (
                  <div className="flex items-center gap-2 text-amber-300">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    {s.underReviewRecords} record(s) under active review
                  </div>
                )}
                {s.failedEmergencyAttempts > 0 && (
                  <div className="flex items-center gap-2 text-red-300">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    {s.failedEmergencyAttempts} failed/terminated emergency access attempt(s)
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-white font-bold flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-indigo-400" /> Platform Usage & Ingress Trends
              </h3>
              <div className="h-64">
                <canvas ref={chartRef}></canvas>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-700/50 rounded-xl p-3">
                  <p className="text-slate-400">Active Logins (7d)</p>
                  <p className="text-xl font-bold text-white">{s.activeLogins}</p>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-3">
                  <p className="text-slate-400">Consent Events (7d)</p>
                  <p className="text-xl font-bold text-white">{s.consentEvents}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-white font-bold flex items-center gap-2 mb-4">
                  <FileCheck className="w-5 h-5 text-emerald-400" /> Pending Actions
                </h3>
                <div className="space-y-3">
                  <Link to="/admin/verifications/hospitals" className="flex items-center justify-between w-full bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl transition-colors font-medium">
                    <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-400" /> Review Hospital Applications</span>
                    {s.pendingVerifications > 0 && <span className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full">{s.pendingVerifications}</span>}
                  </Link>
                  <Link to="/admin/verifications/doctors" className="flex items-center justify-between w-full bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl transition-colors font-medium">
                    <span className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-400" /> Review Doctor Verifications</span>
                  </Link>
                  <Link to="/admin/disputes" className="flex items-center justify-between w-full bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl transition-colors font-medium">
                    <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Resolve Record Disputes</span>
                    {s.flaggedRecords > 0 && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">{s.flaggedRecords}</span>}
                  </Link>
                </div>
              </div>

              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-white font-bold flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-pink-400" /> Immutable Audit Logs
                </h3>
                <p className="text-slate-400 text-sm mb-4">Access the append-only compliance ledger (NFR10, DPDP Act 2023).</p>
                <Link to="/admin/audit-logs" className="block w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg text-center">
                  Open Log Viewer
                </Link>
              </div>

              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                <h3 className="text-white font-bold flex items-center gap-2 mb-3">
                  <Eye className="w-5 h-5 text-cyan-400" /> Infrastructure
                </h3>
                <Link to="/admin/system-health" className="block w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg text-center">
                  System Health & Blockchain Explorer
                </Link>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
