import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, X } from 'lucide-react';
import { WORK_STATUSES, PUBLISH_STATUSES, publishSummary, type ApprovalStage, type Episode } from '../../shared/types';
import { useStore } from '../store/store';
import { addDays, epId } from '../data/seed';
import { Card, DataTable, Empty, Field, Modal, PageHead, SearchInput, StatusPill, fmtDate, download, type Column } from '../components/ui';
import { blankEpisode, toRows, sheetSpec } from '../../shared/workbook';

const STAGES: ApprovalStage[] = ['Draft', 'Under Review', 'Changes Requested', 'Approved', 'In Production', 'Final Review', 'Ready to Publish', 'Published', 'Rejected'];

export default function Episodes() {
  const { episodes, project, upsert, log, toast } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [stage, setStage] = useState(sp.get('stage') ?? '');
  const [script, setScript] = useState('');
  const [video, setVideo] = useState('');
  const [pub, setPub] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (sp.get('new')) { setCreating(true); sp.delete('new'); setSp(sp, { replace: true }); } }, [sp, setSp]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return episodes.filter((e) =>
      (!t || [e.id, e.titleZh, e.titleEn, e.synopsis, e.cliffhanger].some((f) => f.toLowerCase().includes(t))) &&
      (!stage || e.approvalStatus === stage) && (!script || e.scriptStatus === script) && (!video || e.videoStatus === video) && (!pub || publishSummary(e) === pub));
  }, [episodes, q, stage, script, video, pub]);
  const filtered = q || stage || script || video || pub;

  const cols: Column<Episode>[] = [
    { key: 'id', header: 'Episode', sort: (e) => e.number, render: (e) => <span className="mono strong">{e.id}</span>, width: 80 },
    { key: 'no', header: 'No.', sort: (e) => e.number, render: (e) => e.number, className: 'hide-md', width: 50 },
    { key: 'title', header: 'Title', sort: (e) => e.titleEn, render: (e) => (
      <div style={{ minWidth: 220, maxWidth: 360 }}>
        <div className="zh strong">{e.titleZh}</div>
        <div className="small muted">{e.titleEn}</div>
        <div className="xs faint clamp2 hide-md">{e.synopsis}</div>
      </div>) },
    { key: 'script', header: 'Script', sort: (e) => e.scriptStatus, render: (e) => <StatusPill status={e.scriptStatus} /> },
    { key: 'sb', header: 'Storyboard', sort: (e) => e.storyboardStatus, render: (e) => <StatusPill status={e.storyboardStatus} />, className: 'hide-md' },
    { key: 'video', header: 'Video', sort: (e) => e.videoStatus, render: (e) => <StatusPill status={e.videoStatus} /> },
    { key: 'edit', header: 'Editing', sort: (e) => e.editingStatus, render: (e) => <StatusPill status={e.editingStatus} />, className: 'hide-md' },
    { key: 'approval', header: 'Approval', sort: (e) => STAGES.indexOf(e.approvalStatus), render: (e) => <StatusPill status={e.approvalStatus} /> },
    { key: 'pub', header: 'IG / TikTok', sort: (e) => publishSummary(e), render: (e) => <div className="col gap4"><span className="xs muted nowrap">IG <StatusPill status={e.instagramStatus} dot={false} /></span><span className="xs muted nowrap">TT <StatusPill status={e.tiktokStatus} dot={false} /></span></div>, className: 'hide-md' },
    { key: 'date', header: 'Target date', sort: (e) => e.targetPublishDate, render: (e) => <span className="nowrap small">{fmtDate(e.targetPublishDate)}</span> },
  ];

  const exportCsv = () => {
    const st = useStore.getState();
    const head = sheetSpec('EPISODES')!.headers;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const data = toRows('EPISODES', { ...st, episodes: rows });
    const lines = [head.join(','), ...data.map((r) => head.map((h) => esc(r[h])).join(','))];
    download('EPISODES.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <PageHead title="Episodes" sub={`${episodes.length} episodes · EPISODES worksheet`} actions={<>
        <button className="btn" onClick={exportCsv}><Download size={15} />Export CSV</button>
        <button className="btn primary" onClick={() => setCreating(true)}><Plus size={15} />Create Episode</button>
      </>} />
      <Card flush>
        <div className="row wrap" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: '1 1 240px' }}><SearchInput value={q} onChange={setQ} placeholder="Search ID, title, synopsis…" /></div>
          <select className="select" style={{ width: 170 }} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Approval status"><option value="">All approval stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="select" style={{ width: 150 }} value={script} onChange={(e) => setScript(e.target.value)} aria-label="Script status"><option value="">Script: any</option>{WORK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="select" style={{ width: 150 }} value={video} onChange={(e) => setVideo(e.target.value)} aria-label="Video status"><option value="">Video: any</option>{WORK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="select" style={{ width: 160 }} value={pub} onChange={(e) => setPub(e.target.value)} aria-label="Publishing status"><option value="">Publishing (lowest): any</option>{PUBLISH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          {filtered && <button className="btn ghost sm" onClick={() => { setQ(''); setStage(''); setScript(''); setVideo(''); setPub(''); }}><X size={13} />Clear</button>}
        </div>
        <DataTable rows={rows} columns={cols} rowKey={(e) => e.id} onRowClick={(e) => nav(`/episodes/${e.id}`)} pageSize={15}
          initialSort={{ key: 'id', dir: 1 }}
          empty={<Empty title="No episodes match these filters">Try clearing a filter or search term.</Empty>} />
      </Card>
      <CreateEpisode open={creating} onClose={() => setCreating(false)} onCreate={(e) => {
        upsert('episodes', e);
        log({ actor: useStore.getState().settings.reviewerName, message: `Created ${e.id} ${e.titleZh}`, episodeId: e.id, level: 'success' });
        toast('success', `${e.id} created`);
        nav(`/episodes/${e.id}`);
      }} nextNumber={Math.max(0, ...episodes.map((e) => e.number)) + 1} startDate={project.startDate} existing={episodes.map((e) => e.id)} />
    </>
  );
}

