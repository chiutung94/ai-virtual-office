import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { WORKBOOK_SHEETS } from '../../shared/sheetSchema';
import { Banner, Card, PageHead } from '../components/ui';
import { MAKE_EVENTS } from './Settings';

export default function SetupGuide() {
  return (
    <>
      <Link to="/settings" className="row small mb16"><ArrowLeft size={14} />Settings</Link>
      <PageHead title="Setup guide" sub="Connect Google Sheets, Make.com and AI services. Every key stays on the server." />
      <Banner tone="info">The app never stores API keys in the browser. Keys go in the server’s <code className="inline">.env</code> file (or your host’s environment variables). Integrations only show “Connected” after a live test succeeds.</Banner>

      <div className="grid g2 mt16" style={{ alignItems: 'start' }}>
        <Card title="1 · Run the app with its API server">
          <ol className="steps" style={{ padding: 0, margin: 0 }}>
            <li><strong>Install & configure</strong><pre className="code">{`npm install
cp .env.example .env`}</pre></li>
            <li><strong>Development</strong> — runs the API on :8787 and the UI on :5173<pre className="code">npm run dev</pre></li>
            <li><strong>Production</strong> — one Node process serves UI + API<pre className="code">{`npm run build
npm start`}</pre><ul><li>Deploy to any Node host (Render, Railway, Fly.io, a VPS). Static-only hosting runs in demo mode only.</li></ul></li>
          </ol>
        </Card>

        <Card title="2 · Google Sheets (primary database)">
          <ol className="steps" style={{ padding: 0, margin: 0 }}>
            <li><strong>Import the workbook</strong><ul><li>Upload <code className="inline">AI_Office_Drama_Production_HQ_v3.xlsx</code> to Google Drive → Open with Google Sheets → File → Save as Google Sheets.</li><li>Copy the spreadsheet ID from the URL: <code className="inline">/spreadsheets/d/&lt;ID&gt;/edit</code></li></ul></li>
            <li><strong>Create a service account</strong><ul><li>Google Cloud Console → new project → enable <em>Google Sheets API</em>.</li><li>IAM & Admin → Service Accounts → Create → Keys → Add key → JSON.</li></ul></li>
            <li><strong>Share the sheet</strong> with the service account e-mail as <em>Editor</em>.</li>
            <li><strong>Set server variables</strong><pre className="code">{`GOOGLE_SHEETS_SPREADSHEET_ID=1AbC...
GOOGLE_SERVICE_ACCOUNT_EMAIL=avo@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`}</pre></li>
            <li><strong>Restart the server</strong>, open <Link to="/settings">Settings</Link> → Google Sheets → <em>Test connection</em>. The test lists missing worksheets.</li>
            <li><strong>Pull first</strong>, review, then switch Data source to Google Sheets. Push only after checking a backup of the workbook.</li>
          </ol>
        </Card>
      </div>

      <Card className="mt16" title="Worksheet column mapping" sub="Header matching ignores case, spaces and underscores. Unlisted columns are preserved. Add aliases in shared/sheetSchema.ts if your headers differ.">
        <div className="table-wrap"><table className="table"><thead><tr><th>Worksheet</th><th>Mode</th><th>Expected headers</th></tr></thead><tbody>
          {WORKBOOK_SHEETS.map((w) => <tr key={w.sheet}><td className="mono strong">{w.sheet}</td><td className="small">{w.synced ? 'Read / write' : 'Reference only'}</td><td className="mono xs muted">{w.columns.map((c) => c.header).join(' · ') || '—'}</td></tr>)}
        </tbody></table></div>
      </Card>

      <div className="grid g2 mt16" style={{ alignItems: 'start' }}>
        <Card title="3 · Make.com automation">
          <ol className="steps" style={{ padding: 0, margin: 0 }}>
            <li><strong>Create a scenario</strong> starting with <em>Webhooks → Custom webhook</em>. Copy its URL.</li>
            <li><strong>Set</strong><pre className="code">{`MAKE_WEBHOOK_URL=https://hook.eu2.make.com/xxxx
MAKE_WEBHOOK_SECRET=any-long-random-string`}</pre><ul><li>Each request carries <code className="inline">x-avo-signature</code> = HMAC-SHA256(body, secret). Verify it in the scenario.</li></ul></li>
            <li><strong>Test</strong> in Settings — sends a <code className="inline">system.ping</code> event. Use it to let Make determine the data structure.</li>
            <li><strong>Route by event</strong> with a Router + filters on <code className="inline">event</code>. Payload: <code className="inline">{'{ event, sentAt, source, payload }'}</code>.</li>
            <li><strong>Publishing safety</strong> — filter on <code className="inline">payload.approved = true</code>. Keep scenarios creating drafts until Instagram/TikTok API permissions are approved and tested.</li>
          </ol>
          <div className="divider" />
          <div className="table-wrap"><table className="table"><tbody>{MAKE_EVENTS.map(([e, d]) => <tr key={e}><td className="mono xs">{e}</td><td className="xs muted">{d}</td></tr>)}</tbody></table></div>
        </Card>

        <Card title="4 · AI & media services">
          <ol className="steps" style={{ padding: 0, margin: 0 }}>
            <li><strong>OpenAI (AI Head Writer)</strong><pre className="code">{`OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini`}</pre><ul><li>Test in Settings. Script Studio’s “Generate Script” unlocks only after a successful test. Generated drafts are labelled and still require human approval.</li><li>Set a monthly usage limit in the OpenAI dashboard to protect the US$100 budget.</li></ul></li>
            <li><strong>Kling AI</strong> — <code className="inline">KLING_ACCESS_KEY</code>, <code className="inline">KLING_SECRET_KEY</code>. Automated generation is the next build stage; until then clips are uploaded manually.</li>
            <li><strong>Shotstack</strong> — <code className="inline">SHOTSTACK_API_KEY</code>, <code className="inline">SHOTSTACK_ENV=stage</code>. Key test is available; render submission is the next stage. Use “Export Shotstack JSON” in the Editing Studio meanwhile.</li>
            <li><strong>Voice</strong> — <code className="inline">VOICE_API_KEY</code> (provider to be chosen). Shown as “Needs Attention” until a verified test exists.</li>
            <li><strong>Instagram / TikTok</strong> — <code className="inline">INSTAGRAM_ACCESS_TOKEN</code>, <code className="inline">TIKTOK_ACCESS_TOKEN</code>. Both require app review for publishing scopes. The app stays in manual mode until then.</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
