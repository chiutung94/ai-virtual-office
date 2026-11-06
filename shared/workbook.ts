// Exact mapping between the app and the workbook "AI OFFICE – DRAMA PRODUCTION HQ".
// Used by the Google Sheets sync (server upsert) and the .xlsx import.
//
// Headers below are the workbook's real headers. Matching is tolerant of
// case/spaces/underscores. Columns not listed are never modified.

import {
  type ApprovalStage, type Asset, type Character, type Continuity, type DialogueLine, type Episode, type GenerationStatus,
  type Location, type Platform, type Project, type PublishEntry, type PublishStatus, type Scene, type ScriptRun, type ScriptVersion,
  type Shot, type WorkStatus, type AnalyticsEntry, GENERATION_STATUSES, PUBLISH_STATUSES, PIPELINE,
} from './types.js';

export type Row = Record<string, string | number>;

export const normaliseHeader = (h: string) => String(h).toLowerCase().replace(/[^a-z0-9一-鿿]/g, '');

export interface SheetSpec {
  sheet: string;
  description: string;
  headers: string[]; // exact workbook headers this app reads/writes
  keyHeaders: string[]; // row identity (composite allowed)
  synced: boolean; // false = reference-only, never written
  /** On push, rows whose `scopeHeader` value was pushed but whose key wasn't are cleared (e.g. deleted scenes). */
  scopeHeader?: string;
}

export const SHEETS: SheetSpec[] = [
  { sheet: 'START_HERE', description: 'Project brief and status vocabulary. Reference only.', headers: [], keyHeaders: [], synced: false },
  {
    sheet: 'EPISODES', description: 'Master episode list with titles, loglines, cliffhangers, schedule, captions and per-platform status.', synced: true, keyHeaders: ['episode_id'],
    headers: ['episode_id', 'episode_no', 'title_cn', 'title_en', 'arc', 'logline', 'script_status', 'runtime_target_sec', 'publish_date', 'publish_time_myt', 'caption_cn', 'caption_en', 'cliffhanger', 'review_notes', 'final_video_url', 'instagram_status', 'tiktok_status'],
  },
  {
    sheet: 'CHARACTERS', description: 'Character bible: appearance, wardrobe and voice locks, reference image URLs.', synced: true, keyHeaders: ['character_id'],
    headers: ['character_id', 'name_cn', 'name_en', 'age', 'role', 'appearance_lock', 'wardrobe_lock', 'voice_direction', 'master_portrait_url', 'full_body_url', 'expression_sheet_url', 'notes'],
  },
  {
    sheet: 'LOCATIONS', description: 'Recurring sets.', synced: true, keyHeaders: ['location_id'],
    headers: ['location_id', 'name_cn', 'name_en', 'visual_description', 'reference_image_url', 'continuity_notes'],
  },
  {
    sheet: 'SCRIPTS', description: 'One row per scene of the current script.', synced: true, keyHeaders: ['episode_id', 'scene_no'], scopeHeader: 'episode_id',
    headers: ['episode_id', 'scene_no', 'scene_title', 'duration_sec', 'location_id', 'characters', 'visual_action', 'dialogue_cn', 'subtitle_en', 'camera_direction', 'sound_notes', 'approved'],
  },
  {
    sheet: 'SHOT_LIST', description: 'Shot prompts and Kling generation tracking (one row per generated clip).', synced: true, keyHeaders: ['shot_id'],
    headers: ['shot_id', 'episode_id', 'scene_no', 'shot_no', 'character_ids', 'reference_asset_urls', 'prompt', 'negative_prompt', 'duration_sec', 'aspect_ratio', 'resolution', 'generation_status', 'kling_task_id', 'video_url', 'retry_count', 'notes', 'kling_units'],
  },
  {
    sheet: 'ASSETS', description: 'Reference images, music, SFX and other files.', synced: true, keyHeaders: ['asset_id'],
    headers: ['asset_id', 'episode_id', 'asset_type', 'character_or_scene', 'file_url', 'version', 'approved', 'created_at', 'notes'],
  },
  {
    sheet: 'PRODUCTION', description: 'Per-episode department status board.', synced: true, keyHeaders: ['episode_id'],
    headers: ['episode_id', 'script_status', 'storyboard_status', 'video_status', 'edit_status', 'approval_status', 'owner', 'last_updated', 'blocker'],
  },
  {
    sheet: 'PUBLISHING', description: 'One row per episode × platform. Manual approval required before posting.', synced: true, keyHeaders: ['episode_id', 'platform'],
    headers: ['episode_id', 'platform', 'caption', 'hashtags', 'cover_url', 'video_url', 'scheduled_at_myt', 'status', 'platform_post_id', 'published_url', 'notes'],
  },
  {
    sheet: 'ANALYTICS', description: 'Real post metrics (24h views etc.).', synced: true, keyHeaders: ['episode_id', 'platform', 'posted_at'],
    headers: ['episode_id', 'platform', 'posted_at', 'views_24h', 'avg_watch_sec', 'completion_rate', 'likes', 'comments', 'shares', 'saves', 'followers_gained', 'notes'],
  },
  {
    sheet: 'CONTINUITY', description: 'Story continuity per episode — facts, state changes, wardrobe, open questions.', synced: true, keyHeaders: ['episode_id'],
    headers: ['episode_id', 'timeline_date', 'facts_established', 'character_state_changes', 'props_costume_changes', 'unresolved_questions', 'next_episode_constraints'],
  },
  {
    sheet: 'SCRIPT_RUNS', description: 'Make.com AI script queue (HOLD → GENERATE → REVIEW → human approval).', synced: true, keyHeaders: ['run_id'],
    headers: ['run_id', 'episode_id', 'queue_status', 'model', 'prompt_version', 'output_json', 'created_at', 'error_message', 'human_approval'],
  },
  { sheet: 'MAKE_SETUP', description: 'Make.com scenario instructions. Reference only.', headers: [], keyHeaders: [], synced: false },
];
export const sheetSpec = (name: string) => SHEETS.find((s) => s.sheet === name);
export const SYNCED_SHEETS = SHEETS.filter((s) => s.synced).map((s) => s.sheet);

