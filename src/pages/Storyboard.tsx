import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, LayoutGrid, List, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { WORK_STATUSES, type Shot, type WorkStatus } from '../../shared/types';
import { latestScript, useStore } from '../store/store';
import { Banner, Card, ConfirmDialog, DataTable, Empty, Field, Modal, PageHead, StatusPill, type ConfirmOpts } from '../components/ui';
import { CharacterChips, EpisodePicker, useEpisodeParam } from '../components/shared';

const SHOT_TYPES = ['ECU', 'CU', 'MCU', 'MS', 'WS', 'EWS', 'OTS', 'POV', 'Insert', 'Aerial'];

export default function Storyboard() {
  const s = useStore();
  const [epId, setEp] = useEpisodeParam();
  const ep = s.episodes.find((e) => e.id === epId);
  const shots = s.shots.filter((x) => x.episodeId === epId).sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber);
  const script = latestScript(s.scriptVersions, epId);
  const [view, setView] = useState<'table' | 'board'>('table');
  const [edit, setEdit] = useState<Shot | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const total = shots.reduce((a, b) => a + b.duration, 0);

  const charLock = (ids: string[]) => ids.map((id) => s.characters.find((c) => c.id === id)).filter(Boolean).map((c) => `${c!.nameEn} (${c!.wardrobeLock.split('.')[0]})`).join('; ');

  const breakdown = () => setConfirm({
    title: 'Create shots from script?', confirmLabel: 'Create shots', tone: 'primary',
    message: `Creates one establishing shot per scene from script v${script?.version} using a rule-based template (not AI). Existing shots for ${epId} are kept; new shots are appended.`,
    onConfirm: () => {
      if (!script) return;
      script.scenes.forEach((sc) => {
        const existing = useStore.getState().shots.filter((x) => x.episodeId === epId && x.sceneNumber === sc.number);
        const n = existing.length + 1;
        const loc = s.locations.find((l) => l.id === sc.locationId);
        s.upsert('shots', {
          id: `${epId}-S${sc.number}-SH${n}`, episodeId: epId, sceneNumber: sc.number, shotNumber: n, shotType: 'MS', camera: sc.camera, description: sc.visualAction,
          visualPrompt: `Photorealistic live-action cinematic, vertical 9:16. ${loc?.nameEn ?? ''}, ${sc.timeOfDay.toLowerCase()}. ${sc.visualAction} Characters: ${charLock(sc.characterIds)}. Lighting: ${loc?.lighting ?? ''}. Shallow depth of field, film grain.`,
          characterIds: sc.characterIds, duration: sc.duration, storyboardStatus: 'In Progress',
        });
      });
      if (ep && ep.storyboardStatus === 'Not Started') s.updateEpisode(epId, { storyboardStatus: 'In Progress' });
      s.toast('success', `Shots created for ${script.scenes.length} scenes`);
    },
  });

  const saveShot = () => {
    if (!edit) return;
    if (!edit.visualPrompt.trim()) { s.toast('error', 'Visual prompt is required'); return; }
    s.upsert('shots', { ...edit, id: edit.id || `${epId}-S${edit.sceneNumber}-SH${edit.shotNumber}` });
    s.toast('success', 'Shot saved');
    setEdit(null);
  };
  const newShot = (): Shot => {
    const sc = shots.at(-1)?.sceneNumber ?? 1;
    const n = shots.filter((x) => x.sceneNumber === sc).length + 1;
    return { id: '', episodeId: epId, sceneNumber: sc, shotNumber: n, shotType: 'MS', camera: '', description: '', visualPrompt: '', characterIds: [], duration: 4, storyboardStatus: 'Not Started' };
  };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); s.toast('success', 'Prompt copied'); } catch { s.toast('error', 'Clipboard not available'); } };

  return (
    <>
      <PageHead title="Storyboard & Shot List" sub="Shot breakdown and locked visual prompts · SHOT_LIST worksheet" actions={<EpisodePicker value={epId} onChange={setEp} />} />
      {ep && (
        <Card>
          <div className="row between wrap">
            <div><span className="zh strong">{ep.id} · {ep.titleZh}</span> <span className="muted small">· {shots.length} shots · {total}s planned · target {ep.targetDuration}s</span></div>
            <div className="row wrap">
              <span className="label">Storyboard status</span>
              <select className="select" style={{ width: 170 }} value={ep.storyboardStatus} aria-label="Storyboard status" onChange={(e) => { s.updateEpisode(ep.id, { storyboardStatus: e.target.value as WorkStatus }); s.toast('success', 'Storyboard status updated'); }}>
                {WORK_STATUSES.map((w) => <option key={w}>{w}</option>)}
              </select>
              <div className="seg" role="group" aria-label="View">
                <button aria-pressed={view === 'table'} onClick={() => setView('table')}><List size={13} /></button>
                <button aria-pressed={view === 'board'} onClick={() => setView('board')}><LayoutGrid size={13} /></button>
              </div>
              <button className="btn" onClick={breakdown} disabled={!script}><Wand2 size={14} />Shots from script</button>
              <button className="btn primary" onClick={() => setEdit(newShot())}><Plus size={14} />Add shot</button>
            </div>
          </div>
          {!script && <div className="mt16"><Banner tone="info">No script for this episode yet. <Link to={`/script/${epId}`}>Write one in Script Studio</Link> first.</Banner></div>}
        </Card>
      )}

      <div className="mt16">
        {view === 'table' ? (
          <Card flush>
            <DataTable rows={shots} rowKey={(r) => r.id} pageSize={25} columns={[
              { key: 'id', header: 'Shot', sort: (r) => r.sceneNumber * 100 + r.shotNumber, render: (r) => <span className="mono nowrap">S{r.sceneNumber}·{r.shotNumber}</span> },
              { key: 'type', header: 'Type', render: (r) => <span className="tag">{r.shotType}</span> },
              { key: 'desc', header: 'Description / camera', render: (r) => <div style={{ minWidth: 200 }}><div className="small">{r.description}</div><div className="xs muted">{r.camera}</div></div> },
              { key: 'prompt', header: 'Visual prompt', render: (r) => <div className="xs muted mono clamp2" style={{ maxWidth: 380 }} title={r.visualPrompt}>{r.visualPrompt}</div> },
              { key: 'chars', header: 'Characters', render: (r) => <CharacterChips ids={r.characterIds} /> },
              { key: 'dur', header: 'Sec', sort: (r) => r.duration, render: (r) => r.duration },
              { key: 'st', header: 'Status', sort: (r) => r.storyboardStatus, render: (r) => <StatusPill status={r.storyboardStatus} /> },
              { key: 'a', header: '', render: (r) => (
                <div className="row nowrap">
                  <button className="btn sm icon ghost" aria-label="Copy prompt" onClick={() => copy(r.visualPrompt)}><Copy size={13} /></button>
                  <button className="btn sm icon ghost" aria-label="Edit shot" onClick={() => setEdit({ ...r })}><Pencil size={13} /></button>
                  <button className="btn sm icon ghost" aria-label="Delete shot" onClick={() => setConfirm({ title: `Delete shot ${r.id}?`, tone: 'danger', confirmLabel: 'Delete', message: 'This cannot be undone.', onConfirm: () => { s.remove('shots', r.id); s.toast('success', 'Shot deleted'); } })}><Trash2 size={13} /></button>
                </div>) },
            ]} empty={<Empty title="No shots planned">Use “Shots from script” or add shots manually.</Empty>} />
          </Card>
        ) : shots.length ? (
          <div className="grid g4">
            {shots.map((r) => (
              <Card key={r.id}>
                <div className="avatar" style={{ aspectRatio: '9/16', maxHeight: 220 }}><span className="xs">9:16 frame · {r.shotType}</span></div>
                <div className="row between mt8"><span className="mono small">S{r.sceneNumber}·{r.shotNumber}</span><StatusPill status={r.storyboardStatus} /></div>
                <div className="small mt8 clamp2">{r.description}</div>
                <div className="row mt8"><button className="btn sm" onClick={() => setEdit({ ...r })}>Edit</button><button className="btn sm ghost" onClick={() => copy(r.visualPrompt)}>Copy prompt</button></div>
              </Card>
            ))}
          </div>
        ) : <Card><Empty title="No shots planned" /></Card>}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.id ? `Edit ${edit.id}` : 'Add shot'} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={saveShot}>Save shot</button></>}>
        {edit && (
          <div className="form-grid">
            <Field label="Scene number">{(id) => <input id={id} type="number" min={1} className="input" value={edit.sceneNumber} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, sceneNumber: Number(e.target.value) })} />}</Field>
            <Field label="Shot number">{(id) => <input id={id} type="number" min={1} className="input" value={edit.shotNumber} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, shotNumber: Number(e.target.value) })} />}</Field>
            <Field label="Shot type">{(id) => <select id={id} className="select" value={edit.shotType} onChange={(e) => setEdit({ ...edit, shotType: e.target.value })}>{SHOT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
            <Field label="Duration (s)">{(id) => <input id={id} type="number" min={1} className="input" value={edit.duration} onChange={(e) => setEdit({ ...edit, duration: Number(e.target.value) })} />}</Field>
            <Field label="Camera" className="full">{(id) => <input id={id} className="input" value={edit.camera} onChange={(e) => setEdit({ ...edit, camera: e.target.value })} />}</Field>
            <Field label="Description" className="full">{(id) => <textarea id={id} className="textarea" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />}</Field>
            <Field label="Visual prompt" className="full" hint="Include wardrobe locks from the Character Library for continuity.">{(id) => <textarea id={id} className="textarea mono" style={{ minHeight: 110 }} value={edit.visualPrompt} onChange={(e) => setEdit({ ...edit, visualPrompt: e.target.value })} />}</Field>
            <div className="field full"><span className="label">Characters</span><div className="row wrap">{s.characters.map((c) => (
              <label key={c.id} className="check small"><input type="checkbox" checked={edit.characterIds.includes(c.id)} onChange={(e) => setEdit({ ...edit, characterIds: e.target.checked ? [...edit.characterIds, c.id] : edit.characterIds.filter((x) => x !== c.id) })} />{c.id} <span className="zh">{c.nameZh.split(' / ')[0]}</span></label>
            ))}</div></div>
            <Field label="Status">{(id) => <select id={id} className="select" value={edit.storyboardStatus} onChange={(e) => setEdit({ ...edit, storyboardStatus: e.target.value as WorkStatus })}>{WORK_STATUSES.map((w) => <option key={w}>{w}</option>)}</select>}</Field>
          </div>
        )}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
