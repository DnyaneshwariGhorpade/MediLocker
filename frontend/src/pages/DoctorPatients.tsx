import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { Users, Search, ShieldCheck, ShieldAlert, Key, Eye, CheckCircle2 } from 'lucide-react';

const DoctorPatients = () => {
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [consentDetails, setConsentDetails] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);

  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [decryptedViewId, setDecryptedViewId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('query');
    if (query) {
      setIdentifier(query);
      handleSearch(query);
    }
  }, [location]);

  const handleSearch = async (queryToSearch: string = identifier) => {
    if (!queryToSearch) return;
    try {
      const res = await api.raw('/api/v1/doctor/check-consent', {
        method: 'POST',
        body: JSON.stringify({ identifier: queryToSearch })
      });
      if (res.ok) {
        const data = await res.json();
        setPatient(data.patient);
        setHasConsent(data.hasConsent);
        setConsentDetails(data.consentDetails);

        if (data.hasConsent) {
          fetchRecords(data.patient.vault_number);
        } else {
          setRecords([]);
        }
      } else {
        setPatient(null);
      }
    } catch (e) { console.error(e); }
  };

  const requestConsent = async () => {
    if (!patient) return;
    try {
      const res = await api.raw('/api/v1/doctor/request-consent', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patient.id })
      });
      if (res.ok) alert("Consent request sent to patient.");
    } catch (e) { console.error(e); }
  };

  const fetchRecords = async (vaultNumber: string) => {
    try {
      setRecords(await api.get<any>(`/api/v1/doctor/patient-records/${vaultNumber}`));
    } catch (e) { console.error(e); }
  };

  const simulateDecryption = async (id: string) => {
    setDecryptingId(id);
    try {
      // Simulate KMS unwrapping and local AES decryption
      setTimeout(() => {
        setDecryptingId(null);
        setDecryptedViewId(id);
      }, 2000);
    } catch (e) { setDecryptingId(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-600" />
              Patient Record Lookup
            </h1>
            <p className="text-slate-500 mt-2">Zero-Trust consent-gated access to medical vaults.</p>
          </div>

          <div className="relative w-full md:w-96 flex">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Vault ID or Phone Number"
              className="w-full pl-4 pr-4 py-3 rounded-l-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={() => handleSearch()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-r-2xl font-bold flex items-center gap-2 transition-colors">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!patient ? (
          <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 text-center text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-semibold text-lg">Search for a patient to view their records.</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* Patient Header & Consent Banner */}
            <div className={`p-8 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${hasConsent ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{patient.name}</h2>
                <div className="flex gap-4 mt-2 text-sm font-medium">
                  <span className="text-slate-600">Vault: <span className="font-mono text-slate-800">{patient.vault_number}</span></span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">{patient.age} Yrs, {patient.gender}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {hasConsent ? (
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 text-emerald-700 font-bold mb-1">
                      <ShieldCheck className="w-5 h-5" /> Consent Active
                    </div>
                    <p className="text-xs text-emerald-600 font-medium">Expires: {new Date(consentDetails.valid_until).toLocaleString()}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2 text-red-600 font-bold">
                      <ShieldAlert className="w-5 h-5" /> No Active Consent
                    </div>
                    <button onClick={requestConsent} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold shadow-md transition-colors text-sm">
                      Request Access
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Consented Record Browser */}
            {hasConsent && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Authorized Records</h3>
                  <div className="flex gap-1">
                    {consentDetails.allowed_categories.map((c: string) => (
                      <span key={c} className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">{c.replace('_', ' ')}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {records.map(record => (
                    <div key={record.record_id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-lg">
                          {record.category.replace(/_/g, ' ')}
                        </span>
                        {record.blockchain_anchor && <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-label="Blockchain verified" />}
                      </div>

                      <h3 className="text-xl font-bold text-slate-800 mb-2">{record.record_title}</h3>
                      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{record.diagnosis || 'No clinical diagnosis specified.'}</p>

                      <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
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
                              <><Key className="w-4 h-4" /> View Securely</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {records.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-100">
                      No records found in the authorized categories.
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Decrypted Viewer Modal Overlay Simulation */}
        {decryptedViewId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <h3 className="font-bold text-slate-800">Secure In-Memory Decryption Viewer (Clinical Mode)</h3>
                </div>
                <button onClick={() => setDecryptedViewId(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-semibold text-slate-700 transition-colors">
                  Close Document
                </button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto flex items-center justify-center bg-slate-100">
                 {/* Dummy Document Representation */}
                 <div className="bg-white w-full max-w-2xl h-96 shadow-lg border border-slate-200 rounded flex items-center justify-center p-12 text-center text-slate-400 border-dashed">
                    <p>Decrypted medical record rendered securely from memory buffer.<br/>(Simulated PDF/DICOM Viewer)</p>
                 </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DoctorPatients;
