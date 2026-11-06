import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import type { Project } from '../../shared/types';
import { useStore } from '../store/store';
import { Card, Field, Modal, PageHead, Progress, StatusPill, fmtDate, fmtUSD } from '../components/ui';
import { ARCS } from '../data/episodeOutline';

export default function Projects() {
  const { project, episodes, updateProject, toast } = useStore();
  const [edit, setEdit] = useState<Project | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const done = episodes.filter((e) => ['Ready to Publish', 'Published'].includes(e.approvalStatus)).length;

  const save = () => {
    if (!edit) return;
    const e: Record<string, string> = {};
    if (!edit.titleZh.trim()) e.titleZh = 'Required';
    if (!edit.titleEn.trim()) e.titleEn = 'Required';
    if (!(edit.monthlyBudget > 0)) e.monthlyBudget = 'Must be greater than 0';
    if (!(edit.totalEpisodes > 0)) e.totalEpisodes = 'Must be greater than 0';
    setErr(e);
    if (Object.keys(e).length) return;
    updateProject(edit);
    toast('success', 'Project details saved');
    setEdit(null);
  };

  const rows: [string, string][] = [
    ['Genre', project.genre], ['Format', project.format], ['Total episodes', String(project.totalEpisodes)],
    ['Episode duration', project.episodeDuration], ['Pilot target', project.pilotTarget], ['Language', project.language],
    ['Subtitles', project.subtitles], ['Visual style', project.visualStyle], ['Publishing platforms', project.platforms.join(' & ')],
    ['Publishing frequency', project.frequency], ['First publish date', fmtDate(project.startDate)], ['Automation', project.automation], ['Monthly budget', fmtUSD(project.monthlyBudget)],
  ];
  const text = (k: keyof Project, label: string, full = false, area = false) => (
    <Field label={label} error={err[k]} className={full ? 'full' : ''}>
      {(id) => area
        ? <textarea id={id} className="textarea" value={String(edit![k])} onChange={(ev) => setEdit({ ...edit!, [k]: ev.target.value })} />
        : <input id={id} className="input" value={String(edit![k])} onChange={(ev) => setEdit({ ...edit!, [k]: ev.target.value })} />}
    </Field>
  );

  return (
    <>
      <PageHead title="Projects" sub="Productions managed by this studio." />
      <div className="grid g3">
        <Card className="span2" title={<span className="zh">{project.titleZh}</span>} sub={project.titleEn} actions={<>
          <StatusPill status="In Production" />
          <button className="btn sm" onClick={() => { setEdit({ ...project }); setErr({}); }}><Pencil size={13} />Edit</button>
        </>}>
          <p className="muted">{project.logline}</p>
          <div className="divider" />
          <dl className="kv">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
        </Card>
        <div className="col gap16">
          <Card title="Overall progress">
            <div className="row between small"><span className="muted">Episodes approved for release</span><span className="strong">{done} / {project.totalEpisodes}</span></div>
            <div className="mt8"><Progress value={(done / project.totalEpisodes) * 100} /></div>
            <div className="row mt16"><Link to="/episodes" className="btn sm">Open episodes</Link><Link to="/approvals" className="btn sm ghost">Approval Centre</Link></div>
          </Card>
          <Card title="Story arcs" flush>
            <div className="list">
              {ARCS.map((a) => {
                const inArc = episodes.filter((e) => e.number >= a.from && e.number <= a.to);
                const scripted = inArc.filter((e) => ['Approved', 'Complete'].includes(e.scriptStatus)).length;
                return (
                  <div className="list-item" key={a.name}>
                    <div className="grow">
                      <div className="row between small"><span className="zh">{a.name}</span><span className="xs muted">EP{String(a.from).padStart(3, '0')}–{String(a.to).padStart(3, '0')}</span></div>
                      <div className="mt8"><Progress value={(scripted / inArc.length) * 100} /></div>
                      <div className="xs faint mt8">{scripted}/{inArc.length} scripts approved</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
      <Card className="mt16" title="Add another production">
        <p className="small muted">This foundation manages one active production. Multi-project workspaces will use one Google Sheets workbook per project — duplicate the workbook, then point a second deployment (or a future project switcher) at its spreadsheet ID.</p>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit project" size="lg" footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" onClick={save}>Save project</button></>}>
        {edit && (
          <div className="form-grid">
            {text('titleZh', 'Chinese title')}
            {text('titleEn', 'English title')}
            {text('genre', 'Genre', true)}
            {text('logline', 'Logline', true, true)}
            {text('format', 'Format')}
            {text('visualStyle', 'Visual style')}
            {text('episodeDuration', 'Episode duration')}
            {text('pilotTarget', 'Pilot target')}
            {text('language', 'Language')}
            {text('subtitles', 'Subtitles')}
            {text('frequency', 'Publishing frequency')}
            {text('automation', 'Automation')}
            <Field label="Total episodes" error={err.totalEpisodes}>{(id) => <input id={id} type="number" min={1} className="input" value={edit.totalEpisodes} onChange={(e) => setEdit({ ...edit, totalEpisodes: Number(e.target.value) })} />}</Field>
            <Field label="Monthly budget (USD)" error={err.monthlyBudget}>{(id) => <input id={id} type="number" min={1} step="1" className="input" value={edit.monthlyBudget} onChange={(e) => setEdit({ ...edit, monthlyBudget: Number(e.target.value) })} />}</Field>
            <Field label="First publish date">{(id) => <input id={id} type="date" className="input" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} />}</Field>
          </div>
        )}
      </Modal>
    </>
  );
}
