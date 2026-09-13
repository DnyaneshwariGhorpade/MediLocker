import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

// ------------------------------------------------------------------ toasts

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    tone: ToastTone;
    message: string;
}

interface ToastContextValue {
    notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_STYLES: Record<ToastTone, { classes: string; Icon: typeof Info }> = {
    success: { classes: 'bg-emerald-600 text-white', Icon: CheckCircle2 },
    error: { classes: 'bg-red-600 text-white', Icon: AlertCircle },
    info: { classes: 'bg-slate-900 text-white', Icon: Info },
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const notify = useCallback((message: string, tone: ToastTone = 'info') => {
        const id = Date.now() + Math.random();
        setToasts((current) => [...current, { id, tone, message }]);
        setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 6000);
    }, []);

    const value = useMemo(() => ({ notify }), [notify]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Announced to assistive technology without stealing focus. */}
            <div
                role="status"
                aria-live="polite"
                className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm"
            >
                {toasts.map((toast) => {
                    const { classes, Icon } = TONE_STYLES[toast.tone];
                    return (
                        <div
                            key={toast.id}
                            className={`${classes} rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 text-sm font-medium`}
                        >
                            <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
                            <span className="flex-1">{toast.message}</span>
                            <button
                                onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
                                aria-label="Dismiss notification"
                                className="opacity-70 hover:opacity-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

// -------------------------------------------------------------- skeletons

export const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} aria-hidden />
);

export const CardSkeleton = () => (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
    </div>
);

export const LoadingState = ({ label = 'Loading' }: { label?: string }) => (
    <div role="status" aria-live="polite" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <span className="sr-only">{label}</span>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
    </div>
);

// ------------------------------------------------------------ empty state

export const EmptyState = ({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: React.ReactNode;
}) => (
    <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100">
        <p className="text-lg font-semibold text-slate-800">{title}</p>
        {description && <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
    </div>
);

// ------------------------------------------------------------ error banner

export const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div
        role="alert"
        className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-2xl p-4 flex items-start gap-3"
    >
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
        <span className="flex-1">{message}</span>
        {onRetry && (
            <button onClick={onRetry} className="font-semibold underline shrink-0">
                Retry
            </button>
        )}
    </div>
);
