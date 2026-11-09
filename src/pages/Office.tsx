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
const PAD = 3; // garden around the building (tiles)

interface Room { id: string; name: string; x: number; y: number; w: number; h: number; floor: string; doors: [number, number][] }
const ROOMS: Room[] = [
  { id: 'writers', name: "Writers' Room", x: 0, y: 0, w: 10, h: 8, floor: '#dcd6f2', doors: [[5, 7]] },
  { id: 'studio', name: 'Director & Storyboard', x: 9, y: 0, w: 11, h: 8, floor: '#d5e4f3', doors: [[14, 7]] },
  { id: 'producer', name: "Producer's Office", x: 19, y: 0, w: 11, h: 8, floor: '#f0e4cf', doors: [[24, 7]] },
  { id: 'stage', name: 'Video Stage', x: 0, y: 11, w: 11, h: 9, floor: '#d4e6da', doors: [[5, 11]] },
  { id: 'voice', name: 'Voice Booth', x: 10, y: 11, w: 6, h: 9, floor: '#f1dbe4', doors: [[12, 11]] },
  { id: 'edit', name: 'Editing Suite', x: 15, y: 11, w: 8, h: 9, floor: '#dadfec', doors: [[18, 11]] },
  { id: 'dist', name: 'Distribution', x: 22, y: 11, w: 8, h: 9, floor: '#e6e6ee', doors: [[25, 11]] },
];

type FurnKind = 'desk' | 'shelf' | 'plant' | 'sofa' | 'table' | 'greenscreen' | 'camera' | 'light' | 'mic' | 'board' | 'cooler' | 'rug'
  | 'phones' | 'easel' | 'panel' | 'inbox' | 'pingpong' | 'coffee' | 'beanbag' | 'counter' | 'fridge' | 'vending' | 'window' | 'whiteboard' | 'tv';
