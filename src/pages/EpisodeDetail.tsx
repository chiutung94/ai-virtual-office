import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Film, PenSquare, Trash2 } from 'lucide-react';
import { WORK_STATUSES, PUBLISH_STATUSES, type Continuity, type Episode } from '../../shared/types';
import { latestScript, useStore } from '../store/store';
import { Banner, Card, ConfirmDialog, Empty, Field, PageHead, StatusPill, Tabs, fmtDate, fmtDateTime, type ConfirmOpts } from '../components/ui';
import { ApprovalActions, CharacterChips, PipelineBar } from '../components/shared';

type Tab = 'overview' | 'scenes' | 'shots' | 'continuity' | 'files' | 'history';

export default function EpisodeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useStore();
  const ep = s.episodes.find((e) => e.id === id);
  const [tab, setTab] = useState<Tab>('overview');
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  if (!ep) return <Empty title={`Episode ${id} not found`}><Link to="/episodes">Back to episodes</Link></Empty>;

  const script = latestScript(s.scriptVersions, ep.id);
  const shots = s.shots.filter((x) => x.episodeId === ep.id).sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber);
  const posts = s.publishing.filter((x) => x.episodeId === ep.id);
  const history = s.approvals.filter((a) => a.episodeId === ep.id);
  const cont: Continuity = s.continuity.find((c) => c.episodeId === ep.id) ?? { episodeId: ep.id, timelineDate: '', facts: '', stateChanges: '', propsCostume: '', unresolved: '', nextConstraints: '' };
  const idx = s.episodes.findIndex((e) => e.id === ep.id);
  const prev = s.episodes[idx - 1], next = s.episodes[idx + 1];
  const loc = (lid: string) => s.locations.find((l) => l.id === lid);
  const ch = (cid: string) => s.characters.find((c) => c.id === cid);
  const total = script?.scenes.reduce((a, b) => a + b.duration, 0) ?? 0;

  const patch = (p: Partial<Episode>, msg?: string) => {
    s.updateEpisode(ep.id, p);
    if (msg) { s.log({ actor: s.settings.reviewerName, episodeId: ep.id, message: `${ep.id} ${msg}`, level: 'info' }); s.toast('success', 'Saved'); }
  };
  const textField = (k: keyof Episode, label: string, area = true, full = true) => (
    <Field key={`${ep.id}-${k}`} label={label} className={full ? 'full' : ''} hint="Saved when you leave the field">{(fid) => area
      ? <textarea id={fid} className="textarea" defaultValue={String(ep[k] ?? '')} onBlur={(e) => { if (e.target.value !== ep[k]) patch({ [k]: e.target.value } as Partial<Episode>, `${label.toLowerCase()} updated`); }} />
      : <input id={fid} className="input" defaultValue={String(ep[k] ?? '')} onBlur={(e) => { if (e.target.value !== ep[k]) patch({ [k]: e.target.value } as Partial<Episode>, `${label.toLowerCase()} updated`); }} />}
    </Field>
  );
  const contField = (k: keyof Continuity, label: string) => (
    <Field key={`${ep.id}-c-${k}`} label={label} className="full">{(fid) => (
      <textarea id={fid} className="textarea" defaultValue={cont[k]} onBlur={(e) => { if (e.target.value !== cont[k]) { s.upsertContinuity({ ...cont, [k]: e.target.value }); s.toast('success', 'Continuity saved'); } }} />
    )}</Field>
  );

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
        sub={<>{ep.titleEn} · {ep.arc} · target {ep.targetDuration}s · publish {fmtDate(ep.targetPublishDate)} {ep.publishTime} MYT · <span className="mono xs">{s.project.code}-{ep.id}</span></>}
        actions={<>
          <Link className="btn" to={`/script/${ep.id}`}><PenSquare size={14} />Script Studio</Link>
          <Link className="btn" to={`/video?ep=${ep.id}`}><Film size={14} />Production</Link>
        </>}
      />
      {ep.blocker && <div className="mb16"><Banner tone="warning"><strong>Blocker:</strong> {ep.blocker}</Banner></div>}
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
        { id: 'shots', label: `Shots & prompts (${shots.length})` },
        { id: 'continuity', label: 'Continuity' },
        { id: 'files', label: 'Production files' },
        { id: 'history', label: `Status history (${history.length})` },
      ]} /></div>

      {tab === 'overview' && (
        <div className="grid g3" style={{ alignItems: 'start' }}>
          <Card className="span2" title="Story">
            <div className="form-grid">
              {textField('synopsis', 'Logline')}
              {textField('cliffhanger', 'Cliffhanger')}
              {textField('captionZh', 'Caption (中文)', true, false)}
              {textField('captionEn', 'Caption (English)', true, false)}
              {textField('notes', 'Review notes')}
              {textField('finalVideoUrl', 'Final video URL', false)}
            </div>
          </Card>
          <Card title="Status" sub="PRODUCTION worksheet">
            <div className="col gap16">
              {([['scriptStatus', 'Script'], ['storyboardStatus', 'Storyboard'], ['videoStatus', 'Video'], ['editingStatus', 'Editing']] as [keyof Episode, string][]).map(([k, label]) => (
                <Field key={k} label={label}>{(fid) => (
                  <select id={fid} className="select" value={ep[k] as string} onChange={(e) => patch({ [k]: e.target.value } as Partial<Episode>, `${label.toLowerCase()} status → ${e.target.value}`)}>{WORK_STATUSES.map((w) => <option key={w}>{w}</option>)}</select>
                )}</Field>
              ))}
              {(['instagramStatus', 'tiktokStatus'] as const).map((k) => (
                <Field key={k} label={k === 'instagramStatus' ? 'Instagram' : 'TikTok'} hint="“Published” is set only by the approval workflow.">{(fid) => (
                  <select id={fid} className="select" value={ep[k]} onChange={(e) => patch({ [k]: e.target.value } as Partial<Episode>, `${k === 'instagramStatus' ? 'Instagram' : 'TikTok'} → ${e.target.value}`)}>
                    {PUBLISH_STATUSES.map((w) => <option key={w} disabled={w === 'Published' && ep[k] !== 'Published'}>{w}</option>)}
                  </select>
                )}</Field>
              ))}
              <div className="grid g2">
                <Field label="Publish date">{(fid) => <input id={fid} type="date" className="input" value={ep.targetPublishDate} onChange={(e) => patch({ targetPublishDate: e.target.value })} />}</Field>
                <Field label="Time (MYT)">{(fid) => <input id={fid} type="time" className="input" value={ep.publishTime} onChange={(e) => patch({ publishTime: e.target.value })} />}</Field>
              </div>
              {textField('owner', 'Owner', false)}
              {textField('blocker', 'Blocker')}
              <div className="xs faint">Last updated {fmtDateTime(ep.updatedAt)}</div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'scenes' && (
        script ? (
          <Card title={`Script v${script.version}`} sub={`${script.scenes.length} scenes · ${total}s total (target ${ep.targetDuration}s) · saved ${fmtDateTime(script.savedAt)} by ${script.savedBy}`} actions={<Link className="btn sm" to={`/script/${ep.id}`}>Edit in Script Studio</Link>}>
            {(script.source === 'ai' || script.source === 'demo-template') && <div className="mb16"><Banner tone="warning">This version came from {script.source === 'ai' ? 'AI generation' : 'a sample template'} — review before approval.</Banner></div>}
            {script.scenes.map((sc) => (
              <div key={sc.id} className="scene-card">
                <div className="scene-head">
                  <div className="row wrap"><span className="strong">Scene {sc.number}</span>{sc.title && <span className="zh strong">{sc.title}</span>}<span className="zh small muted">{loc(sc.locationId)?.nameZh ?? sc.locationId}</span><span className="small muted">{loc(sc.locationId)?.nameEn}{sc.timeOfDay && ` · ${sc.timeOfDay}`}</span></div>
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
                        <span className="tag" style={{ minWidth: 70 }}>{d.speaker || ch(d.characterId)?.nameZh.split(' / ')[0] || '旁白 VO'}</span>
                        <div><div className="zh">{d.zh}</div><div className="small muted">{d.en}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        ) : <Card><Empty title="No script yet" icon={<FileText size={28} />}><Link to={`/script/${ep.id}`} className="btn sm primary mt8">Open Script Studio</Link></Empty></Card>
      )}

      {tab === 'shots' && (
        <Card title="Shots & prompts" sub="SHOT_LIST worksheet" actions={<Link className="btn sm" to={`/storyboard?ep=${ep.id}`}>Edit shot list</Link>} flush>
          {shots.length ? (
            <div className="list">{shots.map((sh) => (
              <div key={sh.id} className="list-item">
                <span className="tag">S{sh.sceneNumber}·{sh.shotNumber}</span>
                <div className="grow">
                  <div className="small"><CharacterChips ids={sh.characterIds} /> · {sh.duration}s · {sh.aspectRatio} · {sh.resolution}</div>
                  <div className="small muted mt8 mono" style={{ whiteSpace: 'pre-wrap' }}>{sh.prompt}</div>
                  {sh.negativePrompt && <div className="xs faint mt8">Negative: {sh.negativePrompt}</div>}
                  {sh.notes && <div className="xs mt8">{sh.notes}</div>}
                </div>
                <StatusPill status={sh.generationStatus} />
              </div>
            ))}</div>
          ) : <Empty title="No shots planned yet" />}
        </Card>
      )}

      {tab === 'continuity' && (
        <Card title="Continuity" sub="CONTINUITY worksheet — fed into AI script generation for the next episode">
          <div className="form-grid">
            {contField('timelineDate', 'Timeline / date')}
            {contField('facts', 'Facts established')}
            {contField('stateChanges', 'Character state changes')}
            {contField('propsCostume', 'Props & costume changes')}
            {contField('unresolved', 'Unresolved questions')}
            {contField('nextConstraints', 'Constraints for next episode')}
          </div>
        </Card>
      )}

      {tab === 'files' && (
        <div className="grid g2">
          <Card title="Generated clips" sub="SHOT_LIST video_url" flush>
            {shots.length ? <div className="list">{shots.map((c) => (
              <div key={c.id} className="list-item">
                <span className="tag">S{c.sceneNumber}·{c.shotNumber}</span>
                <div className="grow small">{c.fileName ?? (c.videoUrl || 'No clip yet')}<div className="xs muted">{c.duration}s{c.klingTaskId && ` · task ${c.klingTaskId}`}</div></div>
                {c.videoUrl ? <a href={c.videoUrl} target="_blank" rel="noreferrer" className="btn sm"><ExternalLink size={12} />Open</a> : null}
                <StatusPill status={c.generationStatus} />
              </div>))}</div> : <Empty title="No clips yet" />}
            {ep.finalVideoUrl && <div style={{ padding: 14 }}><a href={ep.finalVideoUrl} target="_blank" rel="noreferrer" className="btn sm"><ExternalLink size={12} />Final video</a></div>}
          </Card>
          <Card title="Publishing" sub="PUBLISHING worksheet" flush>
            {posts.length ? <div className="list">{posts.map((p) => (
              <div key={p.id} className="list-item">
                <span className="tag">{p.platform}</span>
                <div className="grow small"><div className="zh truncate">{p.caption}</div><div className="xs muted">{p.scheduledAt || 'Not scheduled'}{p.notes && ` · ${p.notes}`}</div></div>
                {p.postUrl && <a className="btn sm" href={p.postUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a>}
                <StatusPill status={p.status} />
              </div>))}</div> : <Empty title="Not in the publishing calendar"><Link to="/calendar">Open calendar</Link></Empty>}
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
          message: 'This removes the episode and its scripts, shots, continuity and publishing entries from local data. Rows already in Google Sheets are not deleted.',
          onConfirm: () => {
            const st = useStore.getState();
            st.replaceCollection('scriptVersions', st.scriptVersions.filter((x) => x.episodeId !== ep.id));
            st.replaceCollection('shots', st.shots.filter((x) => x.episodeId !== ep.id));
            st.replaceCollection('continuity', st.continuity.filter((x) => x.episodeId !== ep.id));
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
