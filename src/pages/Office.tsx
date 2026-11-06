import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Keyboard, MousePointerClick, X } from 'lucide-react';
import type { ConnectionState, DepartmentId } from '../../shared/types';
import { useStore } from '../store/store';
import { Banner, PageHead, StatusPill } from '../components/ui';
import { DEPARTMENTS, departmentState, queueFor } from './Departments';

/* ────────────────────────────────────────────────────────────────
   A walkable top-down studio floor. Each AI department is an agent
   at a desk; its animation reflects the REAL connection state from
   the server (asleep when not connected — nothing is being done).
   Original pixel artwork drawn with SVG rects.
   ──────────────────────────────────────────────────────────────── */

const T = 16; // px per tile
const W = 30, H = 20;

interface Room { id: string; name: string; x: number; y: number; w: number; h: number; floor: string; doors: [number, number][] }
const ROOMS: Room[] = [
  { id: 'writers', name: "Writers' Room", x: 0, y: 0, w: 10, h: 8, floor: '#3a3047', doors: [[5, 7]] },
  { id: 'studio', name: 'Director & Storyboard', x: 9, y: 0, w: 11, h: 8, floor: '#2c3a4a', doors: [[14, 7]] },
  { id: 'producer', name: "Producer's Office", x: 19, y: 0, w: 11, h: 8, floor: '#3d3528', doors: [[24, 7]] },
  { id: 'stage', name: 'Video Stage', x: 0, y: 11, w: 11, h: 9, floor: '#24332c', doors: [[5, 11]] },
  { id: 'voice', name: 'Voice Booth', x: 10, y: 11, w: 6, h: 9, floor: '#3a2a35', doors: [[12, 11]] },
  { id: 'edit', name: 'Editing Suite', x: 15, y: 11, w: 8, h: 9, floor: '#272c3d', doors: [[18, 11]] },
  { id: 'dist', name: 'Distribution', x: 22, y: 11, w: 8, h: 9, floor: '#2f2f3a', doors: [[25, 11]] },
];

type Furn = { kind: 'desk' | 'shelf' | 'plant' | 'sofa' | 'table' | 'greenscreen' | 'camera' | 'light' | 'mic' | 'board' | 'cooler' | 'rug' | 'phones' | 'easel' | 'panel' | 'inbox'; x: number; y: number; w?: number; h?: number; solid?: boolean; color?: string };
const FURN: Furn[] = [
  // Writers' room
  { kind: 'rug', x: 2, y: 4, w: 6, h: 3, color: '#4a3b5c' },
  { kind: 'desk', x: 3, y: 3, w: 2, solid: true },
  { kind: 'shelf', x: 6, y: 1, w: 3, solid: true },
  { kind: 'table', x: 5, y: 5, w: 3, solid: true },
  { kind: 'plant', x: 1, y: 1, solid: true },
  { kind: 'plant', x: 1, y: 6, solid: true },
  // Director & storyboard
  { kind: 'board', x: 11, y: 1, w: 7 },
  { kind: 'desk', x: 11, y: 3, w: 2, solid: true },
  { kind: 'desk', x: 15, y: 3, w: 2, solid: true },
  { kind: 'easel', x: 18, y: 5, solid: true },
  { kind: 'plant', x: 10, y: 6, solid: true },
  // Producer
  { kind: 'rug', x: 21, y: 4, w: 7, h: 3, color: '#4f4330' },
  { kind: 'desk', x: 23, y: 3, w: 3, solid: true },
  { kind: 'inbox', x: 26, y: 3, solid: true },
  { kind: 'sofa', x: 20, y: 6, w: 3, solid: true },
  { kind: 'shelf', x: 26, y: 1, w: 2, solid: true },
  { kind: 'plant', x: 28, y: 1, solid: true },
  { kind: 'plant', x: 28, y: 6, solid: true },
  // Hallway
  { kind: 'plant', x: 1, y: 8, solid: true },
  { kind: 'plant', x: 1, y: 10, solid: true },
  { kind: 'cooler', x: 28, y: 8, solid: true },
  { kind: 'plant', x: 28, y: 10, solid: true },
  { kind: 'sofa', x: 9, y: 10, w: 3, solid: true },
  { kind: 'sofa', x: 17, y: 10, w: 3, solid: true },
  // Video stage
  { kind: 'greenscreen', x: 2, y: 12, w: 6, h: 2 },
  { kind: 'light', x: 1, y: 14, solid: true },
  { kind: 'light', x: 8, y: 14, solid: true },
  { kind: 'camera', x: 4, y: 16, solid: true },
  { kind: 'desk', x: 7, y: 17, w: 2, solid: true },
  // Voice booth
  { kind: 'panel', x: 11, y: 12, w: 4 },
  { kind: 'desk', x: 12, y: 15, w: 2, solid: true },
  { kind: 'mic', x: 14, y: 14, solid: true },
  // Editing
  { kind: 'desk', x: 17, y: 14, w: 3, solid: true },
  { kind: 'sofa', x: 17, y: 17, w: 3, solid: true },
  { kind: 'plant', x: 21, y: 12, solid: true },
  // Distribution
  { kind: 'phones', x: 23, y: 12, w: 5 },
  { kind: 'desk', x: 24, y: 15, w: 2, solid: true },
  { kind: 'plant', x: 28, y: 18, solid: true },
  { kind: 'table', x: 23, y: 18, w: 2, solid: true },
];