/* ── value codecs ──────────────────────────────────────────── */
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
/** "1.0" → "1" so keys match between xlsx exports and Sheets API values. */
export const normKey = (v: unknown) => { const s = str(v); return /^-?\d+(\.0+)?$/.test(s) ? String(Number(s)) : s; };
const num = (v: unknown, d = 0) => { const s = str(v).replace(/[^0-9.-]/g, ''); return s === '' ? d : Number(s) || d; };
const list = (v: unknown) => str(v).split(/[;,，、]\s*/).map((x) => x.trim()).filter(Boolean);
const yn = (v: unknown) => /^(y|yes|true|1|approved)$/i.test(str(v));
const code = (label: string) => label.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
const fromCode = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => {
  const s = code(str(v));
  return allowed.find((a) => code(a) === s) ?? d;
};

export const epToSheet = (project: Pick<Project, 'code'>, id: string) => (id ? `${project.code}-${id}` : '');
export const epFromSheet = (v: unknown) => { const m = str(v).match(/EP\d+/i); return m ? m[0].toUpperCase() : str(v); };
export const projectCodeFromSheet = (v: unknown) => str(v).replace(/-?EP\d+.*$/i, '');
const shotFromSheet = (v: unknown) => { const m = str(v).match(/EP\d+-S\d+.*/i); return m ? m[0].toUpperCase() : str(v); };

const WORK_CODES: [WorkStatus, string][] = [
  ['Not Started', 'PENDING'], ['In Progress', 'IN_PROGRESS'], ['In Review', 'REVIEW'],
  ['Changes Requested', 'CHANGES_REQUESTED'], ['Approved', 'APPROVED'], ['Complete', 'DONE'],
];
export const workToCode = (w: WorkStatus) => WORK_CODES.find(([a]) => a === w)?.[1] ?? 'PENDING';
export const workFromCode = (v: unknown, d: WorkStatus = 'Not Started'): WorkStatus => {
  const s = code(str(v));
  if (!s) return d;
  const hit = WORK_CODES.find(([a, c]) => c === s || code(a) === s);
  if (hit) return hit[0];
  if (['COMPLETE', 'COMPLETED', 'FINISHED'].includes(s)) return 'Complete';
  if (['QA_REVIEW', 'IN_REVIEW', 'UNDER_REVIEW'].includes(s)) return 'In Review';
  if (['NOT_STARTED', 'TODO'].includes(s)) return 'Not Started';
  return d;
};

/** PRODUCTION.script_status uses the workbook's stage codes (IDEA / SCRIPT_DRAFT / SCRIPT_APPROVED). */
export const scriptToCode = (w: WorkStatus) => (w === 'Not Started' ? 'IDEA' : w === 'Approved' || w === 'Complete' ? 'SCRIPT_APPROVED' : 'SCRIPT_DRAFT');
export function scriptFromCode(v: unknown, approval: unknown, d: WorkStatus): WorkStatus {
  switch (code(str(v))) {
    case 'IDEA': return 'Not Started';
    case 'SCRIPT_APPROVED': return 'Approved';
    case 'SCRIPT_DRAFT': {
      const a = code(str(approval));
      return a === 'UNDER_REVIEW' ? 'In Review' : a === 'CHANGES_REQUESTED' ? 'Changes Requested' : 'In Progress';
    }
    default: return workFromCode(v, d);
  }
}

