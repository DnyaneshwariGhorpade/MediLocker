import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, User, MapPin, Ambulance, ShieldAlert, MonitorSmartphone, LogOut, CheckCircle2 } from 'lucide-react';

const PatientSettings = () => {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Emergency form state
  const [eName, setEName] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eRelation, setERelation] = useState('');
  const [eAllowed, setEAllowed] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/v1/patient/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEName(data.emergency_contact_name || '');
        setEPhone(data.emergency_contact_phone || '');
        setERelation(data.emergency_contact_relation || '');
        setEAllowed(data.is_emergency_sharing_allowed);
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveEmergencySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/patient/emergency-settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          emergency_contact_name: eName,
          emergency_contact_phone: ePhone,
          emergency_contact_relation: eRelation,
          is_emergency_sharing_allowed: eAllowed
        })
      });
      if (res.ok) {
        setMessage('Emergency settings updated securely.');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!profile) return <div className="p-12 text-center text-slate-500 font-medium">Loading secure profile...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-slate-700" />
            Profile & Security Settings
          </h1>
          <p className="text-slate-500 mt-2">Manage demographics, Break-Glass configurations, and active sessions.</p>
        </div>

        {message && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold flex items-center gap-2 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" /> {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Demographics & Auth */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4">
                {profile.first_name.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{profile.first_name} {profile.last_name}</h2>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md inline-flex border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Aadhaar KYC Verified
              </div>
              
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Email Address</p>
                  <p className="text-sm font-medium text-slate-800">{profile.email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Phone Number</p>
                  <p className="text-sm font-medium text-slate-800">{profile.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Current Address</p>
                  <p className="text-sm font-medium text-slate-800">{profile.address}, {profile.city}, {profile.state} - {profile.pincode}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><MonitorSmartphone className="w-4 h-4 text-indigo-500" /> Active Sessions</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Current Session</p>
                    <p className="text-xs text-slate-500">Windows • Chrome</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
                <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl transition-colors">
                  <LogOut className="w-4 h-4" /> Sign Out Everywhere
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Emergency & Break Glass */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6 border-b pb-4">
                <Ambulance className="w-6 h-6 text-red-500" /> Emergency Configuration
              </h3>
              
              <form onSubmit={handleSaveEmergencySettings} className="space-y-6">
                
                {/* Break Glass Toggle */}
                <div className={`p-5 rounded-2xl border-2 transition-colors flex gap-4 ${eAllowed ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="pt-1">
                    <ShieldAlert className={`w-6 h-6 ${eAllowed ? 'text-red-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className={`font-bold text-lg ${eAllowed ? 'text-red-700' : 'text-slate-700'}`}>Break-Glass Emergency Sharing</h4>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={eAllowed} onChange={() => setEAllowed(!eAllowed)} />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>
                    <p className={`text-sm ${eAllowed ? 'text-red-600/80' : 'text-slate-500'}`}>
                      If enabled, verified ER physicians can bypass your consent requirements to access life-saving records (Allergies, Chronic History) during critical emergencies. You will be notified immediately.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Emergency Contact Name</label>
                    <input 
                      required value={eName} onChange={e => setEName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Emergency Phone</label>
                    <input 
                      required type="tel" value={ePhone} onChange={e => setEPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Relationship</label>
                    <input 
                      required value={eRelation} onChange={e => setERelation(e.target.value)}
                      placeholder="e.g. Spouse, Parent"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSettings;
