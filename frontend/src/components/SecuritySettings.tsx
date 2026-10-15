import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Laptop, ShieldCheck, AlertCircle, Copy, Check, RefreshCw, Smartphone, Trash2, Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';

interface Session {
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    last_seen_at: string;
    is_current: boolean;
}

interface SecuritySettingsProps {
    section?: 'all' | 'mfa' | 'password' | 'security' | 'devices';
}

/**
 * Account security panel: TOTP enrolment, password change and signed-in
 * devices. Shared across roles with high-contrast, polished UI.
 */
const SecuritySettings: React.FC<SecuritySettingsProps> = ({ section = 'all' }) => {
    const { logout } = useAuth();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // MFA enrolment
    const [enrolment, setEnrolment] = useState<{ token: string; qr: string; manualKey: string } | null>(null);
    const [enrolCode, setEnrolCode] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);

    // Password change
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changing, setChanging] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        void loadSessions();
    }, []);

    const loadSessions = async () => {
        setLoadingSessions(true);
        try {
            const data = await api.get<Session[]>('/api/v1/auth/sessions');
            setSessions(data || []);
        } catch (e: any) {
            console.error('Failed to load sessions:', e);
        } finally {
            setLoadingSessions(false);
        }
    };

    const startEnrolment = async () => {
        setError('');
        setMessage('');
        setEnrolling(true);
        try {
            const res = await api.raw('/api/v1/auth/mfa/enroll', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Could not start enrolment');
            setEnrolment({ token: data.enrolmentToken, qr: data.qrDataUrl, manualKey: data.manualEntryKey });
        } catch (e: any) {
            setError(e.message || 'Could not start enrolment');
        } finally {
            setEnrolling(false);
        }
    };

    const confirmEnrolment = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await api.raw('/api/v1/auth/mfa/confirm', {
                method: 'POST',
                body: JSON.stringify({ enrolmentToken: enrolment?.token, otp: enrolCode }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to activate 2FA');

            setBackupCodes(data.backupCodes ?? []);
            setEnrolment(null);
            setEnrolCode('');
            setMessage(data.message || 'Two-Factor Authentication activated successfully.');
        } catch (e: any) {
            setError(e.message || 'Could not confirm enrolment');
        }
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword !== confirmPassword) {
            setError('New password and confirmation do not match.');
            return;
        }

        setChanging(true);
        try {
            const res = await api.raw('/api/v1/auth/password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                const detail = Array.isArray(data.details)
                    ? data.details.map((d: { path: string; message: string }) => d.message).join('; ')
                    : '';
                throw new Error(detail ? `${data.message} — ${detail}` : (data.message || 'Failed to change password'));
            }
            setMessage(`${data.message || 'Password changed successfully'}. Other active sessions have been signed out.`);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            void loadSessions();
        } catch (e: any) {
            setError(e.message || 'Could not change password');
        } finally {
            setChanging(false);
        }
    };

    const revokeSession = async (sessionId: string) => {
        try {
            const res = await api.raw(`/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage('Device session revoked successfully.');
                setTimeout(() => setMessage(''), 3000);
                void loadSessions();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const revokeOthers = async () => {
        try {
            const res = await api.raw('/api/v1/auth/sessions/revoke-others', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message || 'All other devices signed out.');
                setTimeout(() => setMessage(''), 3000);
                void loadSessions();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const signOut = async () => {
        await api.raw('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
        logout();
        window.location.href = '/login';
    };

    return (
        <div className="space-y-6">
            {message && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl p-4 font-semibold flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{message}</span>
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-2xl p-4 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Backup codes modal/banner */}
            {backupCodes.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-sm">
                    <h4 className="font-bold text-amber-900 flex items-center gap-2 text-lg mb-2">
                        <AlertCircle className="w-6 h-6 text-amber-600" /> Save your recovery backup codes
                    </h4>
                    <p className="text-sm text-amber-800 mb-4">
                        Store these one-time codes in a safe password vault. If you ever lose your authenticator phone, each code works once to regain access.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {backupCodes.map((code) => (
                            <code key={code} className="bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm font-mono text-center font-bold text-slate-800 shadow-inner">
                                {code}
                            </code>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            void navigator.clipboard.writeText(backupCodes.join('\n'));
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2500);
                        }}
                        className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied to Clipboard!' : 'Copy All Backup Codes'}
                    </button>
                </div>
            )}

            {(section === 'all' || section === 'security' || section === 'mfa' || section === 'password') && (
                <div className={`grid grid-cols-1 ${section === 'all' || section === 'security' ? 'lg:grid-cols-2' : ''} gap-6`}>
                    {/* Two-factor authentication card */}
                    {(section === 'all' || section === 'security' || section === 'mfa') && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Two-Factor Authentication (TOTP)</h3>
                                    <p className="text-xs text-slate-500">Google Authenticator, Microsoft Authenticator, or 1Password</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 my-4 leading-relaxed">
                                Enhance account security by requiring a six-digit cryptographic code alongside your password at every login.
                            </p>

                            {!enrolment ? (
                                <button
                                    onClick={startEnrolment}
                                    disabled={enrolling}
                                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold text-sm shadow transition-colors"
                                >
                                    <Smartphone className="w-4 h-4 text-emerald-400" />
                                    {enrolling ? 'Preparing QR...' : 'Set Up Authenticator App'}
                                </button>
                            ) : (
                                <form onSubmit={confirmEnrolment} className="space-y-4 pt-2 border-t border-slate-100">
                                    <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <img src={enrolment.qr} alt="Authenticator QR code" className="w-40 h-40 bg-white border border-slate-200 rounded-xl p-1 shrink-0 shadow-sm" />
                                        <div className="space-y-3 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700">
                                                1. Scan this QR code using your authenticator application.
                                            </p>
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                                    Or enter secret key manually:
                                                </p>
                                                <code className="block bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono break-all font-semibold text-slate-800 select-all">
                                                    {enrolment.manualKey}
                                                </code>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-700 mb-1.5">
                                                    2. Enter the 6-digit code shown in the app:
                                                </p>
                                                <input
                                                    required
                                                    value={enrolCode}
                                                    onChange={(e) => setEnrolCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    inputMode="numeric"
                                                    pattern="[0-9]{6}"
                                                    maxLength={6}
                                                    placeholder="000 000"
                                                    className="w-44 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 outline-none font-mono tracking-widest text-center text-lg font-bold bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow transition-colors">
                                            Verify &amp; Activate MFA
                                        </button>
                                        <button type="button" onClick={() => setEnrolment(null)} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {/* Password card */}
                    {(section === 'all' || section === 'security' || section === 'password') && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                    <KeyRound className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Change Password</h3>
                                    <p className="text-xs text-slate-500">Requires min. 12 characters, upper, lower, digit &amp; symbol</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 my-4 leading-relaxed">
                                Updating your password automatically revokes active sessions on all other devices.
                            </p>

                            <form onSubmit={changePassword} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Current Password</label>
                                    <div className="relative">
                                        <input
                                            required
                                            type={showCurrent ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="Enter current password"
                                            className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-slate-800"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrent(!showCurrent)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            title={showCurrent ? "Hide password" : "Show password"}
                                        >
                                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">New Password</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type={showNew ? "text" : "password"}
                                                minLength={12}
                                                placeholder="At least 12 chars"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-slate-800"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNew(!showNew)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                title={showNew ? "Hide password" : "Show password"}
                                            >
                                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Confirm New Password</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type={showConfirm ? "text" : "password"}
                                                minLength={12}
                                                placeholder="Repeat new password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none text-sm text-slate-800"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirm(!showConfirm)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                title={showConfirm ? "Hide password" : "Show password"}
                                            >
                                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {newPassword && (
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                                        <p className="font-bold text-slate-500 uppercase text-[10px]">Security Checks:</p>
                                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                                            <span className={`flex items-center gap-1 ${newPassword.length >= 12 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> 12+ characters
                                            </span>
                                            <span className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Upper &amp; lowercase
                                            </span>
                                            <span className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Contains numbers
                                            </span>
                                            <span className={`flex items-center gap-1 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Special symbol
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={changing}
                                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow transition-colors inline-flex items-center gap-2"
                                    >
                                        <Lock className="w-4 h-4" />
                                        {changing ? 'Updating Password…' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* Signed-in Devices */}
            {(section === 'all' || section === 'devices') && (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                <Laptop className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Signed-in Devices &amp; Active Sessions</h3>
                                <p className="text-xs text-slate-500">Track and immediately revoke unauthorized browser sessions.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={loadSessions}
                                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                title="Refresh sessions"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                type="button"
                                onClick={revokeOthers}
                                className="text-xs font-bold text-amber-700 hover:bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl transition-colors"
                            >
                                Sign out other devices
                            </button>
                            <button
                                type="button"
                                onClick={signOut}
                                className="text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 px-3.5 py-2 rounded-xl transition-colors"
                            >
                                Sign out completely
                            </button>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {sessions.map((session) => (
                            <div key={session.session_id} className="py-4 flex items-center justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className={`w-3.5 h-3.5 rounded-full mt-1.5 shrink-0 ${session.is_current ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-300'}`} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-2">
                                            <span>{session.user_agent || 'Unknown Web Browser / Device'}</span>
                                            {session.is_current && (
                                                <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                    Current Device
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            IP: <span className="font-mono font-medium text-slate-700">{session.ip_address || '127.0.0.1'}</span> &middot; Last active: {new Date(session.last_seen_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                {!session.is_current && (
                                    <button
                                        onClick={() => revokeSession(session.session_id)}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-3.5 py-2 rounded-xl transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Revoke
                                    </button>
                                )}
                            </div>
                        ))}
                        {sessions.length === 0 && !loadingSessions && (
                            <p className="py-8 text-center text-sm text-slate-500">No active session records found.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecuritySettings;
