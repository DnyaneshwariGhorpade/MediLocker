import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Stethoscope, Users, UploadCloud, ShieldCheck,
  AlertTriangle, Search, Calendar, FileSignature, LogOut
} from 'lucide-react';

const DoctorDashboard = () => {
  const { token, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  const fetchDashboard = async () => {
    try {
      setData(await api.get<any>('/api/v1/doctor/dashboard-summary'));
    } catch (e) { console.error(e); }
  };

  if (!data) return <div className="p-8 text-center text-slate-500 font-medium">Loading clinical workspace...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Stethoscope className="text-indigo-600 w-8 h-8" />
          <h1 className="text-xl font-extrabold text-slate-800">MediLocker <span className="text-indigo-600">Clinical</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
              {data.doctor.name.charAt(4)}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-bold text-slate-800">{data.doctor.name}</p>
              <p className="text-xs font-medium text-slate-500">{data.doctor.specialization}</p>
            </div>
          </div>
          <button onClick={logout} className="text-slate-400 hover:text-slate-600"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">

        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 shrink-0 space-y-2">
          <Link to="/doctor/dashboard" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-200">
            <Stethoscope className="w-5 h-5" /> Workspace
          </Link>
          <Link to="/doctor/patients" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <Users className="w-5 h-5" /> Patient Lookup
          </Link>
          <Link to="/doctor/upload" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <UploadCloud className="w-5 h-5" /> Upload Records
          </Link>
          <Link to="/doctor/prescriptions/new" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <FileSignature className="w-5 h-5" /> Digital Rx Studio
          </Link>
          <Link to="/doctor/consultation/log" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <Calendar className="w-5 h-5" /> Encounter Log
          </Link>
          <Link to="/doctor/search" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <Search className="w-5 h-5" /> Smart Search
          </Link>
          <Link to="/doctor/flag" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <AlertTriangle className="w-5 h-5" /> Quality Disputes
          </Link>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-8">

          {/* Top Search Banner */}
          <section className="bg-indigo-900 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="relative z-10 text-white w-full md:w-1/2">
              <h2 className="text-2xl font-bold mb-2">Quick Patient Search</h2>
              <p className="text-indigo-200 text-sm mb-4">Enter Vault Number (ML-2026-XXXX) or Phone to access consented records.</p>
              <div className="relative flex">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., ML-2026-XXXX"
                  className="w-full pl-12 pr-4 py-3 rounded-l-xl text-slate-900 focus:outline-none"
                />
                <Link to={`/doctor/patients?query=${searchQuery}`} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-r-xl font-bold transition-colors">
                  Lookup
                </Link>
              </div>
            </div>
          </section>

          {/* Metrics Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <Users className="w-8 h-8 text-blue-500 mb-3" />
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.totalPatients}</p>
              <p className="text-sm font-semibold text-slate-500">Total Patients</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <UploadCloud className="w-8 h-8 text-emerald-500 mb-3" />
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.uploadsThisMonth}</p>
              <p className="text-sm font-semibold text-slate-500">Uploads this Month</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <ShieldCheck className="w-8 h-8 text-indigo-500 mb-3" />
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.activeConsentsCount}</p>
              <p className="text-sm font-semibold text-slate-500">Active Consents</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <AlertTriangle className="w-8 h-8 text-rose-500 mb-3" />
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.flaggedDisputes}</p>
              <p className="text-sm font-semibold text-slate-500">Open Disputes</p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Today's Schedule */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500" /> Recent Consultations</h3>
              </div>
              <div className="p-6 flex-1 space-y-4">
                {data.recentConsultations.map((c: any) => (
                  <div key={c.consultation_id} className="flex justify-between items-center p-4 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                    <div>
                      <p className="font-bold text-slate-800">{c.patients?.first_name} {c.patients?.last_name}</p>
                      <p className="text-xs text-slate-500">{new Date(c.consultation_date).toLocaleString()}</p>
                    </div>
                    <Link to="/doctor/consultation/log" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100">
                      Log Encounter
                    </Link>
                  </div>
                ))}
                {data.recentConsultations.length === 0 && <p className="text-slate-500 text-sm">No recent consultations found.</p>}
              </div>
            </section>

            {/* Recent Prescriptions */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileSignature className="w-5 h-5 text-emerald-500" /> Digital Prescriptions</h3>
                <Link to="/doctor/prescriptions/new" className="text-sm font-bold text-indigo-600 hover:text-indigo-800">+ New Rx</Link>
              </div>
              <div className="p-6 flex-1 space-y-4">
                {data.recentPrescriptions.map((p: any) => (
                  <div key={p.prescription_id} className="flex justify-between items-center p-4 rounded-xl border border-slate-100 bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-800">Rx: {p.patients?.first_name} {p.patients?.last_name}</p>
                      <p className="text-xs text-slate-500">{new Date(p.issued_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100/50 px-2 py-1 rounded border border-emerald-200">
                      <ShieldCheck className="w-3 h-3" /> Signed
                    </div>
                  </div>
                ))}
                {data.recentPrescriptions.length === 0 && <p className="text-slate-500 text-sm">No recent prescriptions issued.</p>}
              </div>
            </section>
          </div>

        </main>
      </div>
    </div>
  );
};

export default DoctorDashboard;
