import React, { useState } from 'react';
import { api } from '../lib/api';
import { Calendar, Search, FileText, CheckCircle2 } from 'lucide-react';

const DoctorConsultations = () => {

  const [patientSearch, setPatientSearch] = useState('');
  const [patientInfo, setPatientInfo] = useState<any>(null);

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosisSummary, setDiagnosisSummary] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSearchPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.raw('/api/v1/doctor/check-consent', {
        method: 'POST',
        body: JSON.stringify({ identifier: patientSearch })
      });
      if (res.ok) {
        const data = await res.json();
        setPatientInfo(data.patient);
      } else {
        alert("Patient not found or no access.");
      }
    } catch (err) { console.error(err); }
  };

  const handleLogEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientInfo) return;

    setSaving(true);
    try {
      const res = await api.raw('/api/v1/doctor/consultations', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientInfo.id,
          chief_complaint: chiefComplaint,
          diagnosis_summary: diagnosisSummary,
          follow_up_date: followUpDate || null
        })
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setChiefComplaint('');
          setDiagnosisSummary('');
          setFollowUpDate('');
          setPatientInfo(null);
        }, 3000);
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              Consultation Logger
            </h1>
            <p className="text-slate-500 mt-2">Record presenting symptoms, findings, and provisional diagnoses.</p>
          </div>
        </div>

        {saved && (
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl font-bold flex items-center gap-2 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" /> Clinical Encounter logged successfully.
          </div>
        )}

        {!patientInfo ? (
          <form onSubmit={handleSearchPatient} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-end gap-4 max-w-xl">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Look up Patient Queue</label>
              <input
                value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                placeholder="Enter Vault Number or Phone"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
              <Search className="w-5 h-5" /> Start
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogEncounter} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Encounter With</p>
                <h3 className="text-xl font-bold text-slate-800">{patientInfo.name} <span className="text-sm font-medium text-slate-500 ml-2">({patientInfo.vault_number})</span></h3>
              </div>
              <button type="button" onClick={() => setPatientInfo(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Change Patient</button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Chief Complaint(s)</label>
                <textarea
                  required rows={3} value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Fever for 3 days, body ache, mild cough."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Provisional Diagnosis / Findings</label>
                <textarea
                  rows={4} value={diagnosisSummary} onChange={e => setDiagnosisSummary(e.target.value)}
                  placeholder="e.g. Suspected Viral URI."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Follow-up Date (Optional)</label>
                <input
                  type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full md:w-1/3 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2">
                <FileText className="w-5 h-5" /> {saving ? 'Saving...' : 'Save Encounter Log'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default DoctorConsultations;
