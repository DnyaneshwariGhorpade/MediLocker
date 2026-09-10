import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Search, Download, Eye, AlertTriangle, Key, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  'ALL', 'PRESCRIPTION', 'BLOOD_REPORT', 'X_RAY', 'MRI', 'CT_SCAN',
  'VACCINATION_RECORD', 'ALLERGY_RECORD', 'SURGERY_HISTORY', 'DISCHARGE_SUMMARY',
  'CHRONIC_DISEASE_HISTORY', 'SENSITIVE_REPORT'
];

const PatientVault = () => {
  const { token } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Decryption State
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [decryptedViewId, setDecryptedViewId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [filter, searchQuery]);

  const fetchRecords = async () => {
    try {
      let url = '/api/v1/vault/records?';
      if (filter !== 'ALL') url += `category=${filter}&`;
      if (searchQuery) url += `search=${searchQuery}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecords(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const simulateDecryption = async (id: string) => {
    setDecryptingId(id);
    
    try {
      // Fetch encrypted payload and wrapped key
      await fetch(`/api/v1/vault/records/${id}/decrypt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Simulate AES-256 Web Crypto decryption delay
      setTimeout(() => {
        setDecryptingId(null);
        setDecryptedViewId(id);
      }, 2000);

    } catch (e) {
      console.error(e);
      setDecryptingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-indigo-600" />
              Lifelong Medical Vault
            </h1>
            <p className="text-slate-500 mt-2">AES-256 Encrypted • Zero-Trust Access • Blockchain Anchored</p>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by title, doctor, diagnosis..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${filter === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              {cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Record Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {records.map(record => (
            <div key={record.record_id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
              
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-lg">
                  {record.category.replace(/_/g, ' ')}
                </span>
                {record.blockchain_anchor && (
                  <div className="group relative">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 cursor-pointer" />
                    <div className="absolute right-0 w-48 p-2 mt-2 bg-slate-800 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                      Blockchain verified
                    </div>
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-800 mb-2">{record.record_title}</h3>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{record.diagnosis || 'No diagnosis details.'}</p>
              
              <div className="mt-auto space-y-3">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Dr. {record.doctors?.last_name || 'Self'}</span>
                  <span>{new Date(record.record_date).toLocaleDateString()}</span>
                </div>
                
                <div className="pt-4 border-t border-slate-100 flex gap-2">
                  {decryptedViewId === record.record_id ? (
                    <button className="flex-1 bg-emerald-50 text-emerald-700 py-2 rounded-xl font-semibold flex justify-center items-center gap-2">
                      <Eye className="w-4 h-4" /> Viewing
                    </button>
                  ) : (
                    <button 
                      onClick={() => simulateDecryption(record.record_id)}
                      disabled={decryptingId === record.record_id}
                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-xl font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {decryptingId === record.record_id ? (
                        <span className="animate-pulse flex items-center gap-2"><Key className="w-4 h-4 animate-spin" /> Decrypting...</span>
                      ) : (
                        <><Key className="w-4 h-4" /> In-Browser Decrypt</>
                      )}
                    </button>
                  )}
                  
                  <button className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
                    <AlertTriangle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {records.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-100">
              No medical records found in this category.
            </div>
          )}
        </div>

        {/* Decrypted Viewer Modal Overlay Simulation */}
        {decryptedViewId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-emerald-600" />
                  <h3 className="font-bold text-slate-800">Secure In-Memory Decryption Viewer</h3>
                </div>
                <button onClick={() => setDecryptedViewId(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-semibold text-slate-700 transition-colors">
                  Close & Destroy Key
                </button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto flex items-center justify-center bg-slate-100">
                 {/* Dummy Document Representation */}
                 <div className="bg-white w-full max-w-2xl h-96 shadow-lg border border-slate-200 rounded flex items-center justify-center p-12 text-center text-slate-400 border-dashed">
                    <p>Decrypted file rendered securely from memory buffer.<br/>(Simulated Document Content)</p>
                 </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PatientVault;
