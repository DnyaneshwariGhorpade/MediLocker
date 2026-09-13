import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Shield, Search, Download, Eye, AlertTriangle, Key, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  'ALL', 'PRESCRIPTION', 'BLOOD_REPORT', 'X_RAY', 'MRI', 'CT_SCAN',
  'VACCINATION_RECORD', 'ALLERGY_RECORD', 'SURGERY_HISTORY', 'DISCHARGE_SUMMARY',
  'CHRONIC_DISEASE_HISTORY', 'SENSITIVE_REPORT'
];

const PatientVault = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Decryption State
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    recordId: string;
    title: string;
    mimeType: string;
    objectUrl: string;
    sha256: string;
    algorithm: string;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecords();
  }, [filter, searchQuery]);

  const fetchRecords = async () => {
    try {
      let url = '/api/v1/vault/records?';
      if (filter !== 'ALL') url += `category=${filter}&`;
      if (searchQuery) url += `search=${searchQuery}`;

      const res = await api.raw(url, {
        });
      if (res.ok) {
        setRecords(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  /** Fetches and renders the decrypted document. */
  const openRecord = async (id: string) => {
    setDecryptingId(id);
    setError('');

    try {
      const res = await api.raw(`/api/v1/vault/records/${id}/decrypt`, {
        method: 'POST',
        });
      const data = await res.json();

      // Rendered from an in-memory blob URL, revoked when the viewer closes so
      // the plaintext is not left addressable.
      const bytes = Uint8Array.from(atob(data.content_base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: data.file_mime_type });

      setViewer({
        recordId: id,
        title: data.record_title,
        mimeType: data.file_mime_type,
        objectUrl: URL.createObjectURL(blob),
        sha256: data.file_sha256_hash,
        algorithm: data.encryption_algorithm
      });
    } catch (e: any) {
      setError(e.message || 'Could not open this record');
    } finally {
      setDecryptingId(null);
    }
  };

  const closeViewer = () => {
    if (viewer?.objectUrl) URL.revokeObjectURL(viewer.objectUrl);
    setViewer(null);
  };

  const downloadRecord = async (id: string, title: string) => {
    setError('');
    try {
      const { blob, filename } = await api.download(`/api/v1/vault/records/${id}/download`);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename === 'download' ? `${title}.pdf` : filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Download failed');
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
            <p className="text-slate-500 mt-2">AES-256-GCM envelope encryption. Consent-gated access.</p>
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-2xl p-4">{error}</div>
        )}

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
                  {record.is_retrievable === false ? (
                    <div className="flex-1 bg-amber-50 text-amber-800 text-xs py-2 px-3 rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      No stored file. Predates encrypted storage.
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => openRecord(record.record_id)}
                        disabled={decryptingId === record.record_id}
                        className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-xl font-semibold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {decryptingId === record.record_id ? (
                          <span className="animate-pulse flex items-center gap-2"><Key className="w-4 h-4" /> Opening</span>
                        ) : (
                          <><Eye className="w-4 h-4" /> View</>
                        )}
                      </button>

                      <button
                        onClick={() => downloadRecord(record.record_id, record.record_title)}
                        aria-label="Download record"
                        className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </>
                  )}
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

        {/* Decrypted document viewer */}
        {viewer && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <Shield className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{viewer.title}</h3>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {viewer.algorithm} · {viewer.sha256.slice(0, 24)}
                    </p>
                  </div>
                </div>
                <button onClick={closeViewer} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-semibold text-slate-700 transition-colors shrink-0">
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-slate-100">
                {viewer.mimeType.startsWith('image/') ? (
                  <img src={viewer.objectUrl} alt={viewer.title} className="mx-auto max-h-[70vh] object-contain p-6" />
                ) : (
                  <iframe src={viewer.objectUrl} title={viewer.title} className="w-full h-[70vh] border-0" />
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PatientVault;
