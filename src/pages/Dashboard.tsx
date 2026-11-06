import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import { CalendarDays, CheckCircle2, Clapperboard, FileClock, Film, ListVideo, PenSquare, Plus, Send, Video } from 'lucide-react';
import { useStore } from '../store/store';
import { Card, PageHead, Progress, Stat, StatusPill, fmtDate, fmtUSD, relTime, Banner, Empty } from '../components/ui';
import { AXIS, tooltipStyle } from '../lib/chart';
import { DEPARTMENTS, departmentState } from './Departments';

export default function Dashboard() {
  const s = useStore();
  const nav = useNavigate();
  const eps = s.episodes;
  const today = new Date().toISOString().slice(0, 10);

  const k = useMemo(() => ({
    completed: eps.filter((e) => ['Ready to Publish', 'Published'].includes(e.approvalStatus)).length,
    scriptsAwaiting: eps.filter((e) => e.approvalStatus === 'Under Review').length,
    videosInProd: eps.filter((e) => e.approvalStatus === 'In Production').length,
    videosAwaiting: eps.filter((e) => e.approvalStatus === 'Final Review').length,
    published: eps.filter((e) => e.approvalStatus === 'Published').length,
  }), [eps]);

  const progress = useMemo(() => {
    const pct = (f: (e: (typeof eps)[number]) => boolean) => Math.round((eps.filter(f).length / eps.length) * 100);
    const done = (st: string) => st === 'Approved' || st === 'Complete';
    return [
      { stage: 'Script', pct: pct((e) => done(e.scriptStatus)) },
      { stage: 'Storyboard', pct: pct((e) => done(e.storyboardStatus)) },
      { stage: 'Video', pct: pct((e) => done(e.videoStatus)) },
      { stage: 'Editing', pct: pct((e) => done(e.editingStatus)) },
      { stage: 'Approved', pct: pct((e) => ['Ready to Publish', 'Published'].includes(e.approvalStatus)) },
      { stage: 'Published', pct: pct((e) => e.approvalStatus === 'Published') },
    ];
  }, [eps]);

  const upcoming = eps.filter((e) => e.targetPublishDate >= today && e.approvalStatus !== 'Published').slice(0, 7);
  const actual = s.expenses.filter((x) => x.date.slice(0, 7) === today.slice(0, 7)).reduce((a, b) => a + b.amount, 0);
  const estimated = s.budgetLines.reduce((a, b) => a + b.estimatedMonthly, 0);
  const budget = s.project.monthlyBudget;
  const openTasks = s.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));

  return (
    <>
      <PageHead
        title="Production Dashboard"
        sub={<><span className="zh">{s.project.titleZh}</span> · {s.project.totalEpisodes} episodes · {s.project.frequency.toLowerCase()} from {fmtDate(s.project.startDate)}</>}
        actions={<>
          <button className="btn" onClick={() => nav('/script')}><PenSquare size={15} />Generate Script</button>
          <button className="btn" onClick={() => nav('/episodes?new=1')}><Plus size={15} />Create Episode</button>
          <button className="btn" onClick={() => nav('/approvals?tab=script')}><FileClock size={15} />Review Script</button>
          <button className="btn primary" onClick={() => nav('/approvals?tab=video')}><Video size={15} />Review Video</button>
        </>}
      />

      {s.settings.dataSource === 'local-demo' && (
        <div className="mb16"><Banner tone="warning">Local demo mode — sample production data stored in this browser. Connect Google Sheets in <Link to="/settings">Settings</Link> to use your workbook.</Banner></div>
      )}

      <div className="grid g6">
        <Stat label="Total episodes" value={eps.length} hint={`Target ${s.project.totalEpisodes}`} icon={<ListVideo size={13} />} />
        <Stat label="Episodes completed" value={k.completed} hint="Ready to publish or published" icon={<CheckCircle2 size={13} />} />
        <Stat label="Scripts awaiting approval" value={k.scriptsAwaiting} hint="Under review" icon={<FileClock size={13} />} />
        <Stat label="Videos in production" value={k.videosInProd} hint="Generation & edit" icon={<Clapperboard size={13} />} />
        <Stat label="Videos awaiting approval" value={k.videosAwaiting} hint="Final review" icon={<Film size={13} />} />
        <Stat label="Published episodes" value={k.published} hint="Manually confirmed" icon={<Send size={13} />} />
      </div>

      <div className="grid g3 mt16">
        <Card className="span2" title="Production progress" sub="Share of 60 episodes complete at each stage">
          <div style={{ height: 240 }} role="img" aria-label={progress.map((p) => `${p.stage} ${p.pct}%`).join(', ')}>
            <ResponsiveContainer>
              <BarChart data={progress} layout="vertical" margin={{ left: 10, right: 40, top: 4, bottom: 4 }} barCategoryGap={10}>
                <CartesianGrid horizontal={false} stroke="#232b3b" />
                <XAxis type="number" domain={[0, 100]} unit="%" {...AXIS} />
                <YAxis type="category" dataKey="stage" width={78} {...AXIS} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Complete']} />
                <Bar dataKey="pct" fill="#3987e5" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fill: '#d6dbe4', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Monthly budget" sub={`Target ${fmtUSD(budget)} / month`} actions={<Link to="/budget" className="small">Details</Link>}>
          <div className="col gap16">
            <div>
              <div className="row between small"><span className="muted">Actual recorded this month</span><span className="strong">{fmtUSD(actual)}</span></div>
              <div className="mt8"><Progress value={(actual / budget) * 100} tone={actual > budget ? 'danger' : actual > budget * 0.8 ? 'warning' : 'success'} /></div>
            </div>
            <div>
              <div className="row between small"><span className="muted">Estimated monthly run-rate</span><span className="strong">{fmtUSD(estimated)}</span></div>
              <div className="mt8"><Progress value={(estimated / budget) * 100} tone={estimated > budget ? 'danger' : 'warning'} /></div>
            </div>
            <div className="row between"><span className="muted small">Remaining (actual)</span><span className="strong" style={{ fontSize: 20 }}>{fmtUSD(budget - actual)}</span></div>
            {actual === 0 && <div className="hint">No actual charges recorded. Enter real invoices in Budget & AI Usage.</div>}
          </div>
        </Card>
      </div>

      <div className="grid g3 mt16">
        <Card title="Upcoming publishing" sub="Next 7 scheduled episodes" actions={<Link to="/calendar" className="small">Calendar</Link>} flush>
          {upcoming.length ? (
            <div className="list">
              {upcoming.map((e) => (
                <Link key={e.id} to={`/episodes/${e.id}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <CalendarDays size={15} className="muted" style={{ marginTop: 2 }} />
                  <div className="grow">
                    <div className="row between"><span className="strong small">{e.id}</span><span className="xs muted">{fmtDate(e.targetPublishDate)}</span></div>
                    <div className="zh small truncate">{e.titleZh}</div>
                    <div className="mt8"><StatusPill status={e.approvalStatus} /></div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <Empty title="Nothing scheduled" />}
        </Card>

        <Card title="Pending tasks" sub={`${openTasks.length} open`} flush>
          {openTasks.length ? (
            <div className="list">
              {openTasks.slice(0, 7).map((t) => (
                <div key={t.id} className="list-item">
                  <input type="checkbox" className="check" aria-label={`Mark “${t.title}” done`} checked={t.done}
                    onChange={() => { s.upsert('tasks', { ...t, done: true }); s.toast('success', 'Task completed'); }} style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
                  <div className="grow">
                    <div className="small">{t.title}</div>
                    <div className="xs muted">{t.owner} · due {fmtDate(t.due)}{t.episodeId && <> · <Link to={`/episodes/${t.episodeId}`}>{t.episodeId}</Link></>}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty title="All caught up" />}
        </Card>

        <Card title="Recent activity" flush>
          {s.activity.length ? (
            <div className="list">
              {s.activity.slice(0, 7).map((a) => (
                <div key={a.id} className="list-item">
                  <span className={`pill ${a.level === 'success' ? 'success' : a.level === 'warning' ? 'warning' : a.level === 'error' ? 'danger' : 'progress'}`} style={{ padding: 0, width: 8, height: 8, marginTop: 6 }} aria-hidden />
                  <div className="grow">
                    <div className="small">{a.message}</div>
                    <div className="xs muted">{a.actor} · {relTime(a.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty title="No activity yet" />}
        </Card>
      </div>

      <Card className="mt16" title="AI department status" sub="Connection state reported by the server — never assumed" actions={<Link to="/departments" className="small">All departments</Link>}>
        <div className="grid g4">
          {DEPARTMENTS.map((d) => {
            const st = departmentState(d, s.integrations, s.episodes);
            return (
              <div key={d.id} className="row" style={{ alignItems: 'flex-start' }}>
                <div className="dept-icon"><d.icon size={17} /></div>
                <div className="grow">
                  <div className="small strong">{d.name}</div>
                  <div className="xs muted truncate">{d.service}</div>
                  <div className="mt8"><StatusPill status={st.state} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