interface Agent { dept: DepartmentId; seat: [number, number]; name: string; look: { hair: string; skin: string; shirt: string; long?: boolean } }
const AGENTS: Agent[] = [
  { dept: 'writer', seat: [3, 2], name: 'Head Writer', look: { hair: '#2b1d18', skin: '#f1c9a5', shirt: '#8b7cf6', long: true } },
  { dept: 'director', seat: [11, 2], name: 'Director', look: { hair: '#1b1b1f', skin: '#e8b98f', shirt: '#3d4b63' } },
  { dept: 'storyboard', seat: [15, 2], name: 'Storyboard', look: { hair: '#6b3d22', skin: '#f3d0b0', shirt: '#d98a4a', long: true } },
  { dept: 'video', seat: [7, 16], name: 'Video Gen', look: { hair: '#111', skin: '#d9a77c', shirt: '#2f9d74' } },
  { dept: 'voice', seat: [12, 14], name: 'Voice', look: { hair: '#3b2a4a', skin: '#f0c6a0', shirt: '#c45b8a', long: true } },
  { dept: 'editor', seat: [18, 13], name: 'Editor', look: { hair: '#5a5a62', skin: '#e3b28a', shirt: '#4b6fd1' } },
  { dept: 'distribution', seat: [24, 14], name: 'Distribution', look: { hair: '#24170f', skin: '#f2cda8', shirt: '#d4a24c' } },
];
const PRODUCER_DESK: [number, number] = [24, 3];

/* ── collision grid ── */
function buildBlocked() {
  const b = new Set<string>();
  const k = (x: number, y: number) => `${x},${y}`;
  for (let x = 0; x < W; x++) { b.add(k(x, 0)); b.add(k(x, H - 1)); }
  for (let y = 0; y < H; y++) { b.add(k(0, y)); b.add(k(W - 1, y)); }
  for (const r of ROOMS) {
    for (let x = r.x; x < r.x + r.w; x++) { b.add(k(x, r.y)); b.add(k(x, r.y + r.h - 1)); }
    for (let y = r.y; y < r.y + r.h; y++) { b.add(k(r.x, y)); b.add(k(r.x + r.w - 1, y)); }
  }
  for (const r of ROOMS) for (const [x, y] of r.doors) b.delete(k(x, y));
  for (const f of FURN) if (f.solid) for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.h ?? 1); dy++) b.add(k(f.x + dx, f.y + dy));
  for (const a of AGENTS) b.add(k(a.seat[0], a.seat[1]));
  return b;
}

const STATE_COLOR: Record<ConnectionState, string> = { Connected: '#4fbf8f', 'In Progress': '#5b9cff', 'Needs Attention': '#d8a650', 'Not Connected': '#6b7385' };

