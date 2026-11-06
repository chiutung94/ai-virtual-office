import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PIPELINE, type ApprovalStage } from '../../shared/types';
import { useStore } from '../store/store';
import { actionsFor } from '../lib/workflow';
import { ConfirmDialog, type ConfirmOpts } from './ui';

/** Episode selection bound to ?ep= query param so views are linkable. */
export function useEpisodeParam(fallback = 'EP001') {
  const [sp, setSp] = useSearchParams();
  const id = sp.get('ep') ?? fallback;
  const set = (v: string) => { sp.set('ep', v); setSp(sp, { replace: true }); };
  return [id, set] as const;
}

export function EpisodePicker({ value, onChange, label = 'Episode' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const episodes = useStore((s) => s.episodes);
  return (
    <label className="row small muted">
      <span className="hide-sm">{label}</span>
      <select className="select" style={{ minWidth: 260 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {episodes.map((e) => (
          <option key={e.id} value={e.id}>{e.id} · {e.titleZh} · {e.titleEn}</option>
        ))}
      </select>
    </label>
  );
}

export function PipelineBar({ stage }: { stage: ApprovalStage }) {
  const idx = PIPELINE.indexOf(stage === 'Changes Requested' ? 'Under Review' : stage);
  return (
    <div className="pipeline" aria-label={`Approval stage: ${stage}`}>
      {PIPELINE.map((p, i) => (
        <div key={p} className={`step ${i < idx ? 'done' : i === idx ? 'current' : ''}`}>
          <span className="n">{String(i + 1).padStart(2, '0')}</span>
          {p}
          {i === idx && stage === 'Changes Requested' && <div className="xs" style={{ color: 'var(--warning)' }}>Changes requested</div>}
          {i === idx && stage === 'Rejected' && <div className="xs" style={{ color: 'var(--danger)' }}>Rejected</div>}
        </div>
      ))}
      {stage === 'Rejected' && <div className="step current" style={{ borderColor: 'var(--danger)' }}><span className="n">✕</span>Rejected</div>}
    </div>
  );
}

/** Approve / Request changes / Reject etc. — always via confirmation. */
export function ApprovalActions({ episodeId, size = '' }: { episodeId: string; size?: 'sm' | '' }) {
  const ep = useStore((s) => s.episodes.find((e) => e.id === episodeId));
  const transition = useStore((s) => s.transition);
  const toast = useStore((s) => s.toast);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  if (!ep) return null;
  const acts = actionsFor(ep.approvalStatus);
  if (!acts.length) return <span className="small muted">No actions — {ep.approvalStatus}</span>;
  return (
    <>
      <div className="row wrap">
        {acts.map((a) => (
          <button key={a.action} className={`btn ${size} ${a.tone}`} onClick={(ev) => {
            ev.stopPropagation();
            setConfirm({
              title: `${a.label} — ${ep.id}`,
              message: <>
                <div className="zh strong">{ep.titleZh} <span className="muted">· {ep.titleEn}</span></div>
                <div className="mt8">{a.confirm ?? `Move from “${ep.approvalStatus}” to “${a.to}”.`}</div>
                {a.action === 'publish' && <div className="mt8 small">Publishing is manual. Mark as published only after you have posted the approved cut yourself and recorded the post URL.</div>}
              </>,
              confirmLabel: a.label,
              tone: a.tone === 'default' ? 'primary' : a.tone,
              requireComment: a.requiresComment,
              commentLabel: 'Reviewer comment',
              onConfirm: (c) => {
                const r = transition(ep.id, a.action, c);
                if (!r.ok) throw new Error(r.error);
                toast('success', `${ep.id}: ${a.to}`);
              },
            });
          }}>{a.label}</button>
        ))}
      </div>
      <ConfirmDialog opts={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

export function CharacterChips({ ids }: { ids: string[] }) {
  const chars = useStore((s) => s.characters);
  return (
    <span className="row wrap gap4">
      {ids.map((id) => {
        const c = chars.find((x) => x.id === id);
        return <span key={id} className="tag" title={c?.nameEn}>{id}{c ? ` ${c.nameZh.split(' / ')[0]}` : ''}</span>;
      })}
    </span>
  );
}
