import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Info, Inbox, Search, X, XCircle } from 'lucide-react';
import { useStore } from '../store/store';
import type { ConnectionState } from '../../shared/types';

/* ── Status tone mapping ─────────────────────────────── */
const TONES: Record<string, string> = {
  'Not Started': 'neutral', Draft: 'neutral', 'Not Scheduled': 'neutral', 'Not Generated': 'neutral', Needed: 'neutral', 'Not Connected': 'neutral',
  'In Progress': 'progress', 'In Production': 'progress', Queued: 'progress', Generating: 'progress', Assembling: 'progress', Rendering: 'progress', Scheduled: 'progress', 'Draft Prepared': 'progress', Recorded: 'progress',
  'In Review': 'review', 'Under Review': 'review', 'Final Review': 'review',
  Approved: 'success', Complete: 'success', 'Ready to Publish': 'success', Published: 'success', Generated: 'success', Uploaded: 'success', Rendered: 'success', Locked: 'success', Connected: 'success',
  'Changes Requested': 'warning', 'Needs Attention': 'warning',
  Rejected: 'danger', Failed: 'danger',
};
export function StatusPill({ status, dot = true }: { status: string; dot?: boolean }) {
  return (
    <span className={`pill ${TONES[status] ?? 'neutral'}`}>
      {dot && <span className="dot" aria-hidden />}
      {status}
    </span>
  );
}
export const ConnectionPill = ({ state }: { state: ConnectionState }) => <StatusPill status={state} />;

/* ── Card ─────────────────────────────────────────────── */
export function Card({ title, sub, actions, children, flush, className = '' }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div className="grow">
            {title && <h2>{title}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {actions && <div className="row wrap">{actions}</div>}
        </header>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{icon}{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function Banner({ tone = 'info', children, icon }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; icon?: ReactNode }) {
  const I = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={`banner ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon ?? <I size={15} />}
      <div>{children}</div>
    </div>
  );
}

export const SampleBadge = ({ label = 'Sample data' }: { label?: string }) => (
  <span className="pill warning" title="Illustrative sample data — not from a connected source">
    <span className="dot" />{label}
  </span>
);

export function Progress({ value, tone }: { value: number; tone?: 'success' | 'warning' | 'danger' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${v}%` }} />
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox size={28} />}
      <div className="strong">{title}</div>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
  <span className="row small muted" role="status"><span className="spinner" />{label}…</span>
);

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="col" style={{ padding: 18, gap: 12 }} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

/* ── Form fields ──────────────────────────────────────── */
export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: ReactNode; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text" role="alert">{error}</span>}
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, label, className = 'select', id }: { value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[]; label?: string; className?: string; id?: string }) {
  return (
    <select id={id} className={className} value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search">
      <Search size={14} aria-hidden />
      <input className="input" type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

/* ── Modal & confirm ──────────────────────────────────── */
export function Modal({ open, onClose, title, children, footer, size }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('input, textarea, select, button.primary, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${size ?? ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger' | 'success' | 'warning';
  requireComment?: boolean;
  commentLabel?: string;
  onConfirm: (comment: string) => void | Promise<void>;
}
export function ConfirmDialog({ opts, onClose }: { opts: ConfirmOpts | null; onClose: () => void }) {
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setComment(''); setErr(''); setBusy(false); }, [opts]);
  if (!opts) return null;
  const go = async () => {
    if (opts.requireComment && !comment.trim()) { setErr('A comment is required for this action.'); return; }
    setBusy(true);
    try { await opts.onConfirm(comment); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={opts.title} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className={`btn ${opts.tone ?? 'primary'}`} onClick={go} disabled={busy}>{busy ? <span className="spinner" /> : null}{opts.confirmLabel ?? 'Confirm'}</button>
    </>}>
      <div className="col gap16">
        <div className="muted">{opts.message}</div>
        {(opts.requireComment || opts.commentLabel) && (
          <Field label={opts.commentLabel ?? 'Reviewer comment'} error={err}>
            {(id) => <textarea id={id} className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={opts.requireComment ? 'Required — explain what needs to change' : 'Optional'} />}
          </Field>
        )}
        {!opts.requireComment && !opts.commentLabel && err && <span className="error-text">{err}</span>}
      </div>
    </Modal>
  );
}

/* ── Data table with sort + pagination ───────────────── */
export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
  width?: number | string;
}
export function DataTable<T>({ rows, columns, rowKey, onRowClick, pageSize = 15, empty, initialSort }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; pageSize?: number; empty?: ReactNode; initialSort?: { key: string; dir: 1 | -1 };
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sort!(a), y = col.sort!(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  useEffect(() => { if (page >= pages) setPage(0); }, [pages, page]);
  const view = sorted.slice(page * size, page * size + size);
  if (!rows.length) return <>{empty ?? <Empty title="Nothing here yet" />}</>;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={c.className} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}
                tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined}>
                {columns.map((c) => <td key={c.key} className={c.className}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>{sorted.length} rows · page {page + 1} of {pages}</span>
        <div className="row">
          <label className="row small">Rows
            <select className="select sm" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} style={{ width: 72 }}>
              {[10, 15, 25, 60].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn sm icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
          <button className="btn sm icon" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
        </div>
      </div>
    </>
  );
}

/* ── Toasts ───────────────────────────────────────────── */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const I = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : t.kind === 'warning' ? AlertTriangle : Info;
        return (
          <div key={t.id} className={`toast ${t.kind}`}>
            <I size={16} />
            <div className="grow">{t.text}</div>
            <button className="btn ghost sm icon" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */
export const fmtDate = (iso?: string) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtUSD = (n: number) => `US$${n.toFixed(2)}`;
export const fmtNum = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
export const relTime = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};
export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
