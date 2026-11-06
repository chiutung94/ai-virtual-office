import { useState } from 'react';
import { ImageOff, Pencil, Plus, Trash2, User } from 'lucide-react';
import type { Character } from '../../shared/types';
import { useStore } from '../store/store';
import { Card, ConfirmDialog, Empty, Field, Modal, PageHead, SearchInput, type ConfirmOpts } from '../components/ui';

const blank = (n: number): Character => ({ id: `C${String(n).padStart(2, '0')}`, nameZh: '', nameEn: '', age: 30, role: '', appearance: '', wardrobeLock: '', voice: '', continuity: '', imageUrl: '' });

export default function Characters() {
  const { characters, upsert, remove, toast, scriptVersions } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ c: Character; isNew: boolean } | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const list = characters.filter((c) => !q || [c.id, c.nameZh, c.nameEn, c.role].join(' ').toLowerCase().includes(q.toLowerCase()));

  const sceneCount = (id: string) => {
    const latest = new Map<string, number>();
    scriptVersions.forEach((v) => latest.set(v.episodeId, Math.max(latest.get(v.episodeId) ?? 0, v.version)));
    return scriptVersions.filter((v) => latest.get(v.episodeId) === v.version).flatMap((v) => v.scenes).filter((s) => s.characterIds.includes(id)).length;
  };

  const save = () => {
    if (!edit) return;
    const c = edit.c, e: Record<string, string> = {};
    if (!/^C\d{2,}$/.test(c.id)) e.id = 'Format: C01';
    if (edit.isNew && characters.some((x) => x.id === c.id)) e.id = 'ID already exists';
    if (!c.nameZh.trim()) e.nameZh = 'Required';
    if (!c.nameEn.trim()) e.nameEn = 'Required';
    if (c.imageUrl && !/^https?:\/\/|^\/uploads\//.test(c.imageUrl)) e.imageUrl = 'Must be an http(s) URL';
    setErr(e);
    if (Object.keys(e).length) return;
    upsert('characters', c);
    toast('success', `${c.id} saved`);
    setEdit(null);
  };
  const F = (k: keyof Character, label: string, area = false, full = false) => (
    <Field label={label} error={err[k]} className={full ? 'full' : ''}>
      {(id) => area
        ? <textarea id={id} className="textarea" value={String(edit!.c[k] ?? '')} onChange={(e) => setEdit({ ...edit!, c: { ...edit!.c, [k]: e.target.value } })} />
        : <input id={id} className="input" value={String(edit!.c[k] ?? '')} type={k === 'age' ? 'number' : 'text'} onChange={(e) => setEdit({ ...edit!, c: { ...edit!.c, [k]: k === 'age' ? Number(e.target.value) : e.target.value } })} />}
    </Field>
  );

  return (
    <>
      <PageHead title="Character Library" sub="Locked character bible for visual and voice continuity · CHARACTERS worksheet" actions={<>
        <div style={{ width: 240 }}><SearchInput value={q} onChange={setQ} placeholder="Search characters…" /></div>
        <button className="btn primary" onClick={() => { setErr({}); setEdit({ c: blank(characters.length + 1), isNew: true }); }}><Plus size={15} />Add character</button>
      </>} />
      {list.length ? (
        <div className="grid g3">
          {list.map((c) => (
            <Card key={c.id}>
              <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 96, flexShrink: 0 }}>
                  <div className="avatar" aria-label={c.imageUrl ? `${c.nameEn} reference` : 'No reference image'}>
                    {c.imageUrl ? <img src={c.imageUrl} alt={`${c.nameEn} reference`} /> : <div className="col" style={{ alignItems: 'center', gap: 4 }}><User size={22} /><span className="xs">No image</span></div>}
                  </div>
                </div>
                <div className="grow">
                  <div className="row between"><span className="tag">{c.id}</span><span className="xs muted">{c.age} yrs</span></div>
                  <h2 className="zh mt8" style={{ fontSize: 17 }}>{c.nameZh}</h2>
                  <div className="small muted">{c.nameEn}</div>
                  <div className="small mt8" style={{ color: 'var(--accent)' }}>{c.role}</div>
                </div>
              </div>
              <dl className="col mt16" style={{ gap: 10, margin: '16px 0 0' }}>
                {([['Appearance', c.appearance], ['Wardrobe lock', c.wardrobeLock], ['Voice', c.voice], ['Continuity notes', c.continuity]] as const).map(([k, v]) => (
                  <div key={k}><dt className="label">{k}</dt><dd className="small" style={{ margin: '2px 0 0' }}>{v || <span className="faint">—</span>}</dd></div>
                ))}
              </dl>
              <div className="divider" />
              <div className="row between">
                <span className="xs muted">In {sceneCount(c.id)} scenes (latest scripts)</span>
                <div className="row">
                  <button className="btn sm" onClick={() => { setErr({}); setEdit({ c: { ...c }, isNew: false }); }}><Pencil size={12} />Edit</button>
                  <button className="btn sm icon ghost" aria-label={`Delete ${c.nameEn}`} onClick={() => setConfirm({
                    title: `Delete ${c.id} ${c.nameZh}?`, tone: 'danger', confirmLabel: 'Delete character',
                    message: sceneCount(c.id) ? `This character appears in ${sceneCount(c.id)} scenes. Those scenes will keep the ID ${c.id} but lose the profile.` : 'This cannot be undone.',
                    onConfirm: () => { remove('characters', c.id); toast('success', `${c.id} deleted`); },
                  })}><Trash2 size={13} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty title="No characters match" icon={<ImageOff size={28} />} /></Card>}

      <Modal open={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.isNew ? 'Add character' : `Edit ${edit?.c.id}`} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={save}>Save character</button></>}>
        {edit && (
          <div className="form-grid">
            <Field label="Character ID" error={err.id}>{(id) => <input id={id} className="input mono" value={edit.c.id} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, c: { ...edit.c, id: e.target.value.toUpperCase() } })} />}</Field>
            {F('age', 'Age')}
            {F('nameZh', 'Chinese name')}
            {F('nameEn', 'English name')}
            {F('role', 'Role', false, true)}
            {F('appearance', 'Appearance description', true, true)}
            {F('wardrobeLock', 'Wardrobe lock', true)}
            {F('voice', 'Voice description', true)}
            {F('continuity', 'Continuity notes', true, true)}
            {F('imageUrl', 'Reference image URL', false, true)}
          </div>
        )}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
