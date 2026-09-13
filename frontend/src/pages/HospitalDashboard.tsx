import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Building2, Users, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import Chart from 'chart.js/auto';

const HospitalDashboard = () => {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  useEffect(() => {
    if (data && chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        // Mock data for the last 24 hours of HMS ingress
        const labels = Array.from({length: 24}, (_, i) => `${24 - i}h ago`).reverse();
        const ingressData = Array.from({length: 24}, () => Math.floor(Math.random() * 50) + 10);

        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'HMS Automated Uploads (per hour)',
              data: ingressData,
              borderColor: 'rgb(59, 130, 246)', // blue-500
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
          }
        });
      }
    }
    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    }
  }, [data]);

  const fetchDashboard = async () => {
    try {
      setData(await api.get<any>('/api/v1/hospital/dashboard-summary'));
    } catch (e) { console.error(e); }
  };

  if (!data) return <div className="p-8 text-center text-slate-500 font-medium">Loading hospital metrics...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{data.hospital.name}</h1>
              <p className="text-slate-500 font-medium text-sm tracking-wide uppercase">{data.hospital.type.replace(/_/g, ' ')} • ID: {data.hospital.id.substring(0, 8)}</p>
            </div>
          </div>
        </div>

        {/* KPI Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <Users className="w-6 h-6 text-blue-500 z-10" />
            <div className="z-10">
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.verifiedDoctors}</p>
              <p className="text-sm font-bold text-slate-500">Verified Staff Doctors</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <Activity className="w-6 h-6 text-emerald-500 z-10" />
            <div className="z-10">
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.hmsUploadsToday}</p>
              <p className="text-sm font-bold text-slate-500">Today's Bulk HMS Uploads</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <ShieldCheck className="w-6 h-6 text-indigo-500 z-10" />
            <div className="z-10">
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.admittedPatients}</p>
              <p className="text-sm font-bold text-slate-500">Admitted Patients Consulted</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <AlertTriangle className="w-6 h-6 text-rose-500 z-10" />
            <div className="z-10">
              <p className="text-3xl font-extrabold text-slate-800">{data.metrics.openDisputes}</p>
              <p className="text-sm font-bold text-slate-500">Open Flagged Disputes</p>
            </div>
          </div>
        </div>

        {/* HMS Ingress Graph */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500"/> HMS API Traffic Ingress Monitor</h3>
          </div>
          <div className="h-72 w-full">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Recent Break-Glass Events */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
             <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500"/> Break-Glass Approvals</h3>
             </div>
             <div className="p-6 flex-1 space-y-4">
                {data.recentBreakGlass.map((bg: any) => (
                  <div key={bg.session_id} className="flex justify-between items-center p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div>
                      <p className="font-bold text-slate-800 flex items-center gap-2">Patient: {bg.patients.first_name} {bg.patients.last_name}</p>
                      <p className="text-xs font-semibold text-slate-500">Doctor: Dr. {bg.doctors.last_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${bg.session_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{bg.session_status}</span>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(bg.session_start_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {data.recentBreakGlass.length === 0 && <p className="text-slate-500 text-sm">No recent emergency overrides.</p>}
             </div>
          </div>

          {/* Recent Staff Verifications */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
             <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-500"/> Recent Staff Verifications</h3>
             </div>
             <div className="p-6 flex-1 space-y-4">
                {data.recentDoctors.map((doc: any) => (
                  <div key={doc.doctor_id} className="flex justify-between items-center p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div>
                      <p className="font-bold text-slate-800">Dr. {doc.first_name} {doc.last_name}</p>
                      <p className="text-xs font-medium text-slate-500">{doc.specialization} • MRN: {doc.mrn}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${doc.verification_status === 'VERIFIED' ? 'bg-blue-100 text-blue-700' : doc.verification_status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {doc.verification_status}
                    </span>
                  </div>
                ))}
                {data.recentDoctors.length === 0 && <p className="text-slate-500 text-sm">No recent staff activity.</p>}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HospitalDashboard;
