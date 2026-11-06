import { useState } from 'react';
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Asset, Location } from '../../shared/types';
import { useStore } from '../store/store';
import { Card, ConfirmDialog, DataTable, Empty, Field, Modal, PageHead, SearchInput, StatusPill, Tabs, type ConfirmOpts } from '../components/ui';

const ASSET_TYPES: Asset['type'][] = ['Character Reference', 'Location Reference', 'Prop', 'Music', 'SFX', 'Logo', 'Other'];
const ASSET_STATUS: Asset['status'][] = ['Needed', 'In Progress', 'Approved', 'Locked'];

export default function Locations() {
  const s = useStore();
  const [tab, setTab] = useState<'locations' | 'assets'>('locations');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [loc, setLoc] = useState<{ v: Location; isNew: boolean } | null>(null);
  const [asset, setAsset] = useState<{ v: Asset; isNew: boolean } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const nextId = (p: string, list: { id: string }[], pad: number) => `${p}${String(Math.max(0, ...list.map((x) => Number(x.id.slice(1)) || 0)) + 1).padStart(pad, '0')}`;

  const assets = s.assets.filter((a) => (!type || a.type === type) && (!q || `${a.id} ${a.name} ${a.linkedTo} ${a.notes}`.toLowerCase().includes(q.toLowerCase())));

  const saveLoc = () => {
    if (!loc) return;
    if (!loc.v.nameZh.trim() || !loc.v.nameEn.trim()) { s.toast('error', 'Both names are required'); return; }
    s.upsert('locations', loc.v); s.toast('success', `${loc.v.id} saved`); setLoc(null);
  };
  const saveAsset = () => {
    if (!asset) return;
    if (!asset.v.name.trim()) { s.toast('error', 'Name is required'); return; }
    if (asset.v.url && !/^(https?:\/\/|\/uploads\/)/.test(asset.v.url)) { s.toast('error', 'URL must start with http(s)://'); return; }
    s.upsert('assets', asset.v); s.toast('success', `${asset.v.id} saved`); setAsset(null);
  };

  return (
    <>
      <PageHead title="Locations & Assets" sub="Recurring sets, reference images, props, music and SFX · LOCATIONS & ASSETS worksheets" actions={
        tab === 'locations'
          ? <button className="btn primary" onClick={() => setLoc({ v: { id: nextId('L', s.locations, 2), nameZh: '', nameEn: '', description: '', lighting: '', continuity: '' }, isNew: true })}><Plus size={15} />Add location</button>
          : <button className="btn primary" onClick={() => setAsset({ v: { id: nextId('A', s.assets, 3), type: 'Prop', name: '', linkedTo: '', url: '', status: 'Needed', notes: '' }, isNew: true })}><Plus size={15} />Add asset</button>
      } />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'locations', label: `Locations (${s.locations.length})` }, { id: 'assets', label: `Assets (${s.assets.length})` }]} />

      {tab === 'locations' ? (
        s.locations.length ? (
          <div className="grid g3">
            {s.locations.map((l) => (
              <Card key={l.id}>
                <div className="avatar" style={{ aspectRatio: '16/9' }}>{l.imageUrl ? <img src={l.imageUrl} alt={l.nameEn} /> : <MapPin size={22} />}</div>
                <div className="row between mt16"><span className="tag">{l.id}</span>
                  <div className="row"><button className="btn sm icon ghost" aria-label="Edit location" onClick={() => setLoc({ v: { ...l }, isNew: false })}><Pencil size={13} /></button>
                    <button className="btn sm icon ghost" aria-label="Delete location" onClick={() => setConfirm({ title: `Delete ${l.id}?`, tone: 'danger', confirmLabel: 'Delete', message: 'Scenes referencing this location will keep its ID.', onConfirm: () => { s.remove('locations', l.id); s.toast('success', 'Location deleted'); } })}><Trash2 size={13} /></button></div>
                </div>
                <h2 className="zh mt8">{l.nameZh}</h2>
                <div className="small muted">{l.nameEn}</div>
                <p className="small mt8">{l.description}</p>
                <div className="xs muted mt8"><strong>Lighting:</strong> {l.lighting}</div>
                <div className="xs muted mt8"><strong>Continuity:</strong> {l.continuity}</div>
              </Card>
            ))}
          </div>
        ) : <Card><Empty title="No locations" /></Card>
      ) : (
        <Card flush>
          <div className="row wrap" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: '1 1 220px' }}><SearchInput value={q} onChange={setQ} placeholder="Search assets…" /></div>
            <select className="select" style={{ width: 200 }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Asset type"><option value="">All types</option>{ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <DataTable rows={assets} rowKey={(r) => r.id} columns={[
            { key: 'id', header: 'ID', sort: (r) => r.id, render: (r) => <span className="mono">{r.id}</span> },
            { key: 'type', header: 'Type', sort: (r) => r.type, render: (r) => <span className="small">{r.type}</span> },
            { key: 'name', header: 'Name', sort: (r) => r.name, render: (r) => <div><div className="small">{r.name}</div>{r.notes && <div className="xs muted">{r.notes}</div>}</div> },
            { key: 'link', header: 'Linked to', render: (r) => <span className="tag">{r.linkedTo || '—'}</span> },
            { key: 'url', header: 'File', render: (r) => r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="row small"><ExternalLink size={12} />Open</a> : <span className="xs faint">none</span> },
            { key: 'st', header: 'Status', sort: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
            { key: 'a', header: '', render: (r) => <div className="row nowrap">
              <button className="btn sm icon ghost" aria-label="Edit asset" onClick={() => setAsset({ v: { ...r }, isNew: false })}><Pencil size={13} /></button>
              <button className="btn sm icon ghost" aria-label="Delete asset" onClick={() => setConfirm({ title: `Delete ${r.id}?`, tone: 'danger', confirmLabel: 'Delete', message: r.name, onConfirm: () => { s.remove('assets', r.id); s.toast('success', 'Asset deleted'); } })}><Trash2 size={13} /></button></div> },
          ]} empty={<Empty title="No assets match" />} />
        </Card>
      )}

      <Modal open={!!loc} onClose={() => setLoc(null)} title={loc?.isNew ? 'Add location' : `Edit ${loc?.v.id}`} footer={<><button className="btn" onClick={() => setLoc(null)}>Cancel</button><button className="btn primary" onClick={saveLoc}>Save</button></>}>
        {loc && <div className="form-grid">
          {(['nameZh', 'nameEn'] as const).map((k) => <Field key={k} label={k === 'nameZh' ? 'Chinese name' : 'English name'}>{(id) => <input id={id} className="input" value={loc.v[k]} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, [k]: e.target.value } })} />}</Field>)}
          {(['description', 'lighting', 'continuity'] as const).map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)} className="full">{(id) => <textarea id={id} className="textarea" value={loc.v[k]} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, [k]: e.target.value } })} />}</Field>)}
          <Field label="Reference image URL" className="full">{(id) => <input id={id} className="input" value={loc.v.imageUrl ?? ''} onChange={(e) => setLoc({ ...loc, v: { ...loc.v, imageUrl: e.target.value } })} />}</Field>
        </div>}
      </Modal>
      <Modal open={!!asset} onClose={() => setAsset(null)} title={asset?.isNew ? 'Add asset' : `Edit ${asset?.v.id}`} footer={<><button className="btn" onClick={() => setAsset(null)}>Cancel</button><button className="btn primary" onClick={saveAsset}>Save</button></>}>
        {asset && <div className="form-grid">
          <Field label="Name" className="full">{(id) => <input id={id} className="input" value={asset.v.name} onChange={(e) => setAsset({ ...asset, v: { ...asset.v, name: e.target.value } })} />}</Field>
          <Field label="Type">{(id) => <select id={id} className="select" value={asset.v.type} onChange={(e) => setAsset({ ...asset, v: { ...asset.v, type: e.target.value as Asset['type'] } })}>{ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
          <Field label="Status">{(id) => <select id={id} className="select" value={asset.v.status} onChange={(e) => setAsset({ ...asset, v: { ...asset.v, status: e.target.value as Asset['status'] } })}>{ASSET_STATUS.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
          <Field label="Linked to" hint="C01, L03, EP001…">{(id) => <input id={id} className="input mono" value={asset.v.linkedTo} onChange={(e) => setAsset({ ...asset, v: { ...asset.v, linkedTo: e.target.value.toUpperCase() } })} />}</Field>
          <Field label="File URL">{(id) => <input id={id} className="input" value={asset.v.url} onChange={(e) => setAsset({ ...asset, v: { ...asset.v, url: e.target.value } })} />}</Field>
          <Field label="Notes" className="full">{(id) => <textarea id={id} className="textarea" value={asset.v.notes} onChange={(e) => setAsset({ ...asset, v: { ...asset.v, notes: e.target.value } })} />}</Field>
        </div>}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
