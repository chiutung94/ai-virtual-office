# Make.com Scenario 01 — Daily Episode Script Generator

Reads the next `SCRIPT_RUNS` row with `queue_status = GENERATE`, asks OpenAI for the episode
script, stores the raw JSON in `output_json`, and sets `queue_status = REVIEW`. A human then
reviews it in **Script Studio → AI script queue** and accepts or rejects it. Nothing becomes the
script automatically.

```
[1 Sheets: Search Rows SCRIPT_RUNS] → [2 Sheets: Search Rows EPISODES] → [3 OpenAI: Create a Completion]
      → [4 JSON: Parse JSON] → [5 Sheets: Update a Row SCRIPT_RUNS (REVIEW)]
                 ↳ error handler on 3 & 4 → [Sheets: Update a Row (BLOCKED + error_message)] → Ignore
```

Cost: ~5 Make operations per run (Make Free has 1,000/month). With gpt-4o-mini, one episode
costs about US$0.002 in OpenAI usage.

## Before you start
- A Make.com account (free is fine). Set your timezone to **Asia/Kuala_Lumpur** in your Make profile.
- An OpenAI API key from https://platform.openai.com/api-keys. Set a monthly limit under Billing → Limits (e.g. US$10).

## Modules

### 1 · Google Sheets → Search Rows
- Connection: your Google account (the one that owns the sheet)
- Spreadsheet: **AI OFFICE – DRAMA PRODUCTION HQ** · Sheet: **SCRIPT_RUNS**
- Table contains headers: **Yes** · Column range: **A-Z**
- Filter: `queue_status` **Equal to (text)** `GENERATE`
- Maximum number of returned rows: **1**

### 2 · Google Sheets → Search Rows
- Sheet: **EPISODES** · headers Yes · A-Z
- Filter: `episode_id` **Equal to** → map `episode_id` from module 1
- Maximum: **1**

### 3 · OpenAI (ChatGPT, Whisper, DALL-E) → Create a Completion (Prompt)
- Connection: add your OpenAI API key **here** (stored by Make, never in the sheet)
- Model: **gpt-4o-mini** · Max tokens: **3000** · Temperature: **0.8**
- Response format: **JSON Object**
- Messages:
  - Role **System** → paste the *System prompt* below
  - Role **User** → paste the *User prompt* below, then replace each `«…»` with the mapped value

### 4 · JSON → Parse JSON
- JSON string: map the **Result** (choices → message → content) of module 3.
  This only validates the output. If it isn't valid JSON, the error route marks the run BLOCKED.

### 5 · Google Sheets → Update a Row
- Sheet: **SCRIPT_RUNS** · Row number: map **Row number** from module 1
- `queue_status` = `REVIEW`
- `output_json` = **Result** of module 3 (the raw text)
- `created_at` = `{{formatDate(now; "YYYY-MM-DD HH:mm")}}`
- `model` = `gpt-4o-mini` · `error_message` = *(empty)*
- Leave `human_approval` unchanged (PENDING)

### Error handler (right-click module 3 → Add error handler; repeat for 4)
- Google Sheets → Update a Row · Sheet **SCRIPT_RUNS** · Row number from module 1
- `queue_status` = `BLOCKED` · `error_message` = map **Error → Message**
- Then add the **Ignore** directive.

### Schedule
Scenario settings → **Every day at 06:00**. Use **Run once** for testing.
Turn on **Sequential processing** so two runs never overlap.

