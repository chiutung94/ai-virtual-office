// Moves data between the app and the workbook — via Google Sheets (server) or a local .xlsx file.
import { IMPORT_ORDER, SYNCED_SHEETS, fromRows, sheetSpec, toRows, type WorkbookState } from '../../shared/workbook';
import { api } from './api';
import { readXlsx, gridToRows } from './xlsx';
import { uid, useStore } from '../store/store';

export { SYNCED_SHEETS };

const snapshot = (): WorkbookState => {
  const s = useStore.getState();
  return { project: s.project, episodes: s.episodes, characters: s.characters, locations: s.locations, assets: s.assets, scriptVersions: s.scriptVersions, shots: s.shots, publishing: s.publishing, analytics: s.analytics, continuity: s.continuity, scriptRuns: s.scriptRuns };
};
const apply = (patch: Partial<WorkbookState>) => useStore.getState().applyWorkbookPatch(patch);

export async function pushSheet(sheet: string) {
  return api.upsertSheet(sheet, toRows(sheet, snapshot()));
}

export async function pullSheet(sheet: string) {
  const res = await api.readSheet(sheet);
  const r = fromRows(sheet, res.rows, snapshot(), uid);
  apply(r.patch);
  return { rows: r.rows, unmappedHeaders: res.unmappedHeaders, note: r.note };
}

export interface FileImportReport {
  sheet: string;
  rows: number;
  note: string;
  missing?: boolean;
  unmappedHeaders: string[];
}

/** Import every worksheet from a local .xlsx (exported from Google Sheets or Excel). */
export async function importWorkbookFile(file: File): Promise<FileImportReport[]> {
  const wb = readXlsx(await file.arrayBuffer());
  const report: FileImportReport[] = [];
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const sheet of IMPORT_ORDER) {
    const spec = sheetSpec(sheet)!;
    const grid = wb.sheets[sheet];
    if (!grid) { report.push({ sheet, rows: 0, note: 'Worksheet not found in file', missing: true, unmappedHeaders: [] }); continue; }
    const rows = gridToRows(grid, spec.keyHeaders[0]);
    const headers = Object.keys(rows[0] ?? {});
    const known = new Set(spec.headers.map(norm));
    const r = fromRows(sheet, rows, snapshot(), uid);
    apply(r.patch);
    report.push({ sheet, rows: r.rows, note: r.note, unmappedHeaders: headers.filter((h) => h && !known.has(norm(h))) });
  }
  return report;
}
