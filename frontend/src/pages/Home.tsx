import { Link } from 'react-router-dom';
import { ShieldCheck, Activity, Database } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-blue-600 h-8 w-8" />
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">MediLocker</span>
        </div>
        <div className="flex gap-6 items-center">
          <a href="#features" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Features</a>
          <a href="#security" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Security</a>
          <Link to="/verify" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Public Verifier</Link>
          <div className="h-6 w-px bg-slate-300 mx-2"></div>
          <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">Sign In</Link>
          <Link to="/register/patient" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm transition-all hover:shadow-md transform hover:-translate-y-0.5">
            Create Account
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 font-medium mb-8 border border-blue-100">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          India DPDP Act 2023 Compliant
        </div>

        <h1 className="text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Your Digital Healthcare <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Record Vault.</span>
        </h1>

        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          A secure, patient-owned cloud-native healthcare record vault with granular consent, cryptographic integrity, and zero-trust encryption.
        </p>

        <div className="flex justify-center gap-4">
          <Link to="/register/patient" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30 transform hover:-translate-y-1">
            I am a Patient
          </Link>
          <Link to="/register/doctor" className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-semibold shadow-sm transition-all hover:shadow-md transform hover:-translate-y-1">
            I am a Doctor
          </Link>
          <Link to="/register/hospital" className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-semibold shadow-sm transition-all hover:shadow-md transform hover:-translate-y-1">
            Hospital Sign Up
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="bg-white py-24 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="bg-blue-100 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <Database className="text-blue-600 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Immutable Storage</h3>
              <p className="text-slate-600 leading-relaxed">All medical records are anchored to a Hyperledger Fabric blockchain, ensuring tamper-proof history.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="bg-indigo-100 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="text-indigo-600 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Granular Consent</h3>
              <p className="text-slate-600 leading-relaxed">You control exactly which doctor sees what. Block sensitive records and revoke access instantly.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
              <div className="bg-emerald-100 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                <Activity className="text-emerald-600 w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Vitals Tracking</h3>
              <p className="text-slate-600 leading-relaxed">Monitor your health metrics over time with beautiful, easy-to-understand charts and graphs.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
