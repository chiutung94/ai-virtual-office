// Google Sheets integration (server-side only).
// Uses a service account (JWT) — the private key never leaves the server.
import { JWT } from 'google-auth-library';
import { SHEETS, normKey, normaliseHeader, sheetSpec, type Row } from '../shared/workbook.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export function sheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let client: JWT | null = null;
function auth() {
  if (!sheetsConfigured()) throw new HttpError(412, 'Google Sheets is not configured on the server (.env).');
  if (!client) {
    client = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  return client;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  try {
    const res = await auth().request<T>({ url: `${API}/${id}${path}`, method: (init.method ?? 'GET') as 'GET', data: init.body });
    return res.data;
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { error?: { message?: string } } }; message: string };
    if (e instanceof HttpError) throw e;
    throw new HttpError(err.response?.status ?? 502, err.response?.data?.error?.message ?? err.message);
  }
}

const ref = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;
const colLetter = (n: number) => {
  let s = '';
  n++;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Verifies credentials and reports which expected worksheets exist. */
export async function testSheets() {
  const meta = await call<{ properties: { title: string }; sheets: { properties: { title: string } }[] }>('?fields=properties.title,sheets.properties.title');
  const present = meta.sheets.map((s) => s.properties.title);
  return { title: meta.properties.title, worksheets: present, missing: SHEETS.map((s) => s.sheet).filter((e) => !present.includes(e)) };
}

async function readValues(sheet: string): Promise<string[][]> {
  const data = await call<{ values?: string[][] }>(`/values/${encodeURIComponent(ref(sheet))}?valueRenderOption=FORMATTED_VALUE`);
  return data.values ?? [];
}

/** Header row = first row (within the first 10) containing the sheet's first key header. */
function headerRowIndex(values: string[][], keyHeader?: string) {
  if (!keyHeader) return 0;
  const k = normaliseHeader(keyHeader);
  for (let i = 0; i < Math.min(values.length, 10); i++) if (values[i].some((c) => normaliseHeader(String(c)) === k)) return i;
  return 0;
}

export async function readSheet(sheet: string) {
  const spec = sheetSpec(sheet);
  if (!spec) throw new HttpError(404, `Unknown worksheet ${sheet}`);
  const values = await readValues(sheet);
  if (!values.length) return { headers: [] as string[], rows: [] as Record<string, string>[], unmappedHeaders: [] as string[] };
  const hi = headerRowIndex(values, spec.keyHeaders[0]);
  const headers = values[hi].map(String);
  const rows = values.slice(hi + 1).filter((r) => r.some((c) => String(c).trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  const known = new Set(spec.headers.map(normaliseHeader));
  return { headers, rows, unmappedHeaders: headers.filter((h) => h && !known.has(normaliseHeader(h))) };
}

/**
 * Upsert header-keyed rows by the sheet's key headers. Only the app's columns are
 * written; other columns are untouched. Missing app headers are appended on the right.
 * With `scopeHeader`, rows for pushed scopes (e.g. an episode) whose key was not pushed
 * have their app columns cleared — used for scenes deleted in the app.
 */
export async function upsertSheet(sheet: string, rows: Row[]) {
  const spec = sheetSpec(sheet);
  if (!spec?.synced) throw new HttpError(400, `${sheet} is not writable by the app.`);
  const values = await readValues(sheet);
  const hi = values.length ? headerRowIndex(values, spec.keyHeaders[0]) : 0;
  const headers = values.length ? values[hi].map(String) : [];
  const data: { range: string; values: (string | number)[][] }[] = [];

  const col = new Map<string, number>();
  for (const h of spec.headers) {
    let i = headers.findIndex((x) => normaliseHeader(x) === normaliseHeader(h));
    if (i < 0) {
      headers.push(h);
      i = headers.length - 1;
      data.push({ range: `${ref(sheet)}!${colLetter(i)}${hi + 1}`, values: [[h]] });
    }
    col.set(h, i);
  }

  const keyOf = (get: (h: string) => unknown) => spec.keyHeaders.map((h) => normKey(get(h))).join('|');
  const existing = new Map<string, number>();
  values.slice(hi + 1).forEach((r, i) => {
    const k = keyOf((h) => r[col.get(h)!]);
    if (k.replace(/\|/g, '')) existing.set(k, hi + 1 + i);
  });

  let nextRow = Math.max(values.length, hi + 1);
  let updated = 0, appended = 0, cleared = 0;
  const pushedKeys = new Set<string>();
  const writeRow = (rowIdx: number, row: Row | null) => {
    for (const h of spec.headers) data.push({ range: `${ref(sheet)}!${colLetter(col.get(h)!)}${rowIdx + 1}`, values: [[row ? row[h] ?? '' : '']] });
  };
  for (const row of rows) {
    const key = keyOf((h) => row[h]);
    if (!key.replace(/\|/g, '')) continue;
    pushedKeys.add(key);
    let idx = existing.get(key);
    if (idx === undefined) { idx = nextRow++; appended++; } else updated++;
    writeRow(idx, row);
  }
  if (spec.scopeHeader) {
    const scopes = new Set(rows.map((r) => normKey(r[spec.scopeHeader!])));
    const sc = col.get(spec.scopeHeader)!;
    values.slice(hi + 1).forEach((r, i) => {
      const k = keyOf((h) => r[col.get(h)!]);
      if (scopes.has(normKey(r[sc])) && !pushedKeys.has(k)) { writeRow(hi + 1 + i, null); cleared++; }
    });
  }
  if (data.length) await call(`/values:batchUpdate`, { method: 'POST', body: { valueInputOption: 'RAW', data } });
  return { updated, appended, cleared };
}
