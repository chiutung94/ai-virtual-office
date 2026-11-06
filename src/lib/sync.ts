// Google Sheets sync — maps store collections to workbook worksheets.
// All requests go through the server (/api/sheets); no credentials in the browser.
import { WORKBOOK_SHEETS, fromRow, sheetDef } from '../../shared/sheetSchema';
import { PUBLISH_STATUSES, WORK_STATUSES, type ApprovalStage, type Episode, type Scene, type ScriptVersion } from '../../shared/types';
import { api } from './api';
import { latestScript, now, uid, useStore, type Collections } from '../store/store';

const APPROVAL: ApprovalStage[] = ['Draft', 'Under Review', 'Changes Requested', 'Approved', 'In Production', 'Final Review', 'Ready to Publish', 'Published', 'Rejected'];
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = String(v ?? '').trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === s) ?? fallback;
};

export const SYNCED_SHEETS = WORKBOOK_SHEETS.filter((s) => s.synced).map((s) => s.sheet);

function scriptRows() {
  const st = useStore.getState();
  return st.episodes.flatMap((e) => {
    const v = latestScript(st.scriptVersions, e.id);
    if (!v) return [];
    const nm = (id: string) => st.characters.find((c) => c.id === id)?.nameZh.split(' / ')[0] ?? '';
    return v.scenes.map((sc) => ({
      rowKey: `${e.id}-S${String(sc.number).padStart(2, '0')}`, episodeId: e.id, version: v.version, number: sc.number, locationId: sc.locationId,
      timeOfDay: sc.timeOfDay, characterIds: sc.characterIds, visualAction: sc.visualAction, camera: sc.camera, sfx: sc.sfx, duration: sc.duration,
      dialogueZh: sc.dialogue.map((d) => `${d.characterId} ${nm(d.characterId)}：${d.zh}`).join('\n'),
      dialogueEn: sc.dialogue.map((d) => `${d.characterId}: ${d.en}`).join('\n'),
    }));
  });
}

export function recordsFor(sheet: string): Record<string, unknown>[] {
  const st = useStore.getState();
  switch (sheet) {
    case 'EPISODES': return st.episodes as unknown as Record<string, unknown>[];
    case 'CHARACTERS': return st.characters as unknown as Record<string, unknown>[];
    case 'LOCATIONS': return st.locations as unknown as Record<string, unknown>[];
    case 'ASSETS': return st.assets as unknown as Record<string, unknown>[];
    case 'SCRIPTS': return scriptRows();
    case 'SHOT_LIST': return st.shots as unknown as Record<string, unknown>[];
    case 'PRODUCTION': return st.clips.map((c) => ({ ...c, clipUrl: c.clipUrl.startsWith('blob:') ? '' : c.clipUrl }));
    case 'PUBLISHING': return st.publishing as unknown as Record<string, unknown>[];
    case 'ANALYTICS': return st.analytics as unknown as Record<string, unknown>[];
    case 'SCRIPT_RUNS': return st.scriptVersions.map(({ id, episodeId, version, source, savedBy, savedAt, note }) => ({ id, episodeId, version, source, savedBy, savedAt, note }));
    default: return [];
  }
}

export async function pushSheet(sheet: string) {
  const r = await api.upsertSheet(sheet, recordsFor(sheet));
  return r;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: Partial<T>[]): T[] {
  const map = new Map(existing.map((e) => [e.id, e]));
  for (const inc of incoming) {
    if (!inc.id) continue;
    const clean = Object.fromEntries(Object.entries(inc).filter(([, v]) => v !== '' && v !== undefined));
    map.set(inc.id, { ...(map.get(inc.id) ?? ({} as T)), ...clean } as T);
  }
  return [...map.values()];
}

