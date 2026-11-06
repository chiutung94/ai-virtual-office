import { Link } from 'react-router-dom';
import { Clapperboard, Film, Megaphone, Mic, PenSquare, Scissors, Video, type LucideIcon } from 'lucide-react';
import { publishSummary, type ConnectionState, type Episode, type IntegrationStatus, type DepartmentId } from '../../shared/types';
import { useStore } from '../store/store';
import { Banner, Empty, PageHead, StatusPill, relTime } from '../components/ui';

export interface Department {
  id: DepartmentId;
  name: string;
  service: string;
  integrations: string[]; // all must be Connected
  icon: LucideIcon;
  role: string;
  link: string;
}

export const DEPARTMENTS: Department[] = [
  { id: 'writer', name: 'AI Head Writer', service: 'OpenAI API', integrations: ['openai'], icon: PenSquare, role: 'Drafts bilingual scene scripts from the series outline.', link: '/script' },
  { id: 'director', name: 'AI Director', service: 'Scene planning & shot prompts (OpenAI)', integrations: ['openai'], icon: Clapperboard, role: 'Breaks approved scripts into shots and camera direction.', link: '/storyboard' },
  { id: 'storyboard', name: 'AI Storyboard Artist', service: 'Visual planning (OpenAI)', integrations: ['openai'], icon: Film, role: 'Writes locked visual prompts with character & wardrobe continuity.', link: '/storyboard' },
  { id: 'video', name: 'AI Video Generator', service: 'Kling AI', integrations: ['kling'], icon: Video, role: 'Generates 9:16 scene clips from approved prompts.', link: '/video' },
  { id: 'voice', name: 'AI Voice Studio', service: 'Mandarin dialogue & voice generation', integrations: ['voice'], icon: Mic, role: 'Produces Mandarin dialogue tracks per character voice.', link: '/voice' },
  { id: 'editor', name: 'AI Editor', service: 'Shotstack', integrations: ['shotstack'], icon: Scissors, role: 'Assembles clips, music and subtitles into the final cut.', link: '/editing' },
  { id: 'distribution', name: 'AI Distribution Manager', service: 'Instagram & TikTok', integrations: ['instagram', 'tiktok'], icon: Megaphone, role: 'Prepares captions and post drafts. Never posts without approval.', link: '/calendar' },
];

export function queueFor(d: DepartmentId, eps: Episode[]): Episode[] {
  switch (d) {
    case 'writer': return eps.filter((e) => ['In Progress', 'Changes Requested', 'Not Started'].includes(e.scriptStatus));
    case 'director':
    case 'storyboard': return eps.filter((e) => ['Approved', 'In Production'].includes(e.approvalStatus) && !['Complete', 'Approved'].includes(e.storyboardStatus));
    case 'video': return eps.filter((e) => e.approvalStatus === 'In Production' && !['Complete', 'Approved'].includes(e.videoStatus));
    case 'voice': return eps.filter((e) => e.approvalStatus === 'In Production');
    case 'editor': return eps.filter((e) => ['In Production', 'Final Review'].includes(e.approvalStatus) && e.editingStatus !== 'Approved');
    case 'distribution': return eps.filter((e) => e.approvalStatus === 'Ready to Publish');
  }
}

export function departmentState(d: Department, integrations: IntegrationStatus[] | null, eps: Episode[]): { state: ConnectionState; detail: string } {
  if (!integrations) return { state: 'Not Connected', detail: 'API server not reachable — integration status unknown, treated as not connected.' };
  const list = d.integrations.map((id) => integrations.find((i) => i.id === id));
  if (list.some((i) => !i || i.state === 'Not Connected') && !list.some((i) => i?.configured)) {
    return { state: 'Not Connected', detail: list.find((i) => i?.state === 'Not Connected')?.detail ?? 'Not configured.' };
  }
  if (list.every((i) => i?.state === 'Connected')) {
    return queueFor(d.id, eps).length
      ? { state: 'In Progress', detail: 'Connected · work in queue' }
      : { state: 'Connected', detail: 'Connected · idle' };
  }
  return { state: 'Needs Attention', detail: list.filter((i) => i && i.state !== 'Connected').map((i) => `${i!.name}: ${i!.detail}`).join(' ') };
}

export default function Departments() {
  const { integrations, episodes, activity, backendOnline } = useStore();
  return (
    <>
      <PageHead title="AI Departments" sub="Each department is a pipeline role backed by an external service. Status comes from verified server-side tests only." />
      {backendOnline === false && <div className="mb16"><Banner tone="warning">The API server is offline, so no external service can be verified. All departments show “Not Connected”. Manual work and tracking still function.</Banner></div>}
      <div className="grid g3">
        {DEPARTMENTS.map((d) => {
          const st = departmentState(d, integrations, episodes);
          const q = queueFor(d.id, episodes);
          const acts = activity.filter((a) => a.department === d.id).slice(0, 3);
          return (
            <section key={d.id} className="card">
              <div className="card-head">
                <div className="row grow" style={{ alignItems: 'flex-start' }}>
                  <div className="dept-icon"><d.icon size={18} /></div>
                  <div className="grow">
                    <h2>{d.name}</h2>
                    <div className="sub">{d.service}</div>
                  </div>
                </div>
                <StatusPill status={st.state} />
              </div>
              <div className="card-body col gap16">
                <p className="small muted">{d.role}</p>
                <div className="xs faint">{st.detail}</div>
                <div>
                  <div className="row between"><span className="label">Task queue</span><span className="xs muted">{q.length} episodes</span></div>
                  {q.length ? (
                    <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }} className="col gap4">
                      {q.slice(0, 4).map((e) => (
                        <li key={e.id} className="row between small">
                          <Link to={`/episodes/${e.id}`} className="truncate">{e.id} <span className="zh muted">{e.titleZh}</span></Link>
                          <StatusPill status={d.id === 'writer' ? e.scriptStatus : d.id === 'editor' ? e.editingStatus : d.id === 'video' ? e.videoStatus : d.id === 'distribution' ? publishSummary(e) : e.storyboardStatus} dot={false} />
                        </li>
                      ))}
                      {q.length > 4 && <li className="xs muted">+{q.length - 4} more</li>}
                    </ul>
                  ) : <div className="xs muted mt8">Queue empty</div>}
                </div>
                <div>
                  <span className="label">Recent activity</span>
                  {acts.length ? acts.map((a) => <div key={a.id} className="xs muted mt8">{a.message} · {relTime(a.timestamp)}</div>) : <div className="xs faint mt8">No activity</div>}
                </div>
                <div className="row"><Link to={d.link} className="btn sm">Open workspace</Link>{st.state !== 'Connected' && st.state !== 'In Progress' && <Link to="/settings" className="btn sm ghost">Configure</Link>}</div>
              </div>
            </section>
          );
        })}
      </div>
      {!episodes.length && <Empty title="No episodes" />}
    </>
  );
}
