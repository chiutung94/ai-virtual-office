// Mapping between app records and the worksheets of
// AI_Office_Drama_Production_HQ_v3.xlsx (once imported to Google Sheets).
//
// Header matching is tolerant: "Episode ID", "EPISODE_ID" and "episode_id"
// all normalise to the same key. Columns in the workbook that are not listed
// here are preserved untouched on write (the server only updates mapped cells).
//
// If your workbook uses different header names, add them to `aliases`.

export type ColType = 'string' | 'number' | 'boolean' | 'list' | 'date';

export interface ColumnDef {
  field: string; // app field
  header: string; // preferred worksheet header
  aliases?: string[];
  type?: ColType;
}

export interface SheetDef {
  sheet: string;
  key: string; // app field used as the row key for upserts
  description: string;
  columns: ColumnDef[];
  /** true if the app reads/writes this sheet; false = reference-only worksheet */
  synced: boolean;
}

export const normaliseHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9一-鿿]/g, '');

export const WORKBOOK_SHEETS: SheetDef[] = [
  {
    sheet: 'START_HERE',
    key: '',
    description: 'Workbook instructions. Read-only reference — never written by the app.',
    columns: [],
    synced: false,
  },
  {
    sheet: 'EPISODES',
    key: 'id',
    description: 'Master episode list EP001–EP060 with pipeline statuses.',
    synced: true,
    columns: [
      { field: 'id', header: 'EPISODE_ID', aliases: ['ep id', 'id'] },
      { field: 'number', header: 'EPISODE_NO', aliases: ['episode number', 'ep no', 'no'], type: 'number' },
      { field: 'titleZh', header: 'TITLE_ZH', aliases: ['chinese title', 'title cn', '中文标题'] },
      { field: 'titleEn', header: 'TITLE_EN', aliases: ['english title'] },
      { field: 'synopsis', header: 'SYNOPSIS', aliases: ['summary'] },
      { field: 'arc', header: 'ARC', aliases: ['story arc', 'act'] },
      { field: 'scriptStatus', header: 'SCRIPT_STATUS' },
      { field: 'storyboardStatus', header: 'STORYBOARD_STATUS' },
      { field: 'videoStatus', header: 'VIDEO_STATUS' },
      { field: 'editingStatus', header: 'EDITING_STATUS', aliases: ['edit status'] },
      { field: 'approvalStatus', header: 'APPROVAL_STATUS' },
      { field: 'publishingStatus', header: 'PUBLISHING_STATUS', aliases: ['publish status'] },
      { field: 'targetPublishDate', header: 'TARGET_PUBLISH_DATE', aliases: ['publish date'], type: 'date' },
      { field: 'targetDuration', header: 'TARGET_DURATION_SEC', aliases: ['duration', 'target duration'], type: 'number' },
      { field: 'notes', header: 'NOTES' },
      { field: 'updatedAt', header: 'UPDATED_AT', aliases: ['last updated'] },
    ],
  },
  {
    sheet: 'CHARACTERS',
    key: 'id',
    description: 'Character bible with wardrobe locks and voice notes.',
    synced: true,
    columns: [
      { field: 'id', header: 'CHARACTER_ID', aliases: ['char id', 'id'] },
      { field: 'nameZh', header: 'NAME_ZH', aliases: ['chinese name', '姓名'] },
      { field: 'nameEn', header: 'NAME_EN', aliases: ['english name', 'name'] },
      { field: 'age', header: 'AGE', type: 'number' },
      { field: 'role', header: 'ROLE' },
      { field: 'appearance', header: 'APPEARANCE' },
      { field: 'wardrobeLock', header: 'WARDROBE_LOCK', aliases: ['wardrobe'] },
      { field: 'voice', header: 'VOICE', aliases: ['voice description'] },
      { field: 'continuity', header: 'CONTINUITY_NOTES', aliases: ['continuity'] },
      { field: 'imageUrl', header: 'REFERENCE_IMAGE_URL', aliases: ['image url', 'reference image'] },
    ],
  },
  {
    sheet: 'LOCATIONS',
    key: 'id',
    description: 'Recurring sets and their lighting / continuity locks.',
    synced: true,
    columns: [
      { field: 'id', header: 'LOCATION_ID', aliases: ['loc id', 'id'] },
      { field: 'nameZh', header: 'NAME_ZH' },
      { field: 'nameEn', header: 'NAME_EN', aliases: ['name'] },
      { field: 'description', header: 'DESCRIPTION' },
      { field: 'lighting', header: 'LIGHTING' },
      { field: 'continuity', header: 'CONTINUITY_NOTES', aliases: ['continuity'] },
      { field: 'imageUrl', header: 'REFERENCE_IMAGE_URL', aliases: ['image url'] },
    ],
  },
  {
    sheet: 'SCRIPTS',
    key: 'rowKey',
    description: 'One row per scene of the latest approved/draft script (rowKey = EP001-S01).',
    synced: true,
    columns: [
      { field: 'rowKey', header: 'SCENE_KEY', aliases: ['key'] },
      { field: 'episodeId', header: 'EPISODE_ID' },
      { field: 'version', header: 'VERSION', type: 'number' },
      { field: 'number', header: 'SCENE_NO', type: 'number' },
      { field: 'locationId', header: 'LOCATION_ID' },
      { field: 'timeOfDay', header: 'TIME_OF_DAY' },
      { field: 'characterIds', header: 'CHARACTERS', type: 'list' },
      { field: 'visualAction', header: 'VISUAL_ACTION', aliases: ['action'] },
      { field: 'camera', header: 'CAMERA_DIRECTION', aliases: ['camera'] },
      { field: 'sfx', header: 'SFX', aliases: ['sound effects'] },
      { field: 'duration', header: 'DURATION_SEC', aliases: ['duration'], type: 'number' },
      { field: 'dialogueZh', header: 'DIALOGUE_ZH' },
      { field: 'dialogueEn', header: 'DIALOGUE_EN' },
    ],
  },
  {
    sheet: 'SHOT_LIST',
    key: 'id',
    description: 'Shot-by-shot breakdown and visual prompts.',
    synced: true,
    columns: [
      { field: 'id', header: 'SHOT_ID' },
      { field: 'episodeId', header: 'EPISODE_ID' },
      { field: 'sceneNumber', header: 'SCENE_NO', type: 'number' },
      { field: 'shotNumber', header: 'SHOT_NO', type: 'number' },
      { field: 'shotType', header: 'SHOT_TYPE' },
      { field: 'camera', header: 'CAMERA' },
      { field: 'description', header: 'DESCRIPTION' },
      { field: 'visualPrompt', header: 'VISUAL_PROMPT', aliases: ['prompt'] },
      { field: 'characterIds', header: 'CHARACTERS', type: 'list' },
      { field: 'duration', header: 'DURATION_SEC', type: 'number' },
      { field: 'storyboardStatus', header: 'STATUS' },
    ],
  },
  {
    sheet: 'ASSETS',
    key: 'id',
    description: 'Reference images, props, music and SFX.',
    synced: true,
    columns: [
      { field: 'id', header: 'ASSET_ID' },
      { field: 'type', header: 'TYPE' },
      { field: 'name', header: 'NAME' },
      { field: 'linkedTo', header: 'LINKED_TO' },
      { field: 'url', header: 'URL', aliases: ['file url', 'link'] },
      { field: 'status', header: 'STATUS' },
      { field: 'notes', header: 'NOTES' },
    ],
  },
  {
    sheet: 'PRODUCTION',
    key: 'id',
    description: 'Scene-level video generation tracker (Kling).',
    synced: true,
    columns: [
      { field: 'id', header: 'CLIP_ID' },
      { field: 'episodeId', header: 'EPISODE_ID' },
      { field: 'sceneNumber', header: 'SCENE_NO', type: 'number' },
      { field: 'prompt', header: 'PROMPT' },
      { field: 'characterRefs', header: 'CHARACTER_REFS', type: 'list' },
      { field: 'generationStatus', header: 'KLING_STATUS', aliases: ['generation status', 'status'] },
      { field: 'clipUrl', header: 'CLIP_URL' },
      { field: 'duration', header: 'DURATION_SEC', type: 'number' },
      { field: 'credits', header: 'CREDITS', type: 'number' },
      { field: 'notes', header: 'NOTES' },
      { field: 'updatedAt', header: 'UPDATED_AT' },
    ],
  },
  {
    sheet: 'PUBLISHING',
    key: 'id',
    description: 'Per-platform publishing schedule. Manual / draft preparation only.',
    synced: true,
    columns: [
      { field: 'id', header: 'POST_ID' },
      { field: 'episodeId', header: 'EPISODE_ID' },
      { field: 'platform', header: 'PLATFORM' },
      { field: 'caption', header: 'CAPTION' },
      { field: 'hashtags', header: 'HASHTAGS' },
      { field: 'scheduledDate', header: 'SCHEDULED_DATE', type: 'date' },
      { field: 'status', header: 'STATUS' },
      { field: 'postUrl', header: 'POST_URL' },
    ],
  },
  {
    sheet: 'ANALYTICS',
    key: 'id',
    description: 'Real post metrics (entered manually or by a Make.com scenario).',
    synced: true,
    columns: [
      { field: 'id', header: 'METRIC_ID' },
      { field: 'episodeId', header: 'EPISODE_ID' },
      { field: 'platform', header: 'PLATFORM' },
      { field: 'date', header: 'DATE', type: 'date' },
      { field: 'views', header: 'VIEWS', type: 'number' },
      { field: 'likes', header: 'LIKES', type: 'number' },
      { field: 'comments', header: 'COMMENTS', type: 'number' },
      { field: 'shares', header: 'SHARES', type: 'number' },
      { field: 'completionRate', header: 'COMPLETION_RATE', type: 'number' },
      { field: 'followersGained', header: 'FOLLOWERS_GAINED', type: 'number' },
      { field: 'source', header: 'SOURCE' },
    ],
  },
  {
    sheet: 'CONTINUITY',
    key: '',
    description: 'Continuity log. Read-only in this stage (shown in Character Library notes).',
    columns: [],
    synced: false,
  },
  {
    sheet: 'SCRIPT_RUNS',
    key: 'id',
    description: 'Log of every AI script generation request (audit trail).',
    synced: true,
    columns: [
      { field: 'id', header: 'RUN_ID' },
      { field: 'episodeId', header: 'EPISODE_ID' },
      { field: 'version', header: 'VERSION', type: 'number' },
      { field: 'source', header: 'SOURCE' },
      { field: 'savedBy', header: 'RUN_BY' },
      { field: 'savedAt', header: 'TIMESTAMP' },
      { field: 'note', header: 'NOTE' },
    ],
  },
  {
    sheet: 'MAKE_SETUP',
    key: '',
    description: 'Make.com scenario configuration notes. Read-only reference.',
    columns: [],
    synced: false,
  },
];