/**
 * Workbook stage vocabulary (START_HERE): IDEA, SCRIPT_DRAFT, SCRIPT_APPROVED, ASSETS_PENDING,
 * VIDEO_PENDING, EDITING, QA_REVIEW, APPROVED, SCHEDULED, PUBLISHED, BLOCKED.
 * The exact app stage is also written to PRODUCTION.approval_status so it round-trips.
 */
export function stageToWorkbook(e: Episode): string {
  switch (e.approvalStatus) {
    case 'Draft': return e.scriptStatus === 'Not Started' ? 'IDEA' : 'SCRIPT_DRAFT';
    case 'Under Review':
    case 'Changes Requested': return 'SCRIPT_DRAFT';
    case 'Approved': return 'SCRIPT_APPROVED';
    case 'In Production':
      if (!['Complete', 'Approved'].includes(e.storyboardStatus)) return 'ASSETS_PENDING';
      if (!['Complete', 'Approved'].includes(e.videoStatus)) return 'VIDEO_PENDING';
      return 'EDITING';
    case 'Final Review': return 'QA_REVIEW';
    case 'Ready to Publish': return [e.instagramStatus, e.tiktokStatus].includes('Scheduled') ? 'SCHEDULED' : 'APPROVED';
    case 'Published': return 'PUBLISHED';
    case 'Rejected': return 'BLOCKED';
  }
}
const ALL_STAGES: ApprovalStage[] = [...PIPELINE, 'Changes Requested', 'Rejected'];
export function stageFromWorkbook(workbookStage: unknown, productionApproval: unknown, fallback: ApprovalStage): ApprovalStage {
  const exact = ALL_STAGES.find((s) => code(s) === code(str(productionApproval)));
  if (exact) return exact;
  switch (code(str(workbookStage))) {
    case 'IDEA': case 'SCRIPT_DRAFT': return 'Draft';
    case 'SCRIPT_APPROVED': return 'Approved';
    case 'ASSETS_PENDING': case 'VIDEO_PENDING': case 'EDITING': return 'In Production';
    case 'QA_REVIEW': return 'Final Review';
    case 'APPROVED': case 'SCHEDULED': return 'Ready to Publish';
    case 'PUBLISHED': return 'Published';
    case 'BLOCKED': return 'Rejected';
    default: return fallback;
  }
}
const scriptStatusFromStage = (stage: unknown): WorkStatus | undefined => {
  switch (code(str(stage))) {
    case 'IDEA': return 'Not Started';
    case 'SCRIPT_DRAFT': return 'In Progress';
    case '': return undefined;
    default: return 'Approved';
  }
};

/* ── dialogue cells: "顾念：line\n沈浩然：line" (literal \n or real newlines) ── */
const splitLines = (v: unknown) => str(v).split(/\\n|\r?\n/).map((x) => x.trim()).filter(Boolean);
export function parseDialogue(zhCell: unknown, enCell: unknown, characters: Character[], uid: () => string): DialogueLine[] {
  const zh = splitLines(zhCell), en = splitLines(enCell);
  const byZh = (n: string) => characters.find((c) => c.nameZh.split(/\s*\/\s*/).includes(n));
  const byEn = (n: string) => characters.find((c) => c.nameEn.split(/\s*\/\s*/).some((x) => x.toLowerCase() === n.toLowerCase()));
  return zh.map((line, i) => {
    const m = line.match(/^([^：:]{1,12})[：:]\s*(.*)$/);
    const e = (en[i] ?? '').match(/^([^:：]{1,30})[:：]\s*(.*)$/);
    const speaker = m?.[1]?.trim() ?? '';
    const speakerEn = m ? e?.[1]?.trim() ?? '' : '';
    const ch = (speaker && byZh(speaker)) || (speakerEn && byEn(speakerEn)) || undefined;
    return { id: uid(), characterId: ch?.id ?? '', speaker, speakerEn, zh: m ? m[2] : line, en: m && e ? e[2] : en[i] ?? '' };
  });
}
export function formatDialogue(lines: DialogueLine[], characters: Character[], lang: 'zh' | 'en') {
  return lines.map((d) => {
    const c = characters.find((x) => x.id === d.characterId);
    const label = lang === 'zh'
      ? d.speaker || c?.nameZh.split(/\s*\/\s*/)[0] || ''
      : d.speakerEn || c?.nameEn.split(/\s*\/\s*/).pop() || '';
    const text = lang === 'zh' ? d.zh : d.en;
    return label ? `${label}${lang === 'zh' ? '：' : ': '}${text}` : text;
  }).join('\\n');
}

/* ── state shape the adapters work on ─────────────────────── */
export interface WorkbookState {
  project: Project;
  episodes: Episode[];
  characters: Character[];
  locations: Location[];
  assets: Asset[];
  scriptVersions: ScriptVersion[];
  shots: Shot[];
  publishing: PublishEntry[];
  analytics: AnalyticsEntry[];
  continuity: Continuity[];
  scriptRuns: ScriptRun[];
}

