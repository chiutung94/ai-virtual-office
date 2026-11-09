import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Download, ExternalLink, ImageOff, Upload } from 'lucide-react';
import type { Shot } from '../../shared/types';
import { useStore } from '../store/store';
import { api } from '../lib/api';
import { Banner, Card, Empty, PageHead, StatusPill, download } from '../components/ui';
import { EpisodePicker, useEpisodeParam } from '../components/shared';

/** One page per episode with everything needed to generate its clips by hand in Kling. */
export default function KlingPack() {
  const s = useStore();
  const [epId, setEp] = useEpisodeParam();
  const ep = s.episodes.find((e) => e.id === epId);
  const shots = s.shots.filter((x) => x.episodeId === epId).sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber);
  const [copied, setCopied] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<Shot | null>(null);
  const done = shots.filter((x) => ['Generated', 'Uploaded', 'Approved'].includes(x.generationStatus)).length;
  const missingPortraits = [...new Set(shots.flatMap((x) => x.characterIds))].filter((id) => !s.characters.find((c) => c.id === id)?.imageUrl);

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500); }
    catch { s.toast('error', 'Clipboard not available — select the text and copy manually'); }
  };
  const onFile = async (f?: File) => {
    const c = target.current;
    if (!f || !c) return;
    setUploading(c.id);
    try {
      const r = await api.upload(f);
      s.upsert('shots', { ...c, videoUrl: r.url, fileName: f.name, generationStatus: 'Uploaded' });
      s.toast('success', `${c.id.replace(`${epId}-`, '')} uploaded`);
    } catch (e) { s.toast('error', `Upload failed: ${(e as Error).message}. Is the app server running?`); }
    finally { setUploading(null); if (fileRef.current) fileRef.current.value = ''; }
  };
  const exportTxt = () => {
    const lines = [`KLING PACK — ${s.project.code}-${epId} ${ep?.titleZh ?? ''} (${ep?.titleEn ?? ''})`, `Settings for every clip: Image to Video · 9:16 · use the character portrait as reference`, ''];
    shots.forEach((x, i) => {
      lines.push(`── ${i + 1}/${shots.length}  ${x.id}  (scene ${x.sceneNumber}, ${x.duration}s, ${x.aspectRatio}, ${x.resolution})`);
      lines.push(`Characters: ${x.characterIds.map((id) => { const c = s.characters.find((k) => k.id === id); return `${id} ${c?.nameZh ?? ''} — portrait: ${c?.imageUrl || 'MISSING'}`; }).join(' | ') || 'none (environment shot)'}`);
      lines.push('PROMPT:', x.prompt, '', 'NEGATIVE:', x.negativePrompt, '');
      if (x.notes) lines.push(`Notes: ${x.notes}`, '');
    });
    download(`${epId}-kling-pack.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
  };

  return (
    <>
      <Link to={`/video?ep=${epId}`} className="row small mb16"><ArrowLeft size={14} />Video Production</Link>
      <PageHead title="Kling pack" sub="Everything to generate this episode's clips by hand in Kling: Image to Video, 9:16." actions={<>
        <EpisodePicker value={epId} onChange={setEp} />
        <button className="btn" onClick={exportTxt} disabled={!shots.length}><Download size={14} />Download .txt</button>
      </>} />
      {ep && <div className="mb16"><Banner tone="info"><strong>{done}/{shots.length} clips done.</strong> For each card: open the portrait → upload it in Kling as the reference image → copy the prompt and negative prompt → 9:16, {shots[0]?.duration ?? 5}s → Generate → download → Upload here.</Banner></div>}
      {missingPortraits.length > 0 && <div className="mb16"><Banner tone="warning">No master portrait yet for {missingPortraits.join(', ')}. Add one in the <Link to="/characters">Character Library</Link> first; it keeps the face the same in every clip.</Banner></div>}
      {ep && !['Approved', 'In Production', 'Final Review', 'Ready to Publish', 'Published'].includes(ep.approvalStatus) && (
        <div className="mb16"><Banner tone="warning">{ep.id}'s script isn't approved yet (“{ep.approvalStatus}”). Approve it before spending Kling credits.</Banner></div>
      )}

      {shots.length ? (
        <div className="col gap16">
          {shots.map((x, i) => (
            <Card key={x.id} title={<span className="row wrap"><span className="mono">{i + 1}/{shots.length} · {x.id.replace(`${epId}-`, '')}</span><span className="small muted">scene {x.sceneNumber} · {x.duration}s · {x.aspectRatio} · {x.resolution}</span></span>}
              actions={<StatusPill status={x.generationStatus} />}>
              <div className="grid g3" style={{ alignItems: 'start' }}>
                <div className="col">
                  <span className="label">Reference portraits</span>
                  {x.characterIds.length ? x.characterIds.map((id) => {
                    const c = s.characters.find((k) => k.id === id);
                    return (
                      <div key={id} className="row" style={{ alignItems: 'flex-start' }}>
                        <div className="avatar" style={{ width: 54, flexShrink: 0 }}>{c?.imageUrl ? <img src={c.imageUrl} alt={c.nameEn} /> : <ImageOff size={16} />}</div>
                        <div className="small"><div className="zh strong">{id} {c?.nameZh}</div>
                          {c?.imageUrl ? <a href={c.imageUrl} target="_blank" rel="noreferrer" className="row xs"><ExternalLink size={11} />Open portrait</a> : <span className="xs" style={{ color: 'var(--warning)' }}>No portrait</span>}
                        </div>
                      </div>
                    );
                  }) : <span className="xs muted">Environment shot — no character reference (use Text to Video).</span>}
                  {x.notes && <div className="xs muted">Note: {x.notes}</div>}
                </div>
                <div className="span2 col">
                  <div className="row between"><span className="label">Prompt</span>
                    <button className="btn sm" onClick={() => copy(`${x.id}-p`, x.prompt)}>{copied === `${x.id}-p` ? <Check size={12} /> : <Copy size={12} />}{copied === `${x.id}-p` ? 'Copied' : 'Copy prompt'}</button></div>
                  <div className="mono small" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap' }}>{x.prompt || '—'}</div>
                  <div className="row between"><span className="label">Negative prompt</span>
                    <button className="btn sm" onClick={() => copy(`${x.id}-n`, x.negativePrompt)}>{copied === `${x.id}-n` ? <Check size={12} /> : <Copy size={12} />}{copied === `${x.id}-n` ? 'Copied' : 'Copy negative'}</button></div>
                  <div className="mono xs muted" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>{x.negativePrompt || '—'}</div>
                  <div className="row wrap">
                    {x.generationStatus !== 'Generating' && !x.videoUrl && <button className="btn sm" onClick={() => s.upsert('shots', { ...x, generationStatus: 'Generating' })}>Mark generating</button>}
                    <button className="btn sm primary" disabled={uploading === x.id} onClick={() => { target.current = x; fileRef.current?.click(); }}>{uploading === x.id ? <span className="spinner" /> : <Upload size={12} />}Upload clip</button>
                    {x.videoUrl && <a className="btn sm" href={x.videoUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} />View clip</a>}
                    {x.videoUrl && x.generationStatus !== 'Approved' && <button className="btn sm success" onClick={() => s.upsert('shots', { ...x, generationStatus: 'Approved' })}><Check size={12} />Approve clip</button>}
                    <label className="row xs muted">Kling units
                      <input type="number" min={0} className="input sm" style={{ width: 70 }} value={x.credits} onChange={(e) => s.upsert('shots', { ...x, credits: Math.max(0, Number(e.target.value)) })} />
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty title="No shots for this episode"><Link to={`/storyboard?ep=${epId}`}>Plan shots first</Link></Empty></Card>}
      <input ref={fileRef} type="file" accept="video/*,.mp4,.mov,.webm,.m4v" hidden onChange={(e) => onFile(e.target.files?.[0])} aria-hidden />
    </>
  );
}
