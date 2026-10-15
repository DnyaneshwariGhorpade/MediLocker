import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import SecuritySettings from '../components/SecuritySettings';
import {
  Settings,
  User,
  MapPin,
  Ambulance,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Save,
  Droplet,
  Calendar,
  Lock,
  Smartphone,
  ShieldCheck
} from 'lucide-react';

type SettingsTab = 'profile' | 'emergency' | 'security' | 'sessions';

const PatientSettings = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Demographic / Address Form State
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // Emergency form state
  const [eName, setEName] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eRelation, setERelation] = useState('');
  const [eAllowed, setEAllowed] = useState(false);
  const [savingEmergency, setSavingEmergency] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [emergencyError, setEmergencyError] = useState('');

  // Copy Vault ID state
  const [copiedVault, setCopiedVault] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>('/api/v1/patient/profile');
      setProfile(data);
      setAddressLine(data.address || '');
      setCity(data.city || '');
      setState(data.state || '');
      setPincode(data.pincode || '');

      setEName(data.emergency_contact_name || '');
      setEPhone(data.emergency_contact_phone || '');
      setERelation(data.emergency_contact_relation || '');
      setEAllowed(Boolean(data.is_emergency_sharing_allowed));
    } catch (e: any) {
      console.error('Failed to load profile:', e);
      setProfileError('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const res = await api.raw('/api/v1/patient/profile', {
        method: 'PUT',
        body: JSON.stringify({
          address_line: addressLine,
          city,
          state,
          pincode
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update demographics');

      setProfileMessage('Address & demographics updated securely.');
      setTimeout(() => setProfileMessage(''), 3500);
      void fetchProfile();
    } catch (err: any) {
      setProfileError(err.message || 'Could not save profile details');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmergencySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmergency(true);
    setEmergencyMessage('');
    setEmergencyError('');
    try {
      const res = await api.raw('/api/v1/patient/emergency-settings', {
        method: 'PUT',
        body: JSON.stringify({
          emergency_contact_name: eName,
          emergency_contact_phone: ePhone,
          emergency_contact_relation: eRelation,
          is_emergency_sharing_allowed: eAllowed
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update emergency settings');

      setEmergencyMessage('Break-Glass emergency preferences saved successfully.');
      setTimeout(() => setEmergencyMessage(''), 3500);
      void fetchProfile();
    } catch (err: any) {
      setEmergencyError(err.message || 'Failed to save emergency preferences');
    } finally {
      setSavingEmergency(false);
    }
  };

  const copyVaultId = () => {
    if (profile?.vault_number) {
      void navigator.clipboard.writeText(profile.vault_number);
      setCopiedVault(true);
      setTimeout(() => setCopiedVault(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm">Loading secure profile &amp; security parameters...</p>
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: any; badge?: string }[] = [
    { id: 'profile', label: 'Profile & Demographics', icon: User },
    { id: 'emergency', label: 'Emergency & Break-Glass', icon: Ambulance, badge: eAllowed ? 'Active' : undefined },
    { id: 'security', label: 'Account Security (MFA & Password)', icon: Lock },
    { id: 'sessions', label: 'Active Devices & Sessions', icon: Smartphone }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Account Settings &amp; Security
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Manage your patient profile, emergency medical access, multi-factor keys, and connected devices.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Aadhaar KYC Verified
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 translate-y-[-1px]'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                    isActive ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile & Demographics */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Identity & Vault Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                    {profile?.first_name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900">
                      {profile?.first_name} {profile?.last_name}
                    </h2>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Patient Account &middot; Aadhaar Linked
                    </p>
                    <div className="mt-2.5 inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vault ID:</span>
                      <span className="font-mono text-xs font-bold text-slate-800">{profile?.vault_number}</span>
                      <button
                        type="button"
                        onClick={copyVaultId}
                        className="text-indigo-600 hover:text-indigo-800 p-1 rounded transition-colors ml-1"
                        title="Copy Vault Number"
                      >
                        {copiedVault ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:w-auto w-full">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 min-w-[130px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] block mb-1 flex items-center gap-1">
                      <Droplet className="w-3.5 h-3.5 text-rose-500" /> Blood Group
                    </span>
                    <span className="font-bold text-base text-slate-900">{profile?.blood_group || 'Not recorded'}</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 min-w-[130px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] block mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" /> Gender
                    </span>
                    <span className="font-bold text-base text-slate-900">{profile?.gender || 'Not recorded'}</span>
                  </div>
                </div>
              </div>

              {/* Registered Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-slate-100">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Registered Email</span>
                  <p className="font-semibold text-slate-800 break-all">{profile?.email || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Registered Mobile Number</span>
                  <p className="font-semibold text-slate-800 font-mono">{profile?.phone || 'N/A'}</p>
                </div>
              </div>

              {/* Editable Demographics / Residential Address Form */}
              <form onSubmit={handleSaveProfile} className="pt-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-indigo-600" /> Residential Address
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Used for localized healthcare and clinical emergency dispatch.</p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    Self-Service
                  </span>
                </div>

                {profileMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3 rounded-2xl font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" /> {profileMessage}
                  </div>
                )}
                {profileError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-2xl font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" /> {profileError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Address Line (House / Building / Street)
                    </label>
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="e.g. 402, Green Valley Apartments, MG Road"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800 font-medium text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">City / District</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Pune"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800 font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">State / Province</label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Maharashtra"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800 font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">PIN / Postal Code</label>
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        pattern="[0-9]{6}"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800 font-mono font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {savingProfile ? 'Updating Address...' : 'Save Demographics'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Emergency & Break-Glass */}
        {activeTab === 'emergency' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Ambulance className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Emergency &amp; Break-Glass Protocols</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Life-critical override parameters for accredited Emergency Rooms (ER).</p>
                  </div>
                </div>
                <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shrink-0 ${
                  eAllowed ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {eAllowed ? '● Break-Glass Enabled' : '○ Break-Glass Disabled'}
                </span>
              </div>

              {emergencyMessage && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 rounded-2xl font-semibold flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" /> {emergencyMessage}
                </div>
              )}
              {emergencyError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-2xl font-semibold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" /> {emergencyError}
                </div>
              )}

              <form onSubmit={handleSaveEmergencySettings} className="space-y-6">
                {/* Break Glass Interactive Toggle Box */}
                <div className={`p-6 rounded-2xl border-2 transition-all ${
                  eAllowed ? 'bg-rose-50/70 border-rose-200 shadow-sm' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-2xl shrink-0 mt-0.5 ${eAllowed ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'}`}>
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className={`text-base font-bold ${eAllowed ? 'text-rose-900' : 'text-slate-800'}`}>
                          Allow Break-Glass ER Record Sharing
                        </h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          When enabled, verified ER physicians can temporarily access life-saving health snapshots (Allergies, Blood Group, Chronic Conditions) during medical emergencies without waiting for manual OTP approval. You and your emergency contact are alerted immediately via SMS/notification.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={eAllowed}
                        onChange={() => setEAllowed(!eAllowed)}
                      />
                      <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>
                </div>

                {/* Emergency Contact Form */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" /> Primary Emergency Contact
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Contact Person Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={eName}
                        onChange={(e) => setEName(e.target.value)}
                        placeholder="e.g. Ramesh Ghorpade"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-sm text-slate-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Contact Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={ePhone}
                        onChange={(e) => setEPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none font-mono text-sm text-slate-800 font-medium"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Relationship to Patient *
                      </label>
                      <input
                        type="text"
                        required
                        value={eRelation}
                        onChange={(e) => setERelation(e.target.value)}
                        placeholder="e.g. Spouse, Parent, Sibling, Legal Guardian"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-sm text-slate-800 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={savingEmergency}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-7 py-3 rounded-xl font-bold text-sm shadow-md transition-colors"
                  >
                    <Save className="w-4 h-4 text-rose-400" />
                    {savingEmergency ? 'Saving Protocol...' : 'Save Emergency Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Account Security (MFA + Password) */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  Multi-Factor Authentication &amp; Password
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protect your health vault with TOTP authenticator apps and strong cryptographic passwords.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                ISO 27001 &amp; HIPAA Compliant
              </span>
            </div>

            <SecuritySettings section="security" />
          </div>
        )}

        {/* Tab 4: Active Devices & Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
                  <Smartphone className="w-6 h-6 text-indigo-600" />
                  Signed-In Devices &amp; Active Sessions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and revoke active web sessions or mobile logins accessing your medical records.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Zero-Trust Token Management
              </span>
            </div>

            <SecuritySettings section="devices" />
          </div>
        )}

      </div>
    </div>
  );
};

export default PatientSettings;