## System prompt
```
You are the head writer of 《她归来时，豪门已倾》 (When She Returned, the Empire Fell), a 60-episode Chinese live-action vertical (9:16) short drama: wealthy-family conflict, revenge and comeback. Episodes run 45–90 seconds; every episode opens with a hook in the first 3 seconds and ends on a cliffhanger. Dialogue is natural Mandarin (Simplified Chinese) with matching natural English subtitles. Visual style: photorealistic live-action cinematic.

CHARACTERS (use these IDs):
C01 沈知遥 Shen Zhiyao — 28, female lead; returns under the alias 顾念 (Gu Nian) — calm, controlled
C02 陆景深 Lu Jingshen — 31, male lead / ally — composed, restrained
C03 林曼如 Lin Manru — 48, stepmother / antagonist — elegant, cold, manipulative
C04 沈浩然 Shen Haoran — 27, half-brother / antagonist — arrogant, impatient
C05 周承宇 Zhou Chengyu — 30, former fiancé — smooth, nervous under pressure
C06 沈国峰 Shen Guofeng — 58, father, deceased (flashbacks/recordings only)
C07 苏婉清 Su Wanqing — 52, mother / hidden truth — gentle, emotional
Minor speakers (secretary, guard…) may speak but are not listed in "characters".

LOCATIONS (use these IDs):
L01 沈氏集团总部 Shen Group Headquarters
L02 董事会议室 Executive Boardroom
L03 沈家别墅 Shen Family Mansion
L04 城市街道 City Street
L05 沈国峰书房 Shen Guofeng's Study

OUTPUT: return ONLY a JSON object with this exact shape:
{"scenes":[{"scene_no":1,"scene_title":"中文短标题","duration_sec":12,"location_id":"L02","characters":"C01;C03","visual_action":"English description of what we see","dialogue_cn":"顾念：台词\n林曼如：台词","subtitle_en":"Gu Nian: line\nLin Manru: line","camera_direction":"shot sizes and moves for 9:16","sound_notes":"music / SFX"}]}

RULES:
- 4 to 6 scenes; scene durations add up to the target runtime.
- dialogue_cn: one line per speaker as "说话人：台词", separated by \n. Use 顾念 when she is undercover. A line without a speaker is voice-over.
- subtitle_en: the same lines in the same order as "Speaker: line".
- "characters" lists only the character IDs on screen, separated by ";".
- Budget: about 5 generated clips per episode, so keep locations and set-ups few.
```

## User prompt
```
Write the script for «episode_id» 《«title_cn»》 («title_en»).
Arc: «arc»
Logline: «logline»
It must end on this cliffhanger: «cliffhanger»
Target runtime: «runtime_target_sec» seconds.
Continue directly from the previous episode; keep wardrobe and positions consistent.
```
(Replace each `«…»` with the matching field from **module 2**.)

## Test
1. In the app: **Script Studio → EP001 → AI script queue**. RUN-EP001-001 already says GENERATE.
2. In Make: **Run once**. All five modules should show a green tick.
3. In the sheet, RUN-EP001-001 should now show `queue_status = REVIEW` with JSON in `output_json`.
4. In the app: **Check for results → Load into editor**, read it, then **Accept as new version** or **Reject output**.

## Option: use Claude instead of OpenAI for Module 3

Claude writes the script; video still comes from Kling either way.

1. Create an API key at https://console.anthropic.com → **Settings → API keys**, and add prepaid credit under
   **Settings → Billing** (separate from a Claude.ai subscription). Set a monthly spend limit under **Limits**.
2. In Make, replace Module 3 with **Anthropic Claude → Create a Prompt** (add the API key as the connection).
3. Model: `claude-opus-5-5` (type it in with the *Map* toggle if it isn't in the dropdown).
   Cheaper alternatives: `claude-sonnet-5-5` or `claude-haiku-5-5`.
4. Max tokens: **16000**. Leave temperature / top P / top K **empty**.
5. System prompt and user message: the same text as above. Add to the end of the system prompt:
   `Return only the JSON object — no code fences, no text before or after it.`
6. Module 4 (Parse JSON) and Module 5 (`output_json`) map Claude's **text** output instead of the OpenAI Result.
   The app also accepts output wrapped in ```json fences.

Approximate cost per episode script (about 1.5K input + 2–4K output tokens):
Opus 5.5 ≈ US$0.05–0.10 · Sonnet 5.5 ≈ US$0.02–0.05 · Haiku 5.5 ≈ US$0.002.