/* ── sprites ── */
function Person({ x, y, look, facing = 'down', anim }: { x: number; y: number; look: Agent['look']; facing?: 'down' | 'up' | 'left' | 'right'; anim?: string }) {
  const px = x * T, py = y * T;
  return (
    <g transform={`translate(${px},${py})`}><g className={anim}>
      <ellipse cx={8} cy={15} rx={5} ry={1.5} fill="rgba(0,0,0,.35)" />
      <rect x={4} y={8} width={8} height={6} rx={1} fill={look.shirt} />
      <rect x={3} y={9} width={1.5} height={4} fill={look.shirt} />
      <rect x={11.5} y={9} width={1.5} height={4} fill={look.shirt} />
      <rect x={5} y={2} width={6} height={6} rx={1} fill={look.skin} />
      <rect x={4.5} y={1.5} width={7} height={facing === 'up' ? 6 : 2.5} rx={1} fill={look.hair} />
      {look.long && <><rect x={4} y={3} width={1.5} height={6} fill={look.hair} /><rect x={10.5} y={3} width={1.5} height={6} fill={look.hair} /></>}
      {facing !== 'up' && <>
        {facing !== 'right' && <rect x={6.2} y={5} width={1} height={1} fill="#1a1a1a" />}
        {facing !== 'left' && <rect x={8.8} y={5} width={1} height={1} fill="#1a1a1a" />}
      </>}
    </g></g>
  );
}

function Furniture({ f, glow }: { f: Furn; glow?: boolean }) {
  const x = f.x * T, y = f.y * T, w = (f.w ?? 1) * T, h = (f.h ?? 1) * T;
  switch (f.kind) {
    case 'rug': return <rect x={x} y={y} width={w} height={h} rx={3} fill={f.color} opacity={0.75} />;
    case 'desk': return (
      <g>
        <rect x={x} y={y + 3} width={w} height={11} rx={1.5} fill="#7a5a3c" />
        <rect x={x} y={y + 12} width={w} height={2} fill="#5c4229" />
        {Array.from({ length: f.w ?? 1 }).map((_, i) => (
          <g key={i}>
            <rect x={x + i * T + 3} y={y - 2} width={10} height={7} rx={1} fill="#1d2230" />
            <rect x={x + i * T + 4} y={y - 1} width={8} height={5} fill={glow ? '#6fa8ff' : '#2a3142'} className={glow ? 'office-screen' : undefined} />
            <rect x={x + i * T + 7} y={y + 5} width={2} height={1.5} fill="#1d2230" />
          </g>
        ))}
      </g>
    );
    case 'shelf': return (
      <g><rect x={x} y={y} width={w} height={h} fill="#5c4229" />
        {Array.from({ length: (f.w ?? 1) * 3 }).map((_, i) => <rect key={i} x={x + 2 + i * 5} y={y + 3} width={3} height={9} fill={['#b0503f', '#4f7fbf', '#d8a650', '#5aa37a'][i % 4]} />)}
      </g>
    );
    case 'plant': return <g><rect x={x + 5} y={y + 10} width={6} height={5} rx={1} fill="#8a5a3a" /><circle cx={x + 8} cy={y + 7} r={5} fill="#3f8f5a" /><circle cx={x + 5} cy={y + 5} r={3} fill="#4fa86b" /><circle cx={x + 11} cy={y + 5} r={3} fill="#4fa86b" /></g>;
    case 'sofa': return <g><rect x={x} y={y + 2} width={w} height={12} rx={3} fill="#8a6fb8" /><rect x={x + 2} y={y + 6} width={w - 4} height={6} rx={2} fill="#a28ad0" /></g>;
    case 'table': return <g><rect x={x + 1} y={y + 2} width={w - 2} height={11} rx={2} fill="#a0784f" />{Array.from({ length: f.w ?? 1 }).map((_, i) => <rect key={i} x={x + i * T + 4} y={y + 5} width={7} height={5} fill="#e9e3d6" />)}</g>;
    case 'greenscreen': return <g><rect x={x} y={y} width={w} height={h} fill="#2f9d58" opacity={0.85} /><rect x={x} y={y} width={w} height={2} fill="#1d6b3a" /></g>;
    case 'camera': return <g><rect x={x + 7} y={y + 8} width={2} height={7} fill="#333" /><rect x={x + 2} y={y + 2} width={11} height={7} rx={1} fill="#222" /><circle cx={x + 8} cy={y + 2} r={2.5} fill="#5b9cff" /></g>;
    case 'light': return <g><rect x={x + 7} y={y + 6} width={2} height={9} fill="#444" /><rect x={x + 3} y={y + 1} width={10} height={6} rx={1} fill="#ddd" className={glow ? 'office-light' : undefined} /></g>;
    case 'mic': return <g><rect x={x + 7} y={y + 6} width={1.5} height={9} fill="#555" /><rect x={x + 5} y={y + 1} width={6} height={7} rx={3} fill="#2a2a2a" /><rect x={x + 6} y={y + 2} width={4} height={5} rx={2} fill="#777" /></g>;
    case 'board': return <g><rect x={x} y={y + 1} width={w} height={12} fill="#e8e2d2" />{Array.from({ length: (f.w ?? 1) * 2 - 1 }).map((_, i) => <rect key={i} x={x + 3 + i * 8} y={y + 3} width={6} height={8} fill={['#c9b8f5', '#a8c8ff', '#f5c9a8', '#b8e0c8'][i % 4]} />)}</g>;
    case 'easel': return <g><rect x={x + 3} y={y + 1} width={10} height={9} fill="#f0ead8" /><rect x={x + 4} y={y + 2} width={8} height={7} fill="#c9b8f5" /><rect x={x + 7} y={y + 10} width={2} height={5} fill="#6b4a2f" /></g>;
    case 'panel': return <g>{Array.from({ length: f.w ?? 1 }).map((_, i) => <rect key={i} x={x + i * T + 1} y={y + 1} width={14} height={13} fill={i % 2 ? '#5a3d55' : '#6b4866'} />)}</g>;
    case 'phones': return <g>{Array.from({ length: (f.w ?? 1) }).map((_, i) => <g key={i}><rect x={x + i * T + 4} y={y} width={8} height={14} rx={2} fill="#1d2230" /><rect x={x + i * T + 5} y={y + 1.5} width={6} height={11} fill={i % 2 ? '#e1306c' : '#25f4ee'} opacity={0.55} /></g>)}</g>;
    case 'cooler': return <g><rect x={x + 4} y={y + 6} width={8} height={9} rx={1} fill="#d6dbe4" /><rect x={x + 5} y={y} width={6} height={7} rx={2} fill="#7fb2ff" opacity={0.8} /></g>;
    case 'inbox': return <g><rect x={x + 2} y={y + 4} width={12} height={9} rx={1} fill="#c9a36a" /><rect x={x + 3} y={y + 2} width={10} height={4} fill="#f4f1ea" /></g>;
    default: return null;
  }
}

