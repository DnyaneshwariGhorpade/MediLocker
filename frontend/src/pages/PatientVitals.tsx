import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Plus, History, HeartPulse, Wind, Thermometer, Scale } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const PatientVitals = () => {
  const { token } = useAuth();
  const [vitals, setVitals] = useState<any[]>([]);
  const [isLogging, setIsLogging] = useState(false);
  
  // Form State
  const [metricType, setMetricType] = useState('BP_SYSTOLIC');
  const [metricValue, setMetricValue] = useState('');
  const [readingContext, setReadingContext] = useState('RESTING');

  useEffect(() => {
    fetchVitals();
  }, [token]);

  const fetchVitals = async () => {
    try {
      const res = await fetch('/api/v1/patient/vitals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setVitals(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleLogVital = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let unit = '';
      if (metricType.includes('BP')) unit = 'mmHg';
      else if (metricType.includes('SUGAR')) unit = 'mg/dL';
      else if (metricType === 'PULSE') unit = 'bpm';
      else if (metricType === 'SPO2') unit = '%';
      else if (metricType === 'WEIGHT') unit = 'kg';
      else if (metricType === 'TEMPERATURE') unit = 'F';

      const res = await fetch('/api/v1/patient/vitals', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          metric_type: metricType,
          metric_value: parseFloat(metricValue),
          metric_unit: unit,
          reading_context: readingContext
        })
      });

      if (res.ok) {
        setIsLogging(false);
        setMetricValue('');
        fetchVitals();
      }
    } catch (e) { console.error(e); }
  };

  const getChartData = (type: string, label: string, color: string, bg: string) => {
    const filtered = vitals.filter(v => v.metric_type === type).reverse(); // Oldest to newest
    return {
      labels: filtered.length > 0 ? filtered.map(v => new Date(v.recorded_at).toLocaleDateString()) : ['No Data'],
      datasets: [{
        label,
        data: filtered.length > 0 ? filtered.map(v => v.metric_value) : [0],
        borderColor: color,
        backgroundColor: bg,
        fill: true,
        tension: 0.4
      }]
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-rose-500" />
              Health Telemetry & Vitals
            </h1>
            <p className="text-slate-500 mt-2">Log biometric vitals and visualize long-term trends</p>
          </div>
          <button 
            onClick={() => setIsLogging(!isLogging)}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Log New Vital
          </button>
        </div>

        {/* Logging Form (Conditional) */}
        {isLogging && (
          <div className="bg-white rounded-3xl p-8 shadow-md border border-rose-100 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-4 mb-6">Log Vital Reading</h3>
            <form onSubmit={handleLogVital} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Metric Type</label>
                <select 
                  value={metricType} onChange={e => setMetricType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value="BP_SYSTOLIC">Blood Pressure (Systolic)</option>
                  <option value="BP_DIASTOLIC">Blood Pressure (Diastolic)</option>
                  <option value="FASTING_SUGAR">Fasting Blood Sugar</option>
                  <option value="PP_SUGAR">Post-Prandial Sugar</option>
                  <option value="PULSE">Pulse Rate</option>
                  <option value="SPO2">SpO2 (Oxygen)</option>
                  <option value="WEIGHT">Weight</option>
                  <option value="TEMPERATURE">Temperature</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Value</label>
                <input 
                  type="number" step="0.1" required
                  value={metricValue} onChange={e => setMetricValue(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Context</label>
                <select 
                  value={readingContext} onChange={e => setReadingContext(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value="RESTING">Resting</option>
                  <option value="POST_EXERCISE">Post-Exercise</option>
                  <option value="FEELING_UNWELL">Feeling Unwell</option>
                  <option value="ROUTINE">Routine</option>
                </select>
              </div>
              <div>
                <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-500" /> Systolic Blood Pressure
            </h3>
            <div className="h-64">
              <Line data={getChartData('BP_SYSTOLIC', 'Systolic (mmHg)', 'rgb(244, 63, 94)', 'rgba(244, 63, 94, 0.1)')} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" /> Diastolic Blood Pressure
            </h3>
            <div className="h-64">
              <Line data={getChartData('BP_DIASTOLIC', 'Diastolic (mmHg)', 'rgb(59, 130, 246)', 'rgba(59, 130, 246, 0.1)')} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Wind className="w-5 h-5 text-emerald-500" /> Fasting Blood Sugar
            </h3>
            <div className="h-64">
              <Line data={getChartData('FASTING_SUGAR', 'Fasting (mg/dL)', 'rgb(16, 185, 129)', 'rgba(16, 185, 129, 0.1)')} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-amber-500" /> Body Temperature
            </h3>
            <div className="h-64">
              <Line data={getChartData('TEMPERATURE', 'Temp (°F)', 'rgb(245, 158, 11)', 'rgba(245, 158, 11, 0.1)')} options={{ maintainAspectRatio: false }} />
            </div>
          </div>

        </div>

        {/* History Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5" /> Historical Telemetry Log
            </h2>
            <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 font-semibold">Date & Time</th>
                  <th className="p-4 font-semibold">Metric</th>
                  <th className="p-4 font-semibold">Value</th>
                  <th className="p-4 font-semibold">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vitals.map(vital => (
                  <tr key={vital.vital_id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm text-slate-600">{new Date(vital.recorded_at).toLocaleString()}</td>
                    <td className="p-4 text-sm font-bold text-slate-800">{vital.metric_type.replace('_', ' ')}</td>
                    <td className="p-4 text-sm font-mono font-medium text-slate-700">
                      {vital.metric_value} <span className="text-slate-400">{vital.metric_unit}</span>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">{vital.reading_context}</span>
                    </td>
                  </tr>
                ))}
                {vitals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">No vitals logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PatientVitals;
