import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { canonicalisePrescription, hasSigningKey, signPayload } from '../lib/crypto';
import { FileSignature, Plus, Trash2, ShieldCheck, AlertCircle, Fingerprint, Search } from 'lucide-react';

const DoctorPrescriptions = () => {
  const { token } = useAuth();

  // Patient Context
  const [patientId, setPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientInfo, setPatientInfo] = useState<any>(null);

  // Form State
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medications, setMedications] = useState([{ name: '', strength: '', frequency: '', duration: '', instructions: '' }]);

  // Signing state
  const [isSigning, setIsSigning] = useState(false);
  const [signingStep, setSigningStep] = useState<'IDLE' | 'GENERATING' | 'SIGNING' | 'DONE'>('IDLE');
  const [doctorId, setDoctorId] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [verifyUrl, setVerifyUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // The prescriber id is part of the signed payload, so it has to match what
    // the server will verify against.
    void (async () => {
      try {
        const summary = await api.get<any>('/api/v1/doctor/dashboard-summary');
        setDoctorId(summary.doctor?.id ?? '');
      } catch (e) {
        console.error(e);
      }
      setHasKey(await hasSigningKey());
    })();
  }, [token]);

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
        setPatientId(data.patient.id);
      } else {
        alert("Patient not found or no access.");
      }
    } catch (err) { console.error(err); }
  };

  const handleAddMedication = () => {
    setMedications([...medications, { name: '', strength: '', frequency: '', duration: '', instructions: '' }]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleChangeMedication = (index: number, field: string, value: string) => {
    const newMeds = [...medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setMedications(newMeds);
  };

  const handleSignAndIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || medications.length === 0) return;

    setIsSigning(true);
    setError('');
    setSigningStep('GENERATING');

    try {
      if (!doctorId) {
        throw new Error('Could not determine your prescriber id. Reload the page and try again.');
      }
      if (!(await hasSigningKey())) {
        throw new Error(
          'No signing key is present on this device. Prescriptions can only be signed on the device where you registered.'
        );
      }

      // Field names are normalised to the signed schema. The same shape is
      // reproduced byte-for-byte on the server before verification.
      const signedMedications = medications
        .filter(m => m.name.trim() !== '')
        .map(m => ({
          name: m.name.trim(),
          dosage: m.strength.trim(),
          frequency: m.frequency.trim(),
          ...(m.duration ? { duration_days: Number(m.duration) } : {}),
          ...(m.instructions ? { instructions: m.instructions.trim() } : {})
        }));

      if (signedMedications.length === 0) {
        throw new Error('Add at least one medication before signing.');
      }

      const issuedAt = new Date().toISOString();

      setSigningStep('SIGNING');

      const canonical = canonicalisePrescription({
        patient_id: patientId,
        doctor_id: doctorId,
        medications: signedMedications,
        clinical_notes: clinicalNotes,
        issued_at: issuedAt
      });

      // Signed with the non-extractable private key held in this browser.
      const signature = await signPayload(canonical);

      const res = await api.raw('/api/v1/doctor/prescriptions/sign-and-issue', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId,
          clinical_notes: clinicalNotes,
          medications: signedMedications,
          digital_signature: signature,
          issued_at: issuedAt,
          ...(followUpDate ? { valid_until: followUpDate } : {})
        })
      });

      const data = await res.json();

      setVerifyUrl(data.verify_url ?? '');
      setSigningStep('DONE');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Signing failed');
      setSigningStep('IDLE');
      setIsSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans relative">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <FileSignature className="w-8 h-8 text-indigo-600" />
              Digital Prescription Studio
            </h1>
            <p className="text-slate-500 mt-2">Signed in this browser with an ECDSA P-256 key. The server verifies every signature before storing.</p>
          </div>
        </div>

        {hasKey === false && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">No signing key on this device</p>
              <p>
                Your private key is held only on the device where you registered. Sign prescriptions there, or
                register a new key with your administrator.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-2xl p-4">{error}</div>
        )}

        {/* Patient Selection Header */}
        {!patientInfo ? (
          <form onSubmit={handleSearchPatient} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Look up Patient to start drafting</label>
              <input
                value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                placeholder="Enter Vault Number or Phone"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
              <Search className="w-5 h-5" /> Start
            </button>
          </form>
        ) : (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
            <div>
              <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-1">Prescribing for</p>
              <h2 className="text-2xl font-bold text-slate-800">{patientInfo.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{patientInfo.age} Yrs • {patientInfo.gender} • Vault ID: {patientInfo.vault_number}</p>
            </div>
            <div className="text-right">
              <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl flex items-center gap-2 border border-red-100">
                <AlertCircle className="w-4 h-4" /> <span className="text-sm font-bold">Allergy: Penicillin</span>
              </div>
            </div>
          </div>
        )}

        {/* Editor Form */}
        {patientInfo && (
          <form onSubmit={handleSignAndIssue} className="space-y-6">

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">Medications</h3>
                <button type="button" onClick={handleAddMedication} className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                  <Plus className="w-4 h-4" /> Add Row
                </button>
              </div>
              <div className="p-6 space-y-4">
                {medications.map((med, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                    <button type="button" onClick={() => handleRemoveMedication(index)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <div className="flex-1 w-full md:w-auto">
                      <input placeholder="Drug Name" required value={med.name} onChange={e => handleChangeMedication(index, 'name', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" />
                    </div>
                    <div className="w-full md:w-32">
                      <input placeholder="Strength (e.g. 500mg)" value={med.strength} onChange={e => handleChangeMedication(index, 'strength', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" />
                    </div>
                    <div className="w-full md:w-32">
                      <input placeholder="Freq (1-0-1)" required value={med.frequency} onChange={e => handleChangeMedication(index, 'frequency', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm font-mono" />
                    </div>
                    <div className="w-full md:w-32">
                      <input placeholder="Duration (5 days)" required value={med.duration} onChange={e => handleChangeMedication(index, 'duration', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" />
                    </div>
                    <div className="flex-1 w-full md:w-auto">
                      <input placeholder="Instructions" value={med.instructions} onChange={e => handleChangeMedication(index, 'instructions', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <label className="block text-sm font-bold text-slate-800 mb-2">Clinical Notes & Precautions</label>
                <textarea
                  rows={4} value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)}
                  placeholder="Dietary instructions, tests to perform, etc."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <label className="block text-sm font-bold text-slate-800 mb-2">Follow-up Appointment</label>
                <input
                  type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-3">Sets an automated reminder for the patient.</p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" disabled={isSigning} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-3 transition-colors text-lg disabled:opacity-50">
                <Fingerprint className="w-6 h-6" /> Digitally Sign & Issue
              </button>
            </div>

          </form>
        )}
      </div>

      {/* Signing Dialog Overlay */}
      {isSigning && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95">
            {signingStep === 'DONE' ? (
              <>
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 mb-4">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Prescription Issued</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Signature verified by the server and the signed PDF stored, encrypted, in the patient vault.
                </p>
                {verifyUrl && (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Public verification link
                    </p>
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-indigo-600 break-all hover:underline"
                    >
                      {verifyUrl}
                    </a>
                  </div>
                )}
                <button
                  onClick={() => {
                    setIsSigning(false);
                    setSigningStep('IDLE');
                    setPatientInfo(null);
                    setVerifyUrl('');
                    setMedications([{ name: '', strength: '', frequency: '', duration: '', instructions: '' }]);
                  }}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold"
                >
                  Start New Prescription
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4 animate-pulse">
                  <Fingerprint className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {signingStep === 'GENERATING' ? 'Preparing payload' : 'Signing with your private key'}
                </h3>
                <p className="text-sm text-slate-500">
                  The private key never leaves this device; only the signature is transmitted.
                </p>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default DoctorPrescriptions;
