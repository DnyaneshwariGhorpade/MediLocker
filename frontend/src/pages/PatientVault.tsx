import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Shield,
  Search,
  Download,
  Eye,
  AlertTriangle,
  Key,
  CheckCircle2,
  FileText,
  UploadCloud,
  Stethoscope,
  Calendar,
  Plus,
  XCircle,
  Tag,
  Clock
} from 'lucide-react';

const CATEGORIES = [
  'ALL',
  'BLOOD_REPORT',
  'PRESCRIPTION',
  'X_RAY',
  'MRI',
  'CT_SCAN',
  'VACCINATION_RECORD',
  'ALLERGY_RECORD',
  'SURGERY_HISTORY',
  'DISCHARGE_SUMMARY',
  'CHRONIC_DISEASE_HISTORY',
  'PSYCHIATRIC_REPORT',
  'HIV_REPORT'
];

type VaultViewTab = 'records' | 'consultations';

const PatientVault = () => {
  const [activeTab, setActiveTab] = useState<VaultViewTab>('records');
  const [records, setRecords] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Self-Upload Modal State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('BLOOD_REPORT');
  const [uploadDiagnosis, setUploadDiagnosis] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Patient Profile (for vault_number)
  const [profile, setProfile] = useState<any>(null);

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
    void fetchProfile();
  }, []);

  useEffect(() => {
    void fetchRecords();
  }, [filter, searchQuery]);

  useEffect(() => {
    void fetchConsultations();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await api.get<any>('/api/v1/patient/profile');
      setProfile(data);
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'ALL') params.append('category', filter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const qs = params.toString();
      const url = `/api/v1/vault/records${qs ? `?${qs}` : ''}`;

      const res = await api.raw(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data || []);
      }
    } catch (e) {
      console.error('Error fetching records:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsultations = async () => {
    try {
      const data = await api.get<any[]>('/api/v1/patient/consultations');
      setConsultations(data || []);
    } catch (e) {
      console.error('Error fetching consultations:', e);
    }
  };

  /** Self-upload document into patient's own vault */
  const handleSelfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.vault_number || !uploadTitle.trim() || !uploadFile) {
      setUploadError('Please select a file and provide a title.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('vault_number', profile.vault_number);
      form.append('record_title', uploadTitle.trim());
      form.append('category', uploadCategory);
      if (uploadDiagnosis.trim()) form.append('diagnosis', uploadDiagnosis.trim());
      if (uploadTags.trim()) form.append('tags', uploadTags.trim());

      const res = await api.raw('/api/v1/vault/upload', {
        method: 'POST',
        body: form
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to upload document to vault.');
      }

      setUploadSuccess('Document successfully encrypted and stored in your vault.');
      setUploadTitle('');
      setUploadDiagnosis('');
      setUploadTags('');
      setUploadFile(null);
      setTimeout(() => {
        setIsUploading(false);
        setUploadSuccess('');
      }, 1500);

      void fetchRecords();
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  /** Fetches and renders the decrypted document */
  const openRecord = async (id: string) => {
    setDecryptingId(id);
    setError('');

    try {
      const res = await api.raw(`/api/v1/vault/records/${id}/decrypt`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Decryption failed');
      }

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
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  Lifelong Medical Vault
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  AES-256-GCM envelope encrypted health repository &middot; Immutable clinical records.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setUploadError('');
                setUploadSuccess('');
                setIsUploading(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Upload Document
            </button>
          </div>
        </div>

        {/* View Switcher Tabs: Records vs Consultations */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('records')}
              className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'records'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Encrypted Records &amp; Scans ({records.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('consultations')}
              className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'consultations'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Doctor Encounters ({consultations.length})</span>
            </button>
          </div>

          {activeTab === 'records' && (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search records, diagnoses, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-medium shadow-sm bg-white"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-2xl p-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Encrypted Records & Files */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filter === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Record Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {records.map(record => (
                <div
                  key={record.record_id}
                  className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                      {record.category.replace(/_/g, ' ')}
                    </span>
                    {record.blockchain_anchor && (
                      <div className="group relative">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 cursor-pointer" />
                        <div className="absolute right-0 w-44 p-2 mt-2 bg-slate-800 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                          Cryptographic proof anchored
                        </div>
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-extrabold text-slate-900 mb-2 leading-tight">
                    {record.record_title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                    {record.diagnosis || 'No clinical diagnosis specified.'}
                  </p>

                  {record.tags && record.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {record.tags.map((tag: string, i: number) => (
                        <span key={i} className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span className="font-medium">
                        {record.doctors?.last_name ? `Dr. ${record.doctors.last_name}` : 'Self / Lab'}
                      </span>
                      <span>{new Date(record.record_date).toLocaleDateString()}</span>
                    </div>

                    <div className="flex gap-2">
                      {record.is_retrievable === false ? (
                        <div className="flex-1 bg-amber-50 text-amber-800 text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          File metadata only
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openRecord(record.record_id)}
                            disabled={decryptingId === record.record_id}
                            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {decryptingId === record.record_id ? (
                              <span className="animate-pulse flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5" /> Decrypting...
                              </span>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" /> Decrypt &amp; View
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => downloadRecord(record.record_id, record.record_title)}
                            aria-label="Download record"
                            className="p-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                            title="Download decrypted document"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {records.length === 0 && !loading && (
                <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 border-dashed p-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-slate-800 text-base">No medical records found in this view.</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    You can upload past lab reports or prescriptions directly, or have verified doctors upload directly into your vault ID <span className="font-mono font-bold text-slate-700">{profile?.vault_number}</span>.
                  </p>
                  <button
                    onClick={() => setIsUploading(true)}
                    className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-4 h-4" /> Upload Document Now
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Doctor Consultations & Clinical Encounters */}
        {activeTab === 'consultations' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {consultations.map(c => (
                <div
                  key={c.consultation_id}
                  className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-indigo-600" />
                        Dr. {c.doctors?.first_name ? `${c.doctors.first_name} ` : ''}{c.doctors?.last_name || 'Physician'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {c.doctors?.specialization || 'Clinical Doctor'} &middot; {c.hospitals?.hospital_name || 'Clinic'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(c.consultation_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs space-y-2">
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Chief Complaint
                      </span>
                      <p className="font-semibold text-slate-800">{c.chief_complaint || 'Routine checkup'}</p>
                    </div>
                    {c.diagnosis_summary && (
                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Provisional Diagnosis / Notes
                        </span>
                        <p className="text-slate-700">{c.diagnosis_summary}</p>
                      </div>
                    )}
                  </div>

                  {c.follow_up_date && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" /> Follow-Up Recommended
                      </span>
                      <span className="font-bold text-slate-800">
                        {new Date(c.follow_up_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {consultations.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 border-dashed p-8">
                  <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-slate-800 text-base">No clinical consultations recorded yet.</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    When you consult with verified MediLocker physicians, their diagnoses and clinical notes appear here securely.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Self-Upload Modal */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload to Personal Vault</h3>
                  <p className="text-xs text-slate-500">Vault: <span className="font-mono font-bold text-slate-700">{profile?.vault_number}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploading(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSelfUpload} className="p-6 space-y-4">
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              {uploadSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Document Title *
                </label>
                <input
                  required
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="e.g. Apollo Hospital Discharge Summary 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-xs text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-semibold text-slate-800 bg-white"
                >
                  {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Clinical Diagnosis / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={uploadDiagnosis}
                  onChange={e => setUploadDiagnosis(e.target.value)}
                  placeholder="e.g. Annual executive health checkup"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={e => setUploadTags(e.target.value)}
                  placeholder="e.g. blood, thyroid, routine"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-xs text-slate-800"
                />
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50">
                <input
                  type="file"
                  required
                  id="patient-file-upload"
                  onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.dcm,.txt"
                />
                <label htmlFor="patient-file-upload" className="cursor-pointer flex flex-col items-center">
                  <FileText className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-700">Choose medical file to encrypt</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">PDF, JPEG, PNG (Max 50MB)</p>
                  {uploadFile && (
                    <p className="mt-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                      {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploading(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
                >
                  {uploading ? 'Encrypting & Storing...' : 'Encrypt & Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decrypted Document Viewer Modal */}
      {viewer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <Shield className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 truncate text-sm">{viewer.title}</h3>
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    {viewer.algorithm} &middot; {viewer.sha256.slice(0, 24)}...
                  </p>
                </div>
              </div>
              <button
                onClick={closeViewer}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-xs text-slate-700 transition-colors shrink-0"
              >
                Close Viewer
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
  );
};

export default PatientVault;
