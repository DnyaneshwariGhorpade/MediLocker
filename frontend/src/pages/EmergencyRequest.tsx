import React, { useState } from 'react';
import { api } from '../lib/api';
import { Siren, Search, Activity, FileWarning, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EmergencyRequest = () => {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'ERROR'>('IDLE');
  const [sessionData, setSessionData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 50) return alert("Clinical justification must be at least 50 characters.");

    setIsSubmitting(true);
    setStatus('PENDING');

    try {
      const res = await api.raw('/api/v1/emergency/initiate-request', {
        method: 'POST',
        body: JSON.stringify({ identifier, emergency_reason: reason })
      });

      const data = await res.json();

      if (res.ok) {
        setSessionData(data.session);
        // In a real app, we'd poll for approval or use websockets.
        // For this demo, we'll just wait for the user to navigate to the viewer manually,
        // or we simulate polling... Let's poll for approval.
        startPolling(data.session.session_id);
      } else {
        setStatus('ERROR');
        alert(data.message || "Failed to initiate emergency request.");
      }
    } catch (e) {
      console.error(e);
      setStatus('ERROR');
    }
    setIsSubmitting(false);
  };

  const startPolling = (sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        await api.get<any>(`/api/v1/emergency/session/${sessionId}/data`);
          clearInterval(interval);
          setStatus('APPROVED');
          setTimeout(() => {
            navigate(`/emergency/session/${sessionId}`);
          }, 2000);
      } catch (err) {
        // Just wait
      }
    }, 5000); // Poll every 5s
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-12 font-sans relative overflow-hidden flex items-center justify-center">
      {/* Background FX */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[50%] -left-[10%] w-[120%] h-96 bg-red-600/10 blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[20%] w-96 h-96 bg-orange-600/10 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-2xl w-full relative z-10">

        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-red-500/30">
            <Siren className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Break-Glass Protocol</h1>
          <p className="text-slate-400 mt-3 text-lg font-medium">Initiate emergency override for unresponsive patients.</p>
        </div>

        {status === 'IDLE' || status === 'ERROR' ? (
          <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 shadow-2xl space-y-6">

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Patient Identification</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  required value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder="Vault Number (ML-2026-XXXX) or Phone"
                  className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white font-mono text-lg transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex justify-between">
                <span>Clinical Justification</span>
                <span className={`text-xs ${reason.length < 50 ? 'text-red-400' : 'text-emerald-400'}`}>{reason.length}/50 min chars</span>
              </label>
              <textarea
                required rows={4} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Describe the medical emergency necessitating an override. This will be permanently logged and audited."
                className="w-full px-4 py-4 bg-slate-900/50 border border-slate-700 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white resize-none transition-colors placeholder:text-slate-600"
              />
            </div>

            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200 leading-relaxed font-medium">
                By initiating this request, a 2-Factor Authorization prompt is sent to the Hospital Administrator. Upon approval, you receive a strictly monitored 4-hour session. All accesses are forensically logged.
              </p>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:shadow-[0_0_60px_rgba(220,38,38,0.5)] transition-all text-lg flex justify-center items-center gap-2 disabled:opacity-50">
              {isSubmitting ? 'Submitting Request...' : <><Siren className="w-6 h-6"/> Trigger Protocol</>}
            </button>
          </form>
        ) : status === 'PENDING' ? (
          <div className="bg-white/10 backdrop-blur-xl p-12 rounded-3xl border border-white/20 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95">
            <div className="w-24 h-24 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-2">Awaiting Admin Approval</h2>
            <p className="text-slate-400 max-w-sm">Request dispatched to Hospital Administrator. Do not close this window. Session will open automatically upon approval.</p>
            <div className="mt-8 bg-slate-800/50 px-6 py-3 rounded-xl border border-slate-700 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400"/>
              <span className="font-mono text-slate-300 font-bold">Session ID: {sessionData?.session_id.split('-')[0]}</span>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-500/10 backdrop-blur-xl p-12 rounded-3xl border border-emerald-500/30 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95">
            <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6">
              <Activity className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Granted</h2>
            <p className="text-emerald-200">Admin verified. Redirecting to secure viewer...</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default EmergencyRequest;
