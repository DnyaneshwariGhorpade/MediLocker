import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileCheck, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const VerifyDocument = () => {
  const [activeTab, setActiveTab] = useState<'PRESCRIPTION' | 'BLOCKCHAIN'>('PRESCRIPTION');

  // State for Prescription Tab
  const [prescriptionId, setPrescriptionId] = useState('');
  const [prescriptionStatus, setPrescriptionStatus] = useState<'IDLE' | 'VERIFYING' | 'VERIFIED' | 'FAILED'>('IDLE');
  const [prescriptionDetails, setPrescriptionDetails] = useState<any>(null);
  const [prescriptionMessage, setPrescriptionMessage] = useState('');

  // State for Blockchain Tab
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [hashStatus, setHashStatus] = useState<'IDLE' | 'HASHING' | 'VERIFYING' | 'VERIFIED' | 'FAILED'>('IDLE');
  const [hashDetails, setHashDetails] = useState<any>(null);

  /**
   * The QR code on a signed prescription links here with the id in the query
   * string, so scanning it verifies immediately.
   */
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('prescription');
    if (fromQuery) {
      setPrescriptionId(fromQuery);
      void verifyPrescription(fromQuery);
    }
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyPrescription = async (idOverride?: string) => {
    const id = (idOverride ?? prescriptionId).trim();
    if (!id) return;

    setPrescriptionStatus('VERIFYING');
    setPrescriptionMessage('');

    try {
      // The server re-canonicalises the stored prescription and checks its
      // signature against the issuing doctor's registered public key.
      const data = await api.post<any>('/api/v1/public/verify-prescription', { prescription_id: id });

      setPrescriptionMessage(data.message ?? '');
      setPrescriptionDetails(data.details ?? null);
      setPrescriptionStatus(data.verified ? 'VERIFIED' : 'FAILED');
    } catch {
      setPrescriptionMessage('Could not reach the verification service.');
      setPrescriptionStatus('FAILED');
    }
  };

  const handleReportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReportFile(e.target.files[0]);
      setHashStatus('IDLE');
      setHashDetails(null);
    }
  };

  const calculateSHA256 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const verifyBlockchainHash = async () => {
    if (!reportFile) return;
    setHashStatus('HASHING');

    try {
      // 1. Calculate Hash client-side
      const hash = await calculateSHA256(reportFile);
      setHashStatus('VERIFYING');

      // 2. Query Blockchain via backend
      const data = await api.post<any>('/api/v1/public/verify-hash', { sha256_hash: hash });

      if (data.verified) {
        setHashStatus('VERIFIED');
        setHashDetails({ ...data.details, hash });
      } else {
        setHashStatus('FAILED');
      }
    } catch (err) {
      setHashStatus('FAILED');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Shield className="text-blue-600 h-8 w-8" />
            <span className="text-2xl font-bold text-slate-900">MediLocker Verifier</span>
          </Link>
          <h2 className="text-3xl font-extrabold text-slate-900">Public Document Authenticity Verifier</h2>
          <p className="text-slate-500 mt-2">Verify cryptographic doctor signatures and blockchain tamper-proof hashes without logging in.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('PRESCRIPTION')}
              className={`flex-1 py-4 font-semibold text-sm flex justify-center items-center gap-2 transition-all ${activeTab === 'PRESCRIPTION' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FileCheck className="w-5 h-5" /> Verify Digital Prescription
            </button>
            <button
              onClick={() => setActiveTab('BLOCKCHAIN')}
              className={`flex-1 py-4 font-semibold text-sm flex justify-center items-center gap-2 transition-all ${activeTab === 'BLOCKCHAIN' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Search className="w-5 h-5" /> Verify Blockchain Hash
            </button>
          </div>

          <div className="p-8">

            {/* Tab 1: Prescription Verification */}
            {activeTab === 'PRESCRIPTION' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-blue-600" /> ECDSA P-256 Signature Verification</h3>
                  <p className="text-sm text-slate-600">Scan the QR code on the prescription, or type the prescription ID printed at the foot of the page. The stored prescription is re-canonicalised and its signature checked against the issuing doctor&apos;s registered public key.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Prescription ID</label>
                  <input
                    value={prescriptionId}
                    onChange={(e) => setPrescriptionId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 outline-none font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Printed beneath the QR code on every signed prescription.</p>
                </div>

                <div className="text-center">
                  <button
                    onClick={() => verifyPrescription()}
                    disabled={!prescriptionId.trim() || prescriptionStatus === 'VERIFYING'}
                    className="bg-slate-900 disabled:bg-slate-300 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition-all"
                  >
                    {prescriptionStatus === 'VERIFYING' ? 'Verifying signature...' : 'Verify Signature'}
                  </button>
                </div>

                {prescriptionStatus === 'VERIFIED' && prescriptionDetails && (
                  <div className="mt-8 border border-emerald-200 bg-emerald-50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 text-emerald-700 font-bold text-xl mb-6">
                      <CheckCircle2 className="w-8 h-8" />
                      SIGNATURE VALID
                    </div>
                    <p className="text-sm text-emerald-800 mb-5">{prescriptionMessage}</p>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                      <div><p className="text-slate-500 mb-1">Doctor Name</p><p className="font-semibold text-slate-900">{prescriptionDetails.doctor_name}</p></div>
                      <div><p className="text-slate-500 mb-1">Medical Registration Number</p><p className="font-semibold text-slate-900">{prescriptionDetails.mrn}</p></div>
                      <div><p className="text-slate-500 mb-1">Hospital Affiliation</p><p className="font-semibold text-slate-900">{prescriptionDetails.hospital}</p></div>
                      <div><p className="text-slate-500 mb-1">Date of Issue</p><p className="font-semibold text-slate-900">{new Date(prescriptionDetails.issued_at).toLocaleString()}</p></div>
                      <div><p className="text-slate-500 mb-1">Patient Initials</p><p className="font-semibold text-slate-900">{prescriptionDetails.patient_initials}</p></div>
                      <div><p className="text-slate-500 mb-1">Medications</p><p className="font-semibold text-slate-900">{prescriptionDetails.medication_count}</p></div>
                      <div><p className="text-slate-500 mb-1">Algorithm</p><p className="font-semibold text-slate-900 font-mono text-xs">{prescriptionDetails.signature_algorithm}</p></div>
                      <div><p className="text-slate-500 mb-1">Prescriber Status</p><p className="font-semibold text-slate-900">{prescriptionDetails.doctor_verification_status}</p></div>
                    </div>
                  </div>
                )}

                {prescriptionStatus === 'FAILED' && (
                  <div className="mt-8 border border-red-200 bg-red-50 rounded-2xl p-6 flex items-center gap-4 text-red-700">
                    <AlertTriangle className="w-8 h-8" />
                    <div>
                      <h4 className="font-bold text-lg">Not Verified</h4>
                      <p className="text-sm mt-1">{prescriptionMessage || 'The signature could not be verified against the issuing doctor.'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Tab 2: Blockchain Verification */}
            {activeTab === 'BLOCKCHAIN' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Search className="w-5 h-5 text-indigo-600" /> Document Integrity Check</h3>
                  <p className="text-sm text-slate-600">Upload any medical report. A SHA-256 digest is calculated directly in your browser and queried against the integrity ledger.</p>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:bg-slate-50 transition-colors relative">
                  <input
                    type="file"
                    onChange={handleReportUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                      <FileCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-lg">{reportFile ? reportFile.name : 'Select Medical Report'}</p>
                      <p className="text-slate-500 text-sm mt-1">Any file format supported</p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={verifyBlockchainHash}
                    disabled={!reportFile || hashStatus === 'HASHING' || hashStatus === 'VERIFYING'}
                    className="bg-indigo-600 disabled:bg-slate-300 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition-all"
                  >
                    {hashStatus === 'HASHING' ? 'Calculating Local SHA-256...' : hashStatus === 'VERIFYING' ? 'Querying Ledger...' : 'Verify Integrity'}
                  </button>
                </div>

                {hashStatus === 'VERIFIED' && hashDetails && (
                  <div className="mt-8 border border-emerald-200 bg-emerald-50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 text-emerald-700 font-bold text-xl mb-6">
                      <CheckCircle2 className="w-8 h-8" />
                      DOCUMENT INTEGRITY VERIFIED
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-emerald-100 mb-6 break-all">
                      <p className="text-xs text-slate-500 font-semibold mb-1">CALCULATED SHA-256 HASH</p>
                      <p className="font-mono text-sm text-slate-800">{hashDetails.hash}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                      <div><p className="text-slate-500 mb-1">Blockchain Network</p><p className="font-semibold text-slate-900">{hashDetails.blockchain_network}</p></div>
                      <div><p className="text-slate-500 mb-1">Block Number</p><p className="font-semibold text-slate-900">{hashDetails.block_number}</p></div>
                      <div className="col-span-2"><p className="text-slate-500 mb-1">Transaction ID</p><p className="font-semibold font-mono text-xs text-slate-900">{hashDetails.transaction_tx_id}</p></div>
                    </div>
                  </div>
                )}

                {hashStatus === 'FAILED' && (
                  <div className="mt-8 border border-red-200 bg-red-50 rounded-2xl p-6 flex items-center gap-4 text-red-700">
                    <AlertTriangle className="w-8 h-8" />
                    <div>
                      <h4 className="font-bold text-lg">Hash Not Found on Ledger</h4>
                      <p className="text-sm mt-1">The calculated SHA-256 hash does not exist on the blockchain. The document may be altered, tampered with, or not registered.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyDocument;
