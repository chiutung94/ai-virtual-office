// Script queue CLI — lets a scheduled Claude session act as the AI Head Writer.
//
//   npm run queue -- status               list SCRIPT_RUNS by queue_status
//   npm run queue -- next                 print the next GENERATE run + everything needed to write it
//   npm run queue -- submit <run_id> <file.json>   validate + store output_json, set REVIEW
//   npm run queue -- block <run_id> "<reason>"     set BLOCKED with error_message
//
// Credentials: GOOGLE_SHEETS_SPREADSHEET_ID plus GOOGLE_SERVICE_ACCOUNT_KEY_JSON (or _KEY_FILE).
// It never approves anything: human_approval stays PENDING for review in the app.
import 'dotenv/config';
import fs from 'node:fs';
import { readSheet, sheetsConfigProblem, sheetsConfigured, upsertSheet } from '../server/sheets.js';
import { canon, epFromSheet, normKey, scenesFromAiJson, type Row } from '../shared/workbook.js';
import type { Character } from '../shared/types.js';

const [cmd, a1, a2] = process.argv.slice(2);
const die = (m: string): never => { console.error(`ERROR: ${m}`); process.exit(1); };
if (!sheetsConfigured()) die(sheetsConfigProblem());

const rows = async (sheet: string) => canon((await readSheet(sheet)).rows);
const g = (r: Record<string, string>, h: string) => r[h.replace(/_/g, '')] ?? '';

async function characters(): Promise<Character[]> {
  return (await rows('CHARACTERS')).map((r) => ({
    id: g(r, 'character_id'), nameZh: g(r, 'name_cn'), nameEn: g(r, 'name_en'), age: Number(g(r, 'age')) || 0, role: g(r, 'role'),
    appearance: g(r, 'appearance_lock'), wardrobeLock: g(r, 'wardrobe_lock'), voice: g(r, 'voice_direction'), continuity: g(r, 'notes'),
    imageUrl: '', fullBodyUrl: '', expressionSheetUrl: '',
  }));
}

/** Rewrite one SCRIPT_RUNS row keeping every other value as it is in the sheet. */
async function updateRun(runId: string, patch: Record<string, string>) {
  const res = await readSheet('SCRIPT_RUNS');
  const row = res.rows.find((r) => normKey(Object.entries(r).find(([k]) => k.toLowerCase().replace(/[^a-z]/g, '') === 'runid')?.[1]) === runId);
  if (!row) die(`run ${runId} not found in SCRIPT_RUNS`);
  const c = canon([row!])[0];
  const full: Row = {
    run_id: runId, episode_id: g(c, 'episode_id'), queue_status: g(c, 'queue_status'), model: g(c, 'model'), prompt_version: g(c, 'prompt_version'),
    output_json: g(c, 'output_json'), created_at: g(c, 'created_at'), error_message: g(c, 'error_message'), human_approval: g(c, 'human_approval') || 'PENDING',
    ...patch,
  };
  await upsertSheet('SCRIPT_RUNS', [full]);
}