const latest = (versions: ScriptVersion[], ep: string) =>
  versions.filter((v) => v.episodeId === ep).sort((a, b) => b.version - a.version)[0];

/** App state → header-keyed rows for one worksheet. */
export function toRows(sheet: string, s: WorkbookState): Row[] {
  const E = (id: string) => epToSheet(s.project, id);
  switch (sheet) {
    case 'EPISODES':
      return s.episodes.map((e) => ({
        episode_id: E(e.id), episode_no: e.number, title_cn: e.titleZh, title_en: e.titleEn, arc: e.arc, logline: e.synopsis,
        script_status: stageToWorkbook(e), runtime_target_sec: e.targetDuration, publish_date: e.targetPublishDate, publish_time_myt: e.publishTime,
        caption_cn: e.captionZh, caption_en: e.captionEn, cliffhanger: e.cliffhanger, review_notes: e.notes, final_video_url: e.finalVideoUrl,
        instagram_status: code(e.instagramStatus), tiktok_status: code(e.tiktokStatus),
      }));
    case 'PRODUCTION':
      return s.episodes.map((e) => ({
        episode_id: E(e.id), script_status: scriptToCode(e.scriptStatus), storyboard_status: workToCode(e.storyboardStatus),
        video_status: workToCode(e.videoStatus), edit_status: workToCode(e.editingStatus), approval_status: e.approvalStatus === 'Draft' ? 'PENDING' : code(e.approvalStatus),
        owner: e.owner, last_updated: e.updatedAt.slice(0, 10), blocker: e.blocker,
      }));
    case 'CHARACTERS':
      return s.characters.map((c) => ({
        character_id: c.id, name_cn: c.nameZh, name_en: c.nameEn, age: c.age, role: c.role, appearance_lock: c.appearance, wardrobe_lock: c.wardrobeLock,
        voice_direction: c.voice, master_portrait_url: c.imageUrl, full_body_url: c.fullBodyUrl, expression_sheet_url: c.expressionSheetUrl, notes: c.continuity,
      }));
    case 'LOCATIONS':
      return s.locations.map((l) => ({ location_id: l.id, name_cn: l.nameZh, name_en: l.nameEn, visual_description: l.description, reference_image_url: l.imageUrl, continuity_notes: l.continuity }));
    case 'SCRIPTS':
      return s.episodes.flatMap((e) => {
        const v = latest(s.scriptVersions, e.id);
        if (!v) return [];
        const approved = PIPELINE.indexOf(e.approvalStatus) >= PIPELINE.indexOf('Approved') ? 'Y' : 'N';
        return v.scenes.map((sc) => ({
          episode_id: E(e.id), scene_no: sc.number, scene_title: sc.title, duration_sec: sc.duration, location_id: sc.locationId, characters: sc.characterIds.join(';'),
          visual_action: sc.visualAction, dialogue_cn: formatDialogue(sc.dialogue, s.characters, 'zh'), subtitle_en: formatDialogue(sc.dialogue, s.characters, 'en'),
          camera_direction: sc.camera, sound_notes: sc.sfx, approved,
        }));
      });
    case 'SHOT_LIST':
      return s.shots.map((x) => ({
        shot_id: `${s.project.code}-${x.id}`, episode_id: E(x.episodeId), scene_no: x.sceneNumber, shot_no: x.shotNumber, character_ids: x.characterIds.join(';'),
        reference_asset_urls: x.referenceUrls.join(';'), prompt: x.prompt, negative_prompt: x.negativePrompt, duration_sec: x.duration, aspect_ratio: x.aspectRatio,
        resolution: x.resolution, generation_status: code(x.generationStatus), kling_task_id: x.klingTaskId, video_url: x.videoUrl.startsWith('blob:') ? '' : x.videoUrl,
        retry_count: x.retryCount, notes: x.notes, kling_units: x.credits,
      }));
    case 'ASSETS':
      return s.assets.map((a) => ({ asset_id: a.id, episode_id: a.episodeId ? E(a.episodeId) : '', asset_type: a.type, character_or_scene: a.linkedTo, file_url: a.url, version: a.version, approved: a.approved ? 'Y' : 'N', created_at: a.createdAt, notes: a.notes }));
    case 'PUBLISHING':
      return s.publishing.map((p) => ({
        episode_id: E(p.episodeId), platform: p.platform, caption: p.caption, hashtags: p.hashtags, cover_url: p.coverUrl, video_url: p.videoUrl,
        scheduled_at_myt: p.scheduledAt, status: code(p.status), platform_post_id: p.platformPostId, published_url: p.postUrl, notes: p.notes,
      }));
    case 'ANALYTICS':
      return s.analytics.map((a) => ({
        episode_id: E(a.episodeId), platform: a.platform, posted_at: a.postedAt, views_24h: a.views, avg_watch_sec: a.avgWatchSec, completion_rate: a.completionRate,
        likes: a.likes, comments: a.comments, shares: a.shares, saves: a.saves, followers_gained: a.followersGained, notes: a.notes,
      }));
    case 'CONTINUITY':
      return s.continuity.map((c) => ({
        episode_id: E(c.episodeId), timeline_date: c.timelineDate, facts_established: c.facts, character_state_changes: c.stateChanges,
        props_costume_changes: c.propsCostume, unresolved_questions: c.unresolved, next_episode_constraints: c.nextConstraints,
      }));
    case 'SCRIPT_RUNS':
      return s.scriptRuns.map((r) => ({
        run_id: r.id, episode_id: E(r.episodeId), queue_status: r.queueStatus, model: r.model, prompt_version: r.promptVersion,
        output_json: r.outputJson, created_at: r.createdAt, error_message: r.errorMessage, human_approval: r.humanApproval,
      }));
    default:
      return [];
  }
}

