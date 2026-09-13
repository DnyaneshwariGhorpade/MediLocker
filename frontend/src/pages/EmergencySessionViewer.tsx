import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Siren, HeartPulse, ShieldAlert, XCircle, FileText, Lock } from 'lucide-react';

const EmergencySessionViewer = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTerminating, setIsTerminating] = useState(false);

  useEffect(() => {
    fetchSessionData();
  }, [sessionId, token]);

  useEffect(() => {
    if (data?.session?.session_expires_at) {
      const calculateTimeLeft = () => {
        const expiry = new Date(data.session.session_expires_at).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((expiry - now) / 1000);
        return diff > 0 ? diff : 0;
      };

      setTimeLeft(calculateTimeLeft());

      const timer = setInterval(() => {
        const tl = calculateTimeLeft();
        setTimeLeft(tl);
        if (tl <= 0) {
          clearInterval(timer);
          alert("Session expired. Access revoked.");
          navigate('/doctor/dashboard');
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [data, navigate]);

  const fetchSessionData = async () => {
    try {
      setData(await api.get<any>(`/api/v1/emergency/session/${sessionId}/data`));
    } catch (e: any) {
      // An expired or revoked session throws, which is the signal to leave.
      alert(e.message ?? 'Session invalid or expired.');
      navigate('/emergency/request');
    }
  };

  const handleTerminate = async () => {
    if (!confirm("Are you sure you want to end this emergency session? Access will be immediately revoked.")) return;
    setIsTerminating(true);
    try {
      const res = await api.raw('/api/v1/emergency/terminate', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      });
      if (res.ok) {
        navigate('/doctor/dashboard');
      }
    } catch (e) { console.error(e); }
    setIsTerminating(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  if (!data) return <div className="min-h-screen bg-slate-900 flex justify-center items-center"><div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const { session, snapshot, records } = data;

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">

      {/* Persistent Top Emergency Banner */}
      <div className="bg-red-600 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 shadow-lg border-b-4 border-red-800">
        <div className="flex items-center gap-3 font-bold text-lg tracking-wide uppercase">
          <Siren className="w-6 h-6 animate-pulse" />
          Active Emergency Session
        </div>
        <div className="flex items-center gap-6 mt-2 md:mt-0">
          {session.patient_notified && (
            <div className="hidden lg:flex items-center gap-2 text-xs font-bold bg-red-800 px-3 py-1.5 rounded-lg border border-red-500">
              <ShieldAlert className="w-4 h-4"/> Next-of-Kin / Patient Alerted
            </div>
          )}
          <div className="font-mono text-2xl font-bold tracking-[0.2em] bg-slate-900/50 px-4 py-1 rounded-xl shadow-inner border border-red-500/30 text-red-100">
            {formatTime(timeLeft)}
          </div>
          <button onClick={handleTerminate} disabled={isTerminating} className="bg-white text-red-700 hover:bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-colors flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Terminate
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Col: Patient & Snapshot */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full mix-blend-multiply opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-1">{session.patients.first_name} {session.patients.last_name}</h2>
            <p className="text-slate-500 font-mono text-sm bg-slate-100 inline-block px-2 py-1 rounded">Vault: {session.patients.patient_vaults?.vault_number}</p>

            <div className="mt-6 space-y-4">
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                <p className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2 mb-2"><HeartPulse className="w-4 h-4"/> Known Allergies</p>
                <div className="flex flex-wrap gap-2">
                  {snapshot.allergies.map((a: string) => <span key={a} className="bg-white border border-rose-200 text-rose-700 px-2 py-1 rounded font-bold text-xs">{a}</span>)}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex justify-between items-center">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Blood Group</p>
                <p className="text-2xl font-black text-blue-900">{snapshot.bloodGroup || 'UNK'}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Chronic Conditions</p>
                <ul className="list-disc pl-5 text-sm font-semibold text-amber-900">
                  {snapshot.chronicConditions.map((c: string) => <li key={c}>{c}</li>)}
                </ul>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Active Medications</p>
                <ul className="list-disc pl-5 text-sm font-semibold text-slate-800">
                  {snapshot.activeMedications.map((m: string) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Timeline & Records */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[80vh]">
             <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500" /> Emergency Document Browser</h3>
               <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                 <Lock className="w-3 h-3" /> Every view is audited
               </div>
             </div>

             <div className="p-6 flex-1 overflow-y-auto bg-slate-50 space-y-4">
                {records.map((r: any) => (
                  <div key={r.record_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
                    <div>
                      <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wide mb-2 inline-block">{r.category.replace(/_/g, ' ')}</span>
                      <h4 className="text-lg font-bold text-slate-800 leading-tight mb-1">{r.record_title}</h4>
                      <p className="text-sm text-slate-500 font-medium">{new Date(r.record_date).toLocaleDateString()}</p>
                    </div>
                    <button className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-4 py-2 rounded-xl text-sm transition-colors opacity-0 group-hover:opacity-100 shadow-sm">
                      Access Document
                    </button>
                  </div>
                ))}
                {records.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-medium">No medical records found in vault.</div>
                )}
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default EmergencySessionViewer;
