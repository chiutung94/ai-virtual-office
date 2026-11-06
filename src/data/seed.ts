// SAMPLE data for local demo mode — placeholders only. Real production data is
// loaded by importing the workbook (.xlsx) or pulling from Google Sheets, so no
// script content needs to live in this (public) repository.
import type {
  ActivityItem, ApprovalRecord, Asset, BudgetLine, Character, Continuity, EditJob, Episode, Location,
  Project, PublishEntry, Scene, ScriptRun, ScriptVersion, Shot, Task,
} from '../../shared/types';

export const SEED_VERSION = 2;

export const project: Project = {
  id: 'P001',
  code: 'DRAMA001',
  titleZh: '《她归来时，豪门已倾》',
  titleEn: 'When She Returned, the Empire Fell',
  genre: 'Wealthy-family conflict, revenge and comeback',
  format: 'Vertical short drama (9:16)',
  totalEpisodes: 60,
  episodeDuration: '45–90 seconds',
  pilotTarget: '75–90 seconds',
  language: 'Mandarin Chinese',
  subtitles: 'Simplified Chinese and English',
  visualStyle: 'Photorealistic live-action cinematic',
  platforms: ['Instagram', 'TikTok'],
  frequency: 'One episode per day',
  automation: 'Semi-automated with human approval',
  monthlyBudget: 100,
  startDate: '2026-11-12',
  publishTime: '20:00',
  timezone: 'Asia/Kuala_Lumpur',
  logline: 'The presumed-dead Shen family heiress returns under a new name to take back what was stolen from her.',
};

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const epId = (n: number) => `EP${String(n).padStart(3, '0')}`;
const now = new Date().toISOString();

export const episodes: Episode[] = Array.from({ length: 60 }, (_, i) => {
  const n = i + 1;
  return {
    id: epId(n), number: n, titleZh: `第${n}集（示例）`, titleEn: `Episode ${n} (sample)`,
    synopsis: n === 1 ? 'Sample pilot — import your workbook to load the real series outline.' : '',
    arc: `ARC ${Math.min(6, Math.ceil(n / 10))}`, cliffhanger: '',
    scriptStatus: n === 1 ? 'In Progress' : 'Not Started', storyboardStatus: 'Not Started', videoStatus: 'Not Started', editingStatus: 'Not Started',
    approvalStatus: 'Draft', instagramStatus: 'Draft', tiktokStatus: 'Draft',
    targetPublishDate: '', publishTime: project.publishTime, targetDuration: 75,
    captionZh: '', captionEn: '', finalVideoUrl: '', notes: '', owner: 'Executive Producer', blocker: '', updatedAt: now,
  };
});

const C = (id: string, nameZh: string, nameEn: string, age: number, role: string): Character => ({
  id, nameZh, nameEn, age, role, appearance: '', wardrobeLock: '', voice: '', continuity: '', imageUrl: '', fullBodyUrl: '', expressionSheetUrl: '',
});
export const characters: Character[] = [
  C('C01', '沈知遥', 'Shen Zhiyao / Gu Nian', 28, 'Female protagonist'),
  C('C02', '陆景深', 'Lu Jingshen', 31, 'Strategic ally'),
  C('C03', '林曼如', 'Lin Manru', 48, 'Stepmother / antagonist'),
  C('C04', '沈浩然', 'Shen Haoran', 27, 'Half-brother / antagonist'),
  C('C05', '周承宇', 'Zhou Chengyu', 30, 'Former fiancé'),
  C('C06', '沈国峰', 'Shen Guofeng', 58, 'Deceased father'),
  C('C07', '苏婉清', 'Su Wanqing', 52, 'Mother'),
];

export const locations: Location[] = [
  { id: 'L01', nameZh: '示例地点', nameEn: 'Sample location', description: 'Import the LOCATIONS worksheet to load real sets.', continuity: '', imageUrl: '' },
];

export const assets: Asset[] = [];

const pilot: Scene[] = [
  {
    id: 'S1', number: 1, title: '示例场景', locationId: 'L01', timeOfDay: 'Day', characterIds: ['C01'], duration: 10,
    visualAction: '[SAMPLE] Placeholder scene. Import your workbook to load the real EP001 script.', camera: 'Slow push-in, 9:16', sfx: 'Ambience',
    dialogue: [{ id: 'DL1', characterId: 'C01', speaker: '顾念', speakerEn: 'Gu Nian', zh: '【示例台词】', en: '[Sample line]' }],
  },
];
export const scriptVersions: ScriptVersion[] = [
  { id: 'SV1', episodeId: 'EP001', version: 1, scenes: pilot, savedAt: now, savedBy: 'Sample data', note: 'Sample placeholder', source: 'demo-template' },
];

export const shots: Shot[] = [
  {
    id: 'EP001-S01', episodeId: 'EP001', sceneNumber: 1, shotNumber: 1, characterIds: ['C01'], referenceUrls: [], prompt: '[SAMPLE] Photorealistic cinematic live-action, vertical 9:16.',
    negativePrompt: 'cartoon, anime, watermark', duration: 5, aspectRatio: '9:16', resolution: '720p', generationStatus: 'Prompt Draft', klingTaskId: '', videoUrl: '', retryCount: 0, credits: 0, notes: '',
  },
];

export const editJobs: EditJob[] = [];
export const publishing: PublishEntry[] = [];
export const continuity: Continuity[] = [];
export const scriptRuns: ScriptRun[] = [];
export const approvals: ApprovalRecord[] = [];

export const activity: ActivityItem[] = [
  { id: 'AC1', timestamp: now, actor: 'System', message: 'Sample workspace created. Import your workbook in Settings to load real data.', level: 'info' },
];

export const budgetLines: BudgetLine[] = [
  { id: 'B1', service: 'OpenAI', description: 'Script generation (gpt-4o-mini, one run per episode)', estimatedMonthly: 5 },
  { id: 'B2', service: 'Kling AI', description: 'Video generation — ~5 clips/episode (largest cost driver)', estimatedMonthly: 60 },
  { id: 'B3', service: 'Shotstack', description: 'Final renders', estimatedMonthly: 15 },
  { id: 'B4', service: 'Make.com', description: 'Scenario operations', estimatedMonthly: 10 },
  { id: 'B5', service: 'Voice', description: 'Mandarin voice generation', estimatedMonthly: 8 },
  { id: 'B6', service: 'Other', description: 'Music licences / storage buffer', estimatedMonthly: 2 },
];

export const tasks: Task[] = [
  { id: 'T1', title: 'Import the production workbook (Settings → Import workbook)', due: addDays(project.startDate, -5), done: false, owner: 'Producer' },
  { id: 'T2', title: 'Approve cast master portraits (identity anchors) for C01–C05', due: addDays(project.startDate, -4), done: false, owner: 'Art' },
  { id: 'T3', title: 'Review and approve EP001 script', episodeId: 'EP001', due: addDays(project.startDate, -4), done: false, owner: 'Producer' },
  { id: 'T4', title: 'Connect Google Sheets service account', due: addDays(project.startDate, -3), done: false, owner: 'Admin' },
  { id: 'T5', title: 'Build Make.com Scenario 01 (daily script generator)', due: addDays(project.startDate, -3), done: false, owner: 'Admin' },
];
