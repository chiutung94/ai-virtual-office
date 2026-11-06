import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Film, PenSquare, Trash2 } from 'lucide-react';
import { WORK_STATUSES, PUBLISH_STATUSES, type Episode, type WorkStatus, type PublishStatus } from '../../shared/types';
import { latestScript, useStore } from '../store/store';
import { Banner, Card, ConfirmDialog, Empty, Field, PageHead, StatusPill, Tabs, fmtDate, fmtDateTime, type ConfirmOpts } from '../components/ui';
import { ApprovalActions, CharacterChips, PipelineBar } from '../components/shared';

type Tab = 'overview' | 'scenes' | 'prompts' | 'files' | 'history';

export default function EpisodeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useStore();
  const ep = s.episodes.find((e) => e.id === id);
  const [tab, setTab] = useState<Tab>('overview');
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  if (!ep) return <Empty title={`Episode ${id} not found`}><Link to="/episodes">Back to episodes</Link></Empty>;

  const script = latestScript(s.scriptVersions, ep.id);
  const shots = s.shots.filter((x) => x.episodeId === ep.id);
  const clips = s.clips.filter((x) => x.episodeId === ep.id);
  const posts = s.publishing.filter((x) => x.episodeId === ep.id);
  const history = s.approvals.filter((a) => a.episodeId === ep.id);
  const idx = s.episodes.findIndex((e) => e.id === ep.id);
  const prev = s.episodes[idx - 1], next = s.episodes[idx + 1];
  const loc = (lid: string) => s.locations.find((l) => l.id === lid);
  const ch = (cid: string) => s.characters.find((c) => c.id === cid);
  const total = script?.scenes.reduce((a, b) => a + b.duration, 0) ?? 0;

  const setStatus = (k: keyof Episode, v: string) => {
    // Publishing can only be set to Published through the approval workflow.
    if (k === 'publishingStatus' && v === 'Published') { s.toast('warning', 'Use “Mark as published” in the approval actions — publishing requires explicit approval.'); return; }
    s.updateEpisode(ep.id, { [k]: v } as Partial<Episode>);
    s.log({ actor: s.settings.reviewerName, episodeId: ep.id, message: `${ep.id} ${String(k).replace('Status', '')} status → ${v}`, level: 'info' });
    s.toast('success', 'Status updated');
  };

  return (
    <>
      <div className="row between mb16 wrap">
        <Link to="/episodes" className="row small"><ArrowLeft size={14} />All episodes</Link>
        <div className="row">
          <button className="btn sm" disabled={!prev} onClick={() => nav(`/episodes/${prev.id}`)} aria-label="Previous episode"><ChevronLeft size={14} />{prev?.id}</button>
          <button className="btn sm" disabled={!next} onClick={() => nav(`/episodes/${next.id}`)} aria-label="Next episode">{next?.id}<ChevronRight size={14} /></button>
        </div>
      </div>
      <PageHead
        title={<span className="zh">{ep.id} · {ep.titleZh}</span>}
        sub={<>{ep.titleEn} · <span className="zh">{ep.arc}</span> · target {ep.targetDuration}s · publish {fmtDate(ep.targetPublishDate)}</>}
        actions={<>
          <Link className="btn" to={`/script/${ep.id}`}><PenSquare size={14} />Script Studio</Link>
          <Link className="btn" to={`/video?ep=${ep.id}`}><Film size={14} />Production</Link>
        </>}
      />
      <Card>
        <PipelineBar stage={ep.approvalStatus} />
        <div className="divider" />
        <div className="row between wrap">
          <div className="row"><span className="label">Current stage</span><StatusPill status={ep.approvalStatus} /></div>
          <ApprovalActions episodeId={ep.id} />
        </div>
      </Card>

      <div className="mt24"><Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'scenes', label: `Scenes & dialogue${script ? ` (${script.scenes.length})` : ''}` },
        { id: 'prompts', label: `Visual prompts (${shots.length})` },
        { id: 'files', label: `Production files (${clips.length})` },
        { id: 'history', label: `Status history (${history.length})` },
      ]} /></div>

      {tab === 'overview' && (
        <div className="grid g3">
          <Card className="span2" title="Synopsis">
            <p>{ep.synopsis || <span className="muted">No synopsis yet.</span>}</p>
            <div className="divider" />
            <Field label="Producer notes">{(fid) => <textarea id={fid} className="textarea" defaultValue={ep.notes} onBlur={(e) => { if (e.target.value !== ep.notes) { s.updateEpisode(ep.id, { notes: e.target.value }); s.toast('success', 'Notes saved'); } }} placeholder="Saved when you leave the field" />}</Field>
          </Card>
          <Card title="Department status" sub="Edit to reflect real progress">
            <div className="col gap16">
              {([['scriptStatus', 'Script'], ['storyboardStatus', 'Storyboard'], ['videoStatus', 'Video'], ['editingStatus', 'Editing']] as [keyof Episode, string][]).map(([k, label]) => (
                <Field key={k} label={label}>{(fid) => (
                  <select id={fid} className="select" value={ep[k] as WorkStatus} onChange={(e) => setStatus(k, e.target.value)}>{WORK_STATUSES.map((w) => <option key={w}>{w}</option>)}</select>
                )}</Field>
              ))}
              <Field label="Publishing" hint="“Published” is only set through the approval workflow.">{(fid) => (
                <select id={fid} className="select" value={ep.publishingStatus} onChange={(e) => setStatus('publishingStatus', e.target.value as PublishStatus)}>{PUBLISH_STATUSES.map((w) => <option key={w} disabled={w === 'Published' && ep.approvalStatus !== 'Published'}>{w}</option>)}</select>
              )}</Field>
              <Field label="Target publish date">{(fid) => <input id={fid} type="date" className="input" value={ep.targetPublishDate} onChange={(e) => s.updateEpisode(ep.id, { targetPublishDate: e.target.value })} />}</Field>
              <div className="xs faint">Last updated {fmtDateTime(ep.updatedAt)}</div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'scenes' && (
        script ? (
          <Card title={`Script v${script.version}`} sub={`${script.scenes.length} scenes · ${total}s total (target ${ep.targetDuration}s) · saved ${fmtDateTime(script.savedAt)} by ${script.savedBy}`} actions={<Link className="btn sm" to={`/script/${ep.id}`}>Edit in Script Studio</Link>}>
            {script.source !== 'manual' && <div className="mb16"><Banner tone="warning">This version was created from a {script.source === 'ai' ? 'AI generation' : 'demo template'} — review before approval.</Banner></div>}
            {script.scenes.map((sc) => (
              <div key={sc.id} className="scene-card">
                <div className="scene-head">
                  <div className="row wrap"><span className="strong">Scene {sc.number}</span><span className="zh small">{loc(sc.locationId)?.nameZh}</span><span className="small muted">{loc(sc.locationId)?.nameEn} · {sc.timeOfDay}</span></div>
                  <div className="row"><CharacterChips ids={sc.characterIds} /><span className="tag">{sc.duration}s</span></div>
                </div>
                <div className="scene-body">
                  <div><span className="label">Visual action</span><p className="small">{sc.visualAction}</p></div>
                  <div className="grid g2">
                    <div><span className="label">Camera</span><p className="small muted">{sc.camera}</p></div>
                    <div><span className="label">Sound</span><p className="small muted">{sc.sfx}</p></div>
                  </div>
                  <div className="col gap4">
                    {sc.dialogue.map((d) => (
                      <div key={d.id} className="row" style={{ alignItems: 'flex-start' }}>
                        <span className="tag" style={{ minWidth: 70 }}>{ch(d.characterId)?.nameZh.split(' / ')[0] ?? d.characterId}</span>
                        <div><div className="zh">{d.zh}</div><div className="small muted">{d.en}{d.emotion && <span className="faint"> · ({d.emotion})</span>}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        ) : <Card><Empty title="No script yet" icon={<FileText size={28} />}><Link to={`/script/${ep.id}`} className="btn sm primary mt8">Open Script Studio</Link></Empty></Card>
      )}

      {tab === 'prompts' && (
        <Card title="Visual prompts" sub="From SHOT_LIST" actions={<Link className="btn sm" to={`/storyboard?ep=${ep.id}`}>Edit shot list</Link>} flush>
          {shots.length ? (
            <div className="list">{shots.map((sh) => (
              <div key={sh.id} className="list-item">
                <span className="tag">{sh.id.replace(ep.id + '-', '')}</span>
                <div className="grow">
                  <div className="small"><span className="strong">{sh.shotType}</span> · {sh.camera} · {sh.duration}s</div>
                  <div className="small muted mt8 mono" style={{ whiteSpace: 'pre-wrap' }}>{sh.visualPrompt}</div>
                </div>
                <StatusPill status={sh.storyboardStatus} />
              </div>
            ))}</div>
          ) : <Empty title="No shots planned yet" />}
        </Card>
      )}

      {tab === 'files' && (
        <div className="grid g2">
          <Card title="Scene clips" sub="PRODUCTION worksheet" flush>
            {clips.length ? <div className="list">{clips.map((c) => (
              <div key={c.id} className="list-item">
                <span className="tag">S{c.sceneNumber}</span>
                <div className="grow small">{c.fileName ?? c.id}<div className="xs muted">{c.duration}s · {c.notes || '—'}</div></div>
                {c.clipUrl ? <a href={c.clipUrl} target="_blank" rel="noreferrer" className="btn sm"><ExternalLink size={12} />Open</a> : <span className="xs faint">no file</span>}
                <StatusPill status={c.generationStatus} />
              </div>))}</div> : <Empty title="No clips yet" />}
          </Card>
          <Card title="Publishing" sub="PUBLISHING worksheet" flush>
            {posts.length ? <div className="list">{posts.map((p) => (
              <div key={p.id} className="list-item">
                <span className="tag">{p.platform}</span>
                <div className="grow small truncate">{p.caption}<div className="xs muted">{fmtDate(p.scheduledDate)}</div></div>
                {p.postUrl && <a className="btn sm" href={p.postUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a>}
                <StatusPill status={p.status} />
              </div>))}</div> : <Empty title="Not in the publishing calendar" />}
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card title="Approval & status history">
          {history.length ? (
            <div className="timeline">
              {history.map((h) => (
                <div key={h.id} className={`ti ${h.action === 'Approved' || h.action === 'Published' ? 'success' : h.action === 'Changes Requested' ? 'warning' : h.action === 'Rejected' ? 'danger' : ''}`}>
                  <div className="row wrap small"><span className="strong">{h.subject} · {h.action}</span><span className="muted">{h.from} → {h.to}</span></div>
                  <div className="xs muted">{h.reviewer} · {fmtDateTime(h.timestamp)}</div>
                  {h.comment && <div className="small mt8">“{h.comment}”</div>}
                </div>
              ))}
            </div>
          ) : <Empty title="No approvals recorded yet" />}
        </Card>
      )}

      <div className="row mt24" style={{ justifyContent: 'flex-end' }}>
        <button className="btn danger sm" onClick={() => setConfirm({
          title: `Delete ${ep.id}?`, tone: 'danger', confirmLabel: 'Delete episode',
          message: 'This removes the episode and its scripts, shots, clips and publishing entries from local data. Rows already in Google Sheets are not deleted.',
          onConfirm: () => {
            const st = useStore.getState();
            st.replaceCollection('scriptVersions', st.scriptVersions.filter((x) => x.episodeId !== ep.id));
            st.replaceCollection('shots', st.shots.filter((x) => x.episodeId !== ep.id));
            st.replaceCollection('clips', st.clips.filter((x) => x.episodeId !== ep.id));
            st.replaceCollection('publishing', st.publishing.filter((x) => x.episodeId !== ep.id));
            st.remove('episodes', ep.id);
            st.log({ actor: st.settings.reviewerName, message: `Deleted ${ep.id}`, level: 'warning' });
            st.toast('success', `${ep.id} deleted`);
            nav('/episodes');
          },
        })}><Trash2 size={13} />Delete episode</button>
      </div>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
