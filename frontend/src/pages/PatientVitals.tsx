import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Plus,
  History,
  HeartPulse,
  Wind,
  Thermometer,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Scale,
  Sparkles,
  Gauge
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface VitalRecord {
  vital_id: string;
  metric_type: string;
  metric_value: number | string;
  metric_unit: string;
  reading_context: string | null;
  recorded_at: string;
}

const METRIC_CONFIG: Record<string, { label: string; unit: string; min: number; max: number; step: string; icon: any; color: string; bg: string }> = {
  BP_SYSTOLIC: { label: 'Systolic Blood Pressure', unit: 'mmHg', min: 50, max: 260, step: '1', icon: HeartPulse, color: 'rgb(244, 63, 94)', bg: 'rgba(244, 63, 94, 0.1)' },
  BP_DIASTOLIC: { label: 'Diastolic Blood Pressure', unit: 'mmHg', min: 30, max: 160, step: '1', icon: Activity, color: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },
  FASTING_SUGAR: { label: 'Fasting Blood Sugar', unit: 'mg/dL', min: 40, max: 500, step: '0.1', icon: Wind, color: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.1)' },
  PP_SUGAR: { label: 'Post-Prandial Sugar (PPBS)', unit: 'mg/dL', min: 50, max: 600, step: '0.1', icon: Wind, color: 'rgb(5, 150, 105)', bg: 'rgba(5, 150, 105, 0.1)' },
  PULSE: { label: 'Heart / Pulse Rate', unit: 'bpm', min: 30, max: 240, step: '1', icon: HeartPulse, color: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.1)' },
  SPO2: { label: 'Blood Oxygen (SpO2)', unit: '%', min: 50, max: 100, step: '1', icon: Gauge, color: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.1)' },
  WEIGHT: { label: 'Body Weight', unit: 'kg', min: 10, max: 300, step: '0.1', icon: Scale, color: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.1)' },
  TEMPERATURE: { label: 'Body Temperature', unit: '°F', min: 90, max: 110, step: '0.1', icon: Thermometer, color: 'rgb(245, 158, 11)', bg: 'rgba(245, 158, 11, 0.1)' },
};

