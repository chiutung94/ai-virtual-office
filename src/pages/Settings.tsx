import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, RefreshCw, RotateCcw, Upload, UploadCloud, DownloadCloud, PlugZap } from 'lucide-react';
import { useStore, type Collections } from '../store/store';
import { api } from '../lib/api';
import { SYNCED_SHEETS, pullSheet, pushSheet } from '../lib/sync';
import { WORKBOOK_SHEETS } from '../../shared/sheetSchema';
import { Banner, Card, ConfirmDialog, Field, PageHead, StatusPill, fmtDateTime, download, type ConfirmOpts, SkeletonRows } from '../components/ui';

type SyncResult = { ok: boolean; text: string; unmapped?: string[] };

export const MAKE_EVENTS = [
  ['script.submitted', 'A script was submitted for review'],
  ['script.approved', 'A script was approved'],
  ['script.changes_requested', 'Reviewer requested script changes'],
  ['episode.stage_changed', 'Episode moved stage (e.g. into production)'],
  ['video.final_review', 'Final cut submitted for review'],
  ['episode.ready_to_publish', 'Final cut approved — includes approved: true'],
  ['publish.prepare_draft', 'A post draft was prepared (no posting)'],
  ['publish.marked_published', 'A human recorded the episode as published'],
];

export default function Settings() {
  const s = useStore();
  const [testing, setTesting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busySheet, setBusySheet] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SyncResult>>({});
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sheets = s.integrations?.find((i) => i.id === 'sheets');
  const sheetsOk = sheets?.state === 'Connected';

  const refresh = async () => { setRefreshing(true); await s.refreshIntegrations(); setRefreshing(false); };
  const test = async (id: string) => {
    setTesting(id);
    try {
      const r = await api.testIntegration(id);
      await s.refreshIntegrations();
      s.toast(r.state === 'Connected' ? 'success' : 'error', `${r.name}: ${r.state} — ${r.detail}`);
      s.log({ actor: 'System', message: `Connection test ${r.name}: ${r.state}`, level: r.state === 'Connected' ? 'success' : 'error' });
    } catch (e) { s.toast('error', (e as Error).message); }
    finally { setTesting(null); }
  };

  const runSync = async (sheet: string, dir: 'pull' | 'push') => {
    setBusySheet(`${sheet}:${dir}`);
    try {
      if (dir === 'pull') {
        const r = await pullSheet(sheet);
        setResults((x) => ({ ...x, [sheet]: { ok: true, text: `Pulled ${r.rows} rows${r.note ? ` · ${r.note}` : ''}`, unmapped: r.unmappedHeaders } }));
        s.updateSettings({ lastPull: new Date().toISOString() });
      } else {
        const r = await pushSheet(sheet);
        setResults((x) => ({ ...x, [sheet]: { ok: true, text: `Pushed: ${r.updated} updated, ${r.appended} appended` } }));
        s.updateSettings({ lastPush: new Date().toISOString() });
      }
    } catch (e) {
      setResults((x) => ({ ...x, [sheet]: { ok: false, text: (e as Error).message } }));
      throw e;
    } finally { setBusySheet(null); }
  };
  const runAll = (dir: 'pull' | 'push') => setConfirm({
    title: dir === 'pull' ? 'Pull all worksheets into the app?' : 'Push all app data to Google Sheets?',
    tone: 'warning', confirmLabel: dir === 'pull' ? 'Pull all' : 'Push all',
    message: dir === 'pull'
      ? 'Rows in the workbook will overwrite matching records (by ID) in this browser. Records that exist only locally are kept.'
      : 'Matching rows (by ID) in the workbook will be overwritten in the mapped columns; new rows are appended. Unmapped columns are left untouched. Export a backup of the workbook first.',
    onConfirm: async () => {
      let fails = 0;
      for (const sh of SYNCED_SHEETS) { try { await runSync(sh, dir); } catch { fails++; } }
      s.toast(fails ? 'warning' : 'success', `${dir === 'pull' ? 'Pull' : 'Push'} finished${fails ? ` with ${fails} errors` : ''}`);
      s.log({ actor: s.settings.reviewerName, message: `Google Sheets ${dir} all (${SYNCED_SHEETS.length - fails}/${SYNCED_SHEETS.length} ok)`, level: fails ? 'warning' : 'success' });
    },
  });

  const exportBackup = () => {
    const st = useStore.getState();
    const keys: (keyof Collections)[] = ['episodes', 'characters', 'locations', 'assets', 'scriptVersions', 'shots', 'clips', 'voiceLines', 'editJobs', 'publishing', 'analytics', 'approvals', 'activity', 'budgetLines', 'expenses', 'tasks'];
    download(`ai-virtual-office-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: 'avo-backup', version: 1, exportedAt: new Date().toISOString(), project: st.project, ...Object.fromEntries(keys.map((k) => [k, st[k]])) }, null, 2));
  };
  const importBackup = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.format !== 'avo-backup' || !Array.isArray(data.episodes)) throw new Error('Not an AI Virtual Office backup file');
      setConfirm({ title: 'Restore backup?', tone: 'danger', confirmLabel: 'Replace local data', message: `This replaces all local data with the backup from ${fmtDateTime(data.exportedAt)} (${data.episodes.length} episodes).`, onConfirm: () => { s.importBackup(data); s.toast('success', 'Backup restored'); } });
    } catch (e) { s.toast('error', `Import failed: ${(e as Error).message}`); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <>
      <PageHead title="Settings" sub="Reviewer identity, integrations, Google Sheets sync and data management" actions={<Link className="btn" to="/settings/setup"><BookOpen size={15} />Setup guide</Link>} />

      <div className="grid g2">
        <Card title="Reviewer & workflow">
          <div className="col gap16">
            <Field label="Your name (recorded on approvals)">{(id) => <input id={id} className="input" value={s.settings.reviewerName} onChange={(e) => s.updateSettings({ reviewerName: e.target.value || 'Producer' })} />}</Field>
            <label className="check"><input type="checkbox" checked={s.settings.autoNotifyMake} onChange={(e) => s.updateSettings({ autoNotifyMake: e.target.checked })} />Send workflow events to Make.com (only when Make.com is verified as Connected)</label>
            <Field label="Data source" hint={sheetsOk ? 'Live mode reads/writes the workbook via the server.' : 'Google Sheets must be verified as Connected before it can be selected.'}>
              {(id) => <select id={id} className="select" value={s.settings.dataSource} onChange={(e) => {
                const v = e.target.value as 'local-demo' | 'google-sheets';
                if (v === 'google-sheets' && !sheetsOk) { s.toast('error', 'Connect and test Google Sheets first.'); return; }
                s.updateSettings({ dataSource: v }); s.toast('success', v === 'google-sheets' ? 'Google Sheets selected — pull to load workbook data' : 'Local demo mode');
              }}>
                <option value="local-demo">Local demo mode (browser storage)</option>
                <option value="google-sheets" disabled={!sheetsOk}>Google Sheets workbook</option>
              </select>}
            </Field>
          </div>
        </Card>

        <Card title="Data management" sub="Local data lives in this browser until synced">
          <div className="col gap16">
            <div className="row wrap">
              <button className="btn" onClick={exportBackup}><Download size={14} />Export backup (JSON)</button>
              <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={14} />Import backup</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
            </div>
            <button className="btn danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirm({ title: 'Reset to demo data?', tone: 'danger', confirmLabel: 'Reset all data', message: 'All local edits, approvals, scripts and settings data will be replaced by the original sample data. Export a backup first if you need it.', onConfirm: () => { s.resetDemo(); s.toast('success', 'Demo data restored'); } })}><RotateCcw size={14} />Reset demo data</button>
            <div className="xs faint">Last pull: {fmtDateTime(s.settings.lastPull)} · Last push: {fmtDateTime(s.settings.lastPush)}</div>
          </div>
        </Card>
      </div>

      <Card className="mt16" title="Integrations" sub="States come from the server. “Connected” is shown only after a successful live test." actions={<button className="btn sm" onClick={refresh} disabled={refreshing}><RefreshCw size={13} className={refreshing ? 'spin' : ''} />Refresh</button>} flush>
        {s.backendOnline === false && <div style={{ padding: 16 }}><Banner tone="danger">The API server is not reachable. Start it with <code className="inline">npm run dev</code> (or <code className="inline">npm start</code> in production). Without it the app runs in local demo mode and no external service can connect.</Banner></div>}
        {s.backendOnline === null && <SkeletonRows rows={5} />}
        {s.integrations && (
          <div className="list">
            {s.integrations.map((i) => (
              <div key={i.id} className="list-item" style={{ alignItems: 'center' }}>
                <PlugZap size={16} className="muted" />
                <div className="grow">
                  <div className="row wrap"><span className="strong small">{i.name}</span><StatusPill status={i.state} /></div>
                  <div className="xs muted">{i.detail}</div>
                  {i.lastTestedAt && <div className="xs faint">Last tested {fmtDateTime(i.lastTestedAt)}</div>}
                </div>
                <button className="btn sm" disabled={!i.configured || !i.testable || testing === i.id} onClick={() => test(i.id)} title={!i.configured ? 'Add credentials to the server .env first' : !i.testable ? 'Live test not implemented for this service yet' : ''}>
                  {testing === i.id ? <span className="spinner" /> : null}Test connection
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt16" title="Google Sheets sync" sub="Workbook: AI_Office_Drama_Production_HQ_v3 · rows are matched by ID; unmapped columns are never modified" actions={<>
        <button className="btn sm" disabled={!sheetsOk || !!busySheet} onClick={() => runAll('pull')}><DownloadCloud size={13} />Pull all</button>
        <button className="btn sm" disabled={!sheetsOk || !!busySheet} onClick={() => runAll('push')}><UploadCloud size={13} />Push all</button>
      </>} flush>
        {!sheetsOk && <div style={{ padding: 16 }}><Banner tone="warning">Google Sheets is <strong>{sheets?.state ?? 'Not Connected'}</strong>. Follow the <Link to="/settings/setup">setup guide</Link>, then run “Test connection” above to enable sync.</Banner></div>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Worksheet</th><th>Purpose</th><th>Key</th><th>Sync</th><th>Last result</th></tr></thead>
            <tbody>
              {WORKBOOK_SHEETS.map((w) => (
                <tr key={w.sheet}>
                  <td className="mono strong">{w.sheet}</td>
                  <td className="small muted" style={{ maxWidth: 320 }}>{w.description}</td>
                  <td className="mono xs">{w.synced ? w.columns.find((c) => c.field === w.key)?.header : '—'}</td>
                  <td>{w.synced ? (
                    <div className="row nowrap">
                      <button className="btn sm" disabled={!sheetsOk || !!busySheet} onClick={() => runSync(w.sheet, 'pull').catch(() => s.toast('error', `Pull ${w.sheet} failed`))}>{busySheet === `${w.sheet}:pull` ? <span className="spinner" /> : <DownloadCloud size={12} />}Pull</button>
                      <button className="btn sm" disabled={!sheetsOk || !!busySheet} onClick={() => setConfirm({ title: `Push to ${w.sheet}?`, tone: 'warning', confirmLabel: 'Push', message: 'Mapped columns of matching rows will be overwritten; new rows appended.', onConfirm: () => runSync(w.sheet, 'push').then(() => s.toast('success', `${w.sheet} pushed`)) })}>{busySheet === `${w.sheet}:push` ? <span className="spinner" /> : <UploadCloud size={12} />}Push</button>
                    </div>) : <span className="xs faint">Reference only</span>}</td>
                  <td className="xs" style={{ maxWidth: 280 }}>
                    {results[w.sheet] ? <span style={{ color: results[w.sheet].ok ? 'var(--success)' : 'var(--danger)' }}>{results[w.sheet].text}</span> : <span className="faint">—</span>}
                    {results[w.sheet]?.unmapped?.length ? <div className="faint">Unmapped (preserved): {results[w.sheet].unmapped!.join(', ')}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt16" title="Make.com automation hooks" sub="Outbound events sent server-side to MAKE_WEBHOOK_URL">
        <p className="small muted mb16">Events are notifications. Publishing-related events include the human approval record and an <code className="inline">approved</code> flag — your scenario must filter on <code className="inline">approved = true</code> and should still create drafts rather than auto-posting until platform permissions are confirmed.</p>
        <div className="table-wrap"><table className="table"><thead><tr><th>Event</th><th>When</th></tr></thead><tbody>
          {MAKE_EVENTS.map(([e, d]) => <tr key={e}><td className="mono">{e}</td><td className="small">{d}</td></tr>)}
        </tbody></table></div>
      </Card>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
