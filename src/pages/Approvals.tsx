import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { PIPELINE, type ApprovalStage } from '../../shared/types';
import { latestScript, useStore } from '../store/store';
import { Banner, Card, DataTable, Empty, PageHead, SearchInput, StatusPill, Tabs, fmtDateTime, relTime } from '../components/ui';
import { ApprovalActions } from '../components/shared';

type Tab = 'script' | 'video' | 'publish' | 'all' | 'log';
const TAB_STAGES: Record<Exclude<Tab, 'log'>, ApprovalStage[]> = {
  script: ['Under Review', 'Changes Requested'],
  video: ['In Production', 'Final Review'],
  publish: ['Ready to Publish'],
  all: [...PIPELINE, 'Changes Requested', 'Rejected'],
};

export default function Approvals() {
  const s = useStore();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) ?? 'script';
  const setTab = (t: Tab) => { sp.set('tab', t); setSp(sp, { replace: true }); };
  const [q, setQ] = useState('');

  const counts = useMemo(() => Object.fromEntries(PIPELINE.map((p) => [p, s.episodes.filter((e) => e.approvalStatus === p).length])), [s.episodes]);
  const queue = tab === 'log' ? [] : s.episodes.filter((e) => TAB_STAGES[tab].includes(e.approvalStatus) && (!q || `${e.id} ${e.titleZh} ${e.titleEn}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.approvalStatus === 'Under Review' || a.approvalStatus === 'Final Review' ? -1 : 0) - (b.approvalStatus === 'Under Review' || b.approvalStatus === 'Final Review' ? -1 : 0) || a.number - b.number);
  const log = s.approvals.filter((a) => !q || `${a.episodeId} ${a.comment} ${a.reviewer}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title="Approval Centre" sub="Human-in-the-loop review. Nothing publishes without explicit approval." actions={
        <span className="row small muted"><ShieldCheck size={15} />Reviewing as <strong className="strong">{s.settings.reviewerName}</strong> · <Link to="/settings">change</Link></span>
      } />

      <Card>
        <div className="grid g6" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 0 }}>
          {PIPELINE.map((p, i) => (
            <div key={p} style={{ padding: '4px 10px', borderLeft: i ? '1px solid var(--border)' : undefined }}>
              <div className="xs muted">{String(i + 1).padStart(2, '0')} · {p}</div>
              <div className="strong" style={{ fontSize: 22 }}>{counts[p]}</div>
            </div>
          ))}
        </div>
        <div className="xs faint mt8">Draft → Under Review → Approved → In Production → Final Review → Ready to Publish → Published. “Request changes” returns work to its author; “Reject” closes the episode until reopened.</div>
      </Card>

      <div className="mt24 row between wrap">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[
          { id: 'script', label: `Script review (${s.episodes.filter((e) => TAB_STAGES.script.includes(e.approvalStatus)).length})` },
          { id: 'video', label: `Video review (${s.episodes.filter((e) => TAB_STAGES.video.includes(e.approvalStatus)).length})` },
          { id: 'publish', label: `Ready to publish (${counts['Ready to Publish']})` },
          { id: 'all', label: 'All episodes' },
          { id: 'log', label: `Decision log (${s.approvals.length})` },
        ]} />
        <div style={{ width: 260, marginBottom: 18 }}><SearchInput value={q} onChange={setQ} placeholder="Filter…" /></div>
      </div>

      {tab === 'publish' && <div className="mb16"><Banner tone="info">Publishing is manual in this build. Post the approved cut yourself, record the post URL in the <Link to="/calendar">Publishing Calendar</Link>, then click “Mark as published”.</Banner></div>}

      {tab !== 'log' ? (
        queue.length ? (
          <div className="col gap16">
            {queue.slice(0, tab === 'all' ? 60 : 30).map((e) => {
              const scr = latestScript(s.scriptVersions, e.id);
              const last = s.approvals.find((a) => a.episodeId === e.id);
              return (
                <Card key={e.id}>
                  <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
                    <div className="grow" style={{ minWidth: 240 }}>
                      <div className="row wrap"><Link to={`/episodes/${e.id}`} className="mono strong">{e.id}</Link><span className="zh strong">{e.titleZh}</span><span className="muted small">{e.titleEn}</span></div>
                      <div className="small muted mt8 clamp2">{e.synopsis}</div>
                      <div className="row wrap mt8 xs muted">
                        <StatusPill status={e.approvalStatus} />
                        {scr && <span>Script v{scr.version} · {scr.scenes.length} scenes · {scr.scenes.reduce((a, b) => a + b.duration, 0)}s{scr.source !== 'manual' && <span className="pill warning" style={{ marginLeft: 6 }}>{scr.source === 'ai' ? 'AI draft' : 'Demo template'}</span>}</span>}
                        <span>Video: {e.videoStatus} · Edit: {e.editingStatus}</span>
                      </div>
                      {last && <div className="xs faint mt8">Last: {last.action} by {last.reviewer} {relTime(last.timestamp)}{last.comment && <> — “{last.comment}”</>}</div>}
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end' }}>
                      <ApprovalActions episodeId={e.id} size="sm" />
                      <div className="row">
                        {TAB_STAGES.script.includes(e.approvalStatus) && <Link className="btn sm ghost" to={`/episodes/${e.id}`}>Read script</Link>}
                        {TAB_STAGES.video.includes(e.approvalStatus) && <Link className="btn sm ghost" to={`/editing?ep=${e.id}`}>View edit</Link>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : <Card><Empty title="Queue is clear">No episodes waiting at this stage.</Empty></Card>
      ) : (
        <Card flush>
          <DataTable rows={log} rowKey={(r) => r.id} pageSize={25} columns={[
            { key: 'time', header: 'Timestamp', sort: (r) => r.timestamp, render: (r) => <span className="small nowrap">{fmtDateTime(r.timestamp)}</span> },
            { key: 'ep', header: 'Episode', sort: (r) => r.episodeId, render: (r) => <Link to={`/episodes/${r.episodeId}`} className="mono">{r.episodeId}</Link> },
            { key: 'subj', header: 'Subject', render: (r) => r.subject },
            { key: 'act', header: 'Decision', sort: (r) => r.action, render: (r) => <StatusPill status={r.action === 'Approved' || r.action === 'Published' ? 'Approved' : r.action === 'Changes Requested' ? 'Changes Requested' : r.action === 'Rejected' ? 'Rejected' : 'In Progress'} dot={false} /> },
            { key: 'flow', header: 'Transition', render: (r) => <span className="small muted nowrap">{r.from} → {r.to}</span> },
            { key: 'who', header: 'Reviewer', sort: (r) => r.reviewer, render: (r) => r.reviewer },
            { key: 'c', header: 'Comment', render: (r) => <span className="small">{r.comment || '—'}</span> },
          ]} initialSort={{ key: 'time', dir: -1 }} empty={<Empty title="No decisions recorded" />} />
        </Card>
      )}
    </>
  );
}