/** Header-keyed rows (any header spelling) → plain object keyed by canonical header. */
export function canon(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((r) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) o[normaliseHeader(k)] = str(v);
    return o;
  }).filter((r) => Object.values(r).some((v) => v !== ''));
}
const g = (r: Record<string, string>, h: string) => r[normaliseHeader(h)] ?? '';
const has = (r: Record<string, string>, h: string) => normaliseHeader(h) in r && r[normaliseHeader(h)] !== '';

function mergeBy<T>(existing: T[], incoming: T[], key: (t: T) => string): T[] {
  const m = new Map(existing.map((e) => [key(e), e]));
  for (const i of incoming) m.set(key(i), { ...(m.get(key(i)) ?? {}), ...i } as T);
  return [...m.values()];
}

export interface ImportResult { patch: Partial<WorkbookState>; rows: number; note: string }

/**
 * Worksheet rows → patch for app state. Blank workbook cells never erase local values,
 * so data only the app knows (e.g. planned publish dates) survives an import.
 */
export function fromRows(sheet: string, raw: Record<string, unknown>[], s: WorkbookState, uid: (p: string) => string): ImportResult {
  const rows = canon(raw);
  const keep = <T>(r: Record<string, string>, h: string, conv: (v: string) => T, old: T): T => (has(r, h) ? conv(g(r, h)) : old);
  switch (sheet) {
    case 'EPISODES': {
      const code0 = rows[0] ? projectCodeFromSheet(g(rows[0], 'episode_id')) : '';
      const eps = rows.filter((r) => g(r, 'episode_id')).map((r) => {
        const id = epFromSheet(g(r, 'episode_id'));
        const ex = s.episodes.find((e) => e.id === id) ?? blankEpisode(id, s.project);
        const stage = g(r, 'script_status');
        return {
          ...ex,
          number: keep(r, 'episode_no', (v) => num(v), ex.number),
          titleZh: keep(r, 'title_cn', String, ex.titleZh), titleEn: keep(r, 'title_en', String, ex.titleEn),
          arc: keep(r, 'arc', String, ex.arc), synopsis: keep(r, 'logline', String, ex.synopsis), cliffhanger: keep(r, 'cliffhanger', String, ex.cliffhanger),
          approvalStatus: stage ? stageFromWorkbook(stage, '', ex.approvalStatus) : ex.approvalStatus,
          scriptStatus: scriptStatusFromStage(stage) ?? ex.scriptStatus,
          targetDuration: keep(r, 'runtime_target_sec', (v) => num(v, 75), ex.targetDuration),
          targetPublishDate: g(r, 'publish_date').slice(0, 10), // blank in the workbook = not scheduled yet
          publishTime: keep(r, 'publish_time_myt', String, ex.publishTime),
          captionZh: keep(r, 'caption_cn', String, ex.captionZh), captionEn: keep(r, 'caption_en', String, ex.captionEn),
          notes: keep(r, 'review_notes', String, ex.notes), finalVideoUrl: keep(r, 'final_video_url', String, ex.finalVideoUrl),
          instagramStatus: keep(r, 'instagram_status', (v) => fromCode(v, PUBLISH_STATUSES, 'Draft'), ex.instagramStatus),
          tiktokStatus: keep(r, 'tiktok_status', (v) => fromCode(v, PUBLISH_STATUSES, 'Draft'), ex.tiktokStatus),
        } as Episode;
      });
      return {
        patch: { episodes: mergeBy(s.episodes, eps, (e) => e.id).sort((a, b) => a.number - b.number), ...(code0 ? { project: { ...s.project, code: code0 } } : {}) },
        rows: rows.length, note: '',
      };
    }
    case 'PRODUCTION': {
      const eps = s.episodes.map((e) => {
        const r = rows.find((x) => epFromSheet(g(x, 'episode_id')) === e.id);
        if (!r) return e;
        return {
          ...e,
          scriptStatus: keep(r, 'script_status', (v) => scriptFromCode(v, g(r, 'approval_status'), e.scriptStatus), e.scriptStatus),
          storyboardStatus: keep(r, 'storyboard_status', (v) => workFromCode(v, e.storyboardStatus), e.storyboardStatus),
          videoStatus: keep(r, 'video_status', (v) => workFromCode(v, e.videoStatus), e.videoStatus),
          editingStatus: keep(r, 'edit_status', (v) => workFromCode(v, e.editingStatus), e.editingStatus),
          approvalStatus: has(r, 'approval_status') ? stageFromWorkbook('', g(r, 'approval_status'), e.approvalStatus) : e.approvalStatus,
          owner: keep(r, 'owner', String, e.owner), blocker: keep(r, 'blocker', String, e.blocker),
        };
      });
      return { patch: { episodes: eps }, rows: rows.length, note: '' };
    }
    case 'CHARACTERS': {
      const cs = rows.filter((r) => g(r, 'character_id')).map((r) => {
        const id = g(r, 'character_id');
        const ex = s.characters.find((c) => c.id === id) ?? { id, nameZh: '', nameEn: '', age: 0, role: '', appearance: '', wardrobeLock: '', voice: '', continuity: '', imageUrl: '', fullBodyUrl: '', expressionSheetUrl: '' };
        return {
          ...ex, nameZh: keep(r, 'name_cn', String, ex.nameZh), nameEn: keep(r, 'name_en', String, ex.nameEn), age: keep(r, 'age', (v) => num(v), ex.age),
          role: keep(r, 'role', String, ex.role), appearance: keep(r, 'appearance_lock', String, ex.appearance), wardrobeLock: keep(r, 'wardrobe_lock', String, ex.wardrobeLock),
          voice: keep(r, 'voice_direction', String, ex.voice), imageUrl: keep(r, 'master_portrait_url', String, ex.imageUrl), fullBodyUrl: keep(r, 'full_body_url', String, ex.fullBodyUrl),
          expressionSheetUrl: keep(r, 'expression_sheet_url', String, ex.expressionSheetUrl), continuity: keep(r, 'notes', String, ex.continuity),
        };
      });
      return { patch: { characters: mergeBy(s.characters, cs, (c) => c.id) }, rows: rows.length, note: '' };
    }
    case 'LOCATIONS': {
      const ls = rows.filter((r) => g(r, 'location_id')).map((r) => {
        const id = g(r, 'location_id');
        const ex = s.locations.find((l) => l.id === id) ?? { id, nameZh: '', nameEn: '', description: '', continuity: '', imageUrl: '' };
        return { ...ex, nameZh: keep(r, 'name_cn', String, ex.nameZh), nameEn: keep(r, 'name_en', String, ex.nameEn), description: keep(r, 'visual_description', String, ex.description), imageUrl: keep(r, 'reference_image_url', String, ex.imageUrl), continuity: keep(r, 'continuity_notes', String, ex.continuity) };
      });
      return { patch: { locations: mergeBy(s.locations, ls, (l) => l.id) }, rows: rows.length, note: '' };
    }
    case 'SCRIPTS': {
      const byEp = new Map<string, Record<string, string>[]>();
      rows.forEach((r) => { const ep = epFromSheet(g(r, 'episode_id')); if (ep) byEp.set(ep, [...(byEp.get(ep) ?? []), r]); });
      const added: ScriptVersion[] = [];
      for (const [ep, rs] of byEp) {
        const scenes: Scene[] = rs.sort((a, b) => num(g(a, 'scene_no')) - num(g(b, 'scene_no'))).map((r) => ({
          id: uid('sc'), number: num(g(r, 'scene_no')), title: g(r, 'scene_title'), locationId: g(r, 'location_id'), timeOfDay: '',
          characterIds: list(g(r, 'characters')), visualAction: g(r, 'visual_action'), camera: g(r, 'camera_direction'), sfx: g(r, 'sound_notes'),
          duration: num(g(r, 'duration_sec'), 10), dialogue: parseDialogue(g(r, 'dialogue_cn'), g(r, 'subtitle_en'), s.characters, () => uid('dl')),
        }));
        const local = latest(s.scriptVersions, ep);
        const sig = (sc: Scene[]) => JSON.stringify(sc.map((x) => [x.number, x.title, x.duration, x.locationId, x.characterIds, x.visualAction, x.camera, x.sfx, x.dialogue.map((d) => [d.zh, d.en])]));
        if (!local || sig(local.scenes) !== sig(scenes)) {
          added.push({ id: uid('sv'), episodeId: ep, version: (local?.version ?? 0) + 1, scenes, savedAt: new Date().toISOString(), savedBy: 'Workbook import', note: 'Imported from SCRIPTS worksheet', source: 'workbook' });
        }
      }
      return { patch: { scriptVersions: [...s.scriptVersions, ...added] }, rows: rows.length, note: `${added.length} script version(s) imported` };
    }
    case 'SHOT_LIST': {
      const shots = rows.filter((r) => g(r, 'shot_id')).map((r) => {
        const id = shotFromSheet(g(r, 'shot_id'));
        const ex = s.shots.find((x) => x.id === id);
        return {
          ...(ex ?? {}), id, episodeId: epFromSheet(g(r, 'episode_id')), sceneNumber: num(g(r, 'scene_no')), shotNumber: num(g(r, 'shot_no')),
          characterIds: list(g(r, 'character_ids')), referenceUrls: list(g(r, 'reference_asset_urls')), prompt: g(r, 'prompt'), negativePrompt: g(r, 'negative_prompt'),
          duration: num(g(r, 'duration_sec'), 5), aspectRatio: g(r, 'aspect_ratio') || '9:16', resolution: g(r, 'resolution') || '720p',
          generationStatus: fromCode<GenerationStatus>(g(r, 'generation_status'), GENERATION_STATUSES, 'Prompt Draft'),
          klingTaskId: g(r, 'kling_task_id'), videoUrl: g(r, 'video_url') || ex?.videoUrl || '', retryCount: num(g(r, 'retry_count')),
          notes: g(r, 'notes'), credits: has(r, 'kling_units') ? num(g(r, 'kling_units')) : ex?.credits ?? 0,
        } as Shot;
      });
      return { patch: { shots: mergeBy(s.shots, shots, (x) => x.id) }, rows: rows.length, note: '' };
    }
    case 'ASSETS': {
      const as = rows.filter((r) => g(r, 'asset_id')).map((r) => ({
        id: g(r, 'asset_id'), episodeId: g(r, 'episode_id') ? epFromSheet(g(r, 'episode_id')) : '', type: g(r, 'asset_type') || 'Other', linkedTo: g(r, 'character_or_scene'),
        url: g(r, 'file_url'), version: g(r, 'version'), approved: yn(g(r, 'approved')), createdAt: g(r, 'created_at'), notes: g(r, 'notes'),
      }));
      return { patch: { assets: mergeBy(s.assets, as, (a) => a.id) }, rows: rows.length, note: '' };
    }
    case 'PUBLISHING': {
      const ps = rows.filter((r) => g(r, 'episode_id') && g(r, 'platform')).map((r) => {
        const episodeId = epFromSheet(g(r, 'episode_id'));
        const platform = (/tik/i.test(g(r, 'platform')) ? 'TikTok' : 'Instagram') as Platform;
        const ex = s.publishing.find((p) => p.episodeId === episodeId && p.platform === platform);
        return {
          id: `${episodeId}-${platform}`, episodeId, platform, caption: g(r, 'caption'), hashtags: g(r, 'hashtags').trim(), coverUrl: g(r, 'cover_url'), videoUrl: g(r, 'video_url'),
          scheduledAt: g(r, 'scheduled_at_myt') || ex?.scheduledAt || '', status: fromCode<PublishStatus>(g(r, 'status'), PUBLISH_STATUSES, 'Draft'),
          platformPostId: g(r, 'platform_post_id'), postUrl: g(r, 'published_url'), notes: g(r, 'notes'),
        };
      });
      return { patch: { publishing: mergeBy(s.publishing, ps, (p) => p.id) }, rows: rows.length, note: '' };
    }
    case 'ANALYTICS': {
      const as = rows.filter((r) => g(r, 'episode_id')).map((r) => {
        const episodeId = epFromSheet(g(r, 'episode_id'));
        const platform = (/tik/i.test(g(r, 'platform')) ? 'TikTok' : 'Instagram') as Platform;
        return {
          id: `${episodeId}-${platform}-${g(r, 'posted_at')}`, episodeId, platform, postedAt: g(r, 'posted_at'), views: num(g(r, 'views_24h')), avgWatchSec: num(g(r, 'avg_watch_sec')),
          completionRate: num(g(r, 'completion_rate')), likes: num(g(r, 'likes')), comments: num(g(r, 'comments')), shares: num(g(r, 'shares')), saves: num(g(r, 'saves')),
          followersGained: num(g(r, 'followers_gained')), notes: g(r, 'notes'), source: 'sheets' as const,
        };
      });
      return { patch: { analytics: mergeBy(s.analytics, as, (a) => a.id) }, rows: rows.length, note: '' };
    }
    case 'CONTINUITY': {
      const cs = rows.filter((r) => g(r, 'episode_id')).map((r) => ({
        episodeId: epFromSheet(g(r, 'episode_id')), timelineDate: g(r, 'timeline_date'), facts: g(r, 'facts_established'), stateChanges: g(r, 'character_state_changes'),
        propsCostume: g(r, 'props_costume_changes'), unresolved: g(r, 'unresolved_questions'), nextConstraints: g(r, 'next_episode_constraints'),
      }));
      return { patch: { continuity: mergeBy(s.continuity, cs, (c) => c.episodeId) }, rows: rows.length, note: '' };
    }
    case 'SCRIPT_RUNS': {
      const rs = rows.filter((r) => g(r, 'run_id')).map((r) => ({
        id: g(r, 'run_id'), episodeId: epFromSheet(g(r, 'episode_id')), queueStatus: (code(g(r, 'queue_status')) || 'HOLD') as ScriptRun['queueStatus'],
        model: g(r, 'model'), promptVersion: g(r, 'prompt_version'), outputJson: g(r, 'output_json'), createdAt: g(r, 'created_at'),
        errorMessage: g(r, 'error_message'), humanApproval: (code(g(r, 'human_approval')) || 'PENDING') as ScriptRun['humanApproval'],
      }));
      return { patch: { scriptRuns: mergeBy(s.scriptRuns, rs, (r) => r.id) }, rows: rows.length, note: '' };
    }
    default:
      return { patch: {}, rows: 0, note: 'Reference-only worksheet' };
  }
}

