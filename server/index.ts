// AI VIRTUAL OFFICE — API server.
// All third-party credentials live here (process.env). The browser only ever
// talks to /api/* and never receives a key.
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IntegrationStatus } from '../shared/types.js';
import { HttpError, readSheet, sheetsConfigProblem, sheetsConfigured, testSheets, upsertSheet } from './sheets.js';
import { SHEETS } from '../shared/workbook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UPLOADS = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
app.use(express.json({ limit: '2mb' }));

// ── Verified connection state (only set by a real, successful test) ─────────
type TestResult = { ok: boolean; at: string; detail: string };
const tests: Record<string, TestResult | undefined> = {};
const env = (k: string) => Boolean(process.env[k]?.trim());

interface ServiceDef {
  id: string;
  name: string;
  configured: () => boolean;
  testable: boolean;
  missing: string;
}
const SERVICES: ServiceDef[] = [
  { id: 'sheets', name: 'Google Sheets', configured: sheetsConfigured, testable: true, missing: 'GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY_FILE' },
  { id: 'make', name: 'Make.com', configured: () => env('MAKE_WEBHOOK_URL'), testable: true, missing: 'MAKE_WEBHOOK_URL' },
  { id: 'openai', name: 'OpenAI (AI Head Writer)', configured: () => env('OPENAI_API_KEY'), testable: true, missing: 'OPENAI_API_KEY' },
  { id: 'kling', name: 'Kling AI (Video)', configured: () => env('KLING_ACCESS_KEY') && env('KLING_SECRET_KEY'), testable: false, missing: 'KLING_ACCESS_KEY, KLING_SECRET_KEY' },
  { id: 'voice', name: 'Voice generation', configured: () => env('VOICE_API_KEY'), testable: false, missing: 'VOICE_API_KEY' },
  { id: 'shotstack', name: 'Shotstack (Editor)', configured: () => env('SHOTSTACK_API_KEY'), testable: true, missing: 'SHOTSTACK_API_KEY' },
  { id: 'instagram', name: 'Instagram Graph API', configured: () => env('INSTAGRAM_ACCESS_TOKEN'), testable: false, missing: 'INSTAGRAM_ACCESS_TOKEN' },
  { id: 'tiktok', name: 'TikTok Content Posting API', configured: () => env('TIKTOK_ACCESS_TOKEN'), testable: false, missing: 'TIKTOK_ACCESS_TOKEN' },
];

function statusOf(s: ServiceDef): IntegrationStatus {
  const t = tests[s.id];
  const configured = s.configured();
  let state: IntegrationStatus['state'] = 'Not Connected';
  let detail = s.id === 'sheets' ? `Not configured. ${sheetsConfigProblem()}` : `Not configured. Set ${s.missing} in the server .env file.`;
  if (configured) {
    if (t?.ok) {
      state = 'Connected';
      detail = t.detail;
    } else if (t && !t.ok) {
      state = 'Needs Attention';
      detail = `Last test failed: ${t.detail}`;
    } else {
      state = 'Needs Attention';
      detail = s.testable
        ? 'Credentials present but not yet verified. Run “Test connection”.'
        : 'Credentials present. Automated verification is not implemented in this build stage — treat as unverified.';
    }
  }
  return { id: s.id, name: s.name, state, configured, detail, lastTestedAt: t?.at, testable: s.testable };
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/integrations', (_req, res) => res.json(SERVICES.map(statusOf)));

app.post(
  '/api/integrations/:id/test',
  wrap(async (req, res) => {
    const s = SERVICES.find((x) => x.id === req.params.id);
    if (!s) throw new HttpError(404, 'Unknown integration');
    if (!s.configured()) throw new HttpError(412, `${s.name} is not configured. Set ${s.missing}.`);
    if (!s.testable) throw new HttpError(501, `${s.name}: automated test not implemented yet.`);
    const at = new Date().toISOString();
    try {
      let detail = '';
      if (s.id === 'sheets') {
        const r = await testSheets();
        detail = `Workbook “${r.title}” reachable. ${r.worksheets.length} worksheets.` + (r.missing.length ? ` Missing: ${r.missing.join(', ')}.` : ' All expected worksheets present.');
      } else if (s.id === 'openai') {
        const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
        if (!r.ok) throw new Error(`OpenAI responded ${r.status}`);
        detail = `OpenAI API key accepted. Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}.`;
      } else if (s.id === 'make') {
        const r = await postMake('system.ping', { message: 'Connection test from AI Virtual Office' });
        detail = `Webhook accepted test ping (HTTP ${r.status}).`;
      } else if (s.id === 'shotstack') {
        const envName = process.env.SHOTSTACK_ENV || 'stage';
        const r = await fetch(`https://api.shotstack.io/edit/${envName}/render/00000000-0000-0000-0000-000000000000`, {
          headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY! },
        });
        if (r.status === 401 || r.status === 403) throw new Error(`Shotstack rejected the key (HTTP ${r.status})`);
        detail = `Shotstack key accepted (${envName} environment).`;
      }
      tests[s.id] = { ok: true, at, detail };
    } catch (e) {
      tests[s.id] = { ok: false, at, detail: (e as Error).message };
    }
    res.json(statusOf(s));
  }),
);

