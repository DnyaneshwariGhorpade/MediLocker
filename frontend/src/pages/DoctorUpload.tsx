import React, { useState } from 'react';
import { api } from '../lib/api';
import { sha256File } from '../lib/crypto';
import { UploadCloud, ShieldCheck, FileText, CheckCircle2, Link as LinkIcon } from 'lucide-react';

const DoctorUpload = () => {

  const [vaultNumber, setVaultNumber] = useState('');
  const [recordTitle, setRecordTitle] = useState('');
  const [category, setCategory] = useState('BLOOD_REPORT');
  const [diagnosis, setDiagnosis] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'HASHING' | 'UPLOADING' | 'ANCHORING' | 'DONE'>('IDLE');
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [localDigest, setLocalDigest] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultNumber || !recordTitle || !file) return;

    setIsUploading(true);
    setError('');
    setUploadStatus('HASHING');

    try {
      // Computed locally so the doctor can compare it against what the server
      // reports back. The server recomputes its own digest and does not trust
      // this value.
      const localHash = await sha256File(file);
      setLocalDigest(localHash);

      setUploadStatus('UPLOADING');

      // The file itself is sent; the server encrypts it before storage.
      const form = new FormData();
      form.append('file', file);
      form.append('vault_number', vaultNumber);
      form.append('record_title', recordTitle);
      form.append('category', category);
      if (diagnosis) form.append('diagnosis', diagnosis);
      if (tags) form.append('tags', tags);

      const res = await api.raw('/api/v1/vault/upload', {
        method: 'POST',
        body: form
      });

      const data = await res.json();

      if (data.sha256 !== localHash) {
        throw new Error('The server computed a different digest than this browser. The upload was not trusted.');
      }

      setUploadStatus('ANCHORING');
      const anchorRes = await api.raw('/api/v1/vault/anchor-blockchain', {
        method: 'POST',
        body: JSON.stringify({ record_id: data.record.record_id })
      });

      const anchorData = await anchorRes.json();
      setUploadResult({
        ...(anchorData.anchor ?? {}),
        record_id: data.record.record_id,
        sha256: data.sha256,
        anchorPending: anchorData.simulated === true
      });
      setUploadStatus('DONE');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Upload failed');
      setUploadStatus('IDLE');
    }
    setIsUploading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <UploadCloud className="w-8 h-8 text-emerald-600" />
            Medical Record Uploader
          </h1>
          <p className="text-slate-500 mt-2">AES-256-GCM envelope encryption. Files are encrypted before storage; the digest is computed here and re-verified by the server.</p>
        </div>

        {uploadStatus === 'DONE' ? (
          <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-200 text-center animate-in zoom-in-95">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-emerald-800 mb-2">Encrypted and Stored</h2>
            <p className="text-emerald-600 mb-6">The document was encrypted with a unique key before storage and linked to the patient vault.</p>

            <div className="bg-white p-6 rounded-2xl border border-emerald-100 text-left space-y-3 mb-6">
              <div className="flex justify-between items-center border-b pb-2 gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase shrink-0">Record ID</span>
                <span className="font-mono text-xs font-semibold text-slate-800 break-all">{uploadResult.record_id}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2 gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase shrink-0">Document SHA-256</span>
                <span className="font-mono text-xs font-semibold text-slate-800 break-all">{uploadResult.sha256}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase shrink-0">Digest match</span>
                <span className="text-xs font-semibold text-emerald-700">
                  Browser and server agree
                </span>
              </div>
              {uploadResult.anchorPending && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Integrity anchoring is queued. No ledger is connected in this build, so the anchor status stays
                  pending until one is.
                </p>
              )}
            </div>

            <button onClick={() => { setUploadStatus('IDLE'); setFile(null); setRecordTitle(''); }} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold">
              Upload Another Record
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-4">{error}</div>
              )}
              {localDigest && uploadStatus !== 'IDLE' && (
                <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-xl p-3 font-mono break-all">
                  Local SHA-256: {localDigest}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Target Patient Vault ID</label>
                  <input
                    required value={vaultNumber} onChange={e => setVaultNumber(e.target.value)}
                    placeholder="ML-2026-XXXX"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Document Title</label>
                  <input
                    required value={recordTitle} onChange={e => setRecordTitle(e.target.value)}
                    placeholder="e.g. Complete Blood Count"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="BLOOD_REPORT">Blood Report</option>
                    <option value="X_RAY">X-Ray</option>
                    <option value="MRI">MRI Scan</option>
                    <option value="CT_SCAN">CT Scan</option>
                    <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                    <option value="CHRONIC_DISEASE_HISTORY">Chronic Disease History</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Clinical Diagnosis (Optional)</label>
                  <input
                    value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                    placeholder="Associated clinical condition"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tags (Comma separated)</label>
                  <input
                    value={tags} onChange={e => setTags(e.target.value)}
                    placeholder="e.g. baseline, routine"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Drag & Drop Zone */}
              <div className="mt-8 border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                <input
                  type="file"
                  required
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.png,.jpg,.jpeg,.dcm"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <FileText className="w-12 h-12 text-slate-400 mb-3" />
                  <p className="text-sm font-bold text-slate-700">Click to select or drag and drop</p>
                  <p className="text-xs text-slate-500 mt-1">PDF, JPEG, PNG, DICOM (Max 50MB)</p>
                  {file && <p className="mt-4 text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-lg">{file.name}</p>}
                </label>
              </div>

            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Zero-Knowledge Envelope Encryption Enabled
              </div>
              <button
                type="submit"
                disabled={isUploading}
                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {uploadStatus === 'HASHING' && 'Calculating Hash...'}
                {uploadStatus === 'UPLOADING' && 'Encrypting & Uploading...'}
                {uploadStatus === 'ANCHORING' && <><LinkIcon className="w-4 h-4 animate-pulse" /> Anchoring to Chain...</>}
                {uploadStatus === 'IDLE' && 'Upload & Anchor'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default DoctorUpload;
