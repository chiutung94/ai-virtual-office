// Google Sheets integration (server-side only).
// Uses a service account (JWT) — the private key never leaves the server.
import { JWT } from 'google-auth-library';
import { WORKBOOK_SHEETS, resolveHeader, sheetDef, toRow } from '../shared/sheetSchema.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export function sheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
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

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const res = await auth().request<T>({
    url: `${API}/${id}${path}`,
    method: (init.method ?? 'GET') as 'GET',
    data: init.body,
  }).catch((e: { response?: { status?: number; data?: { error?: { message?: string } } }; message: string }) => {
    throw new HttpError(e.response?.status ?? 502, e.response?.data?.error?.message ?? e.message);
  });
  return res.data;
}

const q = (sheet: string) => encodeURIComponent(`'${sheet.replace(/'/g, "''")}'`);

/** Verifies credentials and reports which expected worksheets exist. */
export async function testSheets() {
  const meta = await call<{ properties: { title: string }; sheets: { properties: { title: string } }[] }>(
    '?fields=properties.title,sheets.properties.title',
  );
  const present = meta.sheets.map((s) => s.properties.title);
  const expected = WORKBOOK_SHEETS.map((s) => s.sheet);
  return {
    title: meta.properties.title,
    worksheets: present,
    missing: expected.filter((e) => !present.includes(e)),
  };
}

async function readValues(sheet: string): Promise<string[][]> {
  const data = await call<{ values?: string[][] }>(`/values/${q(sheet)}?valueRenderOption=FORMATTED_VALUE`);
  return data.values ?? [];
}

/** Find the header row: first row within the first 10 that contains the key header. */
function findHeaderRow(values: string[][], keyHeaderCandidates: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = new Set(keyHeaderCandidates.map(norm));
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    if (values[i].some((c) => wanted.has(norm(String(c))))) return i;
  }
  return 0;
}

export async function readSheet(sheet: string) {
  const def = sheetDef(sheet);
  if (!def) throw new HttpError(404, `Unknown worksheet ${sheet}`);
  const values = await readValues(sheet);
  if (!values.length) return { headers: [], rows: [], unmappedHeaders: [] };
  const keyCol = def.columns.find((c) => c.field === def.key);
  const hi = findHeaderRow(values, keyCol ? [keyCol.header, ...(keyCol.aliases ?? [])] : []);
  const headers = values[hi].map(String);
  const rows = values
    .slice(hi + 1)
    .filter((r) => r.some((c) => String(c).trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  const mapped = new Set(def.columns.map((c) => resolveHeader(c, headers)).filter(Boolean));
  return { headers, rows, unmappedHeaders: headers.filter((h) => h && !mapped.has(h)) };
}

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

/**
 * Upsert app records into a worksheet by key. Only mapped columns are
 * written; any other columns in the workbook are left untouched.
 * Missing mapped headers are appended to the right of the header row.
 */
export async function upsertSheet(sheet: string, records: Record<string, unknown>[]) {
  const def = sheetDef(sheet);
  if (!def || !def.synced) throw new HttpError(400, `${sheet} is not writable by the app.`);
  const values = await readValues(sheet);
  const keyCol = def.columns.find((c) => c.field === def.key)!;
  const hi = values.length ? findHeaderRow(values, [keyCol.header, ...(keyCol.aliases ?? [])]) : 0;
  const headers = values.length ? values[hi].map(String) : [];
  const headerUpdates: { range: string; values: string[][] }[] = [];
  const sheetRef = `'${sheet.replace(/'/g, "''")}'`;

  // Ensure every mapped column has a header.
  const colIndex = new Map<string, number>();
  for (const c of def.columns) {
    let h = resolveHeader(c, headers);
    if (!h) {
      headers.push(c.header);
      h = c.header;
      headerUpdates.push({ range: `${sheetRef}!${colLetter(headers.length - 1)}${hi + 1}`, values: [[c.header]] });
    }
    colIndex.set(c.field, headers.indexOf(h));
  }

  const keyIdx = colIndex.get(def.key)!;
  const existing = new Map<string, number>();
  values.slice(hi + 1).forEach((r, i) => {
    const k = String(r[keyIdx] ?? '').trim();
    if (k) existing.set(k, hi + 1 + i);
  });

  const data: { range: string; values: (string | number | boolean)[][] }[] = [...headerUpdates];
  let nextRow = Math.max(values.length, hi + 1);
  let updated = 0;
  let appended = 0;
  for (const rec of records) {
    const row = toRow(def, rec);
    const key = String(rec[def.key] ?? '');
    if (!key) continue;
    let rowIdx = existing.get(key);
    if (rowIdx === undefined) {
      rowIdx = nextRow++;
      appended++;
    } else updated++;
    for (const c of def.columns) {
      const ci = colIndex.get(c.field)!;
      data.push({ range: `${sheetRef}!${colLetter(ci)}${rowIdx + 1}`, values: [[row[c.header]]] });
    }
  }
  if (data.length) {
    await call(`/values:batchUpdate`, { method: 'POST', body: { valueInputOption: 'USER_ENTERED', data } });
  }
  return { updated, appended };
}
