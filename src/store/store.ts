import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ActivityItem, AnalyticsEntry, ApprovalRecord, Asset, BudgetLine, Character, EditJob, Episode, Expense,
  IntegrationStatus, Location, ProductionClip, Project, PublishEntry, Scene, ScriptVersion, Shot, Task, VoiceLine,
} from '../../shared/types';
import * as seed from '../data/seed';
import { actionsFor, sideEffects, type WfAction } from '../lib/workflow';
import { api } from '../lib/api';

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const now = () => new Date().toISOString();

export interface Collections {
  episodes: Episode[];
  characters: Character[];
  locations: Location[];
  assets: Asset[];
  scriptVersions: ScriptVersion[];
  shots: Shot[];
  clips: ProductionClip[];
  voiceLines: VoiceLine[];
  editJobs: EditJob[];
  publishing: PublishEntry[];
  analytics: AnalyticsEntry[];
  approvals: ApprovalRecord[];
  activity: ActivityItem[];
  budgetLines: BudgetLine[];
  expenses: Expense[];
  tasks: Task[];
}
type KeyedCollection = Exclude<keyof Collections, 'editJobs' | 'voiceLines'>;

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

export interface Settings {
  reviewerName: string;
  dataSource: 'local-demo' | 'google-sheets';
  autoNotifyMake: boolean;
  lastPull?: string;
  lastPush?: string;
}

interface State extends Collections {
  seedVersion: number;
  project: Project;
  settings: Settings;
  // runtime (not persisted)
  integrations: IntegrationStatus[] | null;
  backendOnline: boolean | null;
  toasts: Toast[];

  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: string) => void;
  log: (a: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
  updateProject: (p: Partial<Project>) => void;
  updateSettings: (p: Partial<Settings>) => void;
  updateEpisode: (id: string, patch: Partial<Episode>) => void;
  upsert: <K extends KeyedCollection>(col: K, item: Collections[K][number]) => void;
  remove: (col: KeyedCollection, id: string) => void;
  replaceCollection: <K extends keyof Collections>(col: K, items: Collections[K]) => void;
  upsertEditJob: (job: EditJob) => void;
  upsertVoiceLine: (v: VoiceLine) => void;
  transition: (episodeId: string, action: WfAction, comment: string) => { ok: boolean; error?: string };
  saveScript: (episodeId: string, scenes: Scene[], note: string, source: ScriptVersion['source']) => ScriptVersion;
  refreshIntegrations: () => Promise<void>;
  notifyMake: (event: string, payload: unknown) => Promise<void>;
  resetDemo: () => void;
  importBackup: (data: Partial<Collections> & { project?: Project }) => void;
}

