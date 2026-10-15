import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  XCircle,
  Plus,
  History,
  CheckCircle2,
  AlertCircle,
  Building,
  Stethoscope,
  Clock
} from 'lucide-react';

/** Mirrors record_category_enum in the database schema. */
const RECORD_CATEGORIES = [
  'PRESCRIPTION',
  'BLOOD_REPORT',
  'X_RAY',
  'MRI',
  'CT_SCAN',
  'VACCINATION_RECORD',
  'ALLERGY_RECORD',
  'SURGERY_HISTORY',
  'DISCHARGE_SUMMARY',
  'CHRONIC_DISEASE_HISTORY',
  'PSYCHIATRIC_REPORT',
  'HIV_REPORT',
] as const;

const SENSITIVE_CATEGORIES = new Set(['PSYCHIATRIC_REPORT', 'HIV_REPORT']);

type CategoryState = 'ALLOWED' | 'BLOCKED' | 'OMITTED';

interface VerifiedDoctor {
  doctor_id: string;
  first_name: string;
  last_name: string;
  specialization: string;
  qualification: string;
  mrn: string;
  hospital_name: string;
}

const labelFor = (category: string) =>
  category.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');

const getDefaultCategoryStates = (): Record<string, CategoryState> =>
  Object.fromEntries(
    RECORD_CATEGORIES.map(category => [
      category,
      SENSITIVE_CATEGORIES.has(category) ? 'BLOCKED' : 'ALLOWED',
    ])
  );

