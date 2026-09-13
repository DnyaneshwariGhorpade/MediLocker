import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Laptop, ShieldCheck, AlertCircle, Copy, Check } from 'lucide-react';

interface Session {
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    last_seen_at: string;
    is_current: boolean;
}

/**
 * Account security panel: TOTP enrolment, password change and signed-in
 * devices. Shared by every role, since all three apply to any account.
 */
const SecuritySettings = () => {
    const { token, logout } = useAuth();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // MFA enrolment
    const [enrolment, setEnrolment] = useState<{ token: string; qr: string; manualKey: string } | null>(null);
    const [enrolCode, setEnrolCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);

    // Password change
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [changing, setChanging] = useState(false);

    const authHeaders = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        void loadSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const loadSessions = async () => {
        try {
            const res = await fetch('/api/v1/auth/sessions', { headers: authHeaders });
            if (res.ok) setSessions(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const startEnrolment = async () => {
        setError('');
        setMessage('');
        try {
            const res = await fetch('/api/v1/auth/mfa/enroll', { method: 'POST', headers: authHeaders });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setEnrolment({ token: data.enrolmentToken, qr: data.qrDataUrl, manualKey: data.manualEntryKey });
        } catch (e: any) {
            setError(e.message || 'Could not start enrolment');
        }
    };

    const confirmEnrolment = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch('/api/v1/auth/mfa/confirm', {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrolmentToken: enrolment?.token, otp: enrolCode }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            setBackupCodes(data.backupCodes ?? []);
            setEnrolment(null);
            setEnrolCode('');
            setMessage(data.message);
        } catch (e: any) {
            setError(e.message || 'Could not confirm enrolment');
        }
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setChanging(true);
        try {
            const res = await fetch('/api/v1/auth/password', {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                const detail = Array.isArray(data.details)
                    ? data.details.map((d: { path: string; message: string }) => d.message).join('; ')
                    : '';
                throw new Error(detail ? `${data.message} — ${detail}` : data.message);
            }
            setMessage(`${data.message}. ${data.otherSessionsRevoked} other device(s) signed out.`);
            setCurrentPassword('');
            setNewPassword('');
            void loadSessions();
        } catch (e: any) {
            setError(e.message || 'Could not change password');
        }
        setChanging(false);
    };

    const revokeSession = async (sessionId: string) => {
        try {
            await fetch(`/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE', headers: authHeaders });
            void loadSessions();
        } catch (e) {
            console.error(e);
        }
    };

    const revokeOthers = async () => {
        try {
            const res = await fetch('/api/v1/auth/sessions/revoke-others', { method: 'POST', headers: authHeaders });
            const data = await res.json();
            setMessage(data.message);
            void loadSessions();
        } catch (e) {
            console.error(e);
        }
    };

    const signOut = async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST', headers: authHeaders }).catch(() => undefined);
        logout();
        window.location.href = '/login';
    };

    return (
        <div className="space-y-6">
            {message && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl p-4">
                    {message}
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-2xl p-4">{error}</div>
            )}

            {/* Backup codes are shown exactly once. */}
            {backupCodes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                    <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5" /> Save your backup codes now
                    </h4>
                    <p className="text-sm text-amber-800 mb-4">
                        These are shown once and cannot be recovered. Each works a single time if you lose your
                        authenticator.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                        {backupCodes.map((code) => (
                            <code key={code} className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-mono text-center">
                                {code}
                            </code>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            void navigator.clipboard.writeText(backupCodes.join('\n'));
                            setCopied(true);
                        }}
                        className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy all'}
                    </button>
                </div>
            )}

            {/* Two-factor authentication */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Two-Factor Authentication
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                    Use an authenticator app to generate a code at each sign-in.
                </p>

                {!enrolment ? (
                    <button
                        onClick={startEnrolment}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
                    >
                        Set up authenticator
                    </button>
                ) : (
                    <form onSubmit={confirmEnrolment} className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <img src={enrolment.qr} alt="Authenticator QR code" className="w-44 h-44 border border-slate-200 rounded-xl" />
                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-slate-600">
                                    Scan this with your authenticator app, then enter the six-digit code it shows.
                                </p>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Or enter this key manually
                                    </p>
                                    <code className="block bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono break-all">
                                        {enrolment.manualKey}
                                    </code>
                                </div>
                                <input
                                    required
                                    value={enrolCode}
                                    onChange={(e) => setEnrolCode(e.target.value)}
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    placeholder="000000"
                                    className="w-40 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none font-mono tracking-widest text-center"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm">
                                Confirm and activate
                            </button>
                            <button type="button" onClick={() => setEnrolment(null)} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-100">
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Password */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
                    <KeyRound className="w-5 h-5 text-indigo-600" /> Change Password
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                    Changing your password signs out every other device.
                </p>

                <form onSubmit={changePassword} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Current password</label>
                        <input
                            required
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">New password</label>
                        <input
                            required
                            type="password"
                            minLength={12}
                            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                            title="At least 12 characters, including an uppercase letter, a lowercase letter, a digit and a symbol."
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            At least 12 characters, with upper and lower case, a digit and a symbol.
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={changing}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
                        >
                            {changing ? 'Updating…' : 'Update password'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Devices */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
                            <Laptop className="w-5 h-5 text-slate-600" /> Signed-in Devices
                        </h3>
                        <p className="text-sm text-slate-500">Revoking a device takes effect on its next request.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={revokeOthers} className="text-sm font-semibold text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl">
                            Sign out others
                        </button>
                        <button onClick={signOut} className="text-sm font-semibold text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-xl">
                            Sign out
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {sessions.map((session) => (
                        <div key={session.session_id} className="py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                    {session.user_agent ?? 'Unknown device'}
                                    {session.is_current && (
                                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                                            This device
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {session.ip_address ?? 'unknown IP'} · last active{' '}
                                    {new Date(session.last_seen_at).toLocaleString()}
                                </p>
                            </div>
                            {!session.is_current && (
                                <button
                                    onClick={() => revokeSession(session.session_id)}
                                    className="text-xs font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg shrink-0"
                                >
                                    Revoke
                                </button>
                            )}
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500">No active sessions found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecuritySettings;