const seedCollections = (): Collections & { project: Project } => ({
  project: seed.project,
  episodes: seed.episodes,
  characters: seed.characters,
  locations: seed.locations,
  assets: seed.assets,
  scriptVersions: seed.scriptVersions,
  shots: seed.shots,
  clips: seed.clips,
  voiceLines: [],
  editJobs: seed.editJobs,
  publishing: seed.publishing,
  analytics: [],
  approvals: seed.approvals,
  activity: seed.activity,
  budgetLines: seed.budgetLines,
  expenses: [],
  tasks: seed.tasks,
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seedCollections(),
      seedVersion: seed.SEED_VERSION,
      settings: { reviewerName: 'Producer', dataSource: 'local-demo', autoNotifyMake: true },
      integrations: null,
      backendOnline: null,
      toasts: [],

      toast: (kind, text) => {
        const id = uid('t');
        set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
        setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 4000);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      log: (a) => set((s) => ({ activity: [{ ...a, id: uid('ac'), timestamp: now() }, ...s.activity].slice(0, 300) })),

      updateProject: (p) => set((s) => ({ project: { ...s.project, ...p } })),
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      updateEpisode: (id, patch) =>
        set((s) => ({ episodes: s.episodes.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: now() } : e)) })),

      upsert: (col, item) =>
        set((s) => {
          const list = s[col] as { id: string }[];
          const it = item as { id: string };
          const exists = list.some((x) => x.id === it.id);
          return { [col]: exists ? list.map((x) => (x.id === it.id ? it : x)) : [...list, it] } as Partial<State>;
        }),
      remove: (col, id) => set((s) => ({ [col]: (s[col] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<State>),
      replaceCollection: (col, items) => set({ [col]: items } as Partial<State>),

      upsertEditJob: (job) =>
        set((s) => ({
          editJobs: s.editJobs.some((j) => j.episodeId === job.episodeId)
            ? s.editJobs.map((j) => (j.episodeId === job.episodeId ? job : j))
            : [...s.editJobs, job],
        })),
      upsertVoiceLine: (v) =>
        set((s) => ({
          voiceLines: s.voiceLines.some((x) => x.id === v.id) ? s.voiceLines.map((x) => (x.id === v.id ? v : x)) : [...s.voiceLines, v],
        })),

      transition: (episodeId, action, comment) => {
        const s = get();
        const ep = s.episodes.find((e) => e.id === episodeId);
        if (!ep) return { ok: false, error: 'Episode not found' };
        const def = actionsFor(ep.approvalStatus).find((a) => a.action === action);
        if (!def) return { ok: false, error: `“${action}” is not allowed from ${ep.approvalStatus}` };
        if (def.requiresComment && !comment.trim()) return { ok: false, error: 'A reviewer comment is required.' };
        if (action === 'publish') {
          const posts = s.publishing.filter((p) => p.episodeId === episodeId);
          if (!posts.some((p) => p.postUrl.trim())) return { ok: false, error: 'Add at least one post URL in the Publishing Calendar first.' };
        }
        const record: ApprovalRecord = {
          id: uid('ap'), episodeId, subject: def.subject, action: def.record, from: ep.approvalStatus, to: def.to,
          reviewer: s.settings.reviewerName, comment: comment.trim(), timestamp: now(),
        };
        s.updateEpisode(episodeId, { approvalStatus: def.to, ...sideEffects(ep, ep.approvalStatus, action) });
        set((st) => ({ approvals: [record, ...st.approvals] }));
        s.log({
          actor: s.settings.reviewerName, episodeId,
          message: `${episodeId}: ${def.label} (${record.from} → ${record.to})${comment ? ` — “${comment}”` : ''}`,
          level: def.tone === 'danger' ? 'error' : def.tone === 'warning' ? 'warning' : def.tone === 'success' ? 'success' : 'info',
        });
        if (def.makeEvent) void s.notifyMake(def.makeEvent, { episode: { ...ep, approvalStatus: def.to }, approval: record, approved: def.to === 'Ready to Publish' || def.to === 'Published' });
        return { ok: true };
      },

      saveScript: (episodeId, scenes, note, source) => {
        const versions = get().scriptVersions.filter((v) => v.episodeId === episodeId);
        const v: ScriptVersion = {
          id: uid('sv'), episodeId, version: (versions.reduce((m, x) => Math.max(m, x.version), 0) || 0) + 1,
          scenes: structuredClone(scenes), savedAt: now(), savedBy: get().settings.reviewerName, note, source,
        };
        set((s) => ({ scriptVersions: [...s.scriptVersions, v] }));
        const ep = get().episodes.find((e) => e.id === episodeId);
        if (ep && (ep.scriptStatus === 'Not Started')) get().updateEpisode(episodeId, { scriptStatus: 'In Progress' });
        else get().updateEpisode(episodeId, {});
        get().log({ actor: v.savedBy, department: 'writer', episodeId, message: `${episodeId} script saved as v${v.version}${source !== 'manual' ? ` (${source})` : ''}`, level: 'info' });
        return v;
      },

      refreshIntegrations: async () => {
        try {
          await api.health();
          const list = await api.integrations();
          set({ integrations: list, backendOnline: true });
        } catch {
          set({ integrations: null, backendOnline: false });
        }
      },

      notifyMake: async (event, payload) => {
        const s = get();
        const make = s.integrations?.find((i) => i.id === 'make');
        if (!s.settings.autoNotifyMake || make?.state !== 'Connected') return; // never pretend to send
        try {
          await api.makeEvent(event, payload);
          s.log({ actor: 'Make.com', message: `Webhook delivered: ${event}`, level: 'success' });
        } catch (e) {
          s.log({ actor: 'Make.com', message: `Webhook failed (${event}): ${(e as Error).message}`, level: 'error' });
          s.toast('error', `Make.com webhook failed: ${(e as Error).message}`);
        }
      },

      resetDemo: () => set({ ...seedCollections(), seedVersion: seed.SEED_VERSION }),
      importBackup: (data) => set((s) => ({ ...s, ...data })),
    }),
    {
      name: 'avo-drama-hq',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { integrations: _i, backendOnline: _b, toasts: _t, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as unknown as State;
      },
    },
  ),
);

// Convenience selectors
export const useEpisode = (id?: string) => useStore((s) => s.episodes.find((e) => e.id === id));
export const latestScript = (versions: ScriptVersion[], episodeId: string) =>
  versions.filter((v) => v.episodeId === episodeId).sort((a, b) => b.version - a.version)[0];