const PatientConsent = () => {
  const { token } = useAuth();
  const [activeConsents, setActiveConsents] = useState<any[]>([]);
  const [consentHistory, setConsentHistory] = useState<any[]>([]);
  const [verifiedDoctors, setVerifiedDoctors] = useState<VerifiedDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const [grantingLoading, setGrantingLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // New Consent Form State
  const [doctorId, setDoctorId] = useState('');
  const [customDoctorId, setCustomDoctorId] = useState('');
  const [useCustomId, setUseCustomId] = useState(false);
  const [validDays, setValidDays] = useState(7);
  const [accessLevel, setAccessLevel] = useState('READ_ONLY');
  const [grantError, setGrantError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Per-category decision: Standard records default to ALLOWED, Sensitive to BLOCKED
  const [categoryStates, setCategoryStates] = useState<Record<string, CategoryState>>(getDefaultCategoryStates);

  const allowedCategories = RECORD_CATEGORIES.filter(c => categoryStates[c] === 'ALLOWED');
  const blockedCategories = RECORD_CATEGORIES.filter(c => categoryStates[c] === 'BLOCKED');

  const setCategoryState = (category: string, state: CategoryState) =>
    setCategoryStates(previous => ({ ...previous, [category]: state }));

  useEffect(() => {
    void fetchActiveConsents();
    void fetchConsentHistory();
    void fetchVerifiedDoctors();
  }, [token]);

  const fetchActiveConsents = async () => {
    try {
      const data = await api.get<any[]>('/api/v1/consent/active');
      setActiveConsents(data || []);
    } catch (e) {
      console.error('Error fetching active consents:', e);
    }
  };

  const fetchConsentHistory = async () => {
    try {
      const data = await api.get<any[]>('/api/v1/consent/history');
      setConsentHistory(data || []);
    } catch (e) {
      console.error('Error fetching consent history:', e);
    }
  };

  const fetchVerifiedDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const data = await api.get<VerifiedDoctor[]>('/api/v1/patient/doctors');
      setVerifiedDoctors(data || []);
      if (data && data.length > 0 && !doctorId) {
        setDoctorId(data[0].doctor_id);
      }
    } catch (e) {
      console.error('Error fetching verified doctors:', e);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm("Are you sure you want to instantly revoke access? This cannot be undone.")) return;
    setRevokingId(id);
    try {
      const res = await api.raw(`/api/v1/consent/${id}/revoke`, { method: 'POST' });
      if (res.ok) {
        setFeedbackMessage('Consent revoked with zero latency.');
        setTimeout(() => setFeedbackMessage(''), 3500);
      }
      await fetchActiveConsents();
      await fetchConsentHistory();
    } catch (e) {
      console.error(e);
    }
    setRevokingId(null);
  };

  const applyPreset = (preset: 'SAFE' | 'ALL' | 'CLEAR') => {
    if (preset === 'SAFE') {
      setCategoryStates(getDefaultCategoryStates());
    } else if (preset === 'ALL') {
      setCategoryStates(Object.fromEntries(RECORD_CATEGORIES.map(c => [c, 'ALLOWED'])));
    } else {
      setCategoryStates(Object.fromEntries(RECORD_CATEGORIES.map(c => [c, 'OMITTED'])));
    }
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError('');
    const targetDoctorId = useCustomId ? customDoctorId.trim() : doctorId;

    if (!targetDoctorId) {
      setGrantError('Please select or specify a verified doctor.');
      return;
    }

    if (allowedCategories.length === 0) {
      setGrantError('Please allow at least one medical record category.');
      return;
    }

    setGrantingLoading(true);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);

      const res = await api.raw('/api/v1/consent/grant', {
        method: 'POST',
        body: JSON.stringify({
          doctor_id: targetDoctorId,
          allowed_categories: allowedCategories,
          blocked_categories: blockedCategories,
          valid_until: validUntil.toISOString(),
          access_level: accessLevel
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to grant consent. Please verify the doctor ID.');
      }

      setIsGranting(false);
      setFeedbackMessage('Cryptographic consent successfully granted to doctor.');
      setTimeout(() => setFeedbackMessage(''), 4000);
      void fetchActiveConsents();
      void fetchConsentHistory();
    } catch (e: any) {
      console.error(e);
      setGrantError(e.message || 'Failed to grant consent.');
    } finally {
      setGrantingLoading(false);
    }
  };

  const selectedDoctorInfo = verifiedDoctors.find(d => d.doctor_id === doctorId);

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
            <p className="text-slate-500 mt-2">
              Instantly grant, customize, block, or revoke doctor access with verifiable audit trails.
            </p>
          </div>
          <button
            onClick={() => {
              setGrantError('');
              setIsGranting(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold shadow-md shadow-emerald-200 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Grant Doctor Access
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Active Consents */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-500" /> Active Doctor Consents
            </h2>
            <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
              {activeConsents.length} Active Authorizations
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeConsents.map(consent => (
              <div key={consent.consent_id} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400"></div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        Dr. {consent.doctors?.first_name ? `${consent.doctors.first_name} ` : ''}{consent.doctors?.last_name || 'Physician'}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                        {consent.doctors?.specialization || 'Clinical Specialist'}
                      </p>
                      {consent.doctors?.hospitals?.hospital_name && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3" />
                          {consent.doctors.hospitals.hospital_name}
                        </p>
                      )}
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                      {consent.access_level.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Allowed Categories ({consent.allowed_categories.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {consent.allowed_categories.map((cat: string) => (
                          <span key={cat} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md">
                            {cat.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    {consent.blocked_categories && consent.blocked_categories.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-1">
                          Explicitly Blocked ({consent.blocked_categories.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {consent.blocked_categories.map((cat: string) => (
                            <span key={cat} className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[11px] font-medium rounded-md border border-rose-100">
                              {cat.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Valid Until
                      </span>
                      <span className="font-bold text-slate-800">
                        {new Date(consent.valid_until).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRevoke(consent.consent_id)}
                  disabled={revokingId === consent.consent_id}
                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-rose-200 disabled:opacity-50 mt-2"
                >
                  <XCircle className="w-4 h-4" />
                  {revokingId === consent.consent_id ? 'Revoking Access...' : 'Instant Revoke Access'}
                </button>
              </div>
            ))}

            {activeConsents.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 border-dashed">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-700 text-base">You have no active doctor consents.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click "Grant Doctor Access" to safely share records with verified medical providers.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Audit History */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <History className="w-6 h-6 text-slate-500" /> Consent Audit Log
            </h2>
            <span className="text-xs text-slate-500 font-mono">Immutable cryptographic ledger</span>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Doctor / Hospital</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Validity / Revocation</th>
                    <th className="p-4 font-semibold">Permissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consentHistory.map(history => (
                    <tr key={history.consent_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(history.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm font-semibold text-slate-900">
                        Dr. {history.doctors?.first_name ? `${history.doctors.first_name} ` : ''}{history.doctors?.last_name || 'Physician'}
                        {history.doctors?.hospitals?.hospital_name && (
                          <span className="block text-xs font-normal text-slate-500">
                            {history.doctors.hospitals.hospital_name}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                          history.consent_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                          history.consent_status === 'REVOKED' ? 'bg-rose-100 text-rose-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {history.consent_status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                        {history.revoked_at ? (
                          <span className="text-rose-600 font-medium">Revoked {new Date(history.revoked_at).toLocaleDateString()}</span>
                        ) : (
                          <span>Valid to {new Date(history.valid_until).toLocaleDateString()}</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        <span className="font-semibold text-emerald-700">{history.allowed_categories?.length || 0} allowed</span>
                        {' '}&middot;{' '}
                        <span className="font-semibold text-rose-600">{history.blocked_categories?.length || 0} blocked</span>
                      </td>
                    </tr>
                  ))}
                  {consentHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                        No previous consent audit entries found.
                      </td>
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
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl animate-in slide-in-from-right overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  Grant Doctor Access
                </h3>
                <button
                  type="button"
                  onClick={() => setIsGranting(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form id="grant-consent-form" onSubmit={handleGrant} className="p-6 space-y-6">
                {grantError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3.5 rounded-xl font-semibold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <span>{grantError}</span>
                  </div>
                )}

                {/* Doctor Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Target Doctor *
                    </label>
                    <button
                      type="button"
                      onClick={() => setUseCustomId(!useCustomId)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      {useCustomId ? 'Choose Verified Doctor' : 'Enter Custom UUID'}
                    </button>
                  </div>

                  {!useCustomId ? (
                    <div>
                      <select
                        required
                        value={doctorId}
                        onChange={e => setDoctorId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none text-sm font-semibold text-slate-800 bg-white"
                      >
                        {verifiedDoctors.map(doc => (
                          <option key={doc.doctor_id} value={doc.doctor_id}>
                            Dr. {doc.first_name} {doc.last_name} — {doc.specialization} ({doc.hospital_name})
                          </option>
                        ))}
                        {loadingDoctors && (
                          <option value="">Loading accredited doctors...</option>
                        )}
                        {!loadingDoctors && verifiedDoctors.length === 0 && (
                          <option value="">No verified doctors currently loaded</option>
                        )}
                      </select>

                      {selectedDoctorInfo && (
                        <div className="mt-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-xs text-slate-700 space-y-1">
                          <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Aadhaar &amp; NMC Verified Practitioner
                          </p>
                          <p className="text-slate-600">
                            MRN: <span className="font-mono font-semibold text-slate-800">{selectedDoctorInfo.mrn}</span> &middot; {selectedDoctorInfo.qualification}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        required
                        type="text"
                        value={customDoctorId}
                        onChange={e => setCustomDoctorId(e.target.value)}
                        placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Enter valid Doctor UUID provided by your clinic.</p>
                    </div>
                  )}
                </div>

                {/* Validity Period & Access Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Validity Period
                    </label>
                    <select
                      value={validDays}
                      onChange={e => setValidDays(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none text-xs font-semibold bg-white"
                    >
                      <option value={1}>24 Hours (ER)</option>
                      <option value={7}>7 Days (Standard)</option>
                      <option value={30}>30 Days (Treatment)</option>
                      <option value={90}>90 Days (Chronic)</option>
                      <option value={365}>1 Year (Family Doctor)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Access Level
                    </label>
                    <select
                      value={accessLevel}
                      onChange={e => setAccessLevel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none text-xs font-semibold bg-white"
                    >
                      <option value="READ_ONLY">Read Only</option>
                      <option value="DOWNLOAD">Read &amp; Download</option>
                    </select>
                  </div>
                </div>

                {/* Granular Record Categories */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Record Categories
                    </label>
                    <div className="flex gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => applyPreset('SAFE')}
                        className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded font-bold"
                      >
                        Safe Default
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('ALL')}
                        className="text-slate-600 hover:text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-bold"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('CLEAR')}
                        className="text-slate-600 hover:text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-bold"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 mb-3">
                    <strong>Allow</strong> shares the category. <strong>Block</strong> denies it explicitly.
                  </p>

                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {RECORD_CATEGORIES.map(category => (
                      <div
                        key={category}
                        className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 text-xs"
                      >
                        <span className="text-slate-700 font-medium flex items-center gap-1.5">
                          {labelFor(category)}
                          {SENSITIVE_CATEGORIES.has(category) && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                              Sensitive
                            </span>
                          )}
                        </span>

                        <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                          {(['ALLOWED', 'OMITTED', 'BLOCKED'] as CategoryState[]).map(state => {
                            const selected = categoryStates[category] === state;
                            const tone =
                              state === 'ALLOWED'
                                ? 'bg-emerald-600 text-white font-bold'
                                : state === 'BLOCKED'
                                  ? 'bg-rose-600 text-white font-bold'
                                  : 'bg-slate-700 text-white font-bold';
                            return (
                              <button
                                key={state}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setCategoryState(category, state)}
                                className={`px-2 py-0.5 text-[11px] transition-colors ${
                                  selected ? tone : 'bg-white text-slate-500 hover:bg-slate-100 font-semibold'
                                }`}
                              >
                                {state === 'ALLOWED' ? 'Allow' : state === 'BLOCKED' ? 'Block' : 'Omit'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 mt-3 font-medium">
                    <span className="text-emerald-700 font-bold">{allowedCategories.length}</span> allowed &middot;{' '}
                    <span className="text-rose-600 font-bold">{blockedCategories.length}</span> explicitly blocked
                  </p>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button
                type="submit"
                form="grant-consent-form"
                disabled={grantingLoading || allowedCategories.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-bold shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 text-sm"
              >
                {grantingLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Authorizing Consent...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Grant Secure Access ({allowedCategories.length} Categories)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PatientConsent;