export function blankEpisode(id: string, project: Project): Episode {
  return {
    id, number: Number(id.replace(/\D/g, '')) || 0, titleZh: '', titleEn: '', synopsis: '', arc: '', cliffhanger: '',
    scriptStatus: 'Not Started', storyboardStatus: 'Not Started', videoStatus: 'Not Started', editingStatus: 'Not Started',
    approvalStatus: 'Draft', instagramStatus: 'Draft', tiktokStatus: 'Draft', targetPublishDate: '', publishTime: project.publishTime,
    targetDuration: 75, captionZh: '', captionEn: '', finalVideoUrl: '', notes: '', owner: '', blocker: '', updatedAt: new Date().toISOString(),
  };
}

/** Order in which worksheets must be imported (characters before scripts so speakers resolve). */
export const IMPORT_ORDER = ['CHARACTERS', 'LOCATIONS', 'EPISODES', 'PRODUCTION', 'SCRIPTS', 'SHOT_LIST', 'ASSETS', 'PUBLISHING', 'ANALYTICS', 'CONTINUITY', 'SCRIPT_RUNS'];

/** Parse an AI output_json (SCRIPT_RUNS) into scenes. Accepts workbook-style or app-style keys. */
export function scenesFromAiJson(json: string, characters: Character[], uid: (p: string) => string): Scene[] {
  const data = JSON.parse(json);
  const arr: Record<string, unknown>[] = Array.isArray(data) ? data : data.scenes ?? data.script?.scenes ?? [];
  if (!Array.isArray(arr) || !arr.length) throw new Error('No scenes found in output_json');
  return arr.map((x, i) => {
    const pickS = (...k: string[]) => str(k.map((kk) => x[kk]).find((v) => v !== undefined && v !== null));
    let dialogue: DialogueLine[];
    if (Array.isArray(x.dialogue)) {
      dialogue = (x.dialogue as Record<string, unknown>[]).map((d) => {
        const speaker = str(d.speaker ?? d.character ?? d.name);
        const ch = characters.find((c) => c.id === d.characterId || c.id === d.character_id || c.nameZh.split(/\s*\/\s*/).includes(speaker));
        return { id: uid('dl'), characterId: ch?.id ?? '', speaker, zh: str(d.zh ?? d.cn ?? d.line_cn ?? d.text), en: str(d.en ?? d.line_en ?? d.translation) };
      });
    } else dialogue = parseDialogue(pickS('dialogue_cn', 'dialogue_zh'), pickS('subtitle_en', 'dialogue_en'), characters, () => uid('dl'));
    const chars = x.characters ?? x.characterIds ?? x.character_ids;
    return {
      id: uid('sc'), number: num(pickS('scene_no', 'number'), i + 1) || i + 1, title: pickS('scene_title', 'title'),
      locationId: pickS('location_id', 'locationId'), timeOfDay: pickS('timeOfDay', 'time_of_day'),
      characterIds: Array.isArray(chars) ? chars.map(String) : list(chars), visualAction: pickS('visual_action', 'visualAction'),
      camera: pickS('camera_direction', 'camera'), sfx: pickS('sound_notes', 'sfx'), duration: num(pickS('duration_sec', 'duration'), 10), dialogue,
    };
  });
}