type Furn = { kind: FurnKind; x: number; y: number; w?: number; h?: number; solid?: boolean; color?: string };
const OUTER_WINDOWS = [2, 3, 6, 7, 11, 12, 16, 17, 21, 22, 26, 27];
const FURN: Furn[] = [
  ...OUTER_WINDOWS.map((x) => ({ kind: 'window' as const, x, y: 0 })),
  ...OUTER_WINDOWS.map((x) => ({ kind: 'window' as const, x, y: 19 })),
  // Writers' room
  { kind: 'rug', x: 2, y: 4, w: 7, h: 3, color: '#c4bce6' },
  { kind: 'desk', x: 3, y: 3, w: 2, solid: true },
  { kind: 'shelf', x: 6, y: 1, w: 3, solid: true },
  { kind: 'table', x: 5, y: 5, w: 3, solid: true },
  { kind: 'plant', x: 1, y: 1, solid: true },
  { kind: 'plant', x: 1, y: 6, solid: true },
  // Director & storyboard
  { kind: 'board', x: 11, y: 1, w: 7 },
  { kind: 'desk', x: 11, y: 3, w: 2, solid: true },
  { kind: 'desk', x: 15, y: 3, w: 2, solid: true },
  { kind: 'rug', x: 11, y: 5, w: 6, h: 2, color: '#bcd3ea' },
  { kind: 'easel', x: 18, y: 5, solid: true },
  { kind: 'plant', x: 10, y: 6, solid: true },
  // Producer
  { kind: 'rug', x: 21, y: 4, w: 7, h: 3, color: '#e3cfa8' },
  { kind: 'desk', x: 23, y: 3, w: 3, solid: true },
  { kind: 'inbox', x: 26, y: 3, solid: true },
  { kind: 'sofa', x: 20, y: 6, w: 3, solid: true },
  { kind: 'coffee', x: 21, y: 5, solid: true },
  { kind: 'shelf', x: 26, y: 1, w: 2, solid: true },
  { kind: 'plant', x: 28, y: 1, solid: true },
  { kind: 'plant', x: 28, y: 6, solid: true },
  // Hallway lounge (row 8 and the tiles in front of doors stay free)
  { kind: 'plant', x: 1, y: 8, solid: true },
  { kind: 'plant', x: 1, y: 10, solid: true },
  { kind: 'rug', x: 6, y: 9, w: 5, h: 2, color: '#cfe0f5' },
  { kind: 'sofa', x: 7, y: 10, w: 3, solid: true },
  { kind: 'coffee', x: 8, y: 9, solid: true },
  { kind: 'pingpong', x: 14, y: 9, w: 3, h: 2, solid: true },
  { kind: 'beanbag', x: 20, y: 10, solid: true, color: '#7aa6e8' },
  { kind: 'beanbag', x: 22, y: 10, solid: true, color: '#b48be8' },
  { kind: 'counter', x: 26, y: 10, w: 2, solid: true },
  { kind: 'vending', x: 28, y: 9, solid: true },
  { kind: 'cooler', x: 28, y: 8, solid: true },
  { kind: 'plant', x: 28, y: 10, solid: true },
  // Video stage
  { kind: 'greenscreen', x: 2, y: 12, w: 6, h: 2 },
  { kind: 'light', x: 1, y: 14, solid: true },
  { kind: 'light', x: 8, y: 14, solid: true },
  { kind: 'camera', x: 4, y: 16, solid: true },
  { kind: 'desk', x: 7, y: 17, w: 2, solid: true },
  { kind: 'plant', x: 9, y: 12, solid: true },
  // Voice booth
  { kind: 'panel', x: 11, y: 17, w: 4, h: 2 },
  { kind: 'desk', x: 12, y: 15, w: 2, solid: true },
  { kind: 'mic', x: 14, y: 14, solid: true },
  // Editing
  { kind: 'desk', x: 17, y: 14, w: 3, solid: true },
  { kind: 'rug', x: 16, y: 16, w: 5, h: 3, color: '#c6cde2' },
  { kind: 'sofa', x: 17, y: 17, w: 3, solid: true },
  { kind: 'plant', x: 21, y: 12, solid: true },
  // Distribution
  { kind: 'phones', x: 23, y: 12, w: 5 },
  { kind: 'desk', x: 24, y: 15, w: 2, solid: true },
  { kind: 'whiteboard', x: 26, y: 17, w: 2 },
  { kind: 'table', x: 23, y: 18, w: 2, solid: true },
  { kind: 'plant', x: 28, y: 18, solid: true },
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

/* ── sprites (original artwork, bright cosy palette) ── */
function Person({ x, y, look, facing = 'down', anim }: { x: number; y: number; look: Agent['look']; facing?: 'down' | 'up' | 'left' | 'right'; anim?: string }) {
  const px = x * T, py = y * T;
  return (
    <g transform={`translate(${px},${py})`}><g className={anim}>
      <ellipse cx={8} cy={15} rx={5} ry={1.6} fill="rgba(40,30,60,.25)" />
      {/* legs */}
      <rect x={5.5} y={12.5} width={2} height={2.5} fill="#3a3f55" />
      <rect x={8.5} y={12.5} width={2} height={2.5} fill="#3a3f55" />
      {/* body */}
      <rect x={4} y={8} width={8} height={5.5} rx={1.2} fill={look.shirt} stroke="rgba(30,25,45,.35)" strokeWidth={0.5} />
      <rect x={3} y={9} width={1.6} height={3.6} rx={0.6} fill={look.shirt} />
      <rect x={11.4} y={9} width={1.6} height={3.6} rx={0.6} fill={look.shirt} />
      <rect x={3} y={12.2} width={1.6} height={1.2} fill={look.skin} />
      <rect x={11.4} y={12.2} width={1.6} height={1.2} fill={look.skin} />
      {/* head */}
      <rect x={5} y={2} width={6} height={6.2} rx={1.5} fill={look.skin} stroke="rgba(30,25,45,.3)" strokeWidth={0.5} />
      <rect x={4.6} y={1.4} width={6.8} height={facing === 'up' ? 6.4 : 2.6} rx={1.4} fill={look.hair} />
      {look.long && <><rect x={4} y={3} width={1.6} height={6.4} rx={0.6} fill={look.hair} /><rect x={10.4} y={3} width={1.6} height={6.4} rx={0.6} fill={look.hair} /></>}
      {facing !== 'up' && <>
        {facing !== 'right' && <rect x={6.2} y={5} width={1.1} height={1.2} fill="#1d1a26" />}
        {facing !== 'left' && <rect x={8.7} y={5} width={1.1} height={1.2} fill="#1d1a26" />}
        <rect x={5.4} y={6.4} width={1.2} height={0.8} fill="#f3a3a0" opacity={0.6} />
        <rect x={9.4} y={6.4} width={1.2} height={0.8} fill="#f3a3a0" opacity={0.6} />
      </>}
    </g></g>
  );
}

function Chair({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x * T},${y * T})`}>
      <rect x={3} y={1} width={10} height={6} rx={2} fill="#4b5068" />
      <rect x={2.5} y={6} width={11} height={7} rx={2.5} fill="#5d6380" />
      <rect x={7} y={13} width={2} height={2} fill="#3a3f55" />
    </g>
  );
}

const Shadow = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => <rect x={x + 1} y={y + 1.5} width={w} height={h} rx={2} fill="rgba(60,45,80,.12)" />;

function Furniture({ f, glow }: { f: Furn; glow?: boolean }) {
  const x = f.x * T, y = f.y * T, w = (f.w ?? 1) * T, h = (f.h ?? 1) * T;
  const n = f.w ?? 1;
  switch (f.kind) {
    case 'rug': return <g><rect x={x} y={y} width={w} height={h} rx={4} fill={f.color} /><rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx={3} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={0.8} strokeDasharray="2 1.5" /></g>;
    case 'window': return <g><rect x={x + 1} y={y + 3} width={14} height={8} fill="#f7f7fb" /><rect x={x + 2} y={y + 4} width={5.5} height={6} fill="#bfe3ff" /><rect x={x + 8.5} y={y + 4} width={5.5} height={6} fill="#bfe3ff" /><rect x={x + 2.5} y={y + 4.5} width={2} height={2} fill="#e9f6ff" /></g>;
    case 'desk': return (
      <g>
        <Shadow x={x} y={y + 3} w={w} h={11} />
        <rect x={x} y={y + 3} width={w} height={11} rx={1.5} fill="#f7f7fa" stroke="#cfd0dc" strokeWidth={0.8} />
        <rect x={x} y={y + 12} width={w} height={2} fill="#dcdde7" />
        {Array.from({ length: n }).map((_, i) => (
          <g key={i}>
            <rect x={x + i * T + 3} y={y - 2} width={10} height={7.5} rx={1} fill="#2b2f3d" />
            <rect x={x + i * T + 4} y={y - 1} width={8} height={5.5} fill={glow ? '#8ec2ff' : '#59607a'} className={glow ? 'office-screen' : undefined} />
            <rect x={x + i * T + 7} y={y + 5.5} width={2} height={1.5} fill="#2b2f3d" />
            <rect x={x + i * T + 4} y={y + 8} width={8} height={2.5} rx={0.5} fill="#e3e4ec" />
            {i === n - 1 && <rect x={x + i * T + 12.5} y={y + 7.5} width={2.5} height={3} rx={0.6} fill={['#f29b72', '#8ac6a0', '#a99be8'][(f.x + f.y) % 3]} />}
          </g>
        ))}
      </g>
    );
    case 'shelf': return (
      <g><Shadow x={x} y={y} w={w} h={h} /><rect x={x} y={y} width={w} height={h} rx={1} fill="#c4935f" /><rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill="#a57647" />
        {Array.from({ length: n * 3 }).map((_, i) => <rect key={i} x={x + 2 + i * 5} y={y + 2.5 + (i % 2)} width={3.5} height={10 - (i % 2)} rx={0.5} fill={['#e9725e', '#5d8fe0', '#f2c14e', '#62b57d', '#b07fd9'][i % 5]} />)}
      </g>
    );
    case 'plant': return <g><ellipse cx={x + 8} cy={y + 15} rx={5} ry={1.4} fill="rgba(60,45,80,.15)" /><rect x={x + 4.5} y={y + 9.5} width={7} height={5.5} rx={1.5} fill="#f4f4f6" stroke="#d3d3dc" strokeWidth={0.6} /><circle cx={x + 8} cy={y + 6.5} r={4.8} fill="#4fa463" /><circle cx={x + 4.8} cy={y + 5} r={3.2} fill="#68bf78" /><circle cx={x + 11.2} cy={y + 5} r={3.2} fill="#68bf78" /><circle cx={x + 8} cy={y + 2.8} r={2.8} fill="#7fd08d" /></g>;
    case 'sofa': return <g><Shadow x={x} y={y + 2} w={w} h={12} /><rect x={x} y={y + 2} width={w} height={12} rx={3.5} fill="#ee9561" /><rect x={x + 2} y={y + 6} width={w - 4} height={6.5} rx={2.5} fill="#f6b88d" />{Array.from({ length: n - 1 }).map((_, i) => <rect key={i} x={x + (i + 1) * T - 0.4} y={y + 6.5} width={0.8} height={5.5} fill="#e48b57" />)}</g>;
    case 'table': return <g><Shadow x={x + 1} y={y + 2} w={w - 2} h={11} /><rect x={x + 1} y={y + 2} width={w - 2} height={11} rx={2.5} fill="#dcae78" stroke="#c39259" strokeWidth={0.6} />{Array.from({ length: n }).map((_, i) => <rect key={i} x={x + i * T + 4} y={y + 4.5} width={7.5} height={5.5} rx={0.5} fill="#fbfaf6" />)}</g>;
    case 'coffee': return <g><ellipse cx={x + 8} cy={y + 9.5} rx={6.5} ry={5} fill="rgba(60,45,80,.12)" /><ellipse cx={x + 8} cy={y + 8} rx={6.5} ry={5} fill="#d8a76f" stroke="#c08f58" strokeWidth={0.6} /><rect x={x + 5} y={y + 6} width={3} height={2.5} rx={0.6} fill="#fff" /><rect x={x + 9} y={y + 7} width={2.5} height={2.5} rx={1.2} fill="#f2c14e" /></g>;
    case 'beanbag': return <g><ellipse cx={x + 8} cy={y + 10} rx={6.5} ry={5} fill="rgba(60,45,80,.12)" /><ellipse cx={x + 8} cy={y + 8.5} rx={6.5} ry={5.5} fill={f.color} /><ellipse cx={x + 7} cy={y + 7} rx={3.5} ry={2.5} fill="rgba(255,255,255,.3)" /></g>;
    case 'pingpong': return <g><Shadow x={x + 1} y={y + 2} w={w - 2} h={h - 3} /><rect x={x + 1} y={y + 2} width={w - 2} height={h - 3} rx={1} fill="#2f9a62" stroke="#f7f7fa" strokeWidth={1} /><rect x={x + w / 2 - 0.6} y={y + 1} width={1.2} height={h - 1} fill="#f7f7fa" /><rect x={x + 1} y={y + h / 2 - 0.3} width={w - 2} height={0.6} fill="rgba(255,255,255,.7)" /><circle cx={x + 12} cy={y + 10} r={1.1} fill="#fff6c8" /></g>;
    case 'counter': return <g><Shadow x={x} y={y + 1} w={w} h={13} /><rect x={x} y={y + 1} width={w} height={13} rx={1} fill="#efebe3" stroke="#d6d0c4" strokeWidth={0.6} /><rect x={x + 3} y={y + 3.5} width={8} height={6} rx={1.5} fill="#cfd8e3" /><rect x={x + 6.5} y={y + 2} width={1} height={3} fill="#9aa3b5" /><rect x={x + 19} y={y + 3} width={6} height={7} rx={1} fill="#3b3f4f" /><rect x={x + 20} y={y + 4} width={4} height={2} fill="#e9725e" /></g>;
    case 'vending': return <g><Shadow x={x + 2} y={y} w={12} h={15} /><rect x={x + 2} y={y} width={12} height={15} rx={1.2} fill="#e35d5d" /><rect x={x + 3.5} y={y + 1.5} width={6} height={10} fill="#ffe8d6" />{[0, 1, 2].map((r) => <rect key={r} x={x + 4} y={y + 2.5 + r * 3} width={5} height={1.6} fill={['#5d8fe0', '#f2c14e', '#62b57d'][r]} />)}<rect x={x + 10.5} y={y + 2} width={2} height={4} fill="#3b3f4f" /></g>;
    case 'greenscreen': return <g><rect x={x} y={y} width={w} height={h} fill="#4cbb6f" /><rect x={x} y={y} width={w} height={2.5} fill="#3a9b58" /><rect x={x} y={y + h - 2} width={w} height={2} fill="rgba(0,0,0,.08)" /></g>;
    case 'camera': return <g><ellipse cx={x + 8} cy={y + 15} rx={5} ry={1.3} fill="rgba(60,45,80,.15)" /><rect x={x + 7} y={y + 8} width={2} height={7} fill="#4b5068" /><rect x={x + 2} y={y + 2} width={11} height={7} rx={1.2} fill="#2b2f3d" /><circle cx={x + 8} cy={y + 2.2} r={2.6} fill="#5b9cff" stroke="#2b2f3d" strokeWidth={0.8} /><circle cx={x + 11.5} cy={y + 4} r={0.8} fill="#e35d5d" /></g>;
    case 'light': return <g><rect x={x + 7} y={y + 6} width={2} height={9} fill="#6b7088" /><rect x={x + 3} y={y + 1} width={10} height={6} rx={1} fill={glow ? '#fff8d8' : '#e6e6ee'} stroke="#9aa0b5" strokeWidth={0.6} className={glow ? 'office-light' : undefined} /></g>;
    case 'mic': return <g><rect x={x + 7} y={y + 6} width={1.5} height={9} fill="#6b7088" /><rect x={x + 5} y={y + 1} width={6} height={7} rx={3} fill="#2b2f3d" /><rect x={x + 6} y={y + 2} width={4} height={5} rx={2} fill="#9aa0b5" /></g>;
    case 'board': return <g><rect x={x} y={y + 1} width={w} height={12} rx={1} fill="#fbfaf6" stroke="#c9c6d8" strokeWidth={0.8} />{Array.from({ length: n * 2 - 1 }).map((_, i) => <rect key={i} x={x + 3 + i * 8} y={y + 3 + (i % 2)} width={6} height={7} rx={0.5} fill={['#c9b8f5', '#a8d0ff', '#ffd2a8', '#b8e6c8', '#ffb8c6'][i % 5]} />)}</g>;
    case 'whiteboard': return <g><rect x={x} y={y + 1} width={w} height={11} rx={1} fill="#fbfaf6" stroke="#c9c6d8" strokeWidth={0.8} /><path d={`M${x + 4} ${y + 8} L${x + 10} ${y + 5} L${x + 16} ${y + 7} L${x + 24} ${y + 3}`} stroke="#5d8fe0" strokeWidth={1.2} fill="none" /><rect x={x + 3} y={y + 9.5} width={10} height={1} fill="#e9725e" /></g>;
    case 'tv': return <g><rect x={x + 1} y={y} width={w - 2} height={10} rx={1} fill="#2b2f3d" /><rect x={x + 2.5} y={y + 1.5} width={w - 5} height={7} fill={glow ? '#8ec2ff' : '#59607a'} />{[0, 1, 2, 3].map((i) => <rect key={i} x={x + 4 + i * 10} y={y + 6} width={8} height={1.5} fill="rgba(255,255,255,.5)" />)}</g>;
    case 'easel': return <g><rect x={x + 3} y={y + 1} width={10} height={9} fill="#fbfaf6" stroke="#c4935f" strokeWidth={1} /><rect x={x + 4.5} y={y + 2.5} width={7} height={6} fill="#c9b8f5" /><rect x={x + 7} y={y + 10} width={2} height={5} fill="#a57647" /></g>;
    case 'panel': return <g>{Array.from({ length: n * (f.h ?? 1) }).map((_, i) => <rect key={i} x={x + (i % n) * T + 1} y={y + Math.floor(i / n) * T + 1} width={14} height={14} rx={1} fill={i % 2 ? '#d7aac0' : '#e3bccf'} />)}</g>;
    case 'phones': return <g>{Array.from({ length: n }).map((_, i) => <g key={i}><rect x={x + i * T + 4} y={y} width={8} height={14} rx={2} fill="#2b2f3d" /><rect x={x + i * T + 5} y={y + 1.5} width={6} height={11} rx={0.6} fill={i % 2 ? '#ff6f9f' : '#5fe6e0'} opacity={0.85} /></g>)}</g>;
    case 'cooler': return <g><ellipse cx={x + 8} cy={y + 15} rx={4.5} ry={1.2} fill="rgba(60,45,80,.15)" /><rect x={x + 4} y={y + 6} width={8} height={9} rx={1} fill="#eef0f5" stroke="#cfd2dc" strokeWidth={0.6} /><rect x={x + 5} y={y} width={6} height={7} rx={2} fill="#8ec2ff" /></g>;
    case 'inbox': return <g><Shadow x={x + 2} y={y + 3} w={12} h={10} /><rect x={x + 2} y={y + 4} width={12} height={9} rx={1} fill="#d8b07c" /><rect x={x + 3} y={y + 1.5} width={10} height={4} fill="#fbfaf6" /><rect x={x + 3.5} y={y + 2.5} width={6} height={0.8} fill="#c9c6d8" /></g>;
    default: return null;
  }
}

/** Garden around the building (decoration only). */
function Garden() {
  const trees: [number, number, number][] = [[-2.2, -1.8, 1.4], [6, -2.4, 1.1], [15, -2.6, 1.3], [24, -2.3, 1.1], [31.4, -1.6, 1.4], [-2.4, 6, 1.2], [-2.6, 15, 1.3], [31.8, 7, 1.2], [31.6, 16, 1.4], [-2, 21.4, 1.3], [9, 21.8, 1.1], [20, 21.6, 1.2], [31.2, 21.3, 1.3]];
  const bushes: [number, number][] = [[2, -1], [11, -1.2], [19, -0.9], [27, -1.1], [-1, 3], [-1.1, 12], [30.2, 4], [30.1, 13], [4, 20.4], [14, 20.5], [25, 20.4]];
  const flowers: [number, number, string][] = [[3.5, -1.5, '#ff8fb1'], [12.5, -1.6, '#ffd166'], [21.5, -1.4, '#c3a6ff'], [-1.5, 9, '#ff8fb1'], [30.6, 10, '#ffd166'], [7, 20.8, '#c3a6ff'], [17, 20.9, '#ff8fb1']];
  return (
    <g pointerEvents="none">
      {bushes.map(([bx, by], i) => <g key={`b${i}`}><circle cx={bx * T + 8} cy={by * T + 8} r={7} fill="#5aa457" /><circle cx={bx * T + 4} cy={by * T + 6} r={4.5} fill="#6fbf6a" /><circle cx={bx * T + 12} cy={by * T + 6} r={4.5} fill="#6fbf6a" /></g>)}
      {flowers.map(([fx, fy, c], i) => <g key={`f${i}`}>{[0, 1, 2, 3].map((k) => <circle key={k} cx={fx * T + (k % 2) * 6} cy={fy * T + Math.floor(k / 2) * 5} r={1.6} fill={c} />)}</g>)}
      {trees.map(([tx, ty, sz], i) => (
        <g key={`t${i}`} transform={`translate(${tx * T},${ty * T}) scale(${sz})`}>
          <ellipse cx={8} cy={22} rx={9} ry={3} fill="rgba(40,70,30,.25)" />
          <rect x={6.5} y={13} width={3} height={9} fill="#8a5a3a" />
          <circle cx={8} cy={9} r={9} fill="#4e9a4c" /><circle cx={3.5} cy={7} r={5.5} fill="#62b25e" /><circle cx={12.5} cy={7} r={5.5} fill="#62b25e" /><circle cx={8} cy={3} r={5} fill="#7cc874" />
        </g>
      ))}
    </g>
  );
}

function Tag({ x, y, children, dot, wide = 44 }: { x: number; y: number; children: ReactNode; dot?: string; wide?: number }) {
  return (
    <g transform={`translate(${x * T + 8 - wide / 2},${y * T - 9})`} pointerEvents="none">
      <rect width={wide} height={8} rx={4} fill="rgba(32,30,44,.88)" />
      {dot && <circle cx={5} cy={4} r={2} fill={dot} />}
      <text x={dot ? 9 : wide / 2} y={5.6} fontSize={5} fill="#ffffff" textAnchor={dot ? 'start' : 'middle'} fontFamily="Inter, sans-serif">{children}</text>
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
          <svg viewBox={`${-PAD * T} ${-PAD * T} ${(W + PAD * 2) * T} ${(H + PAD * 2) * T}`} shapeRendering="crispEdges" style={{ width: '100%', display: 'block' }}>
            <defs>
              <pattern id="grass" width={T * 2} height={T * 2} patternUnits="userSpaceOnUse"><rect width={T * 2} height={T * 2} fill="#a6d48b" /><rect x={4} y={6} width={2} height={3} fill="#93c879" /><rect x={20} y={18} width={2} height={3} fill="#93c879" /><rect x={24} y={4} width={1.5} height={2.5} fill="#b6df9c" /><rect x={9} y={24} width={1.5} height={2.5} fill="#b6df9c" /></pattern>
              <pattern id="wood" width={T * 2} height={T} patternUnits="userSpaceOnUse"><rect width={T * 2} height={T} fill="#eadbbf" /><rect width={T * 2} height={0.8} fill="#dcc9a6" /><rect x={T * 1.3} width={0.8} height={T / 2} fill="#dcc9a6" /><rect x={T * 0.4} y={T / 2} width={0.8} height={T / 2} fill="#dcc9a6" /><rect y={T / 2} width={T * 2} height={0.5} fill="#e3d2b3" /></pattern>
              <pattern id="carpet" width={T} height={T} patternUnits="userSpaceOnUse"><rect width={T} height={T} fill="rgba(255,255,255,.18)" /><rect width={T} height={0.5} fill="rgba(80,70,110,.08)" /><rect width={0.5} height={T} fill="rgba(80,70,110,.08)" /></pattern>
            </defs>
            <rect x={-PAD * T} y={-PAD * T} width={(W + PAD * 2) * T} height={(H + PAD * 2) * T} fill="url(#grass)" />
            <rect x={13 * T} y={H * T} width={4 * T} height={PAD * T} fill="#e2d6bd" />
            <Garden />
            <rect x={-4} y={-4} width={W * T + 8} height={H * T + 8} rx={3} fill="rgba(50,40,70,.18)" />
            <rect width={W * T} height={H * T} fill="url(#wood)" />
            {ROOMS.map((r) => (
              <g key={r.id}>
                <rect x={r.x * T} y={r.y * T} width={r.w * T} height={r.h * T} fill={r.floor} />
                <rect x={r.x * T} y={r.y * T} width={r.w * T} height={r.h * T} fill="url(#carpet)" />
              </g>
            ))}
            {/* walls */}
            {[...blocked].filter((k) => { const [x, y] = k.split(',').map(Number); return !FURN.some((f) => f.solid && x >= f.x && x < f.x + (f.w ?? 1) && y >= f.y && y < f.y + (f.h ?? 1)) && !AGENTS.some((a) => a.seat[0] === x && a.seat[1] === y); }).map((k) => {
              const [x, y] = k.split(',').map(Number);
              return <g key={k}><rect x={x * T} y={y * T} width={T} height={T} fill="#8b87a8" /><rect x={x * T} y={y * T} width={T} height={5} fill="#c7c3dc" /><rect x={x * T} y={y * T + T - 1.5} width={T} height={1.5} fill="#6f6b8e" /></g>;
            })}
            {ROOMS.flatMap((r) => r.doors.map(([x, y]) => <g key={`${x},${y}`}><rect x={x * T} y={y * T} width={T} height={T} fill="#e0c9a0" /><rect x={x * T} y={y * T} width={1.5} height={T} fill="#b9a37c" /><rect x={x * T + T - 1.5} y={y * T} width={1.5} height={T} fill="#b9a37c" /></g>))}
            {AGENTS.map((a) => <Chair key={`chair-${a.dept}`} x={a.seat[0]} y={a.seat[1]} />)}
            {FURN.map((f, i) => {
              const glowAgent = AGENTS.find((a) => f.kind === 'desk' && a.seat[0] >= f.x && a.seat[0] < f.x + (f.w ?? 1) && a.seat[1] === f.y - 1);
              const glow = glowAgent ? ['Connected', 'In Progress'].includes(states[glowAgent.dept].state) : f.kind === 'light' ? ['Connected', 'In Progress'].includes(states.video.state) : f.kind === 'tv' ? ['Connected', 'In Progress'].includes(states.editor.state) : f.kind === 'desk' && f.x === 23;
              return <Furniture key={i} f={f} glow={glow} />;
            })}
            {/* room labels */}
            {ROOMS.map((r) => <text key={r.id} x={(r.x + r.w / 2) * T} y={(r.y + r.h - 1) * T - 3} fontSize={5.5} textAnchor="middle" fill="rgba(60,52,90,.5)" fontWeight={600} fontFamily="Inter, sans-serif" pointerEvents="none">{r.name}</text>)}

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
                  {st === 'Not Connected' && <text x={a.seat[0] * T + 13} y={a.seat[1] * T + 2} fontSize={5.5} fill="#5d6380" fontWeight={700} className="office-zzz" fontFamily="Inter, sans-serif">z z</text>}
                  <Tag x={a.seat[0]} y={a.seat[1]} dot={STATE_COLOR[st]} wide={46}>{a.name}</Tag>
                  {bubble && (near === a.dept || st !== 'Connected') && (
                    <g transform={`translate(${a.seat[0] * T + 8 - 26},${a.seat[1] * T - 19})`} pointerEvents="none">
                      <rect width={52} height={9} rx={3} fill="#ffffff" stroke="rgba(60,52,90,.25)" strokeWidth={0.6} /><text x={26} y={6.2} fontSize={4.6} textAnchor="middle" fill="#14161c" fontFamily="Inter, sans-serif">{bubble}</text>
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
