// Thin client for the server API. The browser never holds third-party keys.
import type { IntegrationStatus } from '../../shared/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'Backend server unreachable. Running in local demo mode.');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Static hosting without the API returns HTML (e.g. index.html fallback)
    throw new ApiError(res.status || 0, 'Backend server not available at /api.');
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `HTTP ${res.status}`);
  return data as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  health: () => req<{ ok: boolean }>('/api/health'),
  integrations: () => req<IntegrationStatus[]>('/api/integrations'),
  testIntegration: (id: string) => req<IntegrationStatus>(`/api/integrations/${id}/test`, { method: 'POST' }),
  readSheet: (sheet: string) =>
    req<{ headers: string[]; rows: Record<string, string>[]; unmappedHeaders: string[] }>(`/api/sheets/${encodeURIComponent(sheet)}`),
  upsertSheet: (sheet: string, rows: unknown[]) =>
    req<{ updated: number; appended: number; cleared: number }>(`/api/sheets/${encodeURIComponent(sheet)}/upsert`, json({ rows })),
  makeEvent: (event: string, payload: unknown) => req<{ ok: boolean }>(`/api/make/${event}`, json(payload)),
  generateScript: (payload: unknown) =>
    req<{ scenes: unknown[]; model: string; usage: unknown }>('/api/ai/generate-script', json(payload)),
  upload: (file: File) =>
    req<{ url: string; size: number; name: string }>('/api/uploads', {
      method: 'POST',
      headers: { 'x-file-name': file.name, 'Content-Type': 'application/octet-stream' },
      body: file,
    }),
};
