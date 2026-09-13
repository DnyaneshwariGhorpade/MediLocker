import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Terminal, KeyRound, Shield, AlertTriangle, EyeOff, Save, Plus } from 'lucide-react';

const HospitalApiConsole = () => {
  const { token } = useAuth();
  const [clients, setClients] = useState<any[]>([]);

  const [newClientName, setNewClientName] = useState('');
  const [newIpCidrs, setNewIpCidrs] = useState('');

  const [generatedKey, setGeneratedKey] = useState<any>(null);

  useEffect(() => {
    fetchClients();
  }, [token]);

  const fetchClients = async () => {
    try {
      setClients(await api.get<any>('/api/v1/hms/clients'));
    } catch (e) { console.error(e); }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;
    try {
      const res = await api.raw('/api/v1/hms/clients/generate-key', {
        method: 'POST',
        body: JSON.stringify({
          client_name: newClientName,
          allowed_ip_cidrs: newIpCidrs.split(',').map(s => s.trim()).filter(s => s) || ['0.0.0.0/0']
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.raw_credentials);
        setNewClientName('');
        setNewIpCidrs('');
        fetchClients();
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateWhitelist = async (clientId: string, cidrs: string) => {
    try {
      const res = await api.raw('/api/v1/hms/clients/ip-whitelist', {
        method: 'PUT',
        body: JSON.stringify({
          client_id: clientId,
          allowed_ip_cidrs: cidrs.split(',').map(s => s.trim()).filter(s => s)
        })
      });
      if (res.ok) {
        alert("IP Whitelist updated successfully");
        fetchClients();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Terminal className="w-8 h-8 text-indigo-600" />
            HMS REST API Console
          </h1>
          <p className="text-slate-500 mt-2">Manage programmatic access tokens, IP whitelists, and view endpoint specifications.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Key Management Column */}
          <div className="lg:col-span-1 space-y-8">

            {/* Generate Key Form */}
            <form onSubmit={handleGenerateKey} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                 <KeyRound className="w-5 h-5 text-indigo-500"/> Generate New Key
               </h3>
               <div className="space-y-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Integration Name</label>
                   <input required value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="e.g. Epic Systems Sync" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Allowed IP CIDRs (Comma separated)</label>
                   <input value={newIpCidrs} onChange={e => setNewIpCidrs(e.target.value)} placeholder="e.g. 192.168.1.0/24" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono" />
                 </div>
                 <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                   <Plus className="w-4 h-4"/> Create API Key
                 </button>
               </div>
            </form>

            {/* Existing Clients */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
               <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500"/> Active Integrations</h3>
                 <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded">{clients.length} Keys</span>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {clients.map(c => (
                   <div key={c.client_id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                     <p className="font-bold text-slate-800 mb-1">{c.client_name}</p>
                     <p className="text-xs text-slate-500 mb-3">Key Hash: <span className="font-mono">{c.api_key_hash.substring(0,10)}...</span></p>
                     <div className="flex items-center gap-2">
                       <input
                         defaultValue={c.allowed_ip_cidrs.join(', ')}
                         onBlur={(e) => handleUpdateWhitelist(c.client_id, e.target.value)}
                         className="flex-1 px-2 py-1 border rounded text-xs font-mono outline-none"
                         title="Update CIDRs"
                       />
                       <button className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-bold hover:bg-indigo-100"><Save className="w-3 h-3"/></button>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Documentation Column */}
          <div className="lg:col-span-2">

            {generatedKey && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-6 mb-8 animate-in slide-in-from-top-4 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-100 rounded-full z-0"></div>
                <div className="relative z-10">
                  <h3 className="text-amber-800 font-extrabold text-lg flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5"/> API Secret Generated</h3>
                  <p className="text-amber-700 text-sm font-medium mb-4">{generatedKey.warning}</p>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-bold text-amber-900 uppercase">API Key</p>
                      <code className="block w-full bg-white px-3 py-2 rounded border border-amber-200 font-mono text-sm break-all">{generatedKey.apiKey}</code>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900 uppercase">API Secret (Never shown again)</p>
                      <code className="block w-full bg-white px-3 py-2 rounded border border-amber-200 font-mono text-sm break-all">{generatedKey.apiSecret}</code>
                    </div>
                  </div>
                  <button onClick={() => setGeneratedKey(null)} className="mt-4 text-sm font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1"><EyeOff className="w-4 h-4"/> I have saved them</button>
                </div>
              </div>
            )}

            {/* OpenAPI Simulation */}
            <div className="bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-xl border border-slate-700 font-mono text-sm">
              <div className="bg-[#2d2d2d] px-4 py-3 flex gap-2 border-b border-slate-700">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div className="text-slate-400 text-xs ml-4">swagger-ui / OpenAPI 3.0</div>
              </div>
              <div className="p-6 space-y-4 text-slate-300">
                <h2 className="text-white text-xl font-bold font-sans">MediLocker B2B HMS API Specification</h2>
                <p className="text-slate-400 font-sans mb-6">Base URL: `https://api.medilocker.gov.in/v1/hms`</p>

                <div className="border border-green-900/50 rounded overflow-hidden">
                  <div className="bg-green-900/30 px-4 py-2 flex items-center gap-4 cursor-pointer hover:bg-green-900/40">
                    <span className="bg-green-600 text-white font-bold px-2 py-1 rounded text-xs">POST</span>
                    <span className="font-bold text-green-400">/uploadRecord</span>
                    <span className="text-slate-500 ml-auto font-sans">Push bulk clinical documents into patient vaults</span>
                  </div>
                </div>

                <div className="border border-blue-900/50 rounded overflow-hidden">
                  <div className="bg-blue-900/30 px-4 py-2 flex items-center gap-4 cursor-pointer hover:bg-blue-900/40">
                    <span className="bg-blue-600 text-white font-bold px-2 py-1 rounded text-xs">GET</span>
                    <span className="font-bold text-blue-400">/patientHistory</span>
                    <span className="text-slate-500 ml-auto font-sans">Retrieve chronological metadata of previous visits</span>
                  </div>
                </div>

                <div className="border border-green-900/50 rounded overflow-hidden">
                  <div className="bg-green-900/30 px-4 py-2 flex items-center gap-4 cursor-pointer hover:bg-green-900/40">
                    <span className="bg-green-600 text-white font-bold px-2 py-1 rounded text-xs">POST</span>
                    <span className="font-bold text-green-400">/grantAccess</span>
                    <span className="text-slate-500 ml-auto font-sans">Automated consent grant triggered from hospital desk</span>
                  </div>
                </div>

                <div className="border border-red-900/50 rounded overflow-hidden">
                  <div className="bg-red-900/30 px-4 py-2 flex items-center gap-4 cursor-pointer hover:bg-red-900/40">
                    <span className="bg-red-600 text-white font-bold px-2 py-1 rounded text-xs">POST</span>
                    <span className="font-bold text-red-400">/revokeAccess</span>
                    <span className="text-slate-500 ml-auto font-sans">Terminate consent post-discharge</span>
                  </div>
                </div>

                <div className="border border-blue-900/50 rounded overflow-hidden">
                  <div className="bg-blue-900/30 px-4 py-2 flex items-center gap-4 cursor-pointer hover:bg-blue-900/40">
                    <span className="bg-blue-600 text-white font-bold px-2 py-1 rounded text-xs">GET</span>
                    <span className="font-bold text-blue-400">/medicalTimeline</span>
                    <span className="text-slate-500 ml-auto font-sans">Fetch aggregated consultation stream</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default HospitalApiConsole;