// ── Google Sheets ───────────────────────────────────────────────────────────
app.get('/api/sheets', (_req, res) =>
  res.json(SHEETS.map(({ sheet, description, synced, headers, keyHeaders }) => ({ sheet, description, synced, keyHeaders, headers }))),
);
app.get('/api/sheets/:sheet', wrap(async (req, res) => res.json(await readSheet(req.params.sheet))));
app.post(
  '/api/sheets/:sheet/upsert',
  wrap(async (req, res) => {
    const rows = req.body?.rows;
    if (!Array.isArray(rows)) throw new HttpError(400, 'Body must be { rows: [...] }');
    res.json(await upsertSheet(req.params.sheet, rows));
  }),
);

// ── Make.com hooks ──────────────────────────────────────────────────────────
// Events are notifications only. Publishing events carry the human approval
// record; the Make scenario must check `approved === true` before posting.
const MAKE_EVENTS = new Set([
  'system.ping',
  'script.submitted',
  'script.approved',
  'script.changes_requested',
  'episode.stage_changed',
  'video.final_review',
  'episode.ready_to_publish',
  'publish.prepare_draft',
  'publish.marked_published',
]);

async function postMake(event: string, payload: unknown) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) throw new HttpError(412, 'MAKE_WEBHOOK_URL is not configured.');
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), source: 'ai-virtual-office', payload });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.MAKE_WEBHOOK_SECRET) {
    headers['x-avo-signature'] = crypto.createHmac('sha256', process.env.MAKE_WEBHOOK_SECRET).update(body).digest('hex');
  }
  const r = await fetch(url, { method: 'POST', headers, body });
  if (!r.ok) throw new HttpError(502, `Make.com webhook responded HTTP ${r.status}`);
  return r;
}

app.post(
  '/api/make/:event',
  wrap(async (req, res) => {
    const event = req.params.event;
    if (!MAKE_EVENTS.has(event)) throw new HttpError(400, `Unknown event ${event}`);
    const r = await postMake(event, req.body ?? {});
    res.json({ ok: true, status: r.status });
  }),
);

// ── AI Head Writer (OpenAI) ─────────────────────────────────────────────────
app.post(
  '/api/ai/generate-script',
  wrap(async (req, res) => {
    if (!env('OPENAI_API_KEY')) throw new HttpError(412, 'OpenAI is not configured. AI generation is disabled.');
    const { episode, characters, locations, project, previousSynopses, continuity } = req.body ?? {};
    if (!episode?.id) throw new HttpError(400, 'episode is required');
    const system = `You are the head writer of a Chinese live-action vertical short drama (竖屏短剧). Write tight, hook-driven scenes. Output strict JSON only.`;
    const user = {
      task: `Write the script for ${episode.id} 《${episode.titleZh}》 (${episode.titleEn}).`,
      project,
      synopsis: episode.synopsis,
      cliffhanger: episode.cliffhanger,
      previousSynopses,
      continuityFromPreviousEpisode: continuity ?? null,
      targetDurationSeconds: episode.targetDuration,
      characters,
      locations,
      rules: [
        'Mandarin dialogue in Simplified Chinese with natural English translation.',
        '3–6 scenes. Each scene 8–25 seconds. Total close to the target duration.',
        'Open with a hook in the first 3 seconds; end on a cliffhanger.',
        'Use only the given character IDs and location IDs.',
        'dialogue_cn: one line per speaker as "说话人：台词", lines separated by \\n. subtitle_en: matching English lines "Speaker: line".',
        'Respect continuityFromPreviousEpisode (wardrobe, positions, constraints).',
        'camera: shot sizes and moves for 9:16 vertical framing.',
      ],
      outputSchema: {
        scenes: [{ scene_no: 1, scene_title: '', duration_sec: 12, location_id: 'L01', characters: 'C01;C03', visual_action: '', dialogue_cn: '顾念：……', subtitle_en: 'Gu Nian: …', camera_direction: '', sound_notes: '' }],
      },
    };
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.8,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    });
    const data = (await r.json()) as { choices?: { message: { content: string } }[]; usage?: unknown; error?: { message: string } };
    if (!r.ok) throw new HttpError(502, `OpenAI error: ${data.error?.message ?? r.status}`);
    let parsed: { scenes?: unknown[] };
    try {
      parsed = JSON.parse(data.choices?.[0]?.message.content ?? '{}');
    } catch {
      throw new HttpError(502, 'OpenAI returned malformed JSON.');
    }
    if (!Array.isArray(parsed.scenes)) throw new HttpError(502, 'OpenAI response did not include scenes.');
    res.json({ scenes: parsed.scenes, usage: data.usage ?? null, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' });
  }),
);

// ── Manual clip uploads ─────────────────────────────────────────────────────
app.post(
  '/api/uploads',
  express.raw({ type: () => true, limit: '300mb' }),
  wrap(async (req, res) => {
    const original = String(req.header('x-file-name') ?? 'clip.mp4');
    const ext = path.extname(original).toLowerCase();
    if (!['.mp4', '.mov', '.webm', '.m4v', '.mp3', '.wav', '.m4a', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      throw new HttpError(415, `File type ${ext || '(none)'} not allowed.`);
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Empty upload');
    const safe = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    await fs.promises.writeFile(path.join(UPLOADS, safe), req.body);
    res.json({ url: `/uploads/${safe}`, size: req.body.length, name: original });
  }),
);
app.use('/uploads', express.static(UPLOADS));

// ── Static frontend in production ───────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : err.status ?? 500;
  res.status(status).json({ error: err.message });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`AI Virtual Office API on http://localhost:${port}`));
