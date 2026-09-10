import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, ShieldAlert, CheckCircle2, XCircle, FileBadge, Search } from 'lucide-react';

const HospitalDoctors = () => {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  useEffect(() => {
    fetchDoctors();
  }, [token]);

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/v1/hospital/doctors', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setDoctors(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleStatusChange = async (id: string, action: 'approve' | 'revoke') => {
    try {
      const res = await fetch(`/api/v1/hospital/doctors/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedDoctor(null);
        fetchDoctors();
      }
    } catch (e) { console.error(e); }
  };

  const filteredDoctors = doctors.filter(d => 
    d.first_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.mrn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Doctor Staff Directory
            </h1>
            <p className="text-slate-500 mt-2">Manage affiliations, review credentials, and approve access for medical staff.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Name or MRN..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-6">Doctor Name</th>
                  <th className="p-6">Registration (MRN)</th>
                  <th className="p-6">Specialty</th>
                  <th className="p-6">Status</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDoctors.map(doc => (
                  <tr key={doc.doctor_id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                          {doc.first_name.charAt(0)}{doc.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Dr. {doc.first_name} {doc.last_name}</p>
                          <p className="text-xs text-slate-500 font-mono" title="Public Key Fingerprint">{doc.key_fingerprint.substring(0,16)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 font-mono text-sm font-semibold text-slate-700">{doc.mrn}</td>
                    <td className="p-6 text-sm text-slate-600 font-medium">{doc.specialization}</td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        doc.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 
                        doc.verification_status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {doc.verification_status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => setSelectedDoctor(doc)}
                        className="bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDoctors.length === 0 && (
              <div className="p-12 text-center text-slate-500">No doctors match your search.</div>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><FileBadge className="w-5 h-5 text-blue-600" /> Review Doctor Credentials</h3>
               <button onClick={() => setSelectedDoctor(null)} className="text-slate-400 hover:text-slate-600 font-bold px-3 py-1 bg-slate-200 rounded-lg">Close</button>
             </div>
             
             <div className="p-8 space-y-6">
                <div className="flex items-center gap-4 mb-6 border-b pb-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl">
                    {selectedDoctor.first_name.charAt(0)}{selectedDoctor.last_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}</h2>
                    <p className="text-slate-500 font-medium">{selectedDoctor.qualification} • {selectedDoctor.experience_years} Years Experience</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Registration (MRN)</p>
                    <p className="font-mono text-slate-800 font-semibold bg-slate-50 p-2 rounded border border-slate-100">{selectedDoctor.mrn}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">State Medical Council</p>
                    <p className="font-medium text-slate-800 bg-slate-50 p-2 rounded border border-slate-100">{selectedDoctor.state_medical_council}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">RSA-2048 Public Key Fingerprint</p>
                    <p className="font-mono text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-100 break-all">{selectedDoctor.key_fingerprint}</p>
                  </div>
                </div>

                {selectedDoctor.verification_status === 'PENDING' && (
                  <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 text-sm font-medium flex gap-2">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    This account is pending verification. Upon approval, this doctor will be granted read/write access under this hospital's umbrella.
                  </div>
                )}
             </div>

             <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                {selectedDoctor.verification_status !== 'REVOKED' && (
                  <button 
                    onClick={() => handleStatusChange(selectedDoctor.doctor_id, 'revoke')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-red-600 bg-red-100 hover:bg-red-200 transition-colors"
                  >
                    <XCircle className="w-5 h-5" /> Suspend Access
                  </button>
                )}
                {selectedDoctor.verification_status !== 'VERIFIED' && (
                  <button 
                    onClick={() => handleStatusChange(selectedDoctor.doctor_id, 'approve')}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Approve Verification
                  </button>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalDoctors;
