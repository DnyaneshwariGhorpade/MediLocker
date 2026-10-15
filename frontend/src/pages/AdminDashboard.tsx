import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Users,
  Building2,
  Stethoscope,
  Link2,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileCheck,
  UserCheck,
  Eye,
  Lock,
  HardDrive,
  Activity,
  ArrowRight
} from 'lucide-react';
import Chart from 'chart.js/auto';

const AdminDashboard = () => {
  const { token } = useAuth();
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
          datasets: [
            {
              label: 'Daily Uploads',
              data: counts,
              borderColor: '#4f46e5',
              backgroundColor: 'rgba(79, 70, 229, 0.08)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#4f46e5',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
              ticks: { color: '#64748b' },
            },
            y: {
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
              ticks: { color: '#64748b' },
              beginAtZero: true,
            },
          },
        },
      });
    }
    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [data]);

  const fetchDashboard = async () => {
    try {
      setData(await api.get<any>('/api/v1/admin/dashboard'));
    } catch (e) {
      console.error(e);
    }
  };

  if (!data)
    return (
      <div className="p-16 text-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-semibold text-sm">Loading platform command center...</p>
      </div>
    );

  const s = data.stats;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Platform Command Center</h1>
          </div>
          <p className="text-slate-300 text-sm">
            Zero-Trust Architectural Governance, Health Records Ingress, and Cryptographic Compliance.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-emerald-400 text-xs font-semibold shrink-0">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>ALL SYSTEMS NOMINAL</span>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{s.totalUsers}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Registered Patients</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Building2 className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{s.verifiedHospitals}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Verified Hospitals</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Stethoscope className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{s.verifiedDoctors}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Verified Doctors</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <HardDrive className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{s.totalStorageGB}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">S3 Storage (GB)</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-3">
            <Link2 className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{s.totalBlockchainAnchors}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Blockchain Anchors</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{s.pendingVerifications}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Pending Verifications</p>
        </div>
      </section>

      {/* Security Incident Alerts */}
      {(s.flaggedRecords > 0 || s.failedEmergencyAttempts > 0) && (
        <section className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-rose-900 font-bold flex items-center gap-2 text-sm mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" /> Security & Integrity Incidents
          </h3>
          <div className="space-y-1.5 text-xs">
            {s.flaggedRecords > 0 && (
              <div className="flex items-center gap-2 text-rose-800 font-medium">
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                {s.flaggedRecords} record(s) flagged for cryptographic integrity review
              </div>
            )}
            {s.underReviewRecords > 0 && (
              <div className="flex items-center gap-2 text-amber-800 font-medium">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                {s.underReviewRecords} record(s) under active dispute investigation
              </div>
            )}
            {s.failedEmergencyAttempts > 0 && (
              <div className="flex items-center gap-2 text-rose-800 font-medium">
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                {s.failedEmergencyAttempts} failed or terminated emergency access attempts
              </div>
            )}
          </div>
        </section>
      )}

      {/* Charts & Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" /> Platform Usage & Record Ingress
              </h3>
              <span className="text-xs text-slate-400 font-medium">Last 7 Days</span>
            </div>
            <div className="h-64">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-500 font-semibold">Active Logins (7d)</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{s.activeLogins}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-500 font-semibold">Consent Events (7d)</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{s.consentEvents}</p>
            </div>
          </div>
        </div>

        {/* Shortcuts & Navigation */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <FileCheck className="w-4 h-4 text-emerald-600" /> Pending Action Queue
            </h3>
            <div className="space-y-2.5">
              <Link
                to="/admin/verifications/hospitals"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all font-semibold text-slate-800 text-sm group"
              >
                <span className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Review Hospital Applications
                </span>
                <div className="flex items-center gap-2">
                  {s.pendingVerifications > 0 && (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-2 py-0.5 rounded-full">
                      {s.pendingVerifications}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              <Link
                to="/admin/verifications/doctors"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all font-semibold text-slate-800 text-sm group"
              >
                <span className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Review Doctor Verifications
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/admin/disputes"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/50 transition-all font-semibold text-slate-800 text-sm group"
              >
                <span className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Resolve Record Disputes
                </span>
                <div className="flex items-center gap-2">
                  {s.flaggedRecords > 0 && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">
                      {s.flaggedRecords}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center mb-2.5">
                  <Lock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Immutable Audit Trail</h4>
                <p className="text-xs text-slate-500 mt-1">Cryptographic compliance log for DPDP Act 2023.</p>
              </div>
              <Link
                to="/admin/audit-logs"
                className="mt-4 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 py-2 rounded-xl transition-colors"
              >
                <span>View Audit Trail</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center mb-2.5">
                  <Eye className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Infrastructure & KMS</h4>
                <p className="text-xs text-slate-500 mt-1">Database, KMS keys, and Blockchain Anchors.</p>
              </div>
              <Link
                to="/admin/system-health"
                className="mt-4 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 py-2 rounded-xl transition-colors"
              >
                <span>Explore Health</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