export const sheetDef = (name: string) => WORKBOOK_SHEETS.find((s) => s.sheet === name);

/** Convert an app object to a header-keyed row using the sheet definition. */
export function toRow(def: SheetDef, obj: Record<string, unknown>): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = {};
  for (const c of def.columns) {
    const v = obj[c.field];
    if (v === undefined || v === null) row[c.header] = '';
    else if (c.type === 'list' && Array.isArray(v)) row[c.header] = v.join(', ');
    else if (typeof v === 'object') row[c.header] = JSON.stringify(v);
    else row[c.header] = v as string | number | boolean;
  }
  return row;
}

/** Convert a header-keyed row (any header spelling) to an app object. */
export function fromRow(def: SheetDef, row: Record<string, unknown>): Record<string, unknown> {
  const byNorm = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) byNorm.set(normaliseHeader(k), v);
  const out: Record<string, unknown> = {};
  for (const c of def.columns) {
    const keys = [c.header, ...(c.aliases ?? [])].map(normaliseHeader);
    const hit = keys.find((k) => byNorm.has(k));
    if (!hit) continue;
    const raw = byNorm.get(hit);
    const s = raw === undefined || raw === null ? '' : String(raw).trim();
    switch (c.type) {
      case 'number':
        out[c.field] = s === '' ? 0 : Number(s.replace(/[^0-9.-]/g, '')) || 0;
        break;
      case 'boolean':
        out[c.field] = /^(true|yes|1|y)$/i.test(s);
        break;
      case 'list':
        out[c.field] = s ? s.split(/[,;，、]\s*/).filter(Boolean) : [];
        break;
      default:
        out[c.field] = s;
    }
  }
  return out;
}

/** Return the header that a sheet column resolves to, given actual sheet headers. */
export function resolveHeader(col: ColumnDef, actualHeaders: string[]): string | undefined {
  const keys = new Set([col.header, ...(col.aliases ?? [])].map(normaliseHeader));
  return actualHeaders.find((h) => keys.has(normaliseHeader(h)));
}
