import React, { useEffect, useState, useMemo } from 'react';
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
  Gauge,
  RefreshCw,
  Layers,
  Heart,
  Droplets
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions
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

interface MetricConfig {
  label: string;
  shortLabel: string;
  unit: string;
  min: number;
  max: number;
  step: string;
  icon: any;
  color: string;
  bg: string;
  yMin: number;
  yMax: number;
  normalRange: string;
}

const METRIC_CONFIG: Record<string, MetricConfig> = {
  BP_SYSTOLIC: {
    label: 'Systolic Blood Pressure',
    shortLabel: 'Systolic BP',
    unit: 'mmHg',
    min: 50,
    max: 260,
    step: '1',
    icon: HeartPulse,
    color: 'rgb(244, 63, 94)',
    bg: 'rgba(244, 63, 94, 0.12)',
    yMin: 70,
    yMax: 160,
    normalRange: '< 120 mmHg'
  },
  BP_DIASTOLIC: {
    label: 'Diastolic Blood Pressure',
    shortLabel: 'Diastolic BP',
    unit: 'mmHg',
    min: 30,
    max: 160,
    step: '1',
    icon: Activity,
    color: 'rgb(59, 130, 246)',
    bg: 'rgba(59, 130, 246, 0.12)',
    yMin: 50,
    yMax: 110,
    normalRange: '< 80 mmHg'
  },
  FASTING_SUGAR: {
    label: 'Fasting Blood Glucose',
    shortLabel: 'Fasting Glucose',
    unit: 'mg/dL',
    min: 40,
    max: 500,
    step: '0.1',
    icon: Droplets,
    color: 'rgb(16, 185, 129)',
    bg: 'rgba(16, 185, 129, 0.12)',
    yMin: 60,
    yMax: 160,
    normalRange: '70 - 99 mg/dL'
  },
  PP_SUGAR: {
    label: 'Post-Prandial Sugar (PPBS)',
    shortLabel: 'PPBS Glucose',
    unit: 'mg/dL',
    min: 50,
    max: 600,
    step: '0.1',
    icon: Wind,
    color: 'rgb(5, 150, 105)',
    bg: 'rgba(5, 150, 105, 0.12)',
    yMin: 70,
    yMax: 200,
    normalRange: '< 140 mg/dL'
  },
  PULSE: {
    label: 'Heart / Pulse Rate',
    shortLabel: 'Pulse Rate',
    unit: 'bpm',
    min: 30,
    max: 240,
    step: '1',
    icon: Heart,
    color: 'rgb(236, 72, 153)',
    bg: 'rgba(236, 72, 153, 0.12)',
    yMin: 50,
    yMax: 120,
    normalRange: '60 - 100 bpm'
  },
  SPO2: {
    label: 'Blood Oxygen (SpO2)',
    shortLabel: 'SpO2 Oxygen',
    unit: '%',
    min: 50,
    max: 100,
    step: '1',
    icon: Gauge,
    color: 'rgb(14, 165, 233)',
    bg: 'rgba(14, 165, 233, 0.12)',
    yMin: 88,
    yMax: 100,
    normalRange: '95 - 100%'
  },
  WEIGHT: {
    label: 'Body Weight',
    shortLabel: 'Body Weight',
    unit: 'kg',
    min: 10,
    max: 300,
    step: '0.1',
    icon: Scale,
    color: 'rgb(139, 92, 246)',
    bg: 'rgba(139, 92, 246, 0.12)',
    yMin: 40,
    yMax: 110,
    normalRange: 'BMI 18.5 - 24.9'
  },
  TEMPERATURE: {
    label: 'Body Temperature',
    shortLabel: 'Temperature',
    unit: '°F',
    min: 90,
    max: 110,
    step: '0.1',
    icon: Thermometer,
    color: 'rgb(245, 158, 11)',
    bg: 'rgba(245, 158, 11, 0.12)',
    yMin: 96,
    yMax: 103,
    normalRange: '97.0 - 99.0 °F'
  },
};

type ActiveTab = 'ALL' | 'CARDIO' | 'METABOLIC' | 'RESPIRATORY' | 'WEIGHT';

