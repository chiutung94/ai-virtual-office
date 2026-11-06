import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, Pencil, Play, RotateCw, Upload } from 'lucide-react';
import { GENERATION_STATUSES, WORK_STATUSES, type GenerationStatus, type Shot, type WorkStatus } from '../../shared/types';
import { useStore } from '../store/store';
import { api } from '../lib/api';
import { Banner, Card, DataTable, Empty, Field, Modal, PageHead, Stat } from '../components/ui';
import { CharacterChips, EpisodePicker, useEpisodeParam } from '../components/shared';

export default function VideoProduction() {
  const s = useStore();
  const [epId, setEp] = useEpisodeParam();
  const ep = s.episodes.find((e) => e.id === epId);
  const shots = s.shots.filter((c) => c.episodeId === epId).sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber);
  const kling = s.integrations?.find((i) => i.id === 'kling');
  const [edit, setEdit] = useState<Shot | null>(null);
  const [preview, setPreview] = useState<Shot | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<Shot | null>(null);

  const ready = shots.filter((c) => ['Generated', 'Uploaded', 'Approved'].includes(c.generationStatus)).length;
  const credits = shots.reduce((a, b) => a + (b.credits || 0), 0);
  const scriptOk = ep && !['Draft', 'Under Review', 'Changes Requested', 'Rejected'].includes(ep.approvalStatus);
  const setStatus = (r: Shot, st: GenerationStatus) => s.upsert('shots', { ...r, generationStatus: st, retryCount: st === 'Queued' && r.generationStatus === 'Failed' ? r.retryCount + 1 : r.retryCount });

  const onFile = async (f: File | undefined) => {
    const c = target.current;
    if (!f || !c) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|webm|m4v)$/i.test(f.name)) { s.toast('error', 'Please choose a video file (mp4, mov, webm).'); return; }
    setUploading(c.id);
    try {
      const r = await api.upload(f);
      s.upsert('shots', { ...c, videoUrl: r.url, fileName: f.name, generationStatus: 'Uploaded' });
      s.log({ actor: s.settings.reviewerName, department: 'video', episodeId: epId, message: `${c.id}: clip uploaded (${f.name})`, level: 'success' });
      s.toast('success', `Uploaded ${f.name}`);
    } catch (e) {
      s.upsert('shots', { ...c, videoUrl: URL.createObjectURL(f), fileName: f.name, generationStatus: 'Uploaded', notes: `${c.notes ? c.notes + ' · ' : ''}Local preview only — not stored (server offline)` });
      s.toast('warning', `Server upload failed (${(e as Error).message}). Preview kept for this session only.`);
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = () => {
    if (!edit) return;
    if (edit.videoUrl && !/^(https?:\/\/|\/uploads\/|blob:)/.test(edit.videoUrl)) { s.toast('error', 'Video URL must be an http(s) link'); return; }
    s.upsert('shots', edit);
    s.toast('success', 'Shot saved'); setEdit(null);
  };
  const copyFull = async (r: Shot) => {
    try { await navigator.clipboard.writeText(`${r.prompt}\n\nNegative: ${r.negativePrompt}\nAspect ${r.aspectRatio} · ${r.resolution} · ${r.duration}s`); s.toast('success', 'Prompt copied for Kling'); } catch { s.toast('error', 'Clipboard unavailable'); }
  };

  return (
    <>
      <PageHead title="Video Production" sub="Kling generation tracking per shot · SHOT_LIST worksheet" actions={<EpisodePicker value={epId} onChange={setEp} />} />
      {kling?.state !== 'Connected' && <div className="mb16"><Banner tone="warning">Kling AI is <strong>{kling?.state ?? 'Not Connected'}</strong>. Automatic generation isn't available yet. Copy each prompt into Kling, generate the clip, then upload it here or paste its URL and task ID.</Banner></div>}
      {ep && !scriptOk && <div className="mb16"><Banner tone="info">{ep.id}'s script is not approved yet (“{ep.approvalStatus}”). Your workbook's budget guard says to approve the script and storyboard before spending video credits.</Banner></div>}
      <div className="grid g4">
        <Stat label="Shots" value={shots.length} hint="Guideline: ~5 per episode" />
        <Stat label="Clips ready" value={`${ready}/${shots.length}`} hint="Generated, uploaded or approved" />
        <Stat label="Generated footage" value={`${shots.reduce((a, b) => a + b.duration, 0)}s`} hint={`Episode target ${ep?.targetDuration ?? '—'}s`} />
        <Stat label="Kling units used" value={credits} hint="Recorded manually per shot" />
      </div>
      <Card className="mt16" title={ep ? <span className="zh">{ep.id} · {ep.titleZh}</span> : ''} actions={<>
        {ep && <label className="row small muted">Video status <select className="select" style={{ width: 160 }} value={ep.videoStatus} onChange={(e) => { s.updateEpisode(ep.id, { videoStatus: e.target.value as WorkStatus }); s.toast('success', 'Video status updated'); }}>{WORK_STATUSES.map((w) => <option key={w}>{w}</option>)}</select></label>}
        <button className="btn" disabled title="Requires a verified Kling AI connection (next build stage)"><Play size={14} />Generate with Kling</button>
        <Link className="btn" to={`/storyboard?ep=${epId}`}>Edit prompts</Link>
      </>} flush>
        <DataTable rows={shots} rowKey={(r) => r.id} pageSize={25} columns={[
          { key: 'sc', header: 'Shot', sort: (r) => r.sceneNumber * 100 + r.shotNumber, render: (r) => <div className="nowrap"><div className="mono">{r.id.replace(`${epId}-`, '')}</div><div className="xs muted">S{r.sceneNumber}·{r.shotNumber} · {r.duration}s</div></div> },
          { key: 'p', header: 'Prompt', render: (r) => <div className="xs muted clamp2" style={{ maxWidth: 300 }} title={r.prompt}>{r.prompt || '—'}</div> },
          { key: 'refs', header: 'Character refs', render: (r) => <CharacterChips ids={r.characterIds} /> },
          { key: 'st', header: 'Kling status', sort: (r) => GENERATION_STATUSES.indexOf(r.generationStatus), render: (r) => (
            <select className="select sm" style={{ width: 140 }} value={r.generationStatus} aria-label={`Status ${r.id}`} onChange={(e) => setStatus(r, e.target.value as GenerationStatus)}>
              {GENERATION_STATUSES.map((g) => <option key={g}>{g}</option>)}
            </select>) },
          { key: 'task', header: 'Task ID', render: (r) => <span className="mono xs">{r.klingTaskId || '—'}</span> },
          { key: 'url', header: 'Clip', render: (r) => r.videoUrl ? <button className="btn sm" onClick={() => setPreview(r)}><Play size={12} />Preview</button> : <span className="xs faint">none</span> },
          { key: 'retry', header: 'Retries', sort: (r) => r.retryCount, render: (r) => r.retryCount },
          { key: 'cr', header: 'Units', sort: (r) => r.credits, render: (r) => r.credits },
          { key: 'a', header: '', render: (r) => <div className="row nowrap">
            <button className="btn sm icon ghost" aria-label="Copy prompt for Kling" onClick={() => copyFull(r)}><Copy size={13} /></button>
            <button className="btn sm" disabled={uploading === r.id} onClick={() => { target.current = r; fileRef.current?.click(); }}>{uploading === r.id ? <span className="spinner" /> : <Upload size={12} />}Upload</button>
            {r.generationStatus === 'Failed' && <button className="btn sm icon ghost" aria-label="Retry" title="Re-queue (increments retry count)" onClick={() => setStatus(r, 'Queued')}><RotateCw size={13} /></button>}
            <button className="btn sm icon ghost" aria-label="Edit" onClick={() => setEdit({ ...r })}><Pencil size={13} /></button>
          </div> },
        ]} empty={<Empty title="No shots for this episode"><Link to={`/storyboard?ep=${epId}`}>Plan shots in Storyboard & Shot List</Link></Empty>} />
      </Card>
      <input ref={fileRef} type="file" accept="video/*,.mp4,.mov,.webm,.m4v" hidden onChange={(e) => onFile(e.target.files?.[0])} aria-hidden />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Generation — ${edit?.id}`} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
        {edit && <div className="form-grid">
          <Field label="Kling status">{(id) => <select id={id} className="select" value={edit.generationStatus} onChange={(e) => setEdit({ ...edit, generationStatus: e.target.value as GenerationStatus })}>{GENERATION_STATUSES.map((g) => <option key={g}>{g}</option>)}</select>}</Field>
          <Field label="Kling task ID">{(id) => <input id={id} className="input mono" value={edit.klingTaskId} onChange={(e) => setEdit({ ...edit, klingTaskId: e.target.value })} />}</Field>
          <Field label="Video URL" className="full" hint="Kling download link, or use Upload in the table.">{(id) => <input id={id} className="input" value={edit.videoUrl} onChange={(e) => setEdit({ ...edit, videoUrl: e.target.value })} />}</Field>
          <Field label="Kling units used">{(id) => <input id={id} type="number" min={0} className="input" value={edit.credits} onChange={(e) => setEdit({ ...edit, credits: Number(e.target.value) })} />}</Field>
          <Field label="Retry count">{(id) => <input id={id} type="number" min={0} className="input" value={edit.retryCount} onChange={(e) => setEdit({ ...edit, retryCount: Number(e.target.value) })} />}</Field>
          <Field label="Notes" className="full">{(id) => <textarea id={id} className="textarea" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />}</Field>
        </div>}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`${preview?.id} clip`}>
        {preview && <div className="col">
          <video src={preview.videoUrl} controls style={{ width: '100%', maxHeight: '65vh', background: '#000', borderRadius: 8 }} />
          <a href={preview.videoUrl} target="_blank" rel="noreferrer" className="row small"><ExternalLink size={12} />Open in new tab</a>
        </div>}
      </Modal>
    </>
  );
}
