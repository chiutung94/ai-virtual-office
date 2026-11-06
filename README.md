# AI VIRTUAL OFFICE — AI Drama Production HQ

*Your AI-powered drama production studio.*

A production management platform for vertical short dramas. The first production is the 60-episode
Mandarin revenge drama **《她归来时，豪门已倾》 (When She Returned, the Empire Fell)**.

## Quick start

```bash
npm install
cp .env.example .env      # optional: add credentials later
npm run dev               # API on :8787, UI on http://localhost:5173
```

Production (one Node process serves UI + API):

```bash
npm run build && npm start   # http://localhost:8787
```

Without credentials the app runs in **local demo mode**: realistic sample data stored in the
browser (`localStorage`), clearly labelled throughout the UI. Every external service shows
**Not Connected** until credentials are added *and* a live test passes.

## What's built (stage 1–3)

| Area | Status |
|---|---|
| Dashboard, sidebar navigation, project overview | ✅ working |
| Episodes EP001–EP060: search, 4 filters, sort, pagination, CSV export, create/delete | ✅ |
| Episode detail: scenes, dialogue, visual prompts, files, status history, approval actions | ✅ |
| Character Library (C01–C07), Locations & Assets: full CRUD | ✅ |
| Approval Centre: Draft → Under Review → Approved → In Production → Final Review → Ready to Publish → Published, with Approve / Request Changes (comment required) / Reject (comment required), decision log with timestamps | ✅ |
| Script Studio: scene editor, Mandarin + English, camera, action, SFX, duration, characters, save draft, submit, version history & restore | ✅ |
| Storyboard & Shot List, Video Production (manual clip upload), Voice & Subtitles (SRT export), Editing Studio (Shotstack JSON export) | ✅ |
| Publishing Calendar (month/list, IG + TikTok), Analytics (recorded vs. sample), Budget (estimates vs. recorded actuals) | ✅ |
| Google Sheets integration layer (server-side, service account) — read, upsert by key, preserves unmapped columns | ✅ code complete, tested against a mocked API; **needs your credentials for a live test** |
| Make.com outbound webhooks (HMAC-signed), fired on approval transitions | ✅ code complete; **untested against a live scenario** |
| OpenAI script generation (`/api/ai/generate-script`) | ✅ code complete; **untested without a key** |
| Kling, voice, Shotstack render, Instagram/TikTok posting | ⏳ next stage — UI is manual; status shows Needs Attention if keys are present |

### Safety rules enforced in code
- Keys live only in server env vars; the browser calls `/api/*` only.
- An integration is **Connected** only after `POST /api/integrations/:id/test` succeeds. Status is held server-side.
- "Published" can only be reached from **Ready to Publish**, via a confirmed human action, and only after a post URL is recorded. The Publishing Calendar blocks "Published" for unapproved episodes.
- AI generation is disabled until OpenAI tests as Connected. The offline "demo template" is labelled in the editor, the version history and the Approval Centre.
- Budget "actual" totals only include charges entered by a person; nothing is invented.
- Analytics sample data is shown in a separate "Sample preview" mode with a warning banner. It is never mixed with recorded data.

## Architecture

```
shared/types.ts         Domain model (Episode, Scene, ApprovalRecord, …)
shared/sheetSchema.ts   Worksheet ↔ field mapping for the 13 workbook sheets (tolerant header aliases)
server/index.ts         Express API: integrations status/test, sheets, Make hooks, AI, uploads
server/sheets.ts        Google Sheets v4 via service-account JWT (read / upsert)
src/store/store.ts      Zustand store, persisted to localStorage; approval state machine; activity log
src/lib/workflow.ts     Approval transitions + side-effects (the only path to "Published")
src/lib/sync.ts         Pull/push between store and worksheets
src/pages/*             One page per navigation item
src/components/ui.tsx   Card, DataTable (sort/paginate), Modal, ConfirmDialog, StatusPill, Toasts…
```

### API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/integrations` | Status of every service (never exposes keys) |
| POST | `/api/integrations/:id/test` | Live test (sheets, openai, make, shotstack) |
| GET | `/api/sheets/:sheet` | Read worksheet → `{headers, rows, unmappedHeaders}` |
| POST | `/api/sheets/:sheet/upsert` | `{records}` upsert by key |
| POST | `/api/make/:event` | Forward an allow-listed event to `MAKE_WEBHOOK_URL` |
| POST | `/api/ai/generate-script` | OpenAI JSON-mode scene generation |
| POST | `/api/uploads` | Raw-body clip upload → `/uploads/<file>` |

## Your workbook: AI OFFICE – DRAMA PRODUCTION HQ

The data layer (`shared/workbook.ts`) matches the real workbook column by column. It was verified by
importing the workbook and exporting it again: about 1,900 cells, with 0 differences.

| Worksheet | Key | Notes |
|---|---|---|
| EPISODES | `episode_id` | IDs are `DRAMA001-EP001` in the sheet and `EP001` in the app. `script_status` uses the START_HERE stage codes (IDEA, SCRIPT_DRAFT, … PUBLISHED, BLOCKED). |
| PRODUCTION | `episode_id` | Per-episode department board. `approval_status` keeps the exact app stage. `image_status`, `voice_status` and `qa_status` are left untouched. |
| SCRIPTS | `episode_id` + `scene_no` | Dialogue is stored as `顾念：台词\n…`. Speakers outside the cast (e.g. 秘书) are preserved. Scenes deleted in the app are cleared on push. |
| SHOT_LIST | `shot_id` | Prompts plus Kling tracking (`generation_status`, `kling_task_id`, `video_url`, `retry_count`). Adds one column, `kling_units`. |
| PUBLISHING | `episode_id` + `platform` | `scheduled_at_myt` is Malaysia time. Posting stays manual. |
| ANALYTICS | `episode_id` + `platform` + `posted_at` | |
| CHARACTERS, LOCATIONS, ASSETS, CONTINUITY | id / `episode_id` | |
| SCRIPT_RUNS | `run_id` | The Make.com Scenario 01 queue. Script Studio sets `queue_status=GENERATE`; Make writes `output_json` and sets `REVIEW`; a human accepts or rejects. |
| START_HERE, MAKE_SETUP | — | Reference only, never written. |

**Two ways to load it:**
1. **Import .xlsx (no setup).** In Google Sheets choose File → Download → .xlsx, then go to Settings → *Import workbook*. The file is parsed in the browser and never uploaded.
2. **Live Google Sheets sync.** Use a service account and the Pull/Push buttons in Settings. Writes use `RAW` values (no formula evaluation) and only touch the columns listed above.

> This repository is public, so it contains no script content. Real data lives in your workbook
> and your browser.

## Connecting Google Sheets & Make.com
The full step-by-step guide is in the app at **Settings → Setup guide** (`/settings/setup`).
