import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import type { AnalyticsEntry, Platform } from '../../shared/types';
import { uid, useStore } from '../store/store';
import { Banner, Card, DataTable, Empty, Field, Modal, PageHead, SampleBadge, Stat, fmtDate, fmtNum } from '../components/ui';
import { AXIS, GRID, PLATFORM_COLOR, tooltipStyle } from '../lib/chart';
import { addDays } from '../data/seed';

/** Deterministic illustrative numbers. Never mixed with recorded data. */
function sampleData(start: string): AnalyticsEntry[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 14 }).flatMap((_, i) => (['TikTok', 'Instagram'] as Platform[]).map((p) => {
    const base = (p === 'TikTok' ? 18000 : 9000) * (1 + i * 0.12) * (0.8 + rnd() * 0.4);
    const views = Math.round(base);
    return { id: `S${i}${p}`, episodeId: `EP${String(i + 1).padStart(3, '0')}`, platform: p, date: addDays(start, i), views, likes: Math.round(views * (0.06 + rnd() * 0.03)), comments: Math.round(views * (0.006 + rnd() * 0.004)), shares: Math.round(views * (0.01 + rnd() * 0.01)), completionRate: Math.round(38 + rnd() * 25), followersGained: Math.round(views * (0.004 + rnd() * 0.004)), source: 'manual' as const };
  }));
}

