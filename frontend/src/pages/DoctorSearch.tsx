import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

const CATEGORIES = ['ALL', 'PRESCRIPTION', 'BLOOD_REPORT', 'X_RAY', 'MRI', 'CT_SCAN', 'DISCHARGE_SUMMARY'];

const DoctorSearch = () => {
  const { token } = useAuth();
  
  const [vaultNumber, setVaultNumber] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultNumber) return alert("Vault Number is required.");

    setIsSearching(true);
    try {
      let url = `/api/v1/doctor/records/search?vault_number=${vaultNumber}&category=${category}`;
      if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
      if (fromDate) url += `&from_date=${fromDate}`;
      if (toDate) url += `&to_date=${toDate}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setResults(await res.json());
      } else {
        alert("Search failed. Ensure you have active consent for this patient.");
        setResults([]);
      }
    } catch (err) { console.error(err); }
    setIsSearching(false);
    setHasSearched(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Search className="w-8 h-8 text-indigo-600" />
            Smart Medical Filter Engine
          </h1>
          <p className="text-slate-500 mt-2">Deep search consented records across document type, diagnosis, and date.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Filters Panel */}
          <div className="w-full lg:w-1/3">
            <form onSubmit={handleSearch} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 sticky top-24">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Filter className="w-5 h-5 text-indigo-500" /> Search Parameters
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Patient Vault Number *</label>
                <input 
                  required value={vaultNumber} onChange={e => setVaultNumber(e.target.value)}
                  placeholder="ML-2026-XXXX"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Keywords</label>
                <input 
                  value={keyword} onChange={e => setKeyword(e.target.value)}
                  placeholder="Diagnosis, title, findings..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Document Category</label>
                <select 
                  value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-sm" />
                </div>
              </div>

              <button type="submit" disabled={isSearching} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-md transition-colors flex justify-center items-center gap-2">
                {isSearching ? 'Searching...' : <><Search className="w-4 h-4" /> Apply Filters</>}
              </button>
            </form>
          </div>

          {/* Results Grid */}
          <div className="w-full lg:w-2/3">
            {hasSearched && (
              <div className="mb-4 flex justify-between items-center bg-slate-100 p-4 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">{results.length} results found</span>
                <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 bg-indigo-100 px-2 py-1 rounded"><ShieldCheck className="w-3 h-3" /> Consent Gated View</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.map(record => (
                <div key={record.record_id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md">
                      {record.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{new Date(record.record_date).toLocaleDateString()}</span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-800 mb-1 leading-tight">{record.record_title}</h3>
                  <p className="text-sm text-slate-600 mb-4 flex-1 line-clamp-3">
                    <span className="font-semibold text-slate-700">Diagnosis:</span> {record.diagnosis || 'None listed'}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex gap-2">
                     <button className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-slate-800 transition-colors">
                       <FileText className="w-4 h-4" /> Open Viewer
                     </button>
                  </div>
                </div>
              ))}
              {hasSearched && results.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 border-dashed">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-30 text-slate-400" />
                  <p className="font-semibold">No records match your exact filters.</p>
                  <p className="text-sm mt-1 text-slate-400">Try broadening your search terms or checking consent validity.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default DoctorSearch;
