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

## Connecting Google Sheets & Make.com
The full step-by-step guide is in the app at **Settings → Setup guide** (`/settings/setup`). In short:
1. Upload `AI_Office_Drama_Production_HQ_v3.xlsx` to Drive and save it as a Google Sheet.
2. Create a Google Cloud service account, enable the Sheets API, and share the sheet with the service account as Editor.
3. Fill `GOOGLE_SHEETS_*` in `.env`, restart, then go to **Settings → Test connection**. The test lists any missing worksheets.
4. **Pull** first, then check the "Unmapped (preserved)" column list. If your headers differ from the expected ones, add aliases in `shared/sheetSchema.ts`.
5. Make.com: add a Custom Webhook URL to `MAKE_WEBHOOK_URL`, test it, and route by `event`. Filter on `payload.approved = true` for anything related to publishing.

> The workbook itself was not available while building this. Column names are expected
> defaults with tolerant matching. Verify them against your sheet on the first pull.
