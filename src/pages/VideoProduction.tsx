import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Play, Plus, Trash2, Upload, Wand2 } from 'lucide-react';
import type { GenerationStatus, ProductionClip, WorkStatus } from '../../shared/types';
import { WORK_STATUSES } from '../../shared/types';
import { latestScript, now, useStore } from '../store/store';
import { api } from '../lib/api';
import { Banner, Card, ConfirmDialog, DataTable, Empty, Field, Modal, PageHead, Stat, type ConfirmOpts } from '../components/ui';
import { CharacterChips, EpisodePicker, useEpisodeParam } from '../components/shared';

const GEN: GenerationStatus[] = ['Not Generated', 'Queued', 'Generating', 'Generated', 'Uploaded', 'Failed', 'Approved'];

export default function VideoProduction() {
  const s = useStore();
  const [epId, setEp] = useEpisodeParam();
  const ep = s.episodes.find((e) => e.id === epId);
  const clips = s.clips.filter((c) => c.episodeId === epId).sort((a, b) => a.sceneNumber - b.sceneNumber);
  const script = latestScript(s.scriptVersions, epId);
  const kling = s.integrations?.find((i) => i.id === 'kling');
  const [edit, setEdit] = useState<ProductionClip | null>(null);
  const [preview, setPreview] = useState<ProductionClip | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<ProductionClip | null>(null);

  const done = clips.filter((c) => ['Generated', 'Uploaded', 'Approved'].includes(c.generationStatus)).length;
  const credits = clips.reduce((a, b) => a + (b.credits || 0), 0);

  const fromScript = () => {
    if (!script) return;
    let added = 0;
    script.scenes.forEach((sc) => {
      const id = `CLIP-${epId}-S${sc.number}`;
      if (useStore.getState().clips.some((c) => c.id === id)) return;
      const shot = s.shots.find((x) => x.episodeId === epId && x.sceneNumber === sc.number);
      s.upsert('clips', { id, episodeId: epId, sceneNumber: sc.number, prompt: shot?.visualPrompt ?? sc.visualAction, characterRefs: sc.characterIds, generationStatus: 'Not Generated', clipUrl: '', duration: sc.duration, credits: 0, notes: '', updatedAt: now() });
      added++;
    });
    s.toast(added ? 'success' : 'info', added ? `${added} scene rows created` : 'All scenes already have rows');
  };

  const onFile = async (f: File | undefined) => {
    const c = target.current;
    if (!f || !c) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|webm|m4v)$/i.test(f.name)) { s.toast('error', 'Please choose a video file (mp4, mov, webm).'); return; }
    setUploading(c.id);
    try {
      const r = await api.upload(f);
      s.upsert('clips', { ...c, clipUrl: r.url, fileName: f.name, generationStatus: 'Uploaded', updatedAt: now() });
      s.log({ actor: s.settings.reviewerName, department: 'video', episodeId: epId, message: `${epId} scene ${c.sceneNumber}: clip uploaded (${f.name})`, level: 'success' });
      s.toast('success', `Uploaded ${f.name}`);
    } catch (e) {
      // Backend unavailable: keep a session-only preview and say so.
      const url = URL.createObjectURL(f);
      s.upsert('clips', { ...c, clipUrl: url, fileName: f.name, generationStatus: 'Uploaded', notes: `${c.notes ? c.notes + ' · ' : ''}Local preview only — not stored (server offline)`, updatedAt: now() });
      s.toast('warning', `Server upload failed (${(e as Error).message}). Preview kept for this session only.`);
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = () => {
    if (!edit) return;
    if (edit.clipUrl && !/^(https?:\/\/|\/uploads\/|blob:)/.test(edit.clipUrl)) { s.toast('error', 'Clip URL must be an http(s) link'); return; }
    s.upsert('clips', { ...edit, id: edit.id || `CLIP-${epId}-S${edit.sceneNumber}`, updatedAt: now() });
    s.toast('success', 'Clip saved'); setEdit(null);
  };

  return (
    <>
      <PageHead title="Video Production" sub="Scene-based generation tracker · PRODUCTION worksheet" actions={<EpisodePicker value={epId} onChange={setEp} />} />
      {kling?.state !== 'Connected' && <div className="mb16"><Banner tone="warning">Kling AI is <strong>{kling?.state ?? 'Not Connected'}</strong>. Automatic generation is unavailable — generate clips in Kling manually, then upload them or paste their URLs here. {kling?.state === 'Needs Attention' && kling.detail}</Banner></div>}
      <div className="grid g4">
        <Stat label="Scenes tracked" value={clips.length} hint={script ? `Script v${script.version}: ${script.scenes.length} scenes` : 'No script'} />
        <Stat label="Clips ready" value={`${done}/${clips.length}`} hint="Generated, uploaded or approved" />
        <Stat label="Planned runtime" value={`${clips.reduce((a, b) => a + b.duration, 0)}s`} hint={`Target ${ep?.targetDuration ?? '—'}s`} />
        <Stat label="Generation credits" value={credits} hint="As recorded manually" />
      </div>
      <Card className="mt16" title={ep ? <span className="zh">{ep.id} · {ep.titleZh}</span> : ''} actions={<>
        {ep && <select className="select" style={{ width: 160 }} value={ep.videoStatus} aria-label="Episode video status" onChange={(e) => { s.updateEpisode(ep.id, { videoStatus: e.target.value as WorkStatus }); s.toast('success', 'Video status updated'); }}>{WORK_STATUSES.map((w) => <option key={w}>{w}</option>)}</select>}
        <button className="btn" onClick={fromScript} disabled={!script}><Wand2 size={14} />Rows from script</button>
        <button className="btn" disabled title="Requires a verified Kling AI connection"><Play size={14} />Generate with Kling</button>
        <button className="btn primary" onClick={() => setEdit({ id: '', episodeId: epId, sceneNumber: (clips.at(-1)?.sceneNumber ?? 0) + 1, prompt: '', characterRefs: [], generationStatus: 'Not Generated', clipUrl: '', duration: 10, credits: 0, notes: '', updatedAt: now() })}><Plus size={14} />Add scene</button>
      </>} flush>
        <DataTable rows={clips} rowKey={(r) => r.id} pageSize={25} columns={[
          { key: 'sc', header: 'Scene', sort: (r) => r.sceneNumber, render: (r) => <span className="mono">S{r.sceneNumber}</span> },
          { key: 'p', header: 'Prompt', render: (r) => <div className="xs muted clamp2" style={{ maxWidth: 320 }} title={r.prompt}>{r.prompt || '—'}</div> },
          { key: 'refs', header: 'Character refs', render: (r) => <CharacterChips ids={r.characterRefs} /> },
          { key: 'st', header: 'Kling status', sort: (r) => GEN.indexOf(r.generationStatus), render: (r) => (
            <select className="select sm" style={{ width: 140 }} value={r.generationStatus} aria-label={`Status scene ${r.sceneNumber}`} onClick={(e) => e.stopPropagation()}
              onChange={(e) => { s.upsert('clips', { ...r, generationStatus: e.target.value as GenerationStatus, updatedAt: now() }); }}>
              {GEN.map((g) => <option key={g}>{g}</option>)}
            </select>) },
          { key: 'url', header: 'Clip', render: (r) => r.clipUrl ? <button className="btn sm" onClick={() => setPreview(r)}><Play size={12} />Preview</button> : <span className="xs faint">none</span> },
          { key: 'd', header: 'Sec', sort: (r) => r.duration, render: (r) => r.duration },
          { key: 'cr', header: 'Credits', sort: (r) => r.credits, render: (r) => r.credits },
          { key: 'n', header: 'Notes', render: (r) => <span className="xs muted">{r.notes || '—'}</span> },
          { key: 'a', header: '', render: (r) => <div className="row nowrap">
            <button className="btn sm" disabled={uploading === r.id} onClick={() => { target.current = r; fileRef.current?.click(); }}>{uploading === r.id ? <span className="spinner" /> : <Upload size={12} />}Upload</button>
            <button className="btn sm icon ghost" aria-label="Edit" onClick={() => setEdit({ ...r })}><Pencil size={13} /></button>
            <button className="btn sm icon ghost" aria-label="Delete" onClick={() => setConfirm({ title: `Delete scene ${r.sceneNumber} row?`, tone: 'danger', confirmLabel: 'Delete', message: 'Uploaded files on the server are not deleted.', onConfirm: () => { s.remove('clips', r.id); s.toast('success', 'Row deleted'); } })}><Trash2 size={13} /></button>
          </div> },
        ]} empty={<Empty title="No scenes tracked">{script ? 'Click “Rows from script” to create one row per scene.' : <Link to={`/script/${epId}`}>Write the script first</Link>}</Empty>} />
      </Card>
      <input ref={fileRef} type="file" accept="video/*,.mp4,.mov,.webm,.m4v" hidden onChange={(e) => onFile(e.target.files?.[0])} aria-hidden />

      <Modal open={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.id ? `Edit scene ${edit.sceneNumber}` : 'Add scene'} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
        {edit && <div className="form-grid">
          <Field label="Scene number">{(id) => <input id={id} type="number" min={1} className="input" disabled={!!edit.id} value={edit.sceneNumber} onChange={(e) => setEdit({ ...edit, sceneNumber: Number(e.target.value) })} />}</Field>
          <Field label="Kling status">{(id) => <select id={id} className="select" value={edit.generationStatus} onChange={(e) => setEdit({ ...edit, generationStatus: e.target.value as GenerationStatus })}>{GEN.map((g) => <option key={g}>{g}</option>)}</select>}</Field>
          <Field label="Prompt" className="full">{(id) => <textarea id={id} className="textarea mono" style={{ minHeight: 100 }} value={edit.prompt} onChange={(e) => setEdit({ ...edit, prompt: e.target.value })} />}</Field>
          <Field label="Clip URL" className="full" hint="Paste the Kling download/share link, or use Upload in the table.">{(id) => <input id={id} className="input" value={edit.clipUrl} onChange={(e) => setEdit({ ...edit, clipUrl: e.target.value })} />}</Field>
          <Field label="Duration (s)">{(id) => <input id={id} type="number" min={1} className="input" value={edit.duration} onChange={(e) => setEdit({ ...edit, duration: Number(e.target.value) })} />}</Field>
          <Field label="Generation credits used">{(id) => <input id={id} type="number" min={0} className="input" value={edit.credits} onChange={(e) => setEdit({ ...edit, credits: Number(e.target.value) })} />}</Field>
          <div className="field full"><span className="label">Character references</span><div className="row wrap">{s.characters.map((c) => (
            <label key={c.id} className="check small"><input type="checkbox" checked={edit.characterRefs.includes(c.id)} onChange={(e) => setEdit({ ...edit, characterRefs: e.target.checked ? [...edit.characterRefs, c.id] : edit.characterRefs.filter((x) => x !== c.id) })} />{c.id}</label>
          ))}</div></div>
          <Field label="Notes" className="full">{(id) => <textarea id={id} className="textarea" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />}</Field>
        </div>}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Scene ${preview?.sceneNumber} clip`}>
        {preview && <div className="col">
          <video src={preview.clipUrl} controls style={{ width: '100%', maxHeight: '65vh', background: '#000', borderRadius: 8 }} />
          <a href={preview.clipUrl} target="_blank" rel="noreferrer" className="row small"><ExternalLink size={12} />Open in new tab</a>
        </div>}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
