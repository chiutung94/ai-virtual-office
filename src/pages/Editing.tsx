import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, Film, Scissors } from 'lucide-react';
import type { EditJob } from '../../shared/types';
import { latestScript, useStore } from '../store/store';
import { Banner, Card, Empty, Field, PageHead, StatusPill, download } from '../components/ui';
import { ApprovalActions, EpisodePicker, PipelineBar, useEpisodeParam } from '../components/shared';
import { buildCues } from '../lib/subtitles';

const RENDER: EditJob['renderStatus'][] = ['Not Started', 'Assembling', 'Rendering', 'Rendered', 'Approved'];

export default function Editing() {
  const s = useStore();
  const [epId, setEp] = useEpisodeParam();
  const ep = s.episodes.find((e) => e.id === epId);
  const clips = s.clips.filter((c) => c.episodeId === epId);
  const job: EditJob = s.editJobs.find((j) => j.episodeId === epId) ?? { episodeId: epId, music: '', subtitlesBurned: false, renderStatus: 'Not Started', renderUrl: '', notes: '', clipOrder: clips.sort((a, b) => a.sceneNumber - b.sceneNumber).map((c) => c.id) };
  const ordered = useMemo(() => {
    const ids = [...job.clipOrder.filter((id) => clips.some((c) => c.id === id)), ...clips.filter((c) => !job.clipOrder.includes(c.id)).sort((a, b) => a.sceneNumber - b.sceneNumber).map((c) => c.id)];
    return ids.map((id) => clips.find((c) => c.id === id)!);
  }, [job.clipOrder, clips]);
  const total = ordered.reduce((a, b) => a + b.duration, 0);
  const shotstack = s.integrations?.find((i) => i.id === 'shotstack');
  const update = (p: Partial<EditJob>) => s.upsertEditJob({ ...job, clipOrder: ordered.map((c) => c.id), ...p });
  const move = (i: number, d: -1 | 1) => { const ids = ordered.map((c) => c.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; update({ clipOrder: ids }); };
  const missing = ordered.filter((c) => !c.clipUrl || c.clipUrl.startsWith('blob:'));

  const exportShotstack = () => {
    const script = latestScript(s.scriptVersions, epId);
    let t = 0;
    const videoClips = ordered.map((c) => { const clip = { asset: { type: 'video', src: c.clipUrl.startsWith('/') ? `${location.origin}${c.clipUrl}` : c.clipUrl || 'REPLACE_WITH_CLIP_URL' }, start: t, length: c.duration, fit: 'cover' }; t += c.duration; return clip; });
    const subs = job.subtitlesBurned && script ? buildCues(script.scenes).map((q) => ({
      asset: { type: 'title', text: `${q.zh}\n${q.en}`, style: 'subtitle', size: 'small', position: 'bottom' }, start: Number(q.start.toFixed(2)), length: Number((q.end - q.start).toFixed(2)),
    })) : [];
    const edit = {
      timeline: { background: '#000000', tracks: [...(subs.length ? [{ clips: subs }] : []), { clips: videoClips }], ...(job.music ? { soundtrack: { src: 'REPLACE_WITH_MUSIC_URL', effect: 'fadeOut' } } : {}) },
      output: { format: 'mp4', size: { width: 1080, height: 1920 }, fps: 30 },
      merge: [{ find: 'episode', replace: epId }],
    };
    download(`${epId}.shotstack.json`, JSON.stringify(edit, null, 2));
    s.toast('success', 'Shotstack edit JSON exported');
  };

  if (!ep) return <Empty title="Episode not found" />;
  return (
    <>
      <PageHead title="Editing Studio" sub="Assemble scene clips, music and subtitles into the final 9:16 cut" actions={<EpisodePicker value={epId} onChange={setEp} />} />
      {shotstack?.state !== 'Connected' && <div className="mb16"><Banner tone="warning">Shotstack is <strong>{shotstack?.state ?? 'Not Connected'}</strong>. Cloud rendering is not available from the app yet — export the edit JSON and render in Shotstack or your editor, then paste the render URL below.</Banner></div>}
      <Card>
        <PipelineBar stage={ep.approvalStatus} />
        <div className="divider" />
        <div className="row between wrap"><span className="zh strong">{ep.id} · {ep.titleZh}</span><ApprovalActions episodeId={ep.id} /></div>
      </Card>

      <div className="grid g3 mt16" style={{ alignItems: 'start' }}>
        <Card className="span2" title="Timeline" sub={`${ordered.length} clips · ${total}s (target ${ep.targetDuration}s, format 45–90s)`} actions={<button className="btn sm" onClick={exportShotstack} disabled={!ordered.length}><Download size={12} />Export Shotstack JSON</button>} flush>
          {ordered.length ? (
            <>
              <div style={{ display: 'flex', gap: 2, padding: '14px 18px' }} aria-hidden>
                {ordered.map((c) => <div key={c.id} title={`S${c.sceneNumber} · ${c.duration}s`} style={{ flex: c.duration, height: 34, borderRadius: 4, background: c.clipUrl ? 'var(--accent-soft)' : 'var(--surface-3)', border: `1px solid ${c.clipUrl ? 'rgba(139,124,246,.4)' : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center', fontSize: 11 }}>S{c.sceneNumber}</div>)}
              </div>
              <div className="list">
                {ordered.map((c, i) => (
                  <div key={c.id} className="list-item">
                    <span className="mono small" style={{ width: 28 }}>{i + 1}</span>
                    <Film size={15} className="muted" />
                    <div className="grow"><div className="small">Scene {c.sceneNumber} · {c.duration}s</div><div className="xs muted truncate">{c.fileName ?? (c.clipUrl || 'No clip attached')}</div></div>
                    <StatusPill status={c.generationStatus} />
                    <button className="btn sm icon ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
                    <button className="btn sm icon ghost" aria-label="Move down" disabled={i === ordered.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
                  </div>
                ))}
              </div>
              {missing.length > 0 && <div style={{ padding: '0 18px 14px' }}><Banner tone="warning">{missing.length} clip(s) have no persistent file URL. The exported JSON contains placeholders for them.</Banner></div>}
            </>
          ) : <Empty title="No clips for this episode" icon={<Scissors size={28} />}><Link to={`/video?ep=${epId}`}>Add scene clips in Video Production</Link></Empty>}
        </Card>

        <Card title="Edit settings">
          <div className="col gap16">
            <Field label="Render status">{(id) => <select id={id} className="select" value={job.renderStatus} onChange={(e) => { update({ renderStatus: e.target.value as EditJob['renderStatus'] }); s.toast('success', 'Render status updated'); }}>{RENDER.map((r) => <option key={r}>{r}</option>)}</select>}</Field>
            <Field label="Music">{(id) => <select id={id} className="select" value={job.music} onChange={(e) => update({ music: e.target.value })}><option value="">None</option>{s.assets.filter((a) => a.type === 'Music').map((a) => <option key={a.id} value={`${a.id} ${a.name}`}>{a.id} {a.name}</option>)}</select>}</Field>
            <label className="check"><input type="checkbox" checked={job.subtitlesBurned} onChange={(e) => update({ subtitlesBurned: e.target.checked })} />Burn in bilingual subtitles</label>
            <Field label="Final render URL">{(id) => <input id={id} className="input" placeholder="https://…" defaultValue={job.renderUrl} key={epId + job.renderUrl} onBlur={(e) => { if (e.target.value !== job.renderUrl) { update({ renderUrl: e.target.value }); s.toast('success', 'Render URL saved'); } }} />}</Field>
            {job.renderUrl && <video src={job.renderUrl} controls style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: 360 }} />}
            <Field label="Editor notes">{(id) => <textarea id={id} className="textarea" defaultValue={job.notes} key={epId} onBlur={(e) => update({ notes: e.target.value })} />}</Field>
            <button className="btn" disabled title="Requires a verified Shotstack connection and render endpoint (next build stage)">Render with Shotstack</button>
          </div>
        </Card>
      </div>
    </>
  );
}
