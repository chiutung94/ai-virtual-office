import { useState } from 'react';
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Asset, Location } from '../../shared/types';
import { useStore } from '../store/store';
import { Card, ConfirmDialog, DataTable, Empty, Field, Modal, PageHead, SearchInput, StatusPill, Tabs, type ConfirmOpts } from '../components/ui';

const ASSET_TYPES = ['Character Portrait', 'Full Body', 'Expression Sheet', 'Location Reference', 'Prop', 'Cover', 'Music', 'SFX', 'Voice', 'Logo', 'Other'];
const isUrl = (u: string) => !u || /^(https?:\/\/|\/uploads\/)/.test(u);

export default function Locations() {
  const s = useStore();
  const [tab, setTab] = useState<'locations' | 'assets'>('locations');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [loc, setLoc] = useState<{ v: Location; isNew: boolean } | null>(null);
  const [asset, setAsset] = useState<{ v: Asset; isNew: boolean } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const nextId = (p: string, list: { id: string }[], pad: number) => `${p}${String(Math.max(0, ...list.map((x) => Number(x.id.replace(/\D/g, '')) || 0)) + 1).padStart(pad, '0')}`;
  const types = [...new Set([...ASSET_TYPES, ...s.assets.map((a) => a.type)])];
  const assets = s.assets.filter((a) => (!type || a.type === type) && (!q || `${a.id} ${a.type} ${a.linkedTo} ${a.episodeId} ${a.notes}`.toLowerCase().includes(q.toLowerCase())));

  const saveLoc = () => {
    if (!loc) return;
    if (!loc.v.nameZh.trim() || !loc.v.nameEn.trim()) { s.toast('error', 'Both names are required'); return; }
    if (!isUrl(loc.v.imageUrl)) { s.toast('error', 'Image URL must start with http(s)://'); return; }
    if (loc.isNew && s.locations.some((l) => l.id === loc.v.id)) { s.toast('error', `${loc.v.id} already exists`); return; }
    s.upsert('locations', loc.v); s.toast('success', `${loc.v.id} saved`); setLoc(null);
  };
  const saveAsset = () => {
    if (!asset) return;
    if (!asset.v.url.trim() && !asset.v.notes.trim()) { s.toast('error', 'Add a file URL or a note describing the asset'); return; }
    if (!isUrl(asset.v.url)) { s.toast('error', 'URL must start with http(s)://'); return; }
    s.upsert('assets', asset.v); s.toast('success', `${asset.v.id} saved`); setAsset(null);
  };

  return (
    <>
      <PageHead title="Locations & Assets" sub="Recurring sets and reference files · LOCATIONS & ASSETS worksheets" actions={
        tab === 'locations'
          ? <button className="btn primary" onClick={() => setLoc({ v: { id: nextId('L', s.locations, 2), nameZh: '', nameEn: '', description: '', continuity: '', imageUrl: '' }, isNew: true })}><Plus size={15} />Add location</button>
          : <button className="btn primary" onClick={() => setAsset({ v: { id: nextId('A', s.assets, 3), episodeId: '', type: 'Character Portrait', linkedTo: '', url: '', version: 'v1', approved: false, createdAt: new Date().toISOString().slice(0, 10), notes: '' }, isNew: true })}><Plus size={15} />Add asset</button>
      } />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'locations', label: `Locations (${s.locations.length})` }, { id: 'assets', label: `Assets (${s.assets.length})` }]} />

      {tab === 'locations' ? (
        s.locations.length ? (
          <div className="grid g3">
            {s.locations.map((l) => (
              <Card key={l.id}>
                <div className="avatar" style={{ aspectRatio: '16/9' }}>{l.imageUrl ? <img src={l.imageUrl} alt={l.nameEn} /> : <div className="col" style={{ alignItems: 'center', gap: 4 }}><MapPin size={22} /><span className="xs">No reference image</span></div>}</div>
                <div className="row between mt16"><span className="tag">{l.id}</span>
                  <div className="row"><button className="btn sm icon ghost" aria-label="Edit location" onClick={() => setLoc({ v: { ...l }, isNew: false })}><Pencil size={13} /></button>
                    <button className="btn sm icon ghost" aria-label="Delete location" onClick={() => setConfirm({ title: `Delete ${l.id}?`, tone: 'danger', confirmLabel: 'Delete', message: 'Scenes referencing this location will keep its ID.', onConfirm: () => { s.remove('locations', l.id); s.toast('success', 'Location deleted'); } })}><Trash2 size={13} /></button></div>
                </div>
                <h2 className="zh mt8">{l.nameZh}</h2>
                <div className="small muted">{l.nameEn}</div>
                <p className="small mt8">{l.description}</p>
                {l.continuity && <div className="xs muted mt8"><strong>Continuity:</strong> {l.continuity}</div>}
              </Card>
            ))}
          </div>
        ) : <Card><Empty title="No locations" /></Card>
      ) : (
        <Card flush>
          <div className="row wrap" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: '1 1 220px' }}><SearchInput value={q} onChange={setQ} placeholder="Search assets…" /></div>
            <select className="select" style={{ width: 200 }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Asset type"><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <DataTable rows={assets} rowKey={(r) => r.id} columns={[
            { key: 'id', header: 'ID', sort: (r) => r.id, render: (r) => <span className="mono">{r.id}</span> },
            { key: 'type', header: 'Type', sort: (r) => r.type, render: (r) => <span className="small">{r.type}</span> },
            { key: 'link', header: 'Character / scene', render: (r) => <span className="tag">{r.linkedTo || '—'}</span> },
            { key: 'ep', header: 'Episode', sort: (r) => r.episodeId, render: (r) => <span className="mono xs">{r.episodeId || '—'}</span> },
            { key: 'v', header: 'Version', render: (r) => <span className="xs">{r.version || '—'}</span> },
            { key: 'url', header: 'File', render: (r) => r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="row small"><ExternalLink size={12} />Open</a> : <span className="xs faint">none</span> },
            { key: 'n', header: 'Notes', render: (r) => <span className="xs muted">{r.notes || '—'}</span> },
            { key: 'ap', header: 'Approved', sort: (r) => (r.approved ? 1 : 0), render: (r) => <StatusPill status={r.approved ? 'Approved' : 'Not Started'} /> },
            { key: 'a', header: '', render: (r) => <div className="row nowrap">
              <button className="btn sm icon ghost" aria-label="Edit asset" onClick={() => setAsset({ v: { ...r }, isNew: false })}><Pencil size={13} /></button>
              <button className="btn sm icon ghost" aria-label="Delete asset" onClick={() => setConfirm({ title: `Delete ${r.id}?`, tone: 'danger', confirmLabel: 'Delete', message: `${r.type} — ${r.linkedTo}`, onConfirm: () => { s.remove('assets', r.id); s.toast('success', 'Asset deleted'); } })}><Trash2 size={13} /></button></div> },
          ]} empty={<Empty title="No assets yet">Add approved cast portraits first — they are the identity anchors for every Kling prompt.</Empty>} />
        </Card>
      )}

      <Modal open={!!loc} onClose={() => setLoc(null)} title={loc?.isNew ? 'Add location' : `Edit ${loc?.v.id}`} footer={<><button className="btn" onClick={() => setLoc(null)}>Cancel</button><button className="btn primary" onClick={saveLoc}>Save</button></>}>
        {loc && <div className="form-grid">
          <Field label="Chinese name">{(id) => <input id={id} className="input zh" value={loc.v.nameZh} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, nameZh: e.target.value } })} />}</Field>
          <Field label="English name">{(id) => <input id={id} className="input" value={loc.v.nameEn} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, nameEn: e.target.value } })} />}</Field>
          <Field label="Visual description" className="full">{(id) => <textarea id={id} className="textarea" value={loc.v.description} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, description: e.target.value } })} />}</Field>
          <Field label="Continuity notes" className="full">{(id) => <textarea id={id} className="textarea" value={loc.v.continuity} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, continuity: e.target.value } })} />}</Field>
          <Field label="Reference image URL" className="full">{(id) => <input id={id} className="input" value={loc.v.imageUrl} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, imageUrl: e.target.value } })} />}</Field>
        </div>}
      </Modal>
      <Modal open={!!asset} onClose={() => setAsset(null)} title={asset?.isNew ? 'Add asset' : `Edit ${asset?.v.id}`} footer={<><button className="btn" onClick={() => setAsset(null)}>Cancel</button><button className="btn primary" onClick={saveAsset}>Save</button></>}>
        {asset && (() => {
          const v = asset.v, set = (p: Partial<Asset>) => setAsset({ ...asset, v: { ...v, ...p } });
          return <div className="form-grid">
            <Field label="Type">{(id) => <select id={id} className="select" value={v.type} onChange={(e) => set({ type: e.target.value })}>{types.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
            <Field label="Character / scene" hint="C01, L02, EP001-S03…">{(id) => <input id={id} className="input mono" value={v.linkedTo} onChange={(e) => set({ linkedTo: e.target.value.toUpperCase() })} />}</Field>
            <Field label="Episode (optional)">{(id) => <select id={id} className="select" value={v.episodeId} onChange={(e) => set({ episodeId: e.target.value })}><option value="">— none —</option>{s.episodes.map((e) => <option key={e.id}>{e.id}</option>)}</select>}</Field>
            <Field label="Version">{(id) => <input id={id} className="input" value={v.version} onChange={(e) => set({ version: e.target.value })} />}</Field>
            <Field label="File URL" className="full">{(id) => <input id={id} className="input" value={v.url} onChange={(e) => set({ url: e.target.value })} />}</Field>
            <Field label="Notes" className="full">{(id) => <textarea id={id} className="textarea" value={v.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
            <label className="check full"><input type="checkbox" checked={v.approved} onChange={(e) => set({ approved: e.target.checked })} />Approved for production use</label>
          </div>;
        })()}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
