import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Clock,
  FileText,
  CalendarDays,
  ShieldCheck,
  QrCode,
  Droplet
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PatientDashboard = () => {
  const { token, logout } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [vitals, setVitals] = useState<any[]>([]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await api.get<any>('/api/v1/patient/dashboard-summary');
          setSummary(data);
      } catch (e) {
        console.error(e);
      }
    };

    const fetchVitals = async () => {
      try {
        const data = await api.get<any>('/api/v1/patient/vitals/trends');
          setVitals(data);
      } catch (e) {
        console.error(e);
      }
    };

    fetchSummary();
    fetchVitals();
  }, [token]);

  if (!summary) return <div className="p-8 text-center">Loading dashboard...</div>;

  // Chart data setup
  // Assuming 'metric_type' is BP_SYSTOLIC and BP_DIASTOLIC, or Blood Sugar
  const systolicData = vitals.filter(v => v.metric_type === 'BP_SYSTOLIC').map(v => v.metric_value);
  const diastolicData = vitals.filter(v => v.metric_type === 'BP_DIASTOLIC').map(v => v.metric_value);
  const bpLabels = vitals.filter(v => v.metric_type === 'BP_SYSTOLIC').map(v => new Date(v.recorded_at).toLocaleDateString());

  const bpChartData = {
    labels: bpLabels.length > 0 ? bpLabels : ['No Data'],
    datasets: [
      {
        label: 'Systolic',
        data: systolicData.length > 0 ? systolicData : [0],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
      },
      {
        label: 'Diastolic',
        data: diastolicData.length > 0 ? diastolicData : [0],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Main Content */}
        <main className="space-y-8">

          {/* Profile Header */}
          <section className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-lg">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold backdrop-blur-sm border border-white/30">
                {summary.profile.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-3xl font-bold">{summary.profile.name}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-blue-100">
                  <span className="flex items-center gap-1"><Droplet className="w-4 h-4" /> {summary.profile.blood_group || 'Unknown'}</span>
                  <span>•</span>
                  <span>{summary.profile.age} Years</span>
                  <span>•</span>
                  <span className="bg-blue-900/50 px-3 py-1 rounded-lg text-sm font-mono font-medium tracking-wider border border-blue-600/50">
                    ID: {summary.profile.vault_id}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6 md:mt-0 bg-white p-3 rounded-xl shadow-inner flex flex-col items-center gap-2">
              <QrCode className="w-16 h-16 text-slate-800" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Scan to Share</span>
            </div>
          </section>

          {/* Dual Columns: Charts & Reminders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Health Trends */}
            <section className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Blood Pressure Trends</h3>
                <Link to="/patient/vitals" className="text-sm font-semibold text-blue-600 hover:underline">Log Vitals</Link>
              </div>
              <div className="h-64">
                <Line
                  data={bpChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { suggestedMin: 60, suggestedMax: 160 } }
                  }}
                />
              </div>
            </section>

            {/* Reminders & Consents Summary */}
            <section className="space-y-8">
              {/* Reminders */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-500" />
                  Upcoming Follow-ups
                </h3>
                {summary.reminders && summary.reminders.length > 0 ? (
                  <div className="space-y-4">
                    {summary.reminders.map((r: any) => (
                      <div key={r.id} className="p-4 rounded-xl bg-indigo-50 border border-indigo-100/50 relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl"></div>
                        <p className="font-semibold text-slate-800">{r.doctor}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(r.date).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 p-4 text-center bg-slate-50 rounded-xl">No upcoming appointments.</p>
                )}
              </div>

              {/* Active Consents */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Active Consents</h3>
                  <p className="text-sm text-slate-500">Doctors with access</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl font-bold">
                  {summary.activeConsentsCount}
                </div>
              </div>
            </section>
          </div>

          {/* Timeline Stream */}
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Recent Medical Timeline</h3>
              <Link to="/patient/vault" className="text-sm font-semibold text-blue-600 hover:underline">View All Records</Link>
            </div>

            {summary.timeline && summary.timeline.length > 0 ? (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {summary.timeline.map((item: any) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{item.category.replace('_', ' ')}</span>
                        <time className="text-xs text-slate-400 font-medium">{new Date(item.date).toLocaleDateString()}</time>
                      </div>
                      <h4 className="text-lg font-bold text-slate-800">{item.title}</h4>
                      {item.doctor && <p className="text-sm text-slate-500 mt-2">Added by {item.doctor} • {item.hospital}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No recent records available.</p>
            )}
          </section>

        </main>
      </div>
    </div>
  );
};

export default PatientDashboard;
