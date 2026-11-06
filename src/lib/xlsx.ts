// Minimal .xlsx reader (values only) — runs entirely in the browser, so workbook
// content never leaves the user's machine. Handles shared strings, inline strings,
// numbers, booleans and date-formatted cells.
import { unzipSync, strFromU8 } from 'fflate';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const byTag = (el: Document | Element, tag: string) => Array.from(el.getElementsByTagNameNS('*', tag));

function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
const textOf = (el: Element) => byTag(el, 't').map((t) => t.textContent ?? '').join('');

/** Excel serial date → yyyy-mm-dd (or yyyy-mm-dd HH:mm when fractional). */
function serialToIso(n: number) {
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const iso = d.toISOString();
  return n % 1 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
}
const isTimeOnly = (n: number) => n > 0 && n < 1;
const serialToTime = (n: number) => { const m = Math.round(n * 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export interface ParsedWorkbook {
  sheets: Record<string, string[][]>;
}

export function readXlsx(buf: ArrayBuffer): ParsedWorkbook {
  const files = unzipSync(new Uint8Array(buf));
  const get = (p: string) => (files[p] ? strFromU8(files[p]) : '');
  if (!files['xl/workbook.xml']) throw new Error('Not an .xlsx workbook');

  const shared = get('xl/sharedStrings.xml') ? byTag(parse(get('xl/sharedStrings.xml')), 'si').map(textOf) : [];

  // Which number formats are dates
  const dateStyles = new Set<number>();
  if (get('xl/styles.xml')) {
    const st = parse(get('xl/styles.xml'));
    const customDate = new Set(byTag(st, 'numFmt').filter((f) => /[dmyhs]/i.test((f.getAttribute('formatCode') ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, ''))).map((f) => Number(f.getAttribute('numFmtId'))));
    const xfs = byTag(st, 'cellXfs')[0];
    if (xfs) byTag(xfs, 'xf').forEach((xf, i) => {
      const id = Number(xf.getAttribute('numFmtId'));
      if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || customDate.has(id)) dateStyles.add(i);
    });
  }

  const wb = parse(get('xl/workbook.xml'));
  const rels = parse(get('xl/_rels/workbook.xml.rels'));
  const relTarget = new Map(byTag(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']));
  const out: Record<string, string[][]> = {};
  for (const s of byTag(wb, 'sheet')) {
    const name = s.getAttribute('name') ?? '';
    const rid = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = relTarget.get(rid) ?? '';
    target = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = get(target);
    if (!xml) continue;
    const rows: string[][] = [];
    for (const row of byTag(parse(xml), 'row')) {
      const r = Number(row.getAttribute('r')) - 1;
      const cells: string[] = [];
      for (const c of byTag(row, 'c')) {
        const ci = colIndex(c.getAttribute('r') ?? 'A1');
        const t = c.getAttribute('t');
        const v = byTag(c, 'v')[0]?.textContent ?? '';
        let val = '';
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(c);
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'str' || t === 'e') val = v;
        else if (v !== '') {
          const n = Number(v);
          const style = Number(c.getAttribute('s') ?? -1);
          val = dateStyles.has(style) ? (isTimeOnly(n) ? serialToTime(n) : serialToIso(n)) : Number.isInteger(n) ? String(n) : String(+n.toFixed(6));
        }
        cells[ci] = val;
      }
      rows[r] = Array.from(cells, (x) => x ?? '');
    }
    out[name] = Array.from(rows, (x) => x ?? []);
  }
  return { sheets: out };
}

/** Turn a sheet grid into header-keyed rows, locating the header row by a key header. */
export function gridToRows(grid: string[][], keyHeader?: string): Record<string, string>[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let hi = 0;
  if (keyHeader) {
    const k = norm(keyHeader);
    const found = grid.slice(0, 10).findIndex((r) => r.some((c) => norm(c) === k));
    if (found >= 0) hi = found;
  }
  const headers = grid[hi] ?? [];
  return grid.slice(hi + 1).filter((r) => r.some((c) => c && c.trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}
