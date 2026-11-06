import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, History, Lock, Plus, Save, Send, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { DialogueLine, Scene } from '../../shared/types';
import { latestScript, uid, useStore } from '../store/store';
import { api } from '../lib/api';
import { Banner, Card, ConfirmDialog, Field, PageHead, StatusPill, fmtDateTime, type ConfirmOpts } from '../components/ui';
import { EpisodePicker } from '../components/shared';

const blankScene = (n: number): Scene => ({ id: uid('sc'), number: n, locationId: 'L01', timeOfDay: 'Night', characterIds: [], visualAction: '', camera: '', sfx: '', duration: 15, dialogue: [] });

/** Clearly-labelled offline template so the workflow can be exercised without an API key. */
function demoTemplate(epTitle: string, synopsis: string): Scene[] {
  return [
    { ...blankScene(1), locationId: 'L04', characterIds: ['C01'], duration: 15, visualAction: `[DEMO TEMPLATE] Hook: ${synopsis}`, camera: 'ECU → slow push-in, 9:16', sfx: 'Rain, low drone', dialogue: [{ id: uid('dl'), characterId: 'C01', zh: '【示例台词】这一次，我不会再输。', en: '[Demo line] This time, I will not lose.', emotion: 'cold' }] },
    { ...blankScene(2), locationId: 'L01', characterIds: ['C03', 'C04'], duration: 25, visualAction: `[DEMO TEMPLATE] Antagonists react — ${epTitle}.`, camera: 'MCU alternating, rack focus', sfx: 'Clock ticking', dialogue: [{ id: uid('dl'), characterId: 'C03', zh: '【示例台词】她到底是谁？', en: '[Demo line] Who exactly is she?', emotion: 'tense' }] },
    { ...blankScene(3), locationId: 'L05', characterIds: ['C01', 'C02'], duration: 25, visualAction: '[DEMO TEMPLATE] Cliffhanger beat.', camera: 'Two-shot, smash cut to black', sfx: 'Single piano note', dialogue: [{ id: uid('dl'), characterId: 'C02', zh: '【示例台词】下一步呢？', en: '[Demo line] What is the next move?', emotion: 'serious' }] },
  ];
}

