import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import type { BudgetLine, Expense } from '../../shared/types';
import { uid, useStore } from '../store/store';
import { Banner, Card, ConfirmDialog, DataTable, Empty, Field, Modal, PageHead, Progress, Stat, fmtDate, fmtUSD, type ConfirmOpts } from '../components/ui';
import { AXIS, GRID, SERIES, tooltipStyle } from '../lib/chart';

const SERVICES: BudgetLine['service'][] = ['OpenAI', 'Kling AI', 'Shotstack', 'Make.com', 'Voice', 'Other'];

export default function Budget() {
  const s = useStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exp, setExp] = useState<Expense | null>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const budget = s.project.monthlyBudget;
  const monthExp = s.expenses.filter((e) => e.date.startsWith(month));
  const actual = monthExp.reduce((a, b) => a + b.amount, 0);
  const estimated = s.budgetLines.reduce((a, b) => a + b.estimatedMonthly, 0);
  const credits = s.shots.reduce((a, b) => a + (b.credits || 0), 0);
  const aiRuns = s.scriptVersions.filter((v) => v.source === 'ai').length;

  const chart = useMemo(() => SERVICES.map((sv) => ({
    service: sv,
    Estimated: s.budgetLines.filter((l) => l.service === sv).reduce((a, b) => a + b.estimatedMonthly, 0),
    Actual: +monthExp.filter((e) => e.service === sv).reduce((a, b) => a + b.amount, 0).toFixed(2),
  })), [s.budgetLines, monthExp]);

  const saveExp = () => {
    if (!exp) return;
    if (!(exp.amount > 0)) { s.toast('error', 'Amount must be greater than 0'); return; }
    if (!exp.description.trim()) { s.toast('error', 'Description required'); return; }
    s.upsert('expenses', exp);
    s.log({ actor: s.settings.reviewerName, message: `Recorded ${fmtUSD(exp.amount)} ${exp.service} charge`, level: 'info' });
    s.toast('success', 'Charge recorded'); setExp(null);
  };

  return (
    <>
      <PageHead title="Budget & AI Usage" sub={`Monthly target ${fmtUSD(budget)}`} actions={<>
        <input type="month" className="input" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
        <button className="btn primary" onClick={() => setExp({ id: uid('x'), date: new Date().toISOString().slice(0, 10), service: 'OpenAI', description: '', amount: 0, reference: '' })}><Plus size={15} />Record charge</button>
      </>} />
      <div className="mb16"><Banner tone="info">Actual spend only includes charges you record from real invoices or provider usage pages. No charges are invented or estimated into the actual total. Provider billing APIs are not connected.</Banner></div>
      <div className="grid g4">
        <Stat label="Actual this month" value={fmtUSD(actual)} hint={`${monthExp.length} recorded charges`} />
        <Stat label="Remaining budget" value={fmtUSD(budget - actual)} hint={actual > budget ? 'Over budget' : `${((actual / budget) * 100).toFixed(0)}% used`} />
        <Stat label="Estimated run-rate" value={fmtUSD(estimated)} hint={estimated > budget ? 'Estimates exceed budget' : 'Planning estimate'} />
        <Stat label="Usage tracked" value={`${aiRuns} AI runs`} hint={`${credits} Kling credits logged`} />
      </div>
      <Card className="mt16">
        <div className="row between small"><span className="muted">Actual vs {fmtUSD(budget)} target</span><span className="strong">{fmtUSD(actual)}</span></div>
        <div className="mt8"><Progress value={(actual / budget) * 100} tone={actual > budget ? 'danger' : actual > budget * 0.8 ? 'warning' : 'success'} /></div>
      </Card>

      <div className="grid g3 mt16">
        <Card className="span2" title="Estimated vs actual by service" sub={new Date(month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}>
          <div style={{ height: 280 }} role="img" aria-label={chart.map((c) => `${c.service}: estimated ${c.Estimated}, actual ${c.Actual}`).join('; ')}>
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="service" {...AXIS} />
                <YAxis tickFormatter={(v) => `$${v}`} {...AXIS} />
                <Tooltip {...tooltipStyle} formatter={(v: number, n) => [fmtUSD(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Estimated" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Actual" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Monthly estimates" sub="Editable planning figures" flush>
          <div className="list">
            {s.budgetLines.map((l) => (
              <div key={l.id} className="list-item">
                <div className="grow"><div className="small strong">{l.service}</div><div className="xs muted">{l.description}</div></div>
                <label className="row small"><span className="sr-only">{l.service} estimate</span>$
                  <input type="number" min={0} step="1" className="input sm" style={{ width: 70 }} value={l.estimatedMonthly} onChange={(e) => s.upsert('budgetLines', { ...l, estimatedMonthly: Math.max(0, Number(e.target.value)) })} />
                </label>
              </div>
            ))}
            <div className="list-item"><div className="grow strong small">Total</div><span className={`strong ${estimated > budget ? '' : ''}`} style={{ color: estimated > budget ? 'var(--danger)' : undefined }}>{fmtUSD(estimated)}</span></div>
          </div>
        </Card>
      </div>

      <Card className="mt16" title="Recorded charges" sub="Actual spend" flush>
        <DataTable rows={monthExp} rowKey={(r) => r.id} initialSort={{ key: 'date', dir: -1 }} columns={[
          { key: 'date', header: 'Date', sort: (r) => r.date, render: (r) => fmtDate(r.date) },
          { key: 'sv', header: 'Service', sort: (r) => r.service, render: (r) => <span className="tag">{r.service}</span> },
          { key: 'd', header: 'Description', render: (r) => r.description },
          { key: 'ref', header: 'Invoice / reference', render: (r) => <span className="mono">{r.reference || '—'}</span> },
          { key: 'a', header: 'Amount', sort: (r) => r.amount, render: (r) => <span className="strong">{fmtUSD(r.amount)}</span> },
          { key: 'x', header: '', render: (r) => <button className="btn sm icon ghost" aria-label="Delete charge" onClick={() => setConfirm({ title: 'Delete this charge?', tone: 'danger', confirmLabel: 'Delete', message: `${r.service} ${fmtUSD(r.amount)} — ${r.description}`, onConfirm: () => { s.remove('expenses', r.id); s.toast('success', 'Charge deleted'); } })}><Trash2 size={13} /></button> },
        ]} empty={<Empty title="No charges recorded for this month">Record real charges from provider invoices to track actual spend.</Empty>} />
      </Card>

      <Modal open={!!exp} onClose={() => setExp(null)} title="Record actual charge" footer={<><button className="btn" onClick={() => setExp(null)}>Cancel</button><button className="btn primary" onClick={saveExp}>Save charge</button></>}>
        {exp && <div className="form-grid">
          <Field label="Date">{(id) => <input id={id} type="date" className="input" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} />}</Field>
          <Field label="Service">{(id) => <select id={id} className="select" value={exp.service} onChange={(e) => setExp({ ...exp, service: e.target.value as Expense['service'] })}>{SERVICES.map((x) => <option key={x}>{x}</option>)}</select>}</Field>
          <Field label="Amount (USD)">{(id) => <input id={id} type="number" min={0} step="0.01" className="input" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: Number(e.target.value) })} />}</Field>
          <Field label="Invoice / reference">{(id) => <input id={id} className="input" value={exp.reference} onChange={(e) => setExp({ ...exp, reference: e.target.value })} />}</Field>
          <Field label="Description" className="full">{(id) => <input id={id} className="input" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />}</Field>
        </div>}
      </Modal>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
