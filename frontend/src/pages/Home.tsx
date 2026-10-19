import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  Database, 
  Lock, 
  FileSignature, 
  FileCheck, 
  AlertTriangle, 
  ChevronRight, 
  Menu, 
  X,
  ExternalLink
} from 'lucide-react';

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 flex flex-col justify-between">
      {/* Navbar */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-50 rounded-xl border border-blue-100">
              <ShieldCheck className="text-blue-600 h-7 w-7" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 bg-clip-text text-transparent">
              MediLocker
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-6 items-center">
            <a href="#features" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Features</a>
            <a href="#security" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">Security Architecture</a>
            <Link to="/verify" className="text-slate-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1.5">
              <span>Public Verifier</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-md">Live</span>
            </Link>
            <div className="h-5 w-px bg-slate-200 mx-1"></div>
            <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">Sign In</Link>
            <Link 
              to="/register/patient" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-all hover:shadow-md transform hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-3 border-t border-slate-100 mt-3 space-y-2">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              Features
            </a>
            <a 
              href="#security" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              Security Architecture
            </a>
            <Link 
              to="/verify" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              Public Verifier
            </Link>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link 
                to="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 rounded-xl text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100"
              >
                Sign In
              </Link>
              <Link 
                to="/register/patient" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-blue-50/80 backdrop-blur-sm text-blue-700 font-medium text-sm mb-8 border border-blue-200/60 shadow-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
          </span>
          India DPDP Act 2023 & ABDM Compliant Vault
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-6">
          Your Digital Healthcare <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800">
            Record Vault.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          A secure, patient-owned cloud-native healthcare vault with granular consent, 
          envelope encryption, tamper-evident audit chains, and verifiable digital prescriptions.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link 
            to="/register/patient" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30 transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span>I am a Patient</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link 
            to="/register/doctor" 
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-semibold shadow-sm transition-all hover:shadow-md transform hover:-translate-y-0.5"
          >
            I am a Doctor
          </Link>
          <Link 
            to="/register/hospital" 
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-3.5 rounded-xl font-semibold shadow-sm transition-all hover:shadow-md transform hover:-translate-y-0.5"
          >
            Hospital Sign Up
          </Link>
        </div>

        {/* Quick Demo Hint */}
        <div className="mt-8 text-xs text-slate-500 flex items-center justify-center gap-2">
          <span className="font-semibold text-slate-600">Quick Test:</span>
          <span>Seed credentials available on the</span>
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign In page</Link>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="bg-white py-20 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Core Capabilities</h2>
            <p className="text-3xl font-extrabold text-slate-900">Engineered for Sovereign Health Data</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group">
              <div className="bg-blue-100/80 group-hover:bg-blue-600 group-hover:text-white transition-colors w-14 h-14 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                <Database className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Immutable Ledger</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Records and audit logs are anchored with cryptographic hash chains and database-enforced immutability triggers for non-repudiation.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group">
              <div className="bg-indigo-100/80 group-hover:bg-indigo-600 group-hover:text-white transition-colors w-14 h-14 rounded-xl flex items-center justify-center mb-6 text-indigo-600">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Granular Consent</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Patients retain absolute control: select exact categories to share, set expiration time windows, and revoke access on demand.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group">
              <div className="bg-emerald-100/80 group-hover:bg-emerald-600 group-hover:text-white transition-colors w-14 h-14 rounded-xl flex items-center justify-center mb-6 text-emerald-600">
                <Activity className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Vitals Tracking</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Continuous physiological metric tracking with trend charts, clinical context markers, and automated longitudinal logs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture Section */}
      <section id="security" className="py-20 bg-slate-900 text-white border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 block">
              Cryptographic Guarantees
            </span>
            <h2 className="text-3xl font-extrabold text-white">Zero-Trust Security Architecture</h2>
            <p className="text-slate-400 mt-3 text-sm">
              MediLocker ensures medical records remain confidential, tamper-evident, and auditable at every lifecycle stage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-blue-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 border border-blue-500/20">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-white mb-2">Envelope Encryption</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Files are encrypted using AES-256-GCM with unique DEKs per record, wrapped with master KMS keys.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-indigo-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20">
                <FileSignature className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-white mb-2">ECDSA P-256 Signatures</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Doctors sign prescriptions client-side via non-extractable Web Crypto keys, verifiable by any pharmacy.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
                <FileCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-white mb-2">Tamper-Evident Ledger</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                SHA-256 hash chains guarantee that no audit log or health record entry can be modified or deleted undetected.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-amber-500/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-white mb-2">Audited Break-Glass</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Emergency physician access triggers instantaneous audit logging, time-boxed validity, and patient alerting.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link 
              to="/verify" 
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Test Public Verification Tool</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="text-blue-500 h-6 w-6" />
            <span className="font-bold text-lg text-white">MediLocker</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              v1.0.0
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <Link to="/verify" className="hover:text-white transition-colors">Public Verifier</Link>
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
          </div>

          <div className="text-xs text-slate-500 text-center md:text-right">
            <span>Aligned with India DPDP Act 2023 & ABDM standards.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
