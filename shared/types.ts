// Domain model shared by the frontend and the server.
// Field names map to worksheet columns via shared/sheetSchema.ts.

export type ApprovalStage =
  | 'Draft'
  | 'Under Review'
  | 'Changes Requested'
  | 'Approved'
  | 'In Production'
  | 'Final Review'
  | 'Ready to Publish'
  | 'Published'
  | 'Rejected';

/** The canonical forward path of an episode through human approval. */
export const PIPELINE: ApprovalStage[] = [
  'Draft',
  'Under Review',
  'Approved',
  'In Production',
  'Final Review',
  'Ready to Publish',
  'Published',
];

export type WorkStatus =
  | 'Not Started'
  | 'In Progress'
  | 'In Review'
  | 'Changes Requested'
  | 'Approved'
  | 'Complete';

export const WORK_STATUSES: WorkStatus[] = [
  'Not Started',
  'In Progress',
  'In Review',
  'Changes Requested',
  'Approved',
  'Complete',
];

export type PublishStatus = 'Not Scheduled' | 'Draft Prepared' | 'Scheduled' | 'Published' | 'Failed';
export const PUBLISH_STATUSES: PublishStatus[] = ['Not Scheduled', 'Draft Prepared', 'Scheduled', 'Published', 'Failed'];

export type Platform = 'Instagram' | 'TikTok';

export interface Project {
  id: string;
  titleZh: string;
  titleEn: string;
  genre: string;
  format: string;
  totalEpisodes: number;
  episodeDuration: string;
  pilotTarget: string;
  language: string;
  subtitles: string;
  visualStyle: string;
  platforms: Platform[];
  frequency: string;
  automation: string;
  monthlyBudget: number;
  startDate: string; // first publish date (ISO)
  logline: string;
}

export interface Episode {
  id: string; // EP001
  number: number;
  titleZh: string;
  titleEn: string;
  synopsis: string;
  arc: string;
  scriptStatus: WorkStatus;
  storyboardStatus: WorkStatus;
  videoStatus: WorkStatus;
  editingStatus: WorkStatus;
  approvalStatus: ApprovalStage;
  publishingStatus: PublishStatus;
  targetPublishDate: string; // ISO yyyy-mm-dd
  targetDuration: number; // seconds
  notes?: string;
  updatedAt: string;
}

export interface Character {
  id: string; // C01
  nameZh: string;
  nameEn: string;
  age: number;
  role: string;
  appearance: string;
  wardrobeLock: string;
  voice: string;
  continuity: string;
  imageUrl?: string;
}

export interface Location {
  id: string; // L01
  nameZh: string;
  nameEn: string;
  description: string;
  lighting: string;
  continuity: string;
  imageUrl?: string;
}

export interface Asset {
  id: string; // A001
  type: 'Character Reference' | 'Location Reference' | 'Prop' | 'Music' | 'SFX' | 'Logo' | 'Other';
  name: string;
  linkedTo: string; // C01 / L02 / EP001
  url: string;
  status: 'Needed' | 'In Progress' | 'Approved' | 'Locked';
  notes: string;
}

export interface DialogueLine {
  id: string;
  characterId: string;
  zh: string;
  en: string;
  emotion?: string;
}

export interface Scene {
  id: string;
  number: number;
  locationId: string;
  timeOfDay: string;
  characterIds: string[];
  visualAction: string;
  camera: string;
  sfx: string;
  duration: number; // seconds
  dialogue: DialogueLine[];
}

export interface ScriptVersion {
  id: string;
  episodeId: string;
  version: number;
  scenes: Scene[];
  savedAt: string;
  savedBy: string;
  note: string;
  source: 'manual' | 'ai' | 'demo-template';
}

export interface Shot {
  id: string; // EP001-S01-SH01
  episodeId: string;
  sceneNumber: number;
  shotNumber: number;
  shotType: string;
  camera: string;
  description: string;
  visualPrompt: string;
  characterIds: string[];
  duration: number;
  storyboardStatus: WorkStatus;
}

export type GenerationStatus = 'Not Generated' | 'Queued' | 'Generating' | 'Generated' | 'Uploaded' | 'Failed' | 'Approved';

export interface ProductionClip {
  id: string;
  episodeId: string;
  sceneNumber: number;
  prompt: string;
  characterRefs: string[];
  generationStatus: GenerationStatus;
  clipUrl: string;
  fileName?: string;
  duration: number;
  credits: number;
  notes: string;
  updatedAt: string;
}

export interface VoiceLine {
  id: string; // dialogue line id
  episodeId: string;
  voiceStatus: 'Not Started' | 'Recorded' | 'Approved';
  audioUrl: string;
}

export interface EditJob {
  episodeId: string;
  music: string;
  subtitlesBurned: boolean;
  renderStatus: 'Not Started' | 'Assembling' | 'Rendering' | 'Rendered' | 'Approved';
  renderUrl: string;
  notes: string;
  clipOrder: string[];
}

export interface PublishEntry {
  id: string;
  episodeId: string;
  platform: Platform;
  caption: string;
  hashtags: string;
  scheduledDate: string;
  status: PublishStatus;
  postUrl: string;
}

export interface AnalyticsEntry {
  id: string;
  episodeId: string;
  platform: Platform;
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  completionRate: number; // 0-100
  followersGained: number;
  source: 'manual' | 'sheets' | 'api';
}

export interface ApprovalRecord {
  id: string;
  episodeId: string;
  subject: 'Script' | 'Video' | 'Episode' | 'Publishing';
  action: 'Submitted' | 'Approved' | 'Changes Requested' | 'Rejected' | 'Advanced' | 'Reopened' | 'Published';
  from: ApprovalStage;
  to: ApprovalStage;
  reviewer: string;
  comment: string;
  timestamp: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  actor: string;
  department?: DepartmentId;
  message: string;
  episodeId?: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

export type DepartmentId =
  | 'writer'
  | 'director'
  | 'storyboard'
  | 'video'
  | 'voice'
  | 'editor'
  | 'distribution';

export interface BudgetLine {
  id: string;
  service: 'OpenAI' | 'Kling AI' | 'Shotstack' | 'Make.com' | 'Voice' | 'Other';
  description: string;
  estimatedMonthly: number;
}

export interface Expense {
  id: string;
  date: string;
  service: BudgetLine['service'];
  description: string;
  amount: number; // USD — actual, entered by a human from a real invoice/usage page
  reference: string;
}

export interface Task {
  id: string;
  title: string;
  episodeId?: string;
  due: string;
  done: boolean;
  owner: string;
}

/** Integration status as reported by the server. Never inferred client-side. */
export type ConnectionState = 'Not Connected' | 'Connected' | 'In Progress' | 'Needs Attention';

export interface IntegrationStatus {
  id: string;
  name: string;
  state: ConnectionState;
  configured: boolean;
  detail: string;
  lastTestedAt?: string;
  testable: boolean;
}
