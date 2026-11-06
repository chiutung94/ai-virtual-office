import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, BookOpen, Bot, CalendarDays, CheckSquare, Clapperboard, Cog, Database, Film, FolderKanban,
  LayoutDashboard, ListVideo, MapPin, Menu, Mic, PenSquare, Scissors, Users, Wallet,
} from 'lucide-react';
import { useStore } from '../store/store';
import { Toasts } from './ui';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/episodes', label: 'Episodes', icon: ListVideo },
  { to: '/script', label: 'Script Studio', icon: PenSquare },
  { to: '/storyboard', label: 'Storyboard & Shot List', icon: Clapperboard },
  { to: '/characters', label: 'Character Library', icon: Users },
  { to: '/locations', label: 'Locations & Assets', icon: MapPin },
  { to: '/departments', label: 'AI Departments', icon: Bot },
  { to: '/video', label: 'Video Production', icon: Film },
  { to: '/voice', label: 'Voice & Subtitles', icon: Mic },
  { to: '/editing', label: 'Editing Studio', icon: Scissors },
  { to: '/approvals', label: 'Approval Centre', icon: CheckSquare },
  { to: '/calendar', label: 'Publishing Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/budget', label: 'Budget & AI Usage', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: Cog },
];
const SECTIONS: Record<string, string> = { '/': 'Studio', '/script': 'Production', '/approvals': 'Release', '/budget': 'Admin' };

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const project = useStore((s) => s.project);
  const pending = useStore((s) => s.episodes.filter((e) => ['Under Review', 'Final Review'].includes(e.approvalStatus)).length);
  const backendOnline = useStore((s) => s.backendOnline);
  const dataSource = useStore((s) => s.settings.dataSource);
  const sheets = useStore((s) => s.integrations?.find((i) => i.id === 'sheets'));
  const refresh = useStore((s) => s.refreshIntegrations);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);

  const sheetsLive = dataSource === 'google-sheets' && sheets?.state === 'Connected';

  return (
    <div className="app">
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Primary">
        <div className="brand">
          <div className="brand-mark"><Clapperboard size={18} /></div>
          <div>
            <div className="brand-name">AI VIRTUAL OFFICE</div>
            <div className="brand-sub">AI Drama Production HQ</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(({ to, label, icon: I }) => (
            <div key={to}>
              {SECTIONS[to] && <div className="nav-section">{SECTIONS[to]}</div>}
              <NavLink to={to} end={to === '/'}>
                <I size={16} aria-hidden />
                <span>{label}</span>
                {to === '/approvals' && pending > 0 && <span className="count" aria-label={`${pending} pending`}>{pending}</span>}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="row" style={{ marginBottom: 6 }}>
            <Database size={13} />
            {sheetsLive ? 'Google Sheets connected' : 'Local demo mode'}
          </div>
          <div className="faint xs">Your AI-powered drama production studio.</div>
          <NavLink to="/settings/setup" className="xs row mt8"><BookOpen size={12} />Setup guide</NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn icon ghost menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
          <div className="project">
            <span className="xs muted">Current project</span>
            <span className="t zh truncate">{project.titleZh} <span className="muted hide-sm" style={{ fontWeight: 400 }}>· {project.titleEn}</span></span>
          </div>
          <div className="spacer" />
          <button
            className={`pill ${sheetsLive ? 'success' : 'warning'} hide-sm`}
            style={{ cursor: 'pointer' }}
            onClick={() => nav('/settings')}
            title={backendOnline === false ? 'API server not reachable — data is stored in this browser only' : 'Data source'}
          >
            <span className="dot" />
            {sheetsLive ? 'Live · Google Sheets' : backendOnline === false ? 'Demo · browser storage (API offline)' : 'Demo · browser storage'}
          </button>
          <button className="btn sm" onClick={() => nav('/approvals')}>Review queue{pending ? ` · ${pending}` : ''}</button>
        </header>
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}
