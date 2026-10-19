import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
    Activity,
    AlertTriangle,
    Bell,
    Building2,
    ClipboardList,
    FileSignature,
    FileSearch,
    Flag,
    Gauge,
    HeartPulse,
    KeyRound,
    LayoutDashboard,
    LogOut,
    Menu,
    Scale,
    Search,
    Shield,
    ShieldCheck,
    Stethoscope,
    Upload,
    UserCheck,
    Users,
    X,
} from 'lucide-react';

interface NavItem {
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
}

/** Navigation per role. Mirrors the route table in App.tsx. */
const NAV_BY_ROLE: Record<string, NavItem[]> = {
    PATIENT: [
        { to: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/patient/vault', label: 'Medical Vault', icon: Shield },
        { to: '/patient/consent', label: 'Consent', icon: ShieldCheck },
        { to: '/patient/vitals', label: 'Vitals', icon: HeartPulse },
        { to: '/patient/consultations', label: 'Consultations', icon: ClipboardList },
        { to: '/patient/notifications', label: 'Notifications', icon: Bell },
        { to: '/patient/settings', label: 'Settings', icon: KeyRound },
    ],
    DOCTOR: [
        { to: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/doctor/patients', label: 'Patients', icon: Users },
        { to: '/doctor/upload', label: 'Upload Record', icon: Upload },
        { to: '/doctor/prescriptions/new', label: 'Prescribe', icon: FileSignature },
        { to: '/doctor/consultation/log', label: 'Log Consultation', icon: Stethoscope },
        { to: '/doctor/search', label: 'Search Records', icon: Search },
        { to: '/doctor/flag', label: 'Flag Record', icon: Flag },
        { to: '/emergency/request', label: 'Emergency Access', icon: AlertTriangle },
    ],
    HOSPITAL_ADMIN: [
        { to: '/hospital/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/hospital/doctors', label: 'Doctors', icon: Stethoscope },
        { to: '/hospital/api-console', label: 'API Console', icon: KeyRound },
        { to: '/hospital/emergency-verify', label: 'Emergency Approvals', icon: AlertTriangle },
    ],
    PLATFORM_ADMIN: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/verifications/hospitals', label: 'Hospitals', icon: Building2 },
        { to: '/admin/verifications/doctors', label: 'Doctors', icon: UserCheck },
        { to: '/admin/disputes', label: 'Disputes', icon: Scale },
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: FileSearch },
        { to: '/admin/system-health', label: 'System Health', icon: Gauge },
    ],
    EMERGENCY_PHYSICIAN: [
        { to: '/emergency/request', label: 'Emergency Access', icon: AlertTriangle },
    ],
};

const ROLE_LABEL: Record<string, string> = {
    PATIENT: 'Patient',
    DOCTOR: 'Doctor',
    HOSPITAL_ADMIN: 'Hospital Administrator',
    PLATFORM_ADMIN: 'Platform Administrator',
    EMERGENCY_PHYSICIAN: 'Emergency Physician',
};

/**
 * Shell for every authenticated screen.
 *
 * Before this existed there was no navigation and no way to sign out — each
 * page was a standalone island reachable only by typing a URL.
 */
const AppLayout = () => {
    const { role, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [unread, setUnread] = useState(0);

    const items = NAV_BY_ROLE[role ?? ''] ?? [];
    const currentItem = items.find((item) => item.to === location.pathname);

    useEffect(() => {
        if (role !== 'PATIENT') return;

        let cancelled = false;
        const load = async () => {
            try {
                const notifications = await api.get<Array<{ read_at: string | null }>>('/api/v1/notifications');
                if (!cancelled) setUnread(notifications.filter((n) => n.read_at === null).length);
            } catch {
                // A badge is not worth surfacing an error for.
            }
        };

        void load();
        const timer = setInterval(load, 60_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [role]);

    const signOut = async () => {
        // Ends the session server-side so the token stops working immediately,
        // rather than merely forgetting it locally.
        await api.post('/api/v1/auth/logout').catch(() => undefined);
        logout();
        navigate('/login');
    };

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            isActive ? 'bg-slate-900 text-white shadow-sm translate-x-1' : 'text-slate-600 hover:bg-slate-100'
        }`;

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Mobile overlay */}
            {menuOpen && (
                <button
                    aria-label="Close navigation"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
                />
            )}

            <aside
                className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform lg:translate-x-0 ${
                    menuOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-50 rounded-xl border border-blue-100">
                            <Shield className="text-blue-600 h-6 w-6" />
                        </div>
                        <span className="text-lg font-bold text-slate-900">MediLocker</span>
                    </Link>
                    <button
                        onClick={() => setMenuOpen(false)}
                        aria-label="Close navigation"
                        className="lg:hidden text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav aria-label="Main" className="flex-1 overflow-y-auto p-4 space-y-1">
                    {items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setMenuOpen(false)}
                                className={linkClass}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {item.to.endsWith('/notifications') && unread > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {unread}
                                    </span>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 space-y-3">
                    <div className="px-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signed in as</p>
                        <p className="text-sm font-semibold text-slate-800">{ROLE_LABEL[role ?? ''] ?? role}</p>
                    </div>
                    <button
                        onClick={signOut}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" /> Sign out
                    </button>
                    <div className="px-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>MediLocker v1.0.0</span>
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                        </span>
                    </div>
                </div>
            </aside>

            <div className="flex-1 min-w-0 flex flex-col">
                {/* Mobile header */}
                <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => setMenuOpen(true)}
                        aria-label="Open navigation"
                        className="text-slate-600 hover:text-slate-900"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <Shield className="text-blue-600 h-6 w-6" />
                    <span className="font-bold text-slate-900">MediLocker</span>
                    <Activity className="w-4 h-4 text-emerald-500 ml-auto" aria-hidden />
                </header>

                {/* Desktop top bar */}
                <header className="hidden lg:flex sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 py-3.5 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-800">
                            {currentItem?.label ?? ROLE_LABEL[role ?? ''] ?? 'Workspace'}
                        </span>
                        <span className="text-slate-300">/</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Ledger Integrity Active
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link
                            to="/verify"
                            className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50"
                        >
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>Public Verifier</span>
                        </Link>
                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                                {(ROLE_LABEL[role ?? ''] ?? role ?? 'U')[0]}
                            </div>
                            <span className="text-xs font-medium text-slate-700">
                                {ROLE_LABEL[role ?? ''] ?? role}
                            </span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 min-w-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
