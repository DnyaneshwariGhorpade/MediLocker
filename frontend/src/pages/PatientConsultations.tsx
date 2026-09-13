import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Clock, Stethoscope, Building2, CalendarCheck, FileText, Activity } from 'lucide-react';

const PatientConsultations = () => {
  const { token } = useAuth();
  const [consultations, setConsultations] = useState<any[]>([]);

  useEffect(() => {
    fetchConsultations();
  }, [token]);

  const fetchConsultations = async () => {
    try {
      setConsultations(await api.get<any>('/api/v1/patient/consultations'));
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            Clinical Consultations
          </h1>
          <p className="text-slate-500 mt-2">Chronological history of all your doctor visits and encounters.</p>
        </div>

        {/* Timeline */}
        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 md:before:ml-[2.25rem] before:h-full before:w-0.5 before:bg-slate-200">
          {consultations.map((consultation) => (
            <div key={consultation.consultation_id} className="relative flex items-start gap-6 group">
              <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 z-10">
                <Stethoscope className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Dr. {consultation.doctors?.last_name || 'Unknown'}</h3>
                    <p className="text-slate-500 font-medium">{consultation.doctors?.specialization || 'General Practitioner'}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-slate-800 font-bold">{new Date(consultation.consultation_date).toLocaleDateString()}</p>
                    <p className="text-sm text-slate-500">{new Date(consultation.consultation_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                </div>

                {consultation.hospitals && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-4 bg-slate-50 p-2 rounded-lg inline-flex border border-slate-100">
                    <Building2 className="w-4 h-4" /> {consultation.hospitals.hospital_name}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Chief Complaint</h4>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">{consultation.chief_complaint}</p>
                  </div>
                  {consultation.diagnosis_summary && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Diagnosis</h4>
                      <p className="text-slate-800 font-medium">{consultation.diagnosis_summary}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                  {consultation.follow_up_date && (
                    <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
                      <CalendarCheck className="w-4 h-4" /> Follow-up: {new Date(consultation.follow_up_date).toLocaleDateString()}
                    </div>
                  )}
                  <button className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition-colors">
                    <FileText className="w-4 h-4" /> View Prescription
                  </button>
                  <button className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition-colors">
                    <Activity className="w-4 h-4" /> Linked Tests
                  </button>
                </div>
              </div>
            </div>
          ))}
          {consultations.length === 0 && (
            <div className="ml-12 p-8 text-center text-slate-500 bg-white rounded-3xl border border-slate-100">
              No consultation history found.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PatientConsultations;