const stamp = () => {
  // Malaysia time, matching the workbook's MYT convention.
  const d = new Date(Date.now() + 8 * 3600_000).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)}`;
};

if (cmd === 'status') {
  const runs = await rows('SCRIPT_RUNS');
  const by = new Map<string, string[]>();
  runs.forEach((r) => { const k = g(r, 'queue_status') || '(blank)'; by.set(k, [...(by.get(k) ?? []), g(r, 'run_id')]); });
  for (const [k, ids] of by) console.log(`${k.padEnd(9)} ${ids.length}  ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ' …' : ''}`);
} else if (cmd === 'next') {
  const runs = await rows('SCRIPT_RUNS');
  const run = runs.find((r) => g(r, 'queue_status').toUpperCase() === 'GENERATE');
  if (!run) { console.log(JSON.stringify({ next: null, message: 'No runs with queue_status = GENERATE.' })); process.exit(0); }
  const epSheetId = g(run, 'episode_id');
  const ep = epFromSheet(epSheetId);
  const n = Number(ep.replace(/\D/g, ''));
  const prevId = (k: number) => epSheetId.replace(/EP\d+/i, `EP${String(k).padStart(3, '0')}`);
  const [episodes, chars, locs, cont, scripts] = await Promise.all([rows('EPISODES'), characters(), rows('LOCATIONS'), rows('CONTINUITY'), rows('SCRIPTS')]);
  const epRow = episodes.find((r) => g(r, 'episode_id') === epSheetId);
  if (!epRow) die(`${epSheetId} not found in EPISODES`);
  const pick = (r: Record<string, string>, ...hs: string[]) => Object.fromEntries(hs.map((h) => [h, g(r, h)]));
  const out = {
    run: pick(run, 'run_id', 'episode_id', 'model', 'prompt_version'),
    episode: pick(epRow!, 'episode_id', 'episode_no', 'title_cn', 'title_en', 'arc', 'logline', 'cliffhanger', 'runtime_target_sec', 'review_notes'),
    previous_episodes: [n - 2, n - 1].filter((k) => k > 0).map((k) => episodes.find((r) => g(r, 'episode_id') === prevId(k))).filter(Boolean)
      .map((r) => pick(r!, 'episode_id', 'title_cn', 'logline', 'cliffhanger')),
    next_episode: (() => { const r = episodes.find((x) => g(x, 'episode_id') === prevId(n + 1)); return r ? pick(r, 'episode_id', 'title_cn', 'logline') : null; })(),
    previous_episode_script: scripts.filter((r) => g(r, 'episode_id') === prevId(n - 1))
      .map((r) => pick(r, 'scene_no', 'scene_title', 'location_id', 'characters', 'visual_action', 'dialogue_cn')),
    continuity_from_previous: (() => { const r = cont.find((x) => g(x, 'episode_id') === prevId(n - 1)); return r ? pick(r, 'facts_established', 'character_state_changes', 'props_costume_changes', 'unresolved_questions', 'next_episode_constraints') : null; })(),
    characters: chars.map(({ id, nameZh, nameEn, age, role, appearance, wardrobeLock, voice }) => ({ id, nameZh, nameEn, age, role, appearance, wardrobeLock, voice })),
    locations: locs.map((r) => pick(r, 'location_id', 'name_cn', 'name_en', 'visual_description')),
    output_format: {
      scenes: [{ scene_no: 1, scene_title: '中文短标题', duration_sec: 12, location_id: 'L02', characters: 'C01;C03', visual_action: 'English', dialogue_cn: '顾念：台词\n林曼如：台词', subtitle_en: 'Gu Nian: line\nLin Manru: line', camera_direction: '9:16 shot sizes and moves', sound_notes: 'music / SFX' }],
    },
  };
  console.log(JSON.stringify(out, null, 2));
} else if (cmd === 'submit') {
  if (!a1 || !a2) die('usage: submit <run_id> <file.json>');
  const text = fs.readFileSync(a2, 'utf8');
  const chars = await characters();
  let n = 0;
  let scenes;
  try { scenes = scenesFromAiJson(text, chars, (p) => `${p}${++n}`); } catch (e) { die(`output does not parse: ${(e as Error).message}`); }
  const total = scenes!.reduce((a, b) => a + b.duration, 0);
  const problems = [
    !scenes!.length && 'no scenes',
    (total < 45 || total > 90) && `total runtime ${total}s is outside 45–90s`,
    scenes!.some((s) => !s.visualAction) && 'a scene has no visual_action',
    scenes!.some((s) => s.dialogue.some((d) => !d.zh)) && 'an empty Mandarin line',
  ].filter(Boolean);
  if (problems.length) die(`not submitted — ${problems.join('; ')}`);
  await updateRun(a1, { output_json: JSON.stringify(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))), queue_status: 'REVIEW', created_at: stamp(), model: 'claude (scheduled task)', error_message: '' });
  console.log(`OK ${a1} → REVIEW (${scenes!.length} scenes, ${total}s). Awaiting human approval in Script Studio.`);
} else if (cmd === 'block') {
  if (!a1 || !a2) die('usage: block <run_id> "<reason>"');
  await updateRun(a1, { queue_status: 'BLOCKED', error_message: a2.slice(0, 500), created_at: stamp() });
  console.log(`OK ${a1} → BLOCKED`);
} else {
  console.log('usage: npm run queue -- status | next | submit <run_id> <file.json> | block <run_id> "<reason>"');
}
