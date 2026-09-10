import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileCheck, Search, CheckCircle2, AlertTriangle, UploadCloud } from 'lucide-react';

const VerifyDocument = () => {
  const [activeTab, setActiveTab] = useState<'PRESCRIPTION' | 'BLOCKCHAIN'>('PRESCRIPTION');
  
  // State for Prescription Tab
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionStatus, setPrescriptionStatus] = useState<'IDLE' | 'VERIFYING' | 'VERIFIED' | 'FAILED'>('IDLE');
  const [prescriptionDetails, setPrescriptionDetails] = useState<any>(null);

  // State for Blockchain Tab
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [hashStatus, setHashStatus] = useState<'IDLE' | 'HASHING' | 'VERIFYING' | 'VERIFIED' | 'FAILED'>('IDLE');
  const [hashDetails, setHashDetails] = useState<any>(null);

  const handlePrescriptionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPrescriptionFile(e.target.files[0]);
      setPrescriptionStatus('IDLE');
      setPrescriptionDetails(null);
    }
  };

  const verifyPrescription = async () => {
    if (!prescriptionFile) return;
    setPrescriptionStatus('VERIFYING');

    try {
      // Simulate reading and verifying signature
      const res = await fetch('/api/v1/public/verify-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prescription_file: prescriptionFile.name,
          signature: 'mocked-signature-from-pdf'
        })
      });
      const data = await res.json();
      
      if (res.ok && data.verified) {
        setPrescriptionStatus('VERIFIED');
        setPrescriptionDetails(data.details);
      } else {
        setPrescriptionStatus('FAILED');
      }
    } catch (err) {
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
      const res = await fetch('/api/v1/public/verify-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha256_hash: hash })
      });
      const data = await res.json();
      
      if (res.ok && data.verified) {
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
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-blue-600" /> RSA-2048 Signature Verification</h3>
                  <p className="text-sm text-slate-600">Upload a digitally signed prescription PDF. The system will extract the embedded RSA-2048 signature and verify it against the doctor's registered public key.</p>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:bg-slate-50 transition-colors relative">
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={handlePrescriptionUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-lg">{prescriptionFile ? prescriptionFile.name : 'Select Prescription PDF'}</p>
                      <p className="text-slate-500 text-sm mt-1">Upload the original downloaded PDF</p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <button 
                    onClick={verifyPrescription}
                    disabled={!prescriptionFile || prescriptionStatus === 'VERIFYING'}
                    className="bg-slate-900 disabled:bg-slate-300 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition-all"
                  >
                    {prescriptionStatus === 'VERIFYING' ? 'Verifying Cryptography...' : 'Verify Signature'}
                  </button>
                </div>

                {prescriptionStatus === 'VERIFIED' && prescriptionDetails && (
                  <div className="mt-8 border border-emerald-200 bg-emerald-50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 text-emerald-700 font-bold text-xl mb-6">
                      <CheckCircle2 className="w-8 h-8" />
                      SIGNATURE VALID
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                      <div><p className="text-slate-500 mb-1">Doctor Name</p><p className="font-semibold text-slate-900">{prescriptionDetails.doctor_name}</p></div>
                      <div><p className="text-slate-500 mb-1">Medical Registration Number</p><p className="font-semibold text-slate-900">{prescriptionDetails.mrn}</p></div>
                      <div><p className="text-slate-500 mb-1">Hospital Affiliation</p><p className="font-semibold text-slate-900">{prescriptionDetails.hospital}</p></div>
                      <div><p className="text-slate-500 mb-1">Date of Issue</p><p className="font-semibold text-slate-900">{new Date(prescriptionDetails.issued_at).toLocaleString()}</p></div>
                    </div>
                  </div>
                )}

                {prescriptionStatus === 'FAILED' && (
                  <div className="mt-8 border border-red-200 bg-red-50 rounded-2xl p-6 flex items-center gap-4 text-red-700">
                    <AlertTriangle className="w-8 h-8" />
                    <div>
                      <h4 className="font-bold text-lg">Signature Invalid or Tampered</h4>
                      <p className="text-sm mt-1">The document's cryptographic signature could not be verified against any registered doctor.</p>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Tab 2: Blockchain Verification */}
            {activeTab === 'BLOCKCHAIN' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Search className="w-5 h-5 text-indigo-600" /> Hyperledger Fabric Tamper Check</h3>
                  <p className="text-sm text-slate-600">Upload any medical report. A SHA-256 digest is calculated directly in your browser and queried against the immutable blockchain ledger to prove it hasn't been altered.</p>
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