function Tag({ x, y, children, dot, wide = 44 }: { x: number; y: number; children: ReactNode; dot?: string; wide?: number }) {
  return (
    <g transform={`translate(${x * T + 8 - wide / 2},${y * T - 9})`} pointerEvents="none">
      <rect width={wide} height={8} rx={4} fill="rgba(10,13,19,.85)" />
      {dot && <circle cx={5} cy={4} r={2} fill={dot} />}
      <text x={dot ? 9 : wide / 2} y={5.6} fontSize={5} fill="#f1f3f7" textAnchor={dot ? 'start' : 'middle'} fontFamily="Inter, sans-serif">{children}</text>
    </g>
  );
}

export default function Office() {
  const s = useStore();
  const blocked = useMemo(buildBlocked, []);
  const [pos, setPos] = useState<[number, number]>([24, 5]);
  const [facing, setFacing] = useState<'down' | 'up' | 'left' | 'right'>('up');
  const [open, setOpen] = useState<DepartmentId | 'producer' | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const states = useMemo(() => Object.fromEntries(DEPARTMENTS.map((d) => [d.id, departmentState(d, s.integrations, s.episodes)])) as Record<DepartmentId, { state: ConnectionState; detail: string }>, [s.integrations, s.episodes]);
  const pending = s.episodes.filter((e) => ['Under Review', 'Final Review'].includes(e.approvalStatus)).length;
  const readyToPublish = s.episodes.filter((e) => e.approvalStatus === 'Ready to Publish').length;

  const near = useMemo(() => {
    const d = (a: [number, number]) => Math.max(Math.abs(a[0] - pos[0]), Math.abs(a[1] - pos[1]));
    if (d(PRODUCER_DESK) <= 2) return 'producer' as const;
    return AGENTS.find((a) => d(a.seat) <= 2)?.dept ?? null;
  }, [pos]);

  const move = useCallback((dx: number, dy: number) => {
    setFacing(dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up');
    setPos(([x, y]) => (blocked.has(`${x + dx},${y + dy}`) ? [x, y] : [x + dx, y + dy]));
  }, [blocked]);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const m: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (m[k]) { e.preventDefault(); move(...m[k]); }
      else if ((k === 'e' || k === 'Enter' || k === ' ') && near) { e.preventDefault(); setOpen(near); }
      else if (k === 'Escape') setOpen(null);
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [move, near]);

  const working = DEPARTMENTS.filter((d) => states[d.id].state === 'In Progress').length;
  const online = DEPARTMENTS.filter((d) => ['Connected', 'In Progress'].includes(states[d.id].state)).length;

  return (
    <>
      <PageHead title="Virtual Office" sub="Walk the studio floor. Each AI department sits at its own desk — talk to an agent to see its queue." actions={
        <span className="row small muted"><span className="pill success"><span className="dot" />{online}/{DEPARTMENTS.length} agents online</span><span className="pill progress"><span className="dot" />{working} working</span></span>
      } />
      {online === 0 && <div className="mb16"><Banner tone="info">All agents are asleep because none of their services are connected yet. Agents only “work” when their real service is verified in Settings and they have episodes queued. Until then, you do their tasks manually in each workspace.</Banner></div>}

      <div className="office-wrap">
        <div ref={mapRef} className="office-map" tabIndex={0} role="application" aria-label="Virtual office map. Use arrow keys or WASD to walk, E to talk to the nearest agent.">
          <svg viewBox={`0 0 ${W * T} ${H * T}`} shapeRendering="crispEdges" style={{ width: '100%', display: 'block' }}>
            <defs>
              <pattern id="hall" width={T} height={T} patternUnits="userSpaceOnUse"><rect width={T} height={T} fill="#2a2620" /><rect width={T} height={1} fill="#332e26" /><rect width={1} height={T} fill="#26221c" /></pattern>
              <pattern id="tile" width={T} height={T} patternUnits="userSpaceOnUse"><rect width={T} height={T} fill="rgba(255,255,255,.025)" /><rect width={T} height={0.6} fill="rgba(0,0,0,.18)" /><rect width={0.6} height={T} fill="rgba(0,0,0,.18)" /></pattern>
            </defs>
            <rect width={W * T} height={H * T} fill="url(#hall)" />
            {ROOMS.map((r) => (
              <g key={r.id}>
                <rect x={r.x * T} y={r.y * T} width={r.w * T} height={r.h * T} fill={r.floor} />
                <rect x={r.x * T} y={r.y * T} width={r.w * T} height={r.h * T} fill="url(#tile)" />
              </g>
            ))}
            {/* walls */}
            {[...blocked].filter((k) => { const [x, y] = k.split(',').map(Number); return !FURN.some((f) => f.solid && x >= f.x && x < f.x + (f.w ?? 1) && y >= f.y && y < f.y + (f.h ?? 1)) && !AGENTS.some((a) => a.seat[0] === x && a.seat[1] === y); }).map((k) => {
              const [x, y] = k.split(',').map(Number);
              return <g key={k}><rect x={x * T} y={y * T} width={T} height={T} fill="#4a4f63" /><rect x={x * T} y={y * T} width={T} height={4} fill="#5d6379" /></g>;
            })}
            {ROOMS.flatMap((r) => r.doors.map(([x, y]) => <rect key={`${x},${y}`} x={x * T} y={y * T} width={T} height={T} fill="#6b5a40" opacity={0.6} />))}
            {FURN.map((f, i) => {
              const glowAgent = AGENTS.find((a) => f.kind === 'desk' && a.seat[0] >= f.x && a.seat[0] < f.x + (f.w ?? 1) && a.seat[1] === f.y - 1);
              const glow = glowAgent ? ['Connected', 'In Progress'].includes(states[glowAgent.dept].state) : f.kind === 'light' ? ['Connected', 'In Progress'].includes(states.video.state) : f.kind === 'desk' && f.x === 23;
              return <Furniture key={i} f={f} glow={glow} />;
            })}
            {/* room labels */}
            {ROOMS.map((r) => <text key={r.id} x={(r.x + r.w / 2) * T} y={(r.y + r.h - 1) * T - 3} fontSize={5.5} textAnchor="middle" fill="rgba(241,243,247,.45)" fontFamily="Inter, sans-serif" pointerEvents="none">{r.name}</text>)}

            {/* agents */}
            {AGENTS.map((a) => {
              const st = states[a.dept].state;
              const q = queueFor(a.dept, s.episodes);
              const anim = st === 'In Progress' ? 'office-work' : st === 'Not Connected' ? 'office-sleep' : undefined;
              const bubble = st === 'In Progress' ? `${q[0]?.id ?? ''} · ${q.length} queued` : st === 'Needs Attention' ? 'Needs attention' : st === 'Connected' ? 'Idle' : null;
              return (
                <g key={a.dept} role="button" tabIndex={0} aria-label={`${a.name} agent — ${st}`} style={{ cursor: 'pointer' }}
                  onClick={() => setOpen(a.dept)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(a.dept); } }}>
                  <rect x={a.seat[0] * T - 2} y={a.seat[1] * T - 2} width={T + 4} height={T + 4} fill="transparent" />
                  <Person x={a.seat[0]} y={a.seat[1]} look={a.look} anim={anim} />
                  {st === 'Not Connected' && <text x={a.seat[0] * T + 13} y={a.seat[1] * T + 2} fontSize={5} fill="#9aa3b5" className="office-zzz" fontFamily="Inter, sans-serif">z z</text>}
                  <Tag x={a.seat[0]} y={a.seat[1]} dot={STATE_COLOR[st]} wide={46}>{a.name}</Tag>
                  {bubble && (near === a.dept || st !== 'Connected') && (
                    <g transform={`translate(${a.seat[0] * T + 8 - 26},${a.seat[1] * T - 19})`} pointerEvents="none">
                      <rect width={52} height={9} rx={2} fill="#f1f3f7" /><text x={26} y={6.2} fontSize={4.6} textAnchor="middle" fill="#14161c" fontFamily="Inter, sans-serif">{bubble}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* producer desk badge */}
            {(pending > 0 || readyToPublish > 0) && <g transform={`translate(${26 * T + 9},${3 * T - 2})`} pointerEvents="none"><circle r={4.5} fill="#e0676f" /><text y={2} fontSize={5.5} textAnchor="middle" fill="#fff" fontFamily="Inter, sans-serif">{pending + readyToPublish}</text></g>}
            <g role="button" tabIndex={0} aria-label={`Producer's desk — ${pending} items to review`} style={{ cursor: 'pointer' }} onClick={() => setOpen('producer')} onKeyDown={(e) => { if (e.key === 'Enter') setOpen('producer'); }}>
              <rect x={23 * T} y={3 * T} width={4 * T} height={T} fill="transparent" />
            </g>

            {/* you */}
            <g style={{ transition: 'transform .12s linear' }} transform={`translate(0,0)`}>
              <Person x={pos[0]} y={pos[1]} look={{ hair: '#1c1c22', skin: '#f0c8a2', shirt: '#e8e8ee' }} facing={facing} />
              <Tag x={pos[0]} y={pos[1]} dot="#4fbf8f" wide={30}>You</Tag>
            </g>
            {near && !open && (
              <g transform={`translate(${pos[0] * T + 8 - 30},${pos[1] * T + 18})`} pointerEvents="none">
                <rect width={60} height={9} rx={4.5} fill="#8b7cf6" /><text x={30} y={6.2} fontSize={4.8} textAnchor="middle" fill="#fff" fontFamily="Inter, sans-serif">Press E to talk</text>
              </g>
            )}
          </svg>
          <div className="office-help xs muted">
            <span className="row gap4"><Keyboard size={12} />Click the map, then arrows / WASD to walk · E to talk</span>
            <span className="row gap4"><MousePointerClick size={12} />or click any agent</span>
          </div>
          <div className="office-dpad" aria-hidden>
            <button className="btn sm icon" onClick={() => move(0, -1)}>↑</button>
            <div className="row gap4"><button className="btn sm icon" onClick={() => move(-1, 0)}>←</button><button className="btn sm" onClick={() => near && setOpen(near)} disabled={!near}>Talk</button><button className="btn sm icon" onClick={() => move(1, 0)}>→</button></div>
            <button className="btn sm icon" onClick={() => move(0, 1)}>↓</button>
          </div>
        </div>

        <aside className="office-panel card" aria-live="polite">
          {open ? <AgentPanel id={open} states={states} onClose={() => { setOpen(null); mapRef.current?.focus(); }} pending={pending} readyToPublish={readyToPublish} /> : (
            <div className="card-body">
              <h2>Team on the floor</h2>
              <div className="list mt8">
                {DEPARTMENTS.map((d) => (
                  <button key={d.id} className="list-item" style={{ all: 'unset', display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onClick={() => setOpen(d.id)}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: STATE_COLOR[states[d.id].state], flexShrink: 0 }} />
                    <span className="grow small">{d.name}<div className="xs muted">{d.service}</div></span>
                    <span className="xs muted">{queueFor(d.id, s.episodes).length} queued</span>
                  </button>
                ))}
                <button className="list-item" style={{ all: 'unset', display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', cursor: 'pointer' }} onClick={() => setOpen('producer')}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: '#4fbf8f' }} />
                  <span className="grow small">You — Producer<div className="xs muted">Human approval</div></span>
                  <span className="xs muted">{pending} to review</span>
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function AgentPanel({ id, states, onClose, pending, readyToPublish }: { id: DepartmentId | 'producer'; states: Record<DepartmentId, { state: ConnectionState; detail: string }>; onClose: () => void; pending: number; readyToPublish: number }) {
  const s = useStore();
  if (id === 'producer') {
    const review = s.episodes.filter((e) => ['Under Review', 'Final Review'].includes(e.approvalStatus));
    return (
      <>
        <div className="card-head"><div><h2>Producer's desk</h2><div className="sub">You — the human in the loop</div></div><button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
        <div className="card-body col gap16">
          <p className="small muted">Nothing moves forward or gets published without your approval.</p>
          <div className="row between small"><span>Waiting for your review</span><strong>{pending}</strong></div>
          <div className="row between small"><span>Ready to publish (manual)</span><strong>{readyToPublish}</strong></div>
          {review.slice(0, 5).map((e) => <Link key={e.id} to={`/episodes/${e.id}`} className="row between small"><span>{e.id} <span className="zh muted">{e.titleZh}</span></span><StatusPill status={e.approvalStatus} /></Link>)}
          <Link className="btn primary" to="/approvals">Open Approval Centre</Link>
        </div>
      </>
    );
  }
  const d = DEPARTMENTS.find((x) => x.id === id)!;
  const st = states[id];
  const q = queueFor(id, s.episodes);
  const acts = s.activity.filter((a) => a.department === id).slice(0, 3);
  const line = st.state === 'In Progress' ? `I'm working through ${q.length} episode${q.length === 1 ? '' : 's'}. Next up: ${q[0]?.id}.`
    : st.state === 'Connected' ? 'Connected and idle — nothing in my queue right now.'
    : st.state === 'Needs Attention' ? "My credentials are set but not verified yet. Please run a connection test in Settings."
    : `I'm not connected yet, so I can't do any work. ${q.length ? `There ${q.length === 1 ? 'is 1 episode' : `are ${q.length} episodes`} waiting that you can handle manually for now.` : ''}`;
  return (
    <>
      <div className="card-head">
        <div className="row"><div className="dept-icon"><d.icon size={17} /></div><div><h2>{d.name}</h2><div className="sub">{d.service}</div></div></div>
        <button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>
      <div className="card-body col gap16">
        <StatusPill status={st.state} />
        <div className="office-speech small">“{line}”</div>
        <div className="xs faint">{st.detail}</div>
        <div>
          <span className="label">Queue ({q.length})</span>
          <div className="col gap4 mt8">
            {q.slice(0, 5).map((e) => <Link key={e.id} to={`/episodes/${e.id}`} className="row between small"><span className="truncate">{e.id} <span className="zh muted">{e.titleZh}</span></span></Link>)}
            {!q.length && <span className="xs muted">Empty</span>}
            {q.length > 5 && <span className="xs muted">+{q.length - 5} more</span>}
          </div>
        </div>
        {acts.length > 0 && <div><span className="label">Recent</span>{acts.map((a) => <div key={a.id} className="xs muted mt8">{a.message}</div>)}</div>}
        <div className="row wrap">
          <Link className="btn primary sm" to={d.link}>Open workspace</Link>
          {!['Connected', 'In Progress'].includes(st.state) && <Link className="btn sm" to="/settings">Connect service</Link>}
        </div>
      </div>
    </>
  );
}