export default function Analytics() {
  const s = useStore();
  const hasReal = s.analytics.length > 0;
  const [mode, setMode] = useState<'real' | 'sample'>(hasReal ? 'real' : 'sample');
  const [add, setAdd] = useState<AnalyticsEntry | null>(null);
  const sample = useMemo(() => sampleData(s.project.startDate), [s.project.startDate]);
  const data = mode === 'real' ? s.analytics : sample;

  const tot = useMemo(() => {
    const sum = (k: keyof AnalyticsEntry) => data.reduce((a, b) => a + (b[k] as number), 0);
    const views = sum('views'), eng = sum('likes') + sum('comments') + sum('shares');
    return { views, likes: sum('likes'), comments: sum('comments'), shares: sum('shares'), eng: views ? (eng / views) * 100 : 0, completion: data.length ? sum('completionRate') / data.length : 0, followers: sum('followersGained') };
  }, [data]);

  const byDate = useMemo(() => {
    const m = new Map<string, { date: string; TikTok: number; Instagram: number }>();
    data.forEach((d) => { const r = m.get(d.date) ?? { date: d.date, TikTok: 0, Instagram: 0 }; r[d.platform] += d.views; m.set(d.date, r); });
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);
  const byPlatform = useMemo(() => (['TikTok', 'Instagram'] as Platform[]).map((p) => {
    const rows = data.filter((d) => d.platform === p);
    const v = rows.reduce((a, b) => a + b.views, 0);
    return { platform: p, 'Engagement %': v ? +((rows.reduce((a, b) => a + b.likes + b.comments + b.shares, 0) / v) * 100).toFixed(1) : 0, 'Completion %': rows.length ? +(rows.reduce((a, b) => a + b.completionRate, 0) / rows.length).toFixed(1) : 0 };
  }), [data]);

  const saveEntry = () => {
    if (!add) return;
    if (!add.episodeId || !add.date) { s.toast('error', 'Episode and date are required'); return; }
    if (add.views < 0 || add.completionRate < 0 || add.completionRate > 100) { s.toast('error', 'Check the numbers (completion is 0–100)'); return; }
    s.upsert('analytics', add); s.toast('success', 'Metrics recorded'); setAdd(null); setMode('real');
  };

  return (
    <>
      <PageHead title="Analytics" sub="Post performance across TikTok and Instagram · ANALYTICS worksheet" actions={<>
        <div className="seg" role="group" aria-label="Data source">
          <button aria-pressed={mode === 'real'} onClick={() => setMode('real')}>Recorded data ({s.analytics.length})</button>
          <button aria-pressed={mode === 'sample'} onClick={() => setMode('sample')}>Sample preview</button>
        </div>
        <button className="btn primary" onClick={() => setAdd({ id: uid('m'), episodeId: 'EP001', platform: 'TikTok', date: new Date().toISOString().slice(0, 10), views: 0, likes: 0, comments: 0, shares: 0, completionRate: 0, followersGained: 0, source: 'manual' })}><Plus size={15} />Record metrics</button>
      </>} />
      <div className="mb16">
        {mode === 'sample'
          ? <Banner tone="warning"><strong>SAMPLE DATA — illustrative only.</strong> These numbers are generated to preview the layout and are not from your accounts. Platform analytics APIs are not connected; record real numbers manually or via a Make.com scenario writing to the ANALYTICS worksheet.</Banner>
          : <Banner tone="info">Recorded data — entered manually{s.settings.dataSource === 'google-sheets' ? ' or pulled from Google Sheets' : ''}. Platform APIs are not connected.</Banner>}
      </div>

      {mode === 'real' && !hasReal ? (
        <Card><Empty title="No metrics recorded yet">Episodes have not been published, or no metrics were entered. Use “Record metrics” after posting.</Empty></Card>
      ) : (
        <>
          <div className="grid g6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Stat label="Views" value={fmtNum(tot.views)} hint={mode === 'sample' ? <SampleBadge label="Sample" /> : undefined} />
            <Stat label="Likes" value={fmtNum(tot.likes)} />
            <Stat label="Comments" value={fmtNum(tot.comments)} />
            <Stat label="Shares" value={fmtNum(tot.shares)} />
            <Stat label="Engagement rate" value={`${tot.eng.toFixed(1)}%`} hint="(likes+comments+shares)/views" />
            <Stat label="Avg completion" value={`${tot.completion.toFixed(0)}%`} />
            <Stat label="Follower growth" value={`+${fmtNum(tot.followers)}`} />
          </div>
          <div className="grid g3 mt16">
            <Card className="span2" title="Views per day by platform" sub={mode === 'sample' ? 'Sample preview' : 'Recorded'}>
              <div style={{ height: 280 }} role="img" aria-label="Line chart of daily views for TikTok and Instagram">
                <ResponsiveContainer>
                  <LineChart data={byDate} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} {...AXIS} />
                    <YAxis tickFormatter={fmtNum} width={48} {...AXIS} />
                    <Tooltip {...tooltipStyle} cursor={{ stroke: '#2f394d' }} labelFormatter={(d: string) => fmtDate(d)} formatter={(v: number, n) => [v.toLocaleString(), n]} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#8b94a7' }} />
                    <Line type="monotone" dataKey="TikTok" stroke={PLATFORM_COLOR.TikTok} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#121722' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Instagram" stroke={PLATFORM_COLOR.Instagram} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#121722' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Platform comparison" sub="Engagement and completion">
              <div style={{ height: 280 }} role="img" aria-label={byPlatform.map((p) => `${p.platform}: engagement ${p['Engagement %']}%, completion ${p['Completion %']}%`).join('; ')}>
                <ResponsiveContainer>
                  <BarChart data={[{ metric: 'Engagement %', TikTok: byPlatform[0]['Engagement %'], Instagram: byPlatform[1]['Engagement %'] }, { metric: 'Completion %', TikTok: byPlatform[0]['Completion %'], Instagram: byPlatform[1]['Completion %'] }]} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="metric" {...AXIS} />
                    <YAxis unit="%" {...AXIS} />
                    <Tooltip {...tooltipStyle} formatter={(v: number, n) => [`${v}%`, n]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="TikTok" fill={PLATFORM_COLOR.TikTok} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="Instagram" fill={PLATFORM_COLOR.Instagram} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card className="mt16" title="Per-post metrics" sub="Table view" flush>
            <DataTable rows={data} rowKey={(r) => r.id} pageSize={10} initialSort={{ key: 'date', dir: -1 }} columns={[
              { key: 'date', header: 'Date', sort: (r) => r.date, render: (r) => fmtDate(r.date) },
              { key: 'ep', header: 'Episode', sort: (r) => r.episodeId, render: (r) => <span className="mono">{r.episodeId}</span> },
              { key: 'pl', header: 'Platform', sort: (r) => r.platform, render: (r) => <span className="tag">{r.platform}</span> },
              { key: 'v', header: 'Views', sort: (r) => r.views, render: (r) => r.views.toLocaleString() },
              { key: 'l', header: 'Likes', sort: (r) => r.likes, render: (r) => r.likes.toLocaleString() },
              { key: 'c', header: 'Comments', sort: (r) => r.comments, render: (r) => r.comments.toLocaleString() },
              { key: 's', header: 'Shares', sort: (r) => r.shares, render: (r) => r.shares.toLocaleString() },
              { key: 'e', header: 'Eng.', sort: (r) => (r.likes + r.comments + r.shares) / (r.views || 1), render: (r) => `${(((r.likes + r.comments + r.shares) / (r.views || 1)) * 100).toFixed(1)}%` },
              { key: 'cr', header: 'Completion', sort: (r) => r.completionRate, render: (r) => `${r.completionRate}%` },
              { key: 'f', header: 'Followers', sort: (r) => r.followersGained, render: (r) => `+${r.followersGained}` },
              { key: 'x', header: '', render: (r) => mode === 'real' ? <button className="btn sm icon ghost" aria-label="Delete entry" onClick={() => { s.remove('analytics', r.id); s.toast('success', 'Entry removed'); }}><Trash2 size={13} /></button> : <span className="pill warning xs">sample</span> },
            ]} />
          </Card>
        </>
      )}

      <Modal open={!!add} onClose={() => setAdd(null)} title="Record real post metrics" footer={<><button className="btn" onClick={() => setAdd(null)}>Cancel</button><button className="btn primary" onClick={saveEntry}>Save metrics</button></>}>
        {add && <div className="form-grid">
          <Field label="Episode">{(id) => <select id={id} className="select" value={add.episodeId} onChange={(e) => setAdd({ ...add, episodeId: e.target.value })}>{s.episodes.map((e) => <option key={e.id}>{e.id}</option>)}</select>}</Field>
          <Field label="Platform">{(id) => <select id={id} className="select" value={add.platform} onChange={(e) => setAdd({ ...add, platform: e.target.value as Platform })}><option>TikTok</option><option>Instagram</option></select>}</Field>
          <Field label="Date">{(id) => <input id={id} type="date" className="input" value={add.date} onChange={(e) => setAdd({ ...add, date: e.target.value })} />}</Field>
          {(['views', 'likes', 'comments', 'shares', 'completionRate', 'followersGained'] as const).map((k) => (
            <Field key={k} label={{ views: 'Views', likes: 'Likes', comments: 'Comments', shares: 'Shares', completionRate: 'Completion rate (%)', followersGained: 'Followers gained' }[k]}>{(id) => <input id={id} type="number" min={0} className="input" value={add[k]} onChange={(e) => setAdd({ ...add, [k]: Number(e.target.value) })} />}</Field>
          ))}
        </div>}
      </Modal>
    </>
  );
}
