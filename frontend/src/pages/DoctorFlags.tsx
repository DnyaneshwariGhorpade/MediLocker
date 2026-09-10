import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Search, Flag, CheckCircle2 } from 'lucide-react';

const FLAG_REASONS = [
  { value: 'INCORRECT_INFO', label: 'Incorrect Information' },
  { value: 'DUPLICATE', label: 'Duplicate Record' },
  { value: 'WRONG_PRESCRIPTION', label: 'Wrong Prescription' },
  { value: 'ILLEGIBLE', label: 'Illegible Document' },
  { value: 'EXPIRED', label: 'Expired Validity' },
  { value: 'MISSING_PAGES', label: 'Missing Pages' },
  { value: 'OTHER', label: 'Other Issue' }
];

const DoctorFlags = () => {
  const { token } = useAuth();
  
  const [vaultNumber, setVaultNumber] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  
  const [flagReason, setFlagReason] = useState('INCORRECT_INFO');
  const [reasonDetails, setReasonDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchRecords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultNumber) return;
    try {
      const res = await fetch(`/api/v1/doctor/patient-records/${vaultNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRecords(await res.json());
      else { alert("Patient not found or no active consent."); setRecords([]); }
    } catch (err) { console.error(err); }
  };

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return alert("Please select a record to flag.");

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/doctor/records/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          record_id: selectedRecordId,
          flag_reason: flagReason,
          reason_details: reasonDetails
        })
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setReasonDetails('');
          setSelectedRecordId('');
        }, 3000);
      }
    } catch (err) { console.error(err); }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
            Quality Dispute & Flagging
          </h1>
          <p className="text-slate-500 mt-2">Flag illegible, duplicate, or incorrect medical records for administrative review.</p>
        </div>

        {success && (
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl font-bold flex items-center gap-2 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" /> Record successfully flagged. Administrator notified.
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Step 1: Find Record */}
          <div className="p-8 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 mb-4">Step 1: Select Consented Record</h3>
            <form onSubmit={fetchRecords} className="flex flex-col sm:flex-row gap-4">
              <input 
                value={vaultNumber} onChange={e => setVaultNumber(e.target.value)}
                placeholder="Patient Vault Number"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none uppercase font-mono text-sm"
              />
              <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800">
                <Search className="w-4 h-4" /> Find Records
              </button>
            </form>

            {records.length > 0 && (
              <div className="mt-6">
                <select 
                  value={selectedRecordId} onChange={e => setSelectedRecordId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none font-medium text-slate-700"
                >
                  <option value="" disabled>-- Select Document --</option>
                  {records.map(r => (
                    <option key={r.record_id} value={r.record_id}>
                      {new Date(r.record_date).toLocaleDateString()} - {r.record_title} ({r.category})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Step 2: Dispute Form */}
          <div className={`p-8 ${!selectedRecordId ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
             <h3 className="font-bold text-slate-800 mb-6">Step 2: Dispute Details</h3>
             
             <form onSubmit={handleFlagSubmit} className="space-y-6">
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for Flagging</label>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                   {FLAG_REASONS.map(fr => (
                     <label key={fr.value} className={`cursor-pointer px-4 py-3 rounded-xl border text-sm font-bold text-center transition-all ${flagReason === fr.value ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                       <input type="radio" className="hidden" name="flag_reason" value={fr.value} checked={flagReason === fr.value} onChange={() => setFlagReason(fr.value)} />
                       {fr.label}
                     </label>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Notes (Optional)</label>
                 <textarea 
                   rows={4} value={reasonDetails} onChange={e => setReasonDetails(e.target.value)}
                   placeholder="Describe exactly what is wrong with the document..."
                   className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                 />
               </div>

               <div className="pt-4 border-t border-slate-100 flex justify-end">
                 <button type="submit" disabled={isSubmitting || !selectedRecordId} className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2 disabled:opacity-50">
                   <Flag className="w-5 h-5" /> Submit Flag
                 </button>
               </div>
             </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DoctorFlags;
