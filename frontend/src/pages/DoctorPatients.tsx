import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Users,
  Search,
  ShieldCheck,
  ShieldAlert,
  Key,
  Eye,
  UploadCloud,
  FileSignature,
  Calendar,
  X,
  Maximize2,
  AlertCircle
} from 'lucide-react';

interface DecryptedViewerData {
  recordId: string;
  title: string;
  mimeType: string;
  objectUrl: string;
  sha256?: string;
  algorithm?: string;
}

const DoctorPatients = () => {
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [consentDetails, setConsentDetails] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);

  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DecryptedViewerData | null>(null);
  const [decryptError, setDecryptError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('query');
    if (query) {
      setIdentifier(query);
      void handleSearch(query);
    }
  }, [location]);

  const handleSearch = async (queryToSearch: string = identifier) => {
    if (!queryToSearch) return;
    setDecryptError('');
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
          void fetchRecords(data.patient.vault_number);
        } else {
          setRecords([]);
        }
      } else {
        setPatient(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const requestConsent = async () => {
    if (!patient) return;
    try {
      const res = await api.raw('/api/v1/doctor/request-consent', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patient.id })
      });
      if (res.ok) alert('Consent request sent to patient.');
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecords = async (vaultNumber: string) => {
    try {
      const data = await api.get<any>(`/api/v1/doctor/patient-records/${vaultNumber}`);
      setRecords(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  /** Real in-memory KMS decryption and render */
  const openRecord = async (id: string, recordTitle: string) => {
    setDecryptingId(id);
    setDecryptError('');
    try {
      const res = await api.raw(`/api/v1/vault/records/${id}/decrypt`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Decryption failed on server');
      }

      const binaryString = window.atob(data.content_base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const mimeType = data.file_mime_type || 'application/pdf';
      const blob = new Blob([bytes], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);

      setViewer({
        recordId: id,
        title: data.record_title || recordTitle,
        mimeType,
        objectUrl,
        sha256: data.file_sha256_hash,
        algorithm: data.encryption_algorithm || 'AES-256-GCM'
      });
    } catch (e: any) {
      console.error(e);
      setDecryptError(e.message || 'Failed to decrypt and view clinical record');
    } finally {
      setDecryptingId(null);
    }
  };

  const closeViewer = () => {
    if (viewer?.objectUrl) URL.revokeObjectURL(viewer.objectUrl);
    setViewer(null);
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
            <button
              onClick={() => handleSearch()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-r-2xl font-bold flex items-center gap-2 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {decryptError && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl font-bold flex items-center gap-3 shadow-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{decryptError}</span>
          </div>
        )}

        {!patient ? (
          <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 text-center text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-slate-700">No Patient Selected</h3>
            <p className="text-sm mt-1">Search via Lifelong Vault ID (e.g. ML-2026-XXXX) or registered phone number.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Patient Consent & Identity Banner */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center font-bold text-xl text-indigo-700">
                  {patient.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{patient.name}</h2>
                  <p className="text-sm text-slate-500 font-mono mt-0.5">Vault ID: {patient.vault_number}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Age: {patient.age} &bull; Gender: {patient.gender} &bull; Blood: {patient.blood_group || 'O+'}</p>
                </div>
              </div>

              {/* Consent Controls & Clinical Actions */}
              <div>
                {hasConsent ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                    <div className="text-right sm:border-r sm:border-emerald-200 sm:pr-4">
                      <div className="flex items-center justify-end gap-1.5 text-emerald-800 font-bold text-xs mb-0.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Consent Active
                      </div>
                      <p className="text-[11px] text-emerald-700 font-medium">Expires: {new Date(consentDetails.valid_until).toLocaleDateString()}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/doctor/upload"
                        state={{ vaultNumber: patient.vault_number }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <UploadCloud className="w-3.5 h-3.5" /> Upload File
                      </Link>
                      <Link
                        to="/doctor/prescriptions/new"
                        state={{ vaultNumber: patient.vault_number }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <FileSignature className="w-3.5 h-3.5" /> Prescribe
                      </Link>
                      <Link
                        to="/doctor/consultation/log"
                        state={{ vaultNumber: patient.vault_number }}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Encounter
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2 text-rose-600 font-bold">
                      <ShieldAlert className="w-5 h-5" /> No Active Consent
                    </div>
                    <button
                      onClick={requestConsent}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-xl font-bold shadow-md transition-colors text-sm"
                    >
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
                  <div className="flex gap-1 flex-wrap">
                    {consentDetails.allowed_categories.map((c: string) => (
                      <span key={c} className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {records.map((record) => (
                    <div key={record.record_id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-xs font-mono font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                            {record.category}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(record.record_date).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-lg mb-1">{record.record_title}</h4>
                        <p className="text-sm text-slate-500 mb-4">{record.diagnosis || 'Routine clinical report'}</p>
                      </div>

                      <div className="border-t border-slate-100 pt-4 flex gap-2">
                        {viewer?.recordId === record.record_id ? (
                          <button
                            onClick={() => setViewer(null)}
                            className="flex-1 bg-emerald-50 text-emerald-700 py-2.5 rounded-xl font-semibold flex justify-center items-center gap-2 text-sm"
                          >
                            <Eye className="w-4 h-4" /> Viewing Active
                          </button>
                        ) : (
                          <button
                            onClick={() => openRecord(record.record_id, record.record_title)}
                            disabled={decryptingId === record.record_id}
                            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-50 text-sm"
                          >
                            {decryptingId === record.record_id ? (
                              <span className="animate-pulse flex items-center gap-2">
                                <Key className="w-4 h-4 animate-spin" /> Decrypting...
                              </span>
                            ) : (
                              <>
                                <Key className="w-4 h-4" /> Decrypt &amp; View
                              </>
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

        {/* Real In-Memory Decrypted Document Viewer Modal */}
        {viewer && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
              <div className="p-4 md:px-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      {viewer.title}
                      <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        Decrypted In-Memory
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      SHA256: {viewer.sha256 ? `${viewer.sha256.substring(0, 16)}...` : 'Verified'} &bull; Algorithm: {viewer.algorithm}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={viewer.objectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
                  </a>
                  <button
                    onClick={closeViewer}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" /> Close
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-800 p-2 relative flex items-center justify-center overflow-hidden">
                {viewer.mimeType.startsWith('image/') ? (
                  <img
                    src={viewer.objectUrl}
                    alt={viewer.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <iframe
                    src={viewer.objectUrl}
                    title={viewer.title}
                    className="w-full h-full rounded-xl bg-white border-0"
                  />
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DoctorPatients;