function CreateEpisode({ open, onClose, onCreate, nextNumber, startDate, existing }: { open: boolean; onClose: () => void; onCreate: (e: Episode) => void; nextNumber: number; startDate: string; existing: string[] }) {
  const [f, setF] = useState({ number: nextNumber, titleZh: '', titleEn: '', synopsis: '', targetDuration: 70, date: addDays(startDate, nextNumber - 1) });
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setF({ number: nextNumber, titleZh: '', titleEn: '', synopsis: '', targetDuration: 70, date: addDays(startDate, nextNumber - 1) }); setErr({}); } }, [open, nextNumber, startDate]);
  const submit = () => {
    const e: Record<string, string> = {};
    if (!(f.number > 0)) e.number = 'Positive number required';
    if (existing.includes(epId(f.number))) e.number = `${epId(f.number)} already exists`;
    if (!f.titleZh.trim()) e.titleZh = 'Chinese title required';
    if (!f.titleEn.trim()) e.titleEn = 'English title required';
    if (f.targetDuration < 45 || f.targetDuration > 90) e.targetDuration = 'Episodes must be 45–90 seconds';
    setErr(e);
    if (Object.keys(e).length) return;
    onCreate({
      ...blankEpisode(epId(f.number), useStore.getState().project), titleZh: f.titleZh.trim(), titleEn: f.titleEn.trim(), synopsis: f.synopsis.trim(), arc: 'Extra',
      targetPublishDate: f.date, targetDuration: f.targetDuration,
    });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Create episode" footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={submit}>Create episode</button></>}>
      <div className="form-grid">
        <Field label="Episode number" error={err.number} hint={`ID will be ${epId(f.number || 0)}`}>{(id) => <input id={id} type="number" min={1} className="input" value={f.number} onChange={(e) => setF({ ...f, number: Number(e.target.value) })} />}</Field>
        <Field label="Target publish date">{(id) => <input id={id} type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        <Field label="Chinese title" error={err.titleZh}>{(id) => <input id={id} className="input zh" value={f.titleZh} onChange={(e) => setF({ ...f, titleZh: e.target.value })} />}</Field>
        <Field label="English title" error={err.titleEn}>{(id) => <input id={id} className="input" value={f.titleEn} onChange={(e) => setF({ ...f, titleEn: e.target.value })} />}</Field>
        <Field label="Logline" className="full">{(id) => <textarea id={id} className="textarea" value={f.synopsis} onChange={(e) => setF({ ...f, synopsis: e.target.value })} />}</Field>
        <Field label="Target duration (seconds)" error={err.targetDuration}>{(id) => <input id={id} type="number" className="input" value={f.targetDuration} onChange={(e) => setF({ ...f, targetDuration: Number(e.target.value) })} />}</Field>
      </div>
    </Modal>
  );
}