/** Pull one worksheet into local state. Returns counts and unmapped headers for the UI. */
export async function pullSheet(sheet: string) {
  const def = sheetDef(sheet)!;
  const res = await api.readSheet(sheet);
  const objs = res.rows.map((r) => fromRow(def, r));
  const st = useStore.getState();
  const set = <K extends keyof Collections>(k: K, v: Collections[K]) => st.replaceCollection(k, v);

  switch (sheet) {
    case 'EPISODES': {
      const eps = objs.filter((o) => o.id).map((o) => {
        const ex = st.episodes.find((e) => e.id === o.id);
        const base: Episode = ex ?? { id: String(o.id), number: Number(String(o.id).replace(/\D/g, '')) || 0, titleZh: '', titleEn: '', synopsis: '', arc: '', scriptStatus: 'Not Started', storyboardStatus: 'Not Started', videoStatus: 'Not Started', editingStatus: 'Not Started', approvalStatus: 'Draft', publishingStatus: 'Not Scheduled', targetPublishDate: '', targetDuration: 70, updatedAt: now() };
        return {
          ...base, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '')),
          scriptStatus: pick(o.scriptStatus, WORK_STATUSES, base.scriptStatus),
          storyboardStatus: pick(o.storyboardStatus, WORK_STATUSES, base.storyboardStatus),
          videoStatus: pick(o.videoStatus, WORK_STATUSES, base.videoStatus),
          editingStatus: pick(o.editingStatus, WORK_STATUSES, base.editingStatus),
          approvalStatus: pick(o.approvalStatus, APPROVAL, base.approvalStatus),
          publishingStatus: pick(o.publishingStatus, PUBLISH_STATUSES, base.publishingStatus),
          number: Number(o.number) || base.number,
          targetDuration: Number(o.targetDuration) || base.targetDuration,
        } as Episode;
      });
      set('episodes', mergeById(st.episodes, eps).sort((a, b) => a.number - b.number));
      break;
    }
    case 'CHARACTERS': set('characters', mergeById(st.characters, objs as never)); break;
    case 'LOCATIONS': set('locations', mergeById(st.locations, objs as never)); break;
    case 'ASSETS': set('assets', mergeById(st.assets, objs as never)); break;
    case 'SHOT_LIST': set('shots', mergeById(st.shots, objs as never)); break;
    case 'PRODUCTION': set('clips', mergeById(st.clips, objs as never)); break;
    case 'PUBLISHING': set('publishing', mergeById(st.publishing, objs as never)); break;
    case 'ANALYTICS': set('analytics', mergeById(st.analytics, objs.map((o) => ({ ...o, source: 'sheets' })) as never)); break;
    case 'SCRIPTS': {
      // Group scene rows per episode and import as a new version if it differs from local.
      const byEp = new Map<string, Record<string, unknown>[]>();
      objs.forEach((o) => { if (o.episodeId) byEp.set(String(o.episodeId), [...(byEp.get(String(o.episodeId)) ?? []), o]); });
      const added: ScriptVersion[] = [];
      for (const [ep, rows] of byEp) {
        const scenes: Scene[] = rows.sort((a, b) => Number(a.number) - Number(b.number)).map((r) => {
          const zh = String(r.dialogueZh ?? '').split('\n').filter(Boolean);
          const en = String(r.dialogueEn ?? '').split('\n').filter(Boolean);
          return {
            id: uid('sc'), number: Number(r.number), locationId: String(r.locationId || 'L01'), timeOfDay: String(r.timeOfDay || 'Day'),
            characterIds: (r.characterIds as string[]) ?? [], visualAction: String(r.visualAction ?? ''), camera: String(r.camera ?? ''), sfx: String(r.sfx ?? ''), duration: Number(r.duration) || 10,
            dialogue: zh.map((line, i) => {
              const m = line.match(/^(C\d+)[^:：]*[:：]\s*(.*)$/);
              const em = (en[i] ?? '').match(/^(C\d+)\s*[:：]\s*(.*)$/);
              return { id: uid('dl'), characterId: m?.[1] ?? 'C01', zh: m?.[2] ?? line, en: em?.[2] ?? en[i] ?? '' };
            }),
          };
        });
        const local = latestScript(useStore.getState().scriptVersions, ep);
        const strip = (sc: Scene[]) => JSON.stringify(sc.map((x) => ({ ...x, id: '', dialogue: x.dialogue.map((d) => ({ c: d.characterId, zh: d.zh, en: d.en })) })));
        if (!local || strip(local.scenes) !== strip(scenes)) {
          added.push({ id: uid('sv'), episodeId: ep, version: (local?.version ?? 0) + 1, scenes, savedAt: now(), savedBy: 'Google Sheets import', note: 'Imported from SCRIPTS worksheet', source: 'manual' });
        }
      }
      if (added.length) set('scriptVersions', [...useStore.getState().scriptVersions, ...added]);
      return { rows: res.rows.length, unmappedHeaders: res.unmappedHeaders, note: `${added.length} script versions imported` };
    }
    default: break;
  }
  return { rows: res.rows.length, unmappedHeaders: res.unmappedHeaders, note: '' };
}
