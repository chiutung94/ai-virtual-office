import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { GENERATION_STATUSES, WORK_STATUSES, type GenerationStatus, type Shot, type WorkStatus } from '../../shared/types';
import { latestScript, useStore } from '../store/store';
import { Banner, Card, ConfirmDialog, DataTable, Empty, Field, Modal, PageHead, StatusPill, type ConfirmOpts } from '../components/ui';
import { CharacterChips, EpisodePicker, useEpisodeParam } from '../components/shared';

export const DEFAULT_NEGATIVE = 'cartoon, anime, plastic skin, distorted anatomy, face drift, text, watermark';
export const nextShotId = (shots: Shot[], ep: string) => {
  const n = Math.max(0, ...shots.filter((s) => s.episodeId === ep).map((s) => Number(s.id.match(/-S(\d+)/)?.[1] ?? 0))) + 1;
  return `${ep}-S${String(n).padStart(2, '0')}`;
};

export default function Storyboard() {
  const s = useStore();
  const [epId, setEp] = useEpisodeParam();
  const ep = s.episodes.find((e) => e.id === epId);
  const shots = s.shots.filter((x) => x.episodeId === epId).sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber);
  const script = latestScript(s.scriptVersions, epId);
  const [edit, setEdit] = useState<{ v: Shot; isNew: boolean } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const total = shots.reduce((a, b) => a + b.duration, 0);

  const identity = (ids: string[]) => ids.map((id) => s.characters.find((c) => c.id === id)).filter(Boolean)
    .map((c) => `${c!.nameEn.split(' / ').pop()}: ${c!.appearance || c!.role}; wardrobe: ${c!.wardrobeLock || 'per wardrobe lock'}`).join(' | ');
  const refs = (ids: string[]) => ids.map((id) => s.characters.find((c) => c.id === id)?.imageUrl || `[${id} master portrait URL]`);

  const breakdown = () => setConfirm({
    title: 'Create shots from script?', confirmLabel: 'Create shots', tone: 'primary',
    message: `Creates one shot per scene from script v${script?.version} using a rule-based template (no AI). Prompts include the characters' appearance and wardrobe locks. Existing shots are kept.`,
    onConfirm: () => {
      if (!script) return;
      script.scenes.forEach((sc) => {
        const all = useStore.getState().shots;
        const loc = s.locations.find((l) => l.id === sc.locationId);
        s.upsert('shots', {
          id: nextShotId(all, epId), episodeId: epId, sceneNumber: sc.number, shotNumber: all.filter((x) => x.episodeId === epId && x.sceneNumber === sc.number).length + 1,
          characterIds: sc.characterIds, referenceUrls: refs(sc.characterIds),
          prompt: `Photorealistic cinematic live-action Chinese short drama, vertical 9:16. ${loc ? `${loc.nameEn}: ${loc.description}. ` : ''}${sc.visualAction} ${sc.camera ? `Camera: ${sc.camera}. ` : ''}${sc.characterIds.length ? `Identity locks — ${identity(sc.characterIds)}.` : ''}`,
          negativePrompt: DEFAULT_NEGATIVE, duration: Math.min(10, Math.max(5, sc.duration)), aspectRatio: '9:16', resolution: '720p',
          generationStatus: 'Prompt Draft', klingTaskId: '', videoUrl: '', retryCount: 0, credits: 0, notes: sc.title ? `Scene: ${sc.title}` : '',
        });
      });
      if (ep && ep.storyboardStatus === 'Not Started') s.updateEpisode(epId, { storyboardStatus: 'In Progress' });
      s.toast('success', `Shots created for ${script.scenes.length} scenes`);
    },
  });

  const saveShot = () => {
    if (!edit) return;
    if (!edit.v.prompt.trim()) { s.toast('error', 'Prompt is required'); return; }
    if (edit.isNew && s.shots.some((x) => x.id === edit.v.id)) { s.toast('error', `${edit.v.id} already exists`); return; }
    s.upsert('shots', edit.v);
    s.toast('success', 'Shot saved');
    setEdit(null);
  };
  const newShot = (): Shot => ({
    id: nextShotId(s.shots, epId), episodeId: epId, sceneNumber: shots.at(-1)?.sceneNumber ?? 1, shotNumber: (shots.filter((x) => x.sceneNumber === (shots.at(-1)?.sceneNumber ?? 1)).length || 0) + 1,
    characterIds: [], referenceUrls: [], prompt: '', negativePrompt: DEFAULT_NEGATIVE, duration: 5, aspectRatio: '9:16', resolution: '720p',
    generationStatus: 'Prompt Draft', klingTaskId: '', videoUrl: '', retryCount: 0, credits: 0, notes: '',
  });
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); s.toast('success', 'Copied'); } catch { s.toast('error', 'Clipboard not available'); } };
  const markAllReady = () => {
    shots.filter((x) => x.generationStatus === 'Prompt Draft').forEach((x) => s.upsert('shots', { ...x, generationStatus: 'Prompt Ready' }));
    s.toast('success', 'Draft prompts marked Prompt Ready');
  };

  return (
    <>
      <PageHead title="Storyboard & Shot List" sub="Shot prompts with identity locks · SHOT_LIST worksheet" actions={<EpisodePicker value={epId} onChange={setEp} />} />
      <div className="mb16"><Banner tone="info">Budget guard (from your workbook): about 5 generated clips per episode, using still-image inserts where possible. Approve the script and storyboard before spending Kling credits.</Banner></div>
      {ep && (
        <Card>
          <div className="row between wrap">
            <div><span className="zh strong">{ep.id} · {ep.titleZh}</span> <span className="muted small">· {shots.length} shots · {total}s generated footage · target {ep.targetDuration}s</span></div>
            <div className="row wrap">
              <span className="label">Storyboard status</span>
              <select className="select" style={{ width: 170 }} value={ep.storyboardStatus} aria-label="Storyboard status" onChange={(e) => { s.updateEpisode(ep.id, { storyboardStatus: e.target.value as WorkStatus }); s.toast('success', 'Storyboard status updated'); }}>
                {WORK_STATUSES.map((w) => <option key={w}>{w}</option>)}
              </select>
              <button className="btn" onClick={breakdown} disabled={!script}><Wand2 size={14} />Shots from script</button>
              <button className="btn" onClick={markAllReady} disabled={!shots.some((x) => x.generationStatus === 'Prompt Draft')}>Mark prompts ready</button>
              <button className="btn primary" onClick={() => setEdit({ v: newShot(), isNew: true })}><Plus size={14} />Add shot</button>
            </div>
          </div>
          {!script && <div className="mt16"><Banner tone="info">No script for this episode yet. <Link to={`/script/${epId}`}>Write one in Script Studio</Link> first.</Banner></div>}
          {shots.length > 6 && <div className="mt16"><Banner tone="warning">{shots.length} shots planned — above the ~5 clips/episode budget guideline.</Banner></div>}
        </Card>
      )}

      <Card className="mt16" flush>
        <DataTable rows={shots} rowKey={(r) => r.id} pageSize={25} columns={[
          { key: 'id', header: 'Shot', sort: (r) => r.sceneNumber * 100 + r.shotNumber, render: (r) => <div className="nowrap"><div className="mono">{r.id.replace(`${epId}-`, '')}</div><div className="xs muted">Scene {r.sceneNumber} · #{r.shotNumber}</div></div> },
          { key: 'prompt', header: 'Prompt', render: (r) => <div style={{ maxWidth: 440, minWidth: 220 }}><div className="xs mono clamp2" title={r.prompt}>{r.prompt}</div>{r.negativePrompt && <div className="xs faint truncate" title={r.negativePrompt}>− {r.negativePrompt}</div>}</div> },
          { key: 'chars', header: 'Characters', render: (r) => <CharacterChips ids={r.characterIds} /> },
          { key: 'refs', header: 'Refs', render: (r) => <span className="xs muted" title={r.referenceUrls.join('\n')}>{r.referenceUrls.filter((u) => /^https?:/.test(u)).length}/{r.referenceUrls.length} linked</span> },
          { key: 'dur', header: 'Sec', sort: (r) => r.duration, render: (r) => r.duration },
          { key: 'fmt', header: 'Format', render: (r) => <span className="xs nowrap">{r.aspectRatio} · {r.resolution}</span> },
          { key: 'st', header: 'Status', sort: (r) => GENERATION_STATUSES.indexOf(r.generationStatus), render: (r) => <StatusPill status={r.generationStatus} /> },
          { key: 'a', header: '', render: (r) => (
            <div className="row nowrap">
              <button className="btn sm icon ghost" aria-label="Copy prompt" onClick={() => copy(r.prompt)}><Copy size={13} /></button>
              <button className="btn sm icon ghost" aria-label="Edit shot" onClick={() => setEdit({ v: { ...r }, isNew: false })}><Pencil size={13} /></button>
              <button className="btn sm icon ghost" aria-label="Delete shot" onClick={() => setConfirm({ title: `Delete shot ${r.id}?`, tone: 'danger', confirmLabel: 'Delete', message: 'Removes it locally. A row already in Google Sheets is not deleted.', onConfirm: () => { s.remove('shots', r.id); s.toast('success', 'Shot deleted'); } })}><Trash2 size={13} /></button>
            </div>) },
        ]} empty={<Empty title="No shots planned">Use “Shots from script” or add shots manually.</Empty>} />
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.isNew ? 'Add shot' : `Edit ${edit?.v.id}`} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={saveShot}>Save shot</button></>}>
        {edit && (() => {
          const v = edit.v, set = (p: Partial<Shot>) => setEdit({ ...edit, v: { ...v, ...p } });
          return (
            <div className="form-grid">
              <Field label="Shot ID">{(id) => <input id={id} className="input mono" value={v.id} disabled={!edit.isNew} onChange={(e) => set({ id: e.target.value.toUpperCase() })} />}</Field>
              <div className="grid g2">
                <Field label="Scene">{(id) => <input id={id} type="number" min={1} className="input" value={v.sceneNumber} onChange={(e) => set({ sceneNumber: Number(e.target.value) })} />}</Field>
                <Field label="Shot #">{(id) => <input id={id} type="number" min={1} className="input" value={v.shotNumber} onChange={(e) => set({ shotNumber: Number(e.target.value) })} />}</Field>
              </div>
              <Field label="Prompt" className="full" hint="Keep identity and wardrobe locks from the Character Library.">{(id) => <textarea id={id} className="textarea mono" style={{ minHeight: 120 }} value={v.prompt} onChange={(e) => set({ prompt: e.target.value })} />}</Field>
              <Field label="Negative prompt" className="full">{(id) => <input id={id} className="input mono" value={v.negativePrompt} onChange={(e) => set({ negativePrompt: e.target.value })} />}</Field>
              <div className="field full"><span className="label">Characters</span><div className="row wrap">{s.characters.map((c) => (
                <label key={c.id} className="check small"><input type="checkbox" checked={v.characterIds.includes(c.id)} onChange={(e) => {
                  const ids = e.target.checked ? [...v.characterIds, c.id] : v.characterIds.filter((x) => x !== c.id);
                  set({ characterIds: ids, referenceUrls: refs(ids) });
                }} />{c.id} <span className="zh">{c.nameZh.split(' / ')[0]}</span></label>
              ))}</div></div>
              <Field label="Reference asset URLs" className="full" hint="Semicolon-separated. Filled from master portraits in the Character Library.">{(id) => <input id={id} className="input mono" value={v.referenceUrls.join(';')} onChange={(e) => set({ referenceUrls: e.target.value.split(';').map((x) => x.trim()).filter(Boolean) })} />}</Field>
              <Field label="Duration (s)">{(id) => <input id={id} type="number" min={1} max={10} className="input" value={v.duration} onChange={(e) => set({ duration: Number(e.target.value) })} />}</Field>
              <Field label="Status">{(id) => <select id={id} className="select" value={v.generationStatus} onChange={(e) => set({ generationStatus: e.target.value as GenerationStatus })}>{GENERATION_STATUSES.map((g) => <option key={g}>{g}</option>)}</select>}</Field>
              <Field label="Aspect ratio">{(id) => <select id={id} className="select" value={v.aspectRatio} onChange={(e) => set({ aspectRatio: e.target.value })}>{['9:16', '16:9', '1:1'].map((x) => <option key={x}>{x}</option>)}</select>}</Field>
              <Field label="Resolution">{(id) => <select id={id} className="select" value={v.resolution} onChange={(e) => set({ resolution: e.target.value })}>{['720p', '1080p'].map((x) => <option key={x}>{x}</option>)}</select>}</Field>
              <Field label="Notes" className="full">{(id) => <textarea id={id} className="textarea" value={v.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
            </div>
          );
        })()}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
