import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

/**
 * Catches render-time crashes so one broken screen does not blank the whole
 * application. Without this, an unexpected shape in an API response takes the
 * entire portal down to a white page.
 */
class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Unhandled render error:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 max-w-lg w-full p-8 text-center">
                    <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5">
                        <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong on this screen</h1>
                    <p className="text-sm text-slate-500 mb-6">
                        The rest of the application is unaffected. Reloading usually clears it; if it keeps
                        happening, the message below helps diagnose it.
                    </p>
                    <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs text-slate-600 overflow-x-auto mb-6">
                        {this.state.error.message}
                    </pre>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => this.setState({ error: null })}
                            className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-700 hover:bg-slate-100"
                        >
                            Try again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
                        >
                            Reload
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
