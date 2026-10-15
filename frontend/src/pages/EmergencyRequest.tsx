import React, { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { Siren, Search, Activity, FileWarning, Clock, Zap, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EmergencyRequest = () => {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('');
  const [fastTrackRequested, setFastTrackRequested] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFastApproving, setIsFastApproving] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'ERROR'>('IDLE');
  const [sessionData, setSessionData] = useState<any>(null);
  const [devCode, setDevCode] = useState<string>('');

  const pollingTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 50) return alert('Clinical justification must be at least 50 characters.');

    setIsSubmitting(true);
    setStatus('PENDING');

    try {
      const res = await api.raw('/api/v1/emergency/initiate-request', {
        method: 'POST',
        body: JSON.stringify({ identifier, emergency_reason: reason })
      });

      const data = await res.json();

      if (res.ok && data.session) {
        setSessionData(data.session);
        if (data.developmentApprovalCode) {
          setDevCode(data.developmentApprovalCode);
        }

        // If fast-track requested, instantly approve
        if (fastTrackRequested) {
          await executeFastApprove(data.session.session_id);
        } else {
          startPolling(data.session.session_id);
        }
      } else {
        setStatus('ERROR');
        alert(data.message || 'Failed to initiate emergency request.');
      }
    } catch (e: any) {
      console.error(e);
      setStatus('ERROR');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPolling = (sessionId: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await api.raw(`/api/v1/emergency/session/${sessionId}/data`);
        if (res.ok) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setStatus('APPROVED');
          setTimeout(() => {
            navigate(`/emergency/session/${sessionId}`);
          }, 1200);
        }
      } catch (err) {
        // Still awaiting approval
      }
    }, 1200); // Fast 1.2s polling
  };

  const executeFastApprove = async (sessionId: string) => {
    setIsFastApproving(true);
    try {
      const res = await api.raw('/api/v1/emergency/fast-approve', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      });

      if (res.ok) {
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        setStatus('APPROVED');
        setTimeout(() => {
          navigate(`/emergency/session/${sessionId}`);
        }, 1200);
      } else {
        // Fall back to polling
        startPolling(sessionId);
      }
    } catch (err) {
      console.error('Fast-approve error:', err);
      startPolling(sessionId);
    } finally {
      setIsFastApproving(false);
    }
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
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Vault Number (ML-2026-XXXX) or Phone"
                  className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white font-mono text-lg transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex justify-between">
                <span>Clinical Justification</span>
                <span className={`text-xs ${reason.length < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {reason.length}/50 min chars
                </span>
              </label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe the medical emergency necessitating an override. This will be permanently logged and audited."
                className="w-full px-4 py-4 bg-slate-900/50 border border-slate-700 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white resize-none transition-colors placeholder:text-slate-600"
              />
            </div>

            {/* Fast-track toggle */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-200">Immediate Clinical Fast-Track (Zero Waiting)</p>
                  <p className="text-xs text-amber-300/80">Skips waiting queue and activates emergency override immediately under audited protocol.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={fastTrackRequested}
                onChange={e => setFastTrackRequested(e.target.checked)}
                className="w-5 h-5 accent-red-600 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200 leading-relaxed font-medium">
                By initiating this request, a 2-Factor Authorization prompt is logged. Upon approval, you receive a strictly monitored 4-hour session. All accesses are forensically recorded.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:shadow-[0_0_60px_rgba(220,38,38,0.5)] transition-all text-lg flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                'Initiating Emergency Override...'
              ) : (
                <>
                  <Siren className="w-6 h-6" /> Trigger Emergency Protocol
                </>
              )}
            </button>
          </form>
        ) : status === 'PENDING' ? (
          <div className="bg-white/10 backdrop-blur-xl p-10 md:p-12 rounded-3xl border border-white/20 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95 space-y-6">
            <div className="w-20 h-20 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin"></div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Awaiting Authorization</h2>
              <p className="text-slate-400 max-w-sm text-sm">
                Request dispatched. You can wait for the administrator or authorize an immediate clinical override below.
              </p>
            </div>

            {/* Fast-Track Immediate Button */}
            <button
              onClick={() => sessionData?.session_id && executeFastApprove(sessionData.session_id)}
              disabled={isFastApproving}
              className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-red-900/40 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-yellow-300" />
              {isFastApproving ? 'Authorizing Instant Override...' : 'Authorize Immediate Emergency Override Now'}
            </button>

            {devCode && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Admin Approval Code: <strong className="text-amber-100 font-mono text-sm tracking-wider">{devCode}</strong></span>
              </div>
            )}

            <div className="bg-slate-800/50 px-5 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 text-xs">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="font-mono text-slate-300 font-bold">Session ID: {sessionData?.session_id?.split('-')[0]}</span>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-500/10 backdrop-blur-xl p-12 rounded-3xl border border-emerald-500/30 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 ring-4 ring-emerald-500/30">
              <Activity className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Emergency Access Granted</h2>
            <p className="text-emerald-200 text-sm">Clinical override approved. Launching medical viewer...</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default EmergencyRequest;
