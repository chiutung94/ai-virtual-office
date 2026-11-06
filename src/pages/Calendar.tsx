import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, List, Plus, Send } from 'lucide-react';
import { PUBLISH_STATUSES, type Platform, type PublishEntry, type PublishStatus } from '../../shared/types';
import { useStore } from '../store/store';
import { isPublishable } from '../lib/workflow';
import { addDays } from '../data/seed';
import { Banner, Card, ConfirmDialog, DataTable, Empty, Field, Modal, PageHead, StatusPill, fmtDate, type ConfirmOpts } from '../components/ui';

const DEFAULT_TAGS = '#豪门恩怨 #逆袭复仇 #AI短剧 #ChineseDrama #ShortDrama';
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar() {
  const s = useStore();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [platform, setPlatform] = useState<'' | Platform>('');
  const [month, setMonth] = useState(() => (s.publishing.find((p) => p.scheduledAt)?.scheduledAt || s.episodes[0]?.targetPublishDate || new Date().toISOString()).slice(0, 7));
  const [edit, setEdit] = useState<PublishEntry | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const ig = s.integrations?.find((i) => i.id === 'instagram');
  const tt = s.integrations?.find((i) => i.id === 'tiktok');
  const entries = s.publishing.filter((p) => !platform || p.platform === platform);
  const today = new Date().toISOString().slice(0, 10);

  const days = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - offset + i)).toISOString().slice(0, 10));
  }, [month]);
  const shift = (n: number) => { const [y, m] = month.split('-').map(Number); setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); };

  const save = () => {
    if (!edit) return;
    const ep = s.episodes.find((e) => e.id === edit.episodeId);
    if (!ep) { s.toast('error', 'Unknown episode'); return; }
    if (edit.status === 'Published' && !isPublishable(ep)) { s.toast('error', `${ep.id} is “${ep.approvalStatus}”. Only approved episodes (Ready to Publish) can be marked published.`); return; }
    if (edit.status === 'Published' && !/^https?:\/\//.test(edit.postUrl)) { s.toast('error', 'A post URL is required to mark as published.'); return; }
    if (edit.postUrl && !/^https?:\/\//.test(edit.postUrl)) { s.toast('error', 'Post URL must start with https://'); return; }
    const apply = () => {
      const id = `${edit.episodeId}-${edit.platform}`;
      s.upsert('publishing', { ...edit, id });
      if (edit.status === 'Published') s.log({ actor: s.settings.reviewerName, department: 'distribution', episodeId: edit.episodeId, message: `${edit.episodeId} recorded as published on ${edit.platform} (manual)`, level: 'success' });
      const k = edit.platform === 'Instagram' ? 'instagramStatus' : 'tiktokStatus';
      if (edit.status !== 'Published' && ep[k] !== 'Published') s.updateEpisode(ep.id, { [k]: edit.status });
      if (edit.status === 'Ready') void s.notifyMake('publish.prepare_draft', { entry: edit, approved: isPublishable(ep) });
      s.toast('success', 'Publishing entry saved'); setEdit(null);
    };
    if (edit.status === 'Published') setConfirm({ title: `Record ${edit.episodeId} as published on ${edit.platform}?`, tone: 'success', confirmLabel: 'Record as published', message: 'Confirm you have posted the approved final cut manually. The app does not post on your behalf.', onConfirm: apply });
    else apply();
  };
  const copy = async (p: PublishEntry) => { try { await navigator.clipboard.writeText(`${p.caption}\n\n${p.hashtags}`); s.toast('success', 'Caption + hashtags copied'); } catch { s.toast('error', 'Clipboard unavailable'); } };
  const newEntry = (): PublishEntry => ({ id: '', episodeId: s.episodes[0]?.id ?? '', platform: 'TikTok', caption: '', hashtags: DEFAULT_TAGS, coverUrl: '', videoUrl: '', scheduledAt: `${today} ${s.project.publishTime}`, status: 'Draft', platformPostId: '', postUrl: '', notes: 'Manual approval required' });
  const unscheduled = s.episodes.filter((e) => !e.targetPublishDate);
  const scheduleAll = () => setConfirm({
    title: `Schedule ${unscheduled.length} unscheduled episodes?`, tone: 'primary', confirmLabel: 'Set publish dates',
    message: `Each episode without a date gets one per day from ${s.project.startDate} (episode 1) at ${s.project.publishTime} MYT. Episodes that already have dates are not changed. You can change the start date in Projects. Dates are written to EPISODES.publish_date on your next push.`,
    onConfirm: () => {
      unscheduled.forEach((e) => s.updateEpisode(e.id, { targetPublishDate: addDays(s.project.startDate, e.number - 1), publishTime: e.publishTime || s.project.publishTime }));
      s.toast('success', `${unscheduled.length} episodes scheduled`);
    },
  });
  const planMonth = () => {
    const eps = s.episodes.filter((e) => e.targetPublishDate.startsWith(month));
    let n = 0;
    eps.forEach((e) => (['Instagram', 'TikTok'] as const).forEach((pl) => {
      if (useStore.getState().publishing.some((p) => p.episodeId === e.id && p.platform === pl)) return;
      s.upsert('publishing', { id: `${e.id}-${pl}`, episodeId: e.id, platform: pl, caption: e.captionZh || `${e.titleZh}｜${e.titleEn}`, hashtags: DEFAULT_TAGS, coverUrl: '', videoUrl: e.finalVideoUrl, scheduledAt: `${e.targetPublishDate} ${e.publishTime || s.project.publishTime}`, status: 'Draft', platformPostId: '', postUrl: '', notes: 'Manual approval required' });
      n++;
    }));
    s.toast(n ? 'success' : 'info', n ? `${n} draft posts planned from episode publish dates` : 'Every episode this month already has posts');
  };

  return (
    <>
      <PageHead title="Publishing Calendar" sub="Instagram Reels & TikTok schedule · PUBLISHING worksheet" actions={<>
        <div className="seg" role="group" aria-label="Platform">
          {(['', 'TikTok', 'Instagram'] as const).map((p) => <button key={p} aria-pressed={platform === p} onClick={() => setPlatform(p)}>{p || 'All'}</button>)}
        </div>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'month'} onClick={() => setView('month')}><CalendarDays size={13} /> Month</button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={13} /> List</button>
        </div>
        {unscheduled.length > 0 && <button className="btn" onClick={scheduleAll}>Schedule {unscheduled.length} episodes</button>}
        <button className="btn" onClick={planMonth} title="Create Draft posts for this month's episodes from their publish dates">Plan this month</button>
        <button className="btn primary" onClick={() => setEdit(newEntry())}><Plus size={15} />Add post</button>
      </>} />
      <div className="mb16"><Banner tone="info" icon={<Send size={15} />}>
        Manual publishing mode. Instagram: <strong>{ig?.state ?? 'Not Connected'}</strong> · TikTok: <strong>{tt?.state ?? 'Not Connected'}</strong>. Prepare captions here, post from the apps yourself, then paste the post URL. Automatic posting is not enabled, and only episodes approved as “Ready to Publish” can be recorded as published.
      </Banner></div>

      {view === 'month' ? (
        <Card title={new Date(month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} actions={<>
          <button className="btn sm icon" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={14} /></button>
          <button className="btn sm" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
          <button className="btn sm icon" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={14} /></button>
        </>} flush>
          <div className="cal">
            {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
            {days.map((d) => {
              const ev = entries.filter((p) => p.scheduledAt.slice(0, 10) === d);
              return (
                <div key={d} className={`day ${d.slice(0, 7) !== month ? 'out' : ''} ${d === today ? 'today' : ''}`}>
                  <span className="dnum">{Number(d.slice(8))}</span>
                  {ev.map((p) => <button key={p.id} className={`evt ${p.platform === 'Instagram' ? 'ig' : ''}`} onClick={() => setEdit({ ...p })} title={`${p.episodeId} · ${p.platform} · ${p.status}`}>{p.platform === 'TikTok' ? 'TT' : 'IG'} {p.episodeId}{p.status === 'Published' ? ' ✓' : ''}</button>)}
                </div>
              );
            })}
          </div>
          <div className="row xs muted" style={{ padding: '10px 14px' }}><span className="row gap4"><span style={{ width: 10, height: 10, borderLeft: '2px solid var(--accent-2)', background: 'var(--surface-3)' }} />TikTok</span><span className="row gap4"><span style={{ width: 10, height: 10, borderLeft: '2px solid var(--accent)', background: 'var(--surface-3)' }} />Instagram</span><span>✓ published</span></div>
        </Card>
      ) : (
        <Card flush>
          <DataTable rows={entries} rowKey={(r) => r.id} pageSize={25} initialSort={{ key: 'date', dir: 1 }} onRowClick={(r) => setEdit({ ...r })} columns={[
            { key: 'date', header: 'Scheduled (MYT)', sort: (r) => r.scheduledAt + r.platform, render: (r) => <span className="nowrap small">{r.scheduledAt ? `${fmtDate(r.scheduledAt.slice(0, 10))} ${r.scheduledAt.slice(11, 16)}` : 'Not scheduled'}</span> },
            { key: 'ep', header: 'Episode', sort: (r) => r.episodeId, render: (r) => <Link to={`/episodes/${r.episodeId}`} onClick={(e) => e.stopPropagation()} className="mono">{r.episodeId}</Link> },
            { key: 'pl', header: 'Platform', sort: (r) => r.platform, render: (r) => <span className="tag">{r.platform}</span> },
            { key: 'cap', header: 'Caption / hashtags', render: (r) => <div style={{ maxWidth: 360 }}><div className="small zh truncate">{r.caption}</div><div className="xs muted truncate">{r.hashtags}</div></div> },
            { key: 'appr', header: 'Approval', render: (r) => <StatusPill status={s.episodes.find((e) => e.id === r.episodeId)?.approvalStatus ?? '—'} /> },
            { key: 'st', header: 'Status', sort: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
            { key: 'url', header: 'Post URL', render: (r) => r.postUrl ? <a href={r.postUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open</a> : <span className="xs faint">—</span> },
            { key: 'c', header: '', render: (r) => <button className="btn sm icon ghost" aria-label="Copy caption" onClick={(e) => { e.stopPropagation(); void copy(r); }}><Copy size={13} /></button> },
          ]} empty={<Empty title="Nothing scheduled" />} />
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.id ? `${edit.episodeId} · ${edit.platform}` : 'Add post'} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
        {edit && (() => {
          const ep = s.episodes.find((e) => e.id === edit.episodeId);
          return (
            <div className="form-grid">
              <Field label="Episode">{(id) => <select id={id} className="select" value={edit.episodeId} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, episodeId: e.target.value })}>{s.episodes.map((e) => <option key={e.id} value={e.id}>{e.id} {e.titleZh}</option>)}</select>}</Field>
              <Field label="Platform">{(id) => <select id={id} className="select" value={edit.platform} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, platform: e.target.value as Platform })}><option>TikTok</option><option>Instagram</option></select>}</Field>
              <div className="full">{ep && <div className="row small"><span className="muted">Approval:</span><StatusPill status={ep.approvalStatus} />{!isPublishable(ep) && <span className="xs muted">Not yet approved for release — can be scheduled, not published.</span>}</div>}</div>
              <Field label="Caption" className="full" hint={`${edit.caption.length} characters`}>{(id) => <textarea id={id} className="textarea zh" value={edit.caption} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} />}</Field>
              <Field label="Hashtags" className="full">{(id) => <input id={id} className="input" value={edit.hashtags} onChange={(e) => setEdit({ ...edit, hashtags: e.target.value })} />}</Field>
              <Field label="Scheduled (Malaysia time)">{(id) => <input id={id} type="datetime-local" className="input" value={edit.scheduledAt.replace(' ', 'T')} onChange={(e) => setEdit({ ...edit, scheduledAt: e.target.value.replace('T', ' ') })} />}</Field>
              <Field label="Publishing status">{(id) => <select id={id} className="select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as PublishStatus })}>{PUBLISH_STATUSES.map((p) => <option key={p} disabled={p === 'Published' && !!ep && !isPublishable(ep)}>{p}</option>)}</select>}</Field>
              <Field label="Cover URL">{(id) => <input id={id} className="input" value={edit.coverUrl} onChange={(e) => setEdit({ ...edit, coverUrl: e.target.value })} />}</Field>
              <Field label="Video URL (final MP4)">{(id) => <input id={id} className="input" value={edit.videoUrl} onChange={(e) => setEdit({ ...edit, videoUrl: e.target.value })} />}</Field>
              <Field label="Published URL" hint="Paste after posting manually.">{(id) => <input id={id} className="input" placeholder="https://www.tiktok.com/@…/video/…" value={edit.postUrl} onChange={(e) => setEdit({ ...edit, postUrl: e.target.value })} />}</Field>
              <Field label="Platform post ID">{(id) => <input id={id} className="input mono" value={edit.platformPostId} onChange={(e) => setEdit({ ...edit, platformPostId: e.target.value })} />}</Field>
              <Field label="Notes" className="full">{(id) => <input id={id} className="input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />}</Field>
              <div className="full row"><button className="btn sm" onClick={() => copy(edit)}><Copy size={12} />Copy caption + hashtags</button>{ep && <Link className="btn sm ghost" to={`/episodes/${ep.id}`}>Open episode</Link>}</div>
            </div>
          );
        })()}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