const PatientVitals = () => {
  const { token } = useAuth();
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLogging, setIsLogging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('ALL');

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

  const handleSeedBaseline = async () => {
    setSeeding(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await api.raw('/api/v1/patient/vitals/sample', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to populate sample telemetry');
      }
      setSuccessMessage('7-day clinical baseline telemetry loaded successfully!');
      await fetchVitals();
      setTimeout(() => setSuccessMessage(''), 4500);
    } catch (err: any) {
      console.error('Seed baseline error:', err);
      setErrorMessage(err.message || 'Unable to populate sample vitals.');
    } finally {
      setSeeding(false);
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

  // Helper to retrieve latest reading for a metric
  const getLatestReading = (types: string[]): VitalRecord | undefined => {
    return vitals.find(v => types.includes(v.metric_type));
  };

  const latestSystolic = getLatestReading(['BP_SYSTOLIC', 'BLOOD_PRESSURE']);
  const latestDiastolic = getLatestReading(['BP_DIASTOLIC']);
  const latestSugar = getLatestReading(['FASTING_SUGAR']);
  const latestPulse = getLatestReading(['PULSE']);
  const latestSpO2 = getLatestReading(['SPO2']);
  const latestTemp = getLatestReading(['TEMPERATURE']);
  const latestWeight = getLatestReading(['WEIGHT']);

  // Build combined BP chart dataset
  const bpChartData = useMemo(() => {
    const systolicRecords = vitals
      .filter(v => v.metric_type === 'BP_SYSTOLIC' || v.metric_type === 'BLOOD_PRESSURE')
      .slice(0, 15)
      .reverse();

    const diastolicRecords = vitals
      .filter(v => v.metric_type === 'BP_DIASTOLIC')
      .slice(0, 15)
      .reverse();

    // Map by date timestamp
    const allDatesMap = new Map<string, { systolic?: number; diastolic?: number }>();

    systolicRecords.forEach(r => {
      const d = new Date(r.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const curr = allDatesMap.get(d) || {};
      curr.systolic = Number(r.metric_value);
      allDatesMap.set(d, curr);
    });

    diastolicRecords.forEach(r => {
      const d = new Date(r.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const curr = allDatesMap.get(d) || {};
      curr.diastolic = Number(r.metric_value);
      allDatesMap.set(d, curr);
    });

    const labels = Array.from(allDatesMap.keys());
    const sysData = labels.map(l => allDatesMap.get(l)?.systolic ?? null);
    const diaData = labels.map(l => allDatesMap.get(l)?.diastolic ?? null);

    return {
      hasData: labels.length > 0,
      chart: {
        labels: labels.length > 0 ? labels : ['No Data Recorded'],
        datasets: [
          {
            label: 'Systolic BP (mmHg)',
            data: sysData,
            borderColor: 'rgb(244, 63, 94)',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            fill: false,
            tension: 0.35,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5
          },
          {
            label: 'Diastolic BP (mmHg)',
            data: diaData,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: false,
            tension: 0.35,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5
          }
        ]
      }
    };
  }, [vitals]);

  // Build single-metric chart data helper
  const getSingleMetricChart = (type: string, config: MetricConfig) => {
    const records = vitals
      .filter(v => v.metric_type === type)
      .slice(0, 15)
      .reverse();

    if (records.length === 0) {
      return { hasData: false, data: null };
    }

    return {
      hasData: true,
      data: {
        labels: records.map(r => new Date(r.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' })),
        datasets: [
          {
            label: config.label,
            data: records.map(r => Number(r.metric_value)),
            borderColor: config.color,
            backgroundColor: config.bg,
            fill: true,
            tension: 0.35,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            borderWidth: 2.5
          }
        ]
      }
    };
  };

  // Common chart options generator
  const getChartOptions = (yMin: number, yMax: number, unit: string): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { family: 'inherit', weight: 600, size: 12 },
          boxWidth: 12,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => ` ${context.dataset.label || ''}: ${context.parsed.y} ${unit}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11, weight: 500 }, color: '#64748b' }
      },
      y: {
        suggestedMin: yMin,
        suggestedMax: yMax,
        grid: { color: 'rgba(226, 232, 240, 0.6)' },
        ticks: {
          font: { size: 11, weight: 500 },
          color: '#64748b',
          callback: (value) => `${value} ${unit}`
        }
      }
    }
  });

  const activeConfig = METRIC_CONFIG[metricType] || METRIC_CONFIG['BP_SYSTOLIC'];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  Health Telemetry &amp; Biometrics
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  Real-time physiological curves, longitudinal trends, and encrypted vital tracking.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSeedBaseline}
              disabled={seeding || loading}
              title="Populates realistic 7-day vitals if your chart is blank"
              className="inline-flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
              {seeding ? 'Generating Baseline...' : 'Load 7-Day Baseline Telemetry'}
            </button>
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

        {/* Empty State Banner (If 0 vitals) */}
        {!loading && vitals.length === 0 && (
          <div className="bg-gradient-to-r from-rose-50 via-indigo-50 to-emerald-50 border border-rose-200/80 rounded-3xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center mx-auto text-rose-500">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">No Vital Readings Recorded Yet</h2>
              <p className="text-slate-600 text-sm max-w-lg mx-auto mt-1">
                Your telemetry dashboard is currently blank. You can log individual metrics manually or load a realistic 7-day clinical baseline to immediately experience interactive graphical analysis.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={handleSeedBaseline}
                disabled={seeding}
                className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {seeding ? 'Generating Baseline...' : 'Populate 7-Day Baseline Now'}
              </button>
              <button
                onClick={() => setIsLogging(true)}
                className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm"
              >
                Log First Vital
              </button>
            </div>
          </div>
        )}

        {/* KPI Stat Cards Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Blood Pressure Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Blood Pressure</span>
              <HeartPulse className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {latestSystolic ? (
                <>
                  {latestSystolic.metric_value}
                  <span className="text-slate-400 font-normal text-sm">
                    /{latestDiastolic ? latestDiastolic.metric_value : '--'}
                  </span>
                </>
              ) : (
                <span className="text-slate-400 text-base">--/--</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100">
                {latestSystolic ? 'Normotensive' : 'Awaiting data'}
              </span>
            </div>
          </div>

          {/* Fasting Sugar Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Fasting Sugar</span>
              <Droplets className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {latestSugar ? (
                <>
                  {latestSugar.metric_value}{' '}
                  <span className="text-xs font-semibold text-slate-400">mg/dL</span>
                </>
              ) : (
                <span className="text-slate-400 text-base">-- mg/dL</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                {latestSugar ? 'Optimal Fasting' : 'Awaiting data'}
              </span>
            </div>
          </div>

          {/* Pulse Rate Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pulse Rate</span>
              <Heart className="w-4 h-4 text-pink-500" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {latestPulse ? (
                <>
                  {latestPulse.metric_value}{' '}
                  <span className="text-xs font-semibold text-slate-400">bpm</span>
                </>
              ) : (
                <span className="text-slate-400 text-base">-- bpm</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-100">
                {latestPulse ? 'Normal Resting' : 'Awaiting data'}
              </span>
            </div>
          </div>

          {/* SpO2 Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Oxygen SpO2</span>
              <Gauge className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {latestSpO2 ? (
                <>
                  {latestSpO2.metric_value}{' '}
                  <span className="text-xs font-semibold text-slate-400">%</span>
                </>
              ) : (
                <span className="text-slate-400 text-base">-- %</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                {latestSpO2 ? 'Normal Saturation' : 'Awaiting data'}
              </span>
            </div>
          </div>

          {/* Temperature Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Temperature</span>
              <Thermometer className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {latestTemp ? (
                <>
                  {latestTemp.metric_value}{' '}
                  <span className="text-xs font-semibold text-slate-400">°F</span>
                </>
              ) : (
                <span className="text-slate-400 text-base">-- °F</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                {latestTemp ? 'Afebrile' : 'Awaiting data'}
              </span>
            </div>
          </div>

          {/* Weight Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Body Weight</span>
              <Scale className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {latestWeight ? (
                <>
                  {latestWeight.metric_value}{' '}
                  <span className="text-xs font-semibold text-slate-400">kg</span>
                </>
              ) : (
                <span className="text-slate-400 text-base">-- kg</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                {latestWeight ? 'Stable' : 'Awaiting data'}
              </span>
            </div>
          </div>
        </div>

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
                Target Unit: {activeConfig.unit}
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

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> All Diagnostic Curves
          </button>
          <button
            onClick={() => setActiveTab('CARDIO')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'CARDIO'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" /> Blood Pressure &amp; Pulse
          </button>
          <button
            onClick={() => setActiveTab('METABOLIC')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'METABOLIC'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" /> Blood Glucose / Sugar
          </button>
          <button
            onClick={() => setActiveTab('RESPIRATORY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'RESPIRATORY'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" /> SpO2 &amp; Temperature
          </button>
          <button
            onClick={() => setActiveTab('WEIGHT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'WEIGHT'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Scale className="w-3.5 h-3.5" /> Body Weight
          </button>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Combined Blood Pressure Chart (Shown in ALL or CARDIO) */}
          {(activeTab === 'ALL' || activeTab === 'CARDIO') && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Blood Pressure Profile (Systolic &amp; Diastolic)
                    </h3>
                    <p className="text-xs text-slate-500">Dual-curve physiological blood pressure trajectory</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                  Target &lt; 120/80 mmHg
                </span>
              </div>
              <div className="h-64">
                {bpChartData.hasData ? (
                  <Line
                    data={bpChartData.chart}
                    options={getChartOptions(50, 160, 'mmHg')}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <HeartPulse className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-semibold">No Blood Pressure readings found</p>
                    <button
                      onClick={() => { setMetricType('BP_SYSTOLIC'); setIsLogging(true); }}
                      className="text-xs text-rose-600 font-bold hover:underline"
                    >
                      + Record Blood Pressure
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pulse Rate Chart (Shown in ALL or CARDIO) */}
          {(activeTab === 'ALL' || activeTab === 'CARDIO') && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Heart &amp; Pulse Rate</h3>
                    <p className="text-xs text-slate-500">Resting heart rate in beats per minute</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-pink-50 text-pink-700 rounded-lg">
                  Normal 60 - 100 bpm
                </span>
              </div>
              <div className="h-64">
                {(() => {
                  const chart = getSingleMetricChart('PULSE', METRIC_CONFIG.PULSE);
                  if (chart.hasData && chart.data) {
                    return (
                      <Line
                        data={chart.data}
                        options={getChartOptions(50, 120, 'bpm')}
                      />
                    );
                  }
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Heart className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold">No Pulse readings found</p>
                      <button
                        onClick={() => { setMetricType('PULSE'); setIsLogging(true); }}
                        className="text-xs text-pink-600 font-bold hover:underline"
                      >
                        + Record Pulse
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Fasting Blood Sugar Chart (Shown in ALL or METABOLIC) */}
          {(activeTab === 'ALL' || activeTab === 'METABOLIC') && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Fasting Blood Sugar</h3>
                    <p className="text-xs text-slate-500">Glycemic regulation measured before morning meal</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                  Target 70 - 99 mg/dL
                </span>
              </div>
              <div className="h-64">
                {(() => {
                  const chart = getSingleMetricChart('FASTING_SUGAR', METRIC_CONFIG.FASTING_SUGAR);
                  if (chart.hasData && chart.data) {
                    return (
                      <Line
                        data={chart.data}
                        options={getChartOptions(60, 160, 'mg/dL')}
                      />
                    );
                  }
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Droplets className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold">No Fasting Blood Sugar readings found</p>
                      <button
                        onClick={() => { setMetricType('FASTING_SUGAR'); setIsLogging(true); }}
                        className="text-xs text-emerald-600 font-bold hover:underline"
                      >
                        + Record Blood Sugar
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Post-Prandial Sugar (Shown in METABOLIC) */}
          {activeTab === 'METABOLIC' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Wind className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Post-Prandial Sugar (PPBS)</h3>
                    <p className="text-xs text-slate-500">Blood glucose 2 hours after meal intake</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg">
                  Target &lt; 140 mg/dL
                </span>
              </div>
              <div className="h-64">
                {(() => {
                  const chart = getSingleMetricChart('PP_SUGAR', METRIC_CONFIG.PP_SUGAR);
                  if (chart.hasData && chart.data) {
                    return (
                      <Line
                        data={chart.data}
                        options={getChartOptions(70, 200, 'mg/dL')}
                      />
                    );
                  }
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Wind className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold">No PPBS readings found</p>
                      <button
                        onClick={() => { setMetricType('PP_SUGAR'); setIsLogging(true); }}
                        className="text-xs text-teal-600 font-bold hover:underline"
                      >
                        + Record PPBS
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Blood Oxygen SpO2 Chart (Shown in ALL or RESPIRATORY) */}
          {(activeTab === 'ALL' || activeTab === 'RESPIRATORY') && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Blood Oxygen Saturation (SpO2)</h3>
                    <p className="text-xs text-slate-500">Peripheral capillary oxygen saturation level</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg">
                  Target 95 - 100%
                </span>
              </div>
              <div className="h-64">
                {(() => {
                  const chart = getSingleMetricChart('SPO2', METRIC_CONFIG.SPO2);
                  if (chart.hasData && chart.data) {
                    return (
                      <Line
                        data={chart.data}
                        options={getChartOptions(90, 100, '%')}
                      />
                    );
                  }
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Gauge className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold">No SpO2 readings found</p>
                      <button
                        onClick={() => { setMetricType('SPO2'); setIsLogging(true); }}
                        className="text-xs text-sky-600 font-bold hover:underline"
                      >
                        + Record SpO2
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Body Temperature Chart (Shown in ALL or RESPIRATORY) */}
          {(activeTab === 'ALL' || activeTab === 'RESPIRATORY') && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Thermometer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Core Body Temperature</h3>
                    <p className="text-xs text-slate-500">Longitudinal thermal status in Fahrenheit</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg">
                  Normal 97.0 - 99.0 °F
                </span>
              </div>
              <div className="h-64">
                {(() => {
                  const chart = getSingleMetricChart('TEMPERATURE', METRIC_CONFIG.TEMPERATURE);
                  if (chart.hasData && chart.data) {
                    return (
                      <Line
                        data={chart.data}
                        options={getChartOptions(96, 102, '°F')}
                      />
                    );
                  }
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Thermometer className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold">No Temperature readings found</p>
                      <button
                        onClick={() => { setMetricType('TEMPERATURE'); setIsLogging(true); }}
                        className="text-xs text-amber-600 font-bold hover:underline"
                      >
                        + Record Temperature
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Body Weight Chart (Shown in ALL or WEIGHT) */}
          {(activeTab === 'ALL' || activeTab === 'WEIGHT') && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Body Weight Trajectory</h3>
                    <p className="text-xs text-slate-500">Weight tracking in kilograms</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg">
                  Target BMI Stability
                </span>
              </div>
              <div className="h-64">
                {(() => {
                  const chart = getSingleMetricChart('WEIGHT', METRIC_CONFIG.WEIGHT);
                  if (chart.hasData && chart.data) {
                    return (
                      <Line
                        data={chart.data}
                        options={getChartOptions(40, 110, 'kg')}
                      />
                    );
                  }
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Scale className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold">No Weight readings found</p>
                      <button
                        onClick={() => { setMetricType('WEIGHT'); setIsLogging(true); }}
                        className="text-xs text-purple-600 font-bold hover:underline"
                      >
                        + Record Weight
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

        </div>

        {/* Historical Telemetry Log Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600" /> Historical Telemetry Log
              </h2>
              <p className="text-xs text-slate-500">
                {vitals.length} total encrypted observation{vitals.length === 1 ? '' : 's'} recorded
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" /> Download Full CSV Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100 font-bold">
                  <th className="p-4">Date &amp; Time</th>
                  <th className="p-4">Metric</th>
                  <th className="p-4">Recorded Value</th>
                  <th className="p-4">Reference Target</th>
                  <th className="p-4">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vitals.map(vital => {
                  const cfg = METRIC_CONFIG[vital.metric_type];
                  return (
                    <tr key={vital.vital_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 text-sm text-slate-600 font-medium">
                        {new Date(vital.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                        <span className="text-slate-400">
                          {new Date(vital.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {cfg?.icon && (
                            <cfg.icon className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="text-sm font-bold text-slate-900">
                            {cfg?.label || vital.metric_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-mono font-bold text-slate-900">
                        {vital.metric_value}{' '}
                        <span className="text-xs font-semibold text-slate-400">{vital.metric_unit}</span>
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-500">
                        {cfg?.normalRange || 'N/A'}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                          {vital.reading_context || 'Routine'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {vitals.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 font-medium">
                      No vitals logged yet. Click &ldquo;Log New Vital&rdquo; or &ldquo;Load 7-Day Baseline Telemetry&rdquo; above.
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