const PatientVitals = () => {
  const { token } = useAuth();
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLogging, setIsLogging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [metricType, setMetricType] = useState('BP_SYSTOLIC');
  const [metricValue, setMetricValue] = useState('');
  const [readingContext, setReadingContext] = useState('RESTING');

  useEffect(() => {
    void fetchVitals();
  }, [token]);

  const fetchVitals = async () => {
    setLoading(true);
    try {
      const data = await api.get<VitalRecord[]>('/api/v1/patient/vitals');
      setVitals(data || []);
    } catch (e: any) {
      console.error('Error fetching vitals:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogVital = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const val = parseFloat(metricValue);
    if (isNaN(val)) {
      setErrorMessage('Please enter a valid numeric value for the vital reading.');
      return;
    }

    const config = METRIC_CONFIG[metricType] || { unit: 'unit', label: metricType, min: 0, max: 1000 };
    const unit = config.unit;

    setSaving(true);
    try {
      const res = await api.raw('/api/v1/patient/vitals', {
        method: 'POST',
        body: JSON.stringify({
          metric_type: metricType,
          metric_value: val,
          metric_unit: unit,
          reading_context: readingContext
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Server rejected vital record submission');
      }

      const newRecord: VitalRecord = {
        vital_id: data.vital_id || String(Date.now()),
        metric_type: metricType,
        metric_value: val,
        metric_unit: unit,
        reading_context: readingContext,
        recorded_at: data.recorded_at || new Date().toISOString()
      };
      setVitals(prev => [newRecord, ...prev]);

      setSuccessMessage(`${config.label || metricType} (${val} ${unit}) recorded successfully.`);
      setMetricValue('');
      setIsLogging(false);
      setTimeout(() => setSuccessMessage(''), 4000);
      void fetchVitals();
    } catch (err: any) {
      console.error('Save vital error:', err);
      setErrorMessage(err.message || 'Failed to save vital record. Please check server connection.');
    } finally {
      setSaving(false);
    }
  };

  const getChartData = (type: string, label: string, color: string, bg: string) => {
    const filtered = vitals.filter(v => v.metric_type === type).slice(0, 15).reverse(); // oldest to newest
    return {
      labels: filtered.length > 0 ? filtered.map(v => new Date(v.recorded_at).toLocaleDateString()) : ['No Data'],
      datasets: [{
        label,
        data: filtered.length > 0 ? filtered.map(v => Number(v.metric_value)) : [0],
        borderColor: color,
        backgroundColor: bg,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    };
  };

  const exportCSV = () => {
    if (vitals.length === 0) {
      alert('No vitals data available to export.');
      return;
    }
    const headers = ['Date', 'Time', 'Metric Type', 'Value', 'Unit', 'Context'];
    const rows = vitals.map(v => [
      new Date(v.recorded_at).toISOString().split('T')[0],
      new Date(v.recorded_at).toLocaleTimeString(),
      v.metric_type,
      v.metric_value,
      v.metric_unit,
      v.reading_context || 'Routine'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medilocker-telemetry-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeConfig = METRIC_CONFIG[metricType] || METRIC_CONFIG['BP_SYSTOLIC'];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  Health Telemetry &amp; Biometrics
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  Log personal physiological readings, analyze clinical trends, and export chronological logs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" /> Export CSV
            </button>
            <button
              onClick={() => { setIsLogging(!isLogging); setErrorMessage(''); }}
              className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
            >
              {isLogging ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isLogging ? 'Cancel Logging' : 'Log New Vital'}
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl font-bold flex items-center gap-3 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl font-bold flex items-center gap-3 shadow-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Logging Form (Conditional / Animated) */}
        {isLogging && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border-2 border-rose-200 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-rose-500" /> Log Vital Reading
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Telemetry is stamped with cryptographic timestamps and stored immutably.</p>
              </div>
              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold font-mono">
                Unit: {activeConfig.unit}
              </span>
            </div>

            <form onSubmit={handleLogVital} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Metric Type</label>
                  <select
                    value={metricType}
                    onChange={e => setMetricType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-slate-800 font-semibold bg-white"
                  >
                    <option value="BP_SYSTOLIC">Blood Pressure (Systolic) — mmHg</option>
                    <option value="BP_DIASTOLIC">Blood Pressure (Diastolic) — mmHg</option>
                    <option value="FASTING_SUGAR">Fasting Blood Sugar — mg/dL</option>
                    <option value="PP_SUGAR">Post-Prandial Sugar (PPBS) — mg/dL</option>
                    <option value="PULSE">Pulse / Heart Rate — bpm</option>
                    <option value="SPO2">SpO2 Oxygen Saturation — %</option>
                    <option value="WEIGHT">Body Weight — kg</option>
                    <option value="TEMPERATURE">Body Temperature — °F</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Value ({activeConfig.unit}) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={metricValue}
                      onChange={e => setMetricValue(e.target.value)}
                      placeholder={`e.g. ${activeConfig.min + 20}`}
                      className="w-full pl-4 pr-16 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 font-mono font-bold text-lg"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {activeConfig.unit}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Measurement Context</label>
                  <select
                    value={readingContext}
                    onChange={e => setReadingContext(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-slate-800 font-semibold bg-white"
                  >
                    <option value="RESTING">Resting / Baseline</option>
                    <option value="POST_EXERCISE">Post-Exercise / Active</option>
                    <option value="FEELING_UNWELL">Feeling Unwell / Symptomatic</option>
                    <option value="ROUTINE">Routine Morning Check</option>
                    <option value="BEFORE_MEAL">Before Meal (Fasting)</option>
                    <option value="AFTER_MEAL">After Meal (Post-Prandial)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLogging(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !metricValue}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving Vital Record...
                    </>
                  ) : (
                    'Save Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-500" /> Systolic Blood Pressure (mmHg)
            </h3>
            <div className="h-64">
              <Line data={getChartData('BP_SYSTOLIC', 'Systolic', 'rgb(244, 63, 94)', 'rgba(244, 63, 94, 0.1)')} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" /> Diastolic Blood Pressure (mmHg)
            </h3>
            <div className="h-64">
              <Line data={getChartData('BP_DIASTOLIC', 'Diastolic', 'rgb(59, 130, 246)', 'rgba(59, 130, 246, 0.1)')} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Wind className="w-5 h-5 text-emerald-500" /> Fasting Blood Sugar (mg/dL)
            </h3>
            <div className="h-64">
              <Line data={getChartData('FASTING_SUGAR', 'Fasting Sugar', 'rgb(16, 185, 129)', 'rgba(16, 185, 129, 0.1)')} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-amber-500" /> Body Temperature (°F)
            </h3>
            <div className="h-64">
              <Line data={getChartData('TEMPERATURE', 'Temperature', 'rgb(245, 158, 11)', 'rgba(245, 158, 11, 0.1)')} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" /> Historical Telemetry Log ({vitals.length} records)
            </h2>
            <button
              onClick={exportCSV}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 font-bold">
                  <th className="p-4">Date &amp; Time</th>
                  <th className="p-4">Metric</th>
                  <th className="p-4">Recorded Value</th>
                  <th className="p-4">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vitals.map(vital => (
                  <tr key={vital.vital_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 text-sm text-slate-600 font-medium">
                      {new Date(vital.recorded_at).toLocaleDateString()} at{' '}
                      <span className="text-slate-400">{new Date(vital.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-900">
                      {METRIC_CONFIG[vital.metric_type]?.label || vital.metric_type.replace(/_/g, ' ')}
                    </td>
                    <td className="p-4 text-sm font-mono font-bold text-slate-800">
                      {vital.metric_value} <span className="text-xs font-semibold text-slate-400">{vital.metric_unit}</span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                        {vital.reading_context || 'Routine'}
                      </span>
                    </td>
                  </tr>
                ))}
                {vitals.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500 font-medium">
                      No vitals logged yet. Click &ldquo;Log New Vital&rdquo; above to record your first telemetry reading.
                    </td>
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
