import type {
  Framing,
  HealthResponse,
  PersonaRecord,
  RefineFramingRequest,
  RunListResponse,
  RunSnapshot,
  SeatRecord,
} from './model';
import { readStorage, writeStorage } from '../lib/storage';

const TOKEN_KEY = 'chatprfaq.ownerToken';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
  get needsOwnerToken(): boolean {
    return this.status === 401;
  }
}

export function getOwnerToken(): string {
  return readStorage(TOKEN_KEY) ?? '';
}

export function setOwnerToken(token: string): void {
  writeStorage(TOKEN_KEY, token.trim() || null);
}

function authHeaders(): Record<string, string> {
  const token = getOwnerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') detail = body.detail;
    else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg ?? '').join('; ');
  } catch {
    /* not JSON */
  }
  if (res.status === 401) detail = 'This backend requires an owner token. Add it under Settings in the run library.';
  else if (res.status === 502 || res.status === 504) detail = 'The backend is not reachable. Is it running on port 8000?';
  else if (res.status === 404 && detail === 'Not Found') detail = 'Not found.';
  return new ApiError(res.status, detail);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) throw await errorFromResponse(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type ExportFormat = 'md' | 'plan' | 'redline' | 'json';

export const api = {
  createRun(idea: string): Promise<{ run_id: string }> {
    return request('/api/runs', { method: 'POST', body: JSON.stringify({ idea }) });
  },
  getRun(runId: string): Promise<RunSnapshot> {
    return request(`/api/runs/${encodeURIComponent(runId)}`);
  },
  getShared(token: string): Promise<RunSnapshot> {
    return request(`/api/share/${encodeURIComponent(token)}`);
  },
  listRuns(limit = 25, cursor?: string | null): Promise<RunListResponse> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (cursor) qs.set('cursor', cursor);
    return request(`/api/runs?${qs.toString()}`);
  },
  refineFraming(runId: string, body: RefineFramingRequest): Promise<void> {
    return request(`/api/runs/${encodeURIComponent(runId)}/framing/refine`, { method: 'POST', body: JSON.stringify(body) });
  },
  confirmFraming(runId: string, framing?: Framing): Promise<void> {
    return request(`/api/runs/${encodeURIComponent(runId)}/framing/confirm`, {
      method: 'POST',
      body: JSON.stringify(framing ? { framing } : {}),
    });
  },
  cancelRun(runId: string): Promise<void> {
    return request(`/api/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
  },
  resumeRun(runId: string): Promise<void> {
    return request(`/api/runs/${encodeURIComponent(runId)}/resume`, { method: 'POST' });
  },
  roster(): Promise<PersonaRecord[]> {
    return request('/api/roster');
  },
  seats(): Promise<SeatRecord[]> {
    return request('/api/seats');
  },
  health(): Promise<HealthResponse> {
    return request('/api/health');
  },
  exportUrl(runId: string, format: ExportFormat, fromVersion?: number, toVersion?: number): string {
    const qs = new URLSearchParams({ format });
    if (fromVersion) qs.set('from_version', String(fromVersion));
    if (toVersion) qs.set('to_version', String(toVersion));
    return `/api/runs/${encodeURIComponent(runId)}/export?${qs.toString()}`;
  },
  async fetchExport(runId: string, format: ExportFormat, fromVersion?: number, toVersion?: number): Promise<{ text: string; filename: string }> {
    const res = await fetch(api.exportUrl(runId, format, fromVersion, toVersion), { headers: authHeaders() });
    if (!res.ok) throw await errorFromResponse(res);
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const m = disposition.match(/filename="([^"]+)"/);
    const ext = format === 'json' ? 'json' : 'md';
    return { text: await res.text(), filename: m ? m[1] : `${runId}-${format}.${ext}` };
  },
};
