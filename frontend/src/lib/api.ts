/**
 * Single entry point for every API call.
 *
 * Replaces roughly sixty hand-written `fetch` calls that each re-pasted the
 * bearer token. Centralising it means the auth header, error shape and 401
 * handling are defined once.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Where the token lives. Kept in one place so the layout can clear it too. */
const TOKEN_KEY = 'token';
const ROLE_KEY = 'role';

export class ApiError extends Error {
    readonly status: number;
    readonly details: Array<{ path: string; message: string }> | undefined;
    readonly requestId: string | undefined;

    constructor(
        status: number,
        message: string,
        details?: Array<{ path: string; message: string }>,
        requestId?: string
    ) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
        this.requestId = requestId;
    }

    /** Flattens field-level validation detail into one readable line. */
    get detailText(): string {
        if (!this.details?.length) return this.message;
        return `${this.message} — ${this.details.map((d) => `${d.path}: ${d.message}`).join('; ')}`;
    }
}

type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
    }
};

/** Lets the app route a session expiry through React rather than a hard reload. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler): void {
    onSessionExpired = handler;
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    /** Send as multipart instead of JSON. */
    form?: FormData;
    signal?: AbortSignal;
    /** Skip the automatic logout on 401, e.g. for the login call itself. */
    allowUnauthenticated?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = {};

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body !== undefined && !options.form) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${BASE_URL}${path}`, {
        method: options.method ?? (options.body || options.form ? 'POST' : 'GET'),
        headers,
        body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        ...(options.signal ? { signal: options.signal } : {}),
    });

    // A revoked or expired session must not look like a generic failure.
    if (response.status === 401 && !options.allowUnauthenticated) {
        onSessionExpired();
        throw new ApiError(401, 'Your session has ended. Sign in again.');
    }

    if (response.status === 204) return undefined as T;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        if (!response.ok) {
            throw new ApiError(response.status, `Request failed with status ${response.status}`);
        }
        return (await response.text()) as T;
    }

    const payload = await response.json();

    if (!response.ok) {
        throw new ApiError(
            response.status,
            payload.message ?? `Request failed with status ${response.status}`,
            payload.details,
            payload.requestId
        );
    }

    return payload as T;
}

export const api = {
    get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', ...(signal ? { signal } : {}) }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),

    /** Login and MFA must not trigger the session-expiry redirect on 401. */
    authPost: <T>(path: string, body: unknown) =>
        request<T>(path, { method: 'POST', body, allowUnauthenticated: true }),

    /**
     * Escape hatch returning the raw `Response`.
     *
     * Pages written before the typed helpers existed inspect `res.ok` and call
     * `res.json()` themselves. This gives them the shared base URL, auth header
     * and session-expiry handling without rewriting their control flow. Prefer
     * the typed helpers above for new code.
     */
    async raw(path: string, init: RequestInit = {}): Promise<Response> {
        const token = localStorage.getItem(TOKEN_KEY);
        const headers = new Headers(init.headers);

        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

        if (response.status === 401 && token) {
            onSessionExpired();
        }

        return response;
    },

    /** Fetches a file as a blob, respecting the same auth and error handling. */
    async download(path: string): Promise<{ blob: Blob; filename: string }> {
        const token = localStorage.getItem(TOKEN_KEY);
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (response.status === 401) {
            onSessionExpired();
            throw new ApiError(401, 'Your session has ended. Sign in again.');
        }

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new ApiError(response.status, payload.message ?? 'Download failed');
        }

        const disposition = response.headers.get('content-disposition') ?? '';
        const filename = disposition.match(/filename="(.+?)"/)?.[1] ?? 'download';
        return { blob: await response.blob(), filename };
    },
};
