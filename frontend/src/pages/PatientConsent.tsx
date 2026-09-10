import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ShieldCheck, XCircle, Plus, History } from 'lucide-react';

const PatientConsent = () => {
  const { token } = useAuth();
  const [activeConsents, setActiveConsents] = useState<any[]>([]);
  const [consentHistory, setConsentHistory] = useState<any[]>([]);
  const [isGranting, setIsGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // New Consent Form State
  const [doctorId, setDoctorId] = useState('');
  const [allowedCategories, setAllowedCategories] = useState<string[]>(['PRESCRIPTION', 'BLOOD_REPORT']);
  const [blockedCategories, setBlockedCategories] = useState<string[]>(['PSYCHIATRIC_REPORT', 'HIV_REPORT']);
  const [validDays, setValidDays] = useState(7);
  const [accessLevel, setAccessLevel] = useState('READ_ONLY');

  useEffect(() => {
    fetchActiveConsents();
    fetchConsentHistory();
  }, [token]);

  const fetchActiveConsents = async () => {
    try {
      const res = await fetch('/api/v1/consent/active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setActiveConsents(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchConsentHistory = async () => {
    try {
      const res = await fetch('/api/v1/consent/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setConsentHistory(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm("Are you sure you want to instantly revoke access? This cannot be undone.")) return;
    setRevokingId(id);
    try {
      await fetch(`/api/v1/consent/${id}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchActiveConsents();
      await fetchConsentHistory();
    } catch (e) {
      console.error(e);
    }
    setRevokingId(null);
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);
      
      const res = await fetch('/api/v1/consent/grant', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          doctor_id: doctorId,
          allowed_categories: allowedCategories,
          blocked_categories: blockedCategories,
          valid_until: validUntil.toISOString(),
          access_level: accessLevel
        })
      });
      if (res.ok) {
        setIsGranting(false);
        fetchActiveConsents();
        fetchConsentHistory();
      } else {
        alert("Failed to grant consent. Please check doctor ID.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
              Granular Consent Management
            </h1>
            <p className="text-slate-500 mt-2">Instantly grant, customize, block, or revoke doctor access.</p>
          </div>
          <button 
            onClick={() => setIsGranting(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Grant New Access
          </button>
        </div>

        {/* Active Consents */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" /> Active Consents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeConsents.map(consent => (
              <div key={consent.consent_id} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Dr. {consent.doctors?.last_name || 'Unknown'}</h3>
                    <p className="text-sm text-slate-500">{consent.doctors?.specialization || 'General'}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                    {consent.access_level.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Allowed Categories</p>
                    <div className="flex flex-wrap gap-1">
                      {consent.allowed_categories.map((cat: string) => (
                        <span key={cat} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">{cat.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </div>
                  {consent.blocked_categories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Blocked Categories</p>
                      <div className="flex flex-wrap gap-1">
                        {consent.blocked_categories.map((cat: string) => (
                          <span key={cat} className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded border border-red-100">{cat.replace('_', ' ')}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Valid Until</p>
                    <p className="text-sm text-slate-800 font-medium">{new Date(consent.valid_until).toLocaleDateString()}</p>
                  </div>
                </div>

                <button 
                  onClick={() => handleRevoke(consent.consent_id)}
                  disabled={revokingId === consent.consent_id}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-red-200 disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" /> 
                  {revokingId === consent.consent_id ? 'Revoking in <1ms...' : 'Instant Revoke'}
                </button>
              </div>
            ))}
            {activeConsents.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-100">
                You have no active doctor consents.
              </div>
            )}
          </div>
        </div>

        {/* Audit History */}
        <div className="pt-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <History className="w-6 h-6 text-slate-500" /> Consent Audit Log
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Doctor</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Valid Until/Revoked</th>
                    <th className="p-4 font-semibold">Categories</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consentHistory.map(history => (
                    <tr key={history.consent_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-600">{new Date(history.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-sm font-medium text-slate-900">Dr. {history.doctors?.last_name || 'Unknown'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                          history.consent_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                          history.consent_status === 'REVOKED' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {history.consent_status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {history.revoked_at ? `Revoked on ${new Date(history.revoked_at).toLocaleDateString()}` : new Date(history.valid_until).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {history.allowed_categories.length} allowed, {history.blocked_categories.length} blocked
                      </td>
                    </tr>
                  ))}
                  {consentHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">No consent history found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Grant Consent Drawer (Modal) */}
      {isGranting && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                Grant Doctor Access
              </h3>
              <button onClick={() => setIsGranting(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleGrant} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Doctor ID</label>
                <input 
                  required
                  value={doctorId}
                  onChange={e => setDoctorId(e.target.value)}
                  placeholder="Enter Doctor UUID" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Validity Period</label>
                <select 
                  value={validDays}
                  onChange={e => setValidDays(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none"
                >
                  <option value={1}>24 Hours</option>
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={365}>1 Year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Access Level</label>
                <select 
                  value={accessLevel}
                  onChange={e => setAccessLevel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none"
                >
                  <option value="READ_ONLY">Read Only</option>
                  <option value="DOWNLOAD">Read & Download</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium border border-blue-100 mb-4">
                  Note: In a full implementation, you would use a multi-select component here to pick from all categories.
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-md transition-all">
                Grant Secure Access
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default PatientConsent;