export default function ScriptStudio() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useStore();
  const epId = id ?? 'EP001';
  const ep = s.episodes.find((e) => e.id === epId) ?? s.episodes[0];
  const versions = useMemo(() => s.scriptVersions.filter((v) => v.episodeId === ep?.id).sort((a, b) => b.version - a.version), [s.scriptVersions, ep?.id]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const openai = s.integrations?.find((i) => i.id === 'openai');
  const aiReady = openai?.state === 'Connected';

  useEffect(() => {
    const l = ep ? latestScript(useStore.getState().scriptVersions, ep.id) : undefined;
    setScenes(l ? structuredClone(l.scenes) : []);
    setBaseVersion(l?.version ?? null);
    setDirty(false); setNote(''); setGenError('');
  }, [ep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!ep) return null;
  const locked = !['Draft', 'Changes Requested', 'Rejected'].includes(ep.approvalStatus);
  const total = scenes.reduce((a, b) => a + (Number(b.duration) || 0), 0);
  const durTone = total < 45 || total > 90 ? 'danger' : Math.abs(total - ep.targetDuration) > 10 ? 'warning' : 'success';

  const mutate = (fn: (sc: Scene[]) => Scene[]) => { setScenes((prev) => fn(structuredClone(prev)).map((x, i) => ({ ...x, number: i + 1 }))); setDirty(true); };
  const patchScene = (i: number, p: Partial<Scene>) => mutate((sc) => { sc[i] = { ...sc[i], ...p }; return sc; });
  const patchLine = (i: number, j: number, p: Partial<DialogueLine>) => mutate((sc) => { sc[i].dialogue[j] = { ...sc[i].dialogue[j], ...p }; return sc; });

  const validate = () => {
    if (!scenes.length) return 'Add at least one scene.';
    for (const sc of scenes) {
      if (!sc.visualAction.trim()) return `Scene ${sc.number} needs a visual action.`;
      if (sc.dialogue.some((d) => !d.zh.trim())) return `Scene ${sc.number} has an empty Mandarin line.`;
    }
    return '';
  };

  const save = (silent = false) => {
    const err = validate();
    if (err) { s.toast('error', err); return false; }
    const v = s.saveScript(ep.id, scenes, note || 'Draft saved', 'manual');
    setBaseVersion(v.version); setDirty(false); setNote('');
    if (!silent) s.toast('success', `Saved as v${v.version}`);
    return true;
  };

  const submit = () => {
    const err = validate();
    if (err) { s.toast('error', err); return; }
    const action = ep.approvalStatus === 'Changes Requested' ? 'resubmit' : 'submit';
    setConfirm({
      title: `Submit ${ep.id} for approval`, confirmLabel: 'Submit for approval', commentLabel: 'Note to reviewer',
      message: `${dirty ? 'Unsaved changes will be saved as a new version, then ' : 'The latest version '}will be sent to the Approval Centre. Editing locks until a reviewer requests changes.`,
      onConfirm: (c) => {
        if (dirty && !save(true)) throw new Error('Fix validation errors first.');
        if (ep.approvalStatus === 'Rejected') s.transition(ep.id, 'reopen', 'Reopened for resubmission');
        const r = s.transition(ep.id, action, c);
        if (!r.ok) throw new Error(r.error);
        s.toast('success', `${ep.id} submitted for review`);
      },
    });
  };

  const generate = async () => {
    setBusy(true); setGenError('');
    try {
      const idx = s.episodes.findIndex((e) => e.id === ep.id);
      const r = await api.generateScript({
        episode: ep, project: s.project, characters: s.characters.map(({ id, nameZh, nameEn, role, voice, age }) => ({ id, nameZh, nameEn, role, voice, age })),
        locations: s.locations.map(({ id, nameZh, nameEn }) => ({ id, nameZh, nameEn })),
        previousSynopses: s.episodes.slice(Math.max(0, idx - 3), idx).map((e) => `${e.id}: ${e.synopsis}`),
      });
      const sc = (r.scenes as Partial<Scene>[]).map((x, i) => ({
        ...blankScene(i + 1), ...x, id: uid('sc'), number: i + 1,
        dialogue: (x.dialogue ?? []).map((d) => ({ ...d, id: uid('dl') })) as DialogueLine[],
      }));
      setScenes(sc); setDirty(true); setNote(`AI draft (${r.model})`);
      const v = s.saveScript(ep.id, sc, `AI draft (${r.model}) — unreviewed`, 'ai');
      setBaseVersion(v.version); setDirty(false);
      s.toast('success', `AI draft saved as v${v.version}. Review before submitting.`);
    } catch (e) {
      setGenError((e as Error).message);
    } finally { setBusy(false); }
  };

  const insertDemo = () => setConfirm({
    title: 'Insert demo template?', confirmLabel: 'Insert template', tone: 'warning',
    message: 'This replaces the editor content with a clearly marked placeholder template (no AI is called). Useful for testing the workflow. You can restore earlier versions from history.',
    onConfirm: () => { setScenes(demoTemplate(ep.titleEn, ep.synopsis)); setDirty(true); setNote('Demo template — not AI generated'); },
  });

  const switchEp = (v: string) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    nav(`/script/${v}`);
  };

  return (
    <>
      <PageHead title="Script Studio" sub="Scene-by-scene bilingual script editor · SCRIPTS worksheet" actions={<EpisodePicker value={ep.id} onChange={switchEp} />} />

      <Card>
        <div className="row between wrap">
          <div>
            <div className="zh strong" style={{ fontSize: 16 }}>{ep.id} · {ep.titleZh}</div>
            <div className="small muted">{ep.titleEn} — {ep.synopsis}</div>
          </div>
          <div className="row wrap">
            <StatusPill status={ep.approvalStatus} />
            <span className={`pill ${durTone}`} title="Total duration vs. target">{total}s / {ep.targetDuration}s</span>
            {baseVersion && <span className="tag">v{baseVersion}{dirty ? ' · edited' : ''}</span>}
          </div>
        </div>
        <div className="divider" />
        <div className="row wrap between">
          <div className="row wrap">
            <button className="btn primary" onClick={generate} disabled={!aiReady || busy || locked} title={aiReady ? 'Generate with OpenAI' : 'Configure and test OpenAI in Settings to enable'}>
              {busy ? <span className="spinner" /> : <Sparkles size={15} />}Generate Script
            </button>
            {!aiReady && <button className="btn warning" onClick={insertDemo} disabled={locked}><Wand2 size={15} />Insert demo template</button>}
            <button className="btn" onClick={() => save()} disabled={!dirty || locked}><Save size={15} />Save Draft</button>
            <button className="btn success" onClick={submit} disabled={locked || !scenes.length}><Send size={15} />Submit for Approval</button>
          </div>
          <input className="input" style={{ maxWidth: 280 }} placeholder="Version note (optional)" aria-label="Version note" value={note} onChange={(e) => setNote(e.target.value)} disabled={locked} />
        </div>
        {!aiReady && <div className="mt16"><Banner tone="warning">AI generation is disabled: OpenAI is <strong>{openai?.state ?? 'Not Connected'}</strong>. Add <code className="inline">OPENAI_API_KEY</code> on the server and run “Test connection” in <Link to="/settings">Settings</Link>. Until then, “Insert demo template” fills placeholder text only — it is not AI output.</Banner></div>}
        {genError && <div className="mt16"><Banner tone="danger">Generation failed: {genError}</Banner></div>}
        {locked && <div className="mt16"><Banner tone="info" icon={<Lock size={15} />}>Editing is locked while the episode is “{ep.approvalStatus}”. A reviewer must request changes to unlock it.</Banner></div>}
        {(total < 45 || total > 90) && scenes.length > 0 && <div className="mt16"><Banner tone="warning">Total runtime {total}s is outside the 45–90 second format.</Banner></div>}
      </Card>

      <div className="grid g3 mt16" style={{ alignItems: 'start' }}>
        <div className="span2">
          {scenes.length === 0 && <Card><div className="empty"><div className="strong">No scenes yet</div><div className="small">Add a scene manually{aiReady ? ' or generate a draft' : ''}.</div></div></Card>}
          {scenes.map((sc, i) => (
            <fieldset key={sc.id} className="scene-card" disabled={locked} style={{ margin: 0, padding: 0, minWidth: 0 }}>
              <legend className="sr-only">Scene {sc.number}</legend>
              <div className="scene-head">
                <span className="strong">Scene {sc.number}</span>
                <div className="row">
                  <button className="btn sm icon ghost" aria-label="Move scene up" disabled={i === 0} onClick={() => mutate((x) => { [x[i - 1], x[i]] = [x[i], x[i - 1]]; return x; })}><ArrowUp size={13} /></button>
                  <button className="btn sm icon ghost" aria-label="Move scene down" disabled={i === scenes.length - 1} onClick={() => mutate((x) => { [x[i + 1], x[i]] = [x[i], x[i + 1]]; return x; })}><ArrowDown size={13} /></button>
                  <button className="btn sm icon ghost" aria-label={`Delete scene ${sc.number}`} onClick={() => setConfirm({ title: `Delete scene ${sc.number}?`, tone: 'danger', confirmLabel: 'Delete', message: 'The scene and its dialogue will be removed from this draft.', onConfirm: () => mutate((x) => x.filter((_, k) => k !== i)) })}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="scene-body">
                <div className="grid g4">
                  <Field label="Location">{(fid) => <select id={fid} className="select" value={sc.locationId} onChange={(e) => patchScene(i, { locationId: e.target.value })}>{s.locations.map((l) => <option key={l.id} value={l.id}>{l.id} {l.nameZh}</option>)}</select>}</Field>
                  <Field label="Time of day">{(fid) => <select id={fid} className="select" value={sc.timeOfDay} onChange={(e) => patchScene(i, { timeOfDay: e.target.value })}>{['Day', 'Night', 'Dusk', 'Dawn', 'Flashback'].map((t) => <option key={t}>{t}</option>)}</select>}</Field>
                  <Field label="Duration (s)">{(fid) => <input id={fid} type="number" min={1} max={60} className="input" value={sc.duration} onChange={(e) => patchScene(i, { duration: Number(e.target.value) })} />}</Field>
                  <div className="field"><span className="label">Characters</span>
                    <div className="row wrap gap4">{s.characters.map((c) => (
                      <label key={c.id} className="check xs" title={c.nameEn}><input type="checkbox" checked={sc.characterIds.includes(c.id)} onChange={(e) => patchScene(i, { characterIds: e.target.checked ? [...sc.characterIds, c.id] : sc.characterIds.filter((x) => x !== c.id) })} />{c.id}</label>
                    ))}</div>
                  </div>
                </div>
                <Field label="Visual action">{(fid) => <textarea id={fid} className="textarea" value={sc.visualAction} onChange={(e) => patchScene(i, { visualAction: e.target.value })} />}</Field>
                <div className="grid g2">
                  <Field label="Camera direction">{(fid) => <textarea id={fid} className="textarea" style={{ minHeight: 56 }} value={sc.camera} onChange={(e) => patchScene(i, { camera: e.target.value })} />}</Field>
                  <Field label="Sound effects">{(fid) => <textarea id={fid} className="textarea" style={{ minHeight: 56 }} value={sc.sfx} onChange={(e) => patchScene(i, { sfx: e.target.value })} />}</Field>
                </div>
                <div>
                  <div className="row between"><span className="label">Dialogue — Mandarin / English</span>
                    <button className="btn sm" onClick={() => mutate((x) => { x[i].dialogue.push({ id: uid('dl'), characterId: sc.characterIds[0] ?? 'C01', zh: '', en: '' }); return x; })}><Plus size={12} />Line</button>
                  </div>
                  <div className="col mt8">
                    {sc.dialogue.map((d, j) => (
                      <div key={d.id} className="dl-row">
                        <select className="select sm" aria-label="Speaker" value={d.characterId} onChange={(e) => patchLine(i, j, { characterId: e.target.value })}>
                          {s.characters.map((c) => <option key={c.id} value={c.id}>{c.id} {c.nameZh.split(' / ')[0]}</option>)}
                        </select>
                        <textarea className="textarea zh" style={{ minHeight: 38 }} aria-label="Mandarin line" placeholder="中文台词" value={d.zh} onChange={(e) => patchLine(i, j, { zh: e.target.value })} />
                        <textarea className="textarea" style={{ minHeight: 38 }} aria-label="English translation" placeholder="English translation" value={d.en} onChange={(e) => patchLine(i, j, { en: e.target.value })} />
                        <button className="btn sm icon ghost" aria-label="Remove line" onClick={() => mutate((x) => { x[i].dialogue.splice(j, 1); return x; })}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {!sc.dialogue.length && <span className="xs faint">No dialogue — silent scene.</span>}
                  </div>
                </div>
              </div>
            </fieldset>
          ))}
          {!locked && <button className="btn mt16" onClick={() => mutate((x) => [...x, blankScene(x.length + 1)])}><Plus size={14} />Add scene</button>}
        </div>

        <Card title={<span className="row"><History size={14} />Version history</span>} sub={`${versions.length} versions · SCRIPT_RUNS`} flush>
          {versions.length ? (
            <div className="list">
              {versions.map((v) => (
                <div key={v.id} className="list-item">
                  <span className="tag">v{v.version}</span>
                  <div className="grow">
                    <div className="small">{v.note || '—'}</div>
                    <div className="xs muted">{v.savedBy} · {fmtDateTime(v.savedAt)} · {v.scenes.length} scenes · {v.scenes.reduce((a, b) => a + b.duration, 0)}s</div>
                    {v.source !== 'manual' && <span className={`pill ${v.source === 'ai' ? 'review' : 'warning'} mt8`}>{v.source === 'ai' ? 'AI generated' : 'Demo template'}</span>}
                  </div>
                  <button className="btn sm" disabled={locked || v.version === baseVersion && !dirty} onClick={() => setConfirm({
                    title: `Restore v${v.version}?`, confirmLabel: 'Load into editor',
                    message: 'The editor content will be replaced. Nothing is saved until you click Save Draft.',
                    onConfirm: () => { setScenes(structuredClone(v.scenes)); setDirty(true); setNote(`Restored from v${v.version}`); },
                  })}>Restore</button>
                </div>
              ))}
            </div>
          ) : <div className="empty small">No saved versions</div>}
        </Card>
      </div>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
