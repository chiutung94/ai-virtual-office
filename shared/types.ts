// Domain model shared by the frontend and the server.
// Mirrors the worksheets of "AI OFFICE – DRAMA PRODUCTION HQ"; see shared/workbook.ts
// for the exact column mapping.

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

export type WorkStatus = 'Not Started' | 'In Progress' | 'In Review' | 'Changes Requested' | 'Approved' | 'Complete';
export const WORK_STATUSES: WorkStatus[] = ['Not Started', 'In Progress', 'In Review', 'Changes Requested', 'Approved', 'Complete'];

/** Per-platform publishing state (EPISODES.instagram_status / tiktok_status, PUBLISHING.status). */
export type PublishStatus = 'Draft' | 'Ready' | 'Scheduled' | 'Published' | 'Failed';
export const PUBLISH_STATUSES: PublishStatus[] = ['Draft', 'Ready', 'Scheduled', 'Published', 'Failed'];

export type Platform = 'Instagram' | 'TikTok';
export const PLATFORMS: Platform[] = ['Instagram', 'TikTok'];

export interface Project {
  id: string;
  code: string; // DRAMA001 — prefix of workbook episode IDs
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
  startDate: string; // planned first publish date (ISO)
  publishTime: string; // HH:mm, Malaysia time
  timezone: string;
  logline: string;
}

export interface Episode {
  id: string; // EP001 (workbook: DRAMA001-EP001)
  number: number;
  titleZh: string;
  titleEn: string;
  synopsis: string; // workbook: logline
  arc: string;
  cliffhanger: string;
  scriptStatus: WorkStatus;
  storyboardStatus: WorkStatus;
  videoStatus: WorkStatus;
  editingStatus: WorkStatus;
  approvalStatus: ApprovalStage;
  instagramStatus: PublishStatus;
  tiktokStatus: PublishStatus;
  targetPublishDate: string; // yyyy-mm-dd
  publishTime: string; // HH:mm MYT
  targetDuration: number; // seconds
  captionZh: string;
  captionEn: string;
  finalVideoUrl: string;
  notes: string; // workbook: review_notes
  owner: string;
  blocker: string;
  updatedAt: string;
}

export interface Character {
  id: string; // C01
  nameZh: string;
  nameEn: string;
  age: number;
  role: string;
  appearance: string; // appearance_lock
  wardrobeLock: string;
  voice: string; // voice_direction
  continuity: string; // notes
  imageUrl: string; // master_portrait_url
  fullBodyUrl: string;
  expressionSheetUrl: string;
}

export interface Location {
  id: string; // L01
  nameZh: string;
  nameEn: string;
  description: string; // visual_description
  continuity: string;
  imageUrl: string; // reference_image_url
}

export interface Asset {
  id: string;
  episodeId: string;
  type: string;
  linkedTo: string; // character_or_scene
  url: string;
  version: string;
  approved: boolean;
  createdAt: string;
  notes: string;
}

export interface DialogueLine {
  id: string;
  characterId: string; // '' when the speaker is not in the Character Library (e.g. 秘书)
  speaker?: string; // label as written in the script (e.g. 顾念) — preserved on export
  speakerEn?: string;
  zh: string;
  en: string;
  emotion?: string;
}

export interface Scene {
  id: string;
  number: number;
  title: string;
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
  source: 'manual' | 'ai' | 'demo-template' | 'workbook';
}

export type GenerationStatus = 'Prompt Draft' | 'Prompt Ready' | 'Queued' | 'Generating' | 'Generated' | 'Uploaded' | 'Failed' | 'Approved';
export const GENERATION_STATUSES: GenerationStatus[] = ['Prompt Draft', 'Prompt Ready', 'Queued', 'Generating', 'Generated', 'Uploaded', 'Failed', 'Approved'];

/** One generated clip = one SHOT_LIST row (prompt + Kling generation tracking). */
export interface Shot {
  id: string; // EP001-S01 (workbook: DRAMA001-EP001-S01)
  episodeId: string;
  sceneNumber: number;
  shotNumber: number;
  characterIds: string[];
  referenceUrls: string[];
  prompt: string;
  negativePrompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  generationStatus: GenerationStatus;
  klingTaskId: string;
  videoUrl: string;
  fileName?: string;
  retryCount: number;
  credits: number; // Kling units used (workbook column kling_units)
  notes: string;
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
  clipOrder: string[]; // shot ids
}

export interface PublishEntry {
  id: string; // EP001-Instagram
  episodeId: string;
  platform: Platform;
  caption: string;
  hashtags: string;
  coverUrl: string;
  videoUrl: string;
  scheduledAt: string; // 'YYYY-MM-DD HH:mm' Malaysia time
  status: PublishStatus;
  platformPostId: string;
  postUrl: string; // published_url
  notes: string;
}

export interface AnalyticsEntry {
  id: string;
  episodeId: string;
  platform: Platform;
  postedAt: string;
  views: number; // views_24h
  avgWatchSec: number;
  completionRate: number; // 0-100
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followersGained: number;
  notes: string;
  source: 'manual' | 'sheets' | 'api';
}

export interface Continuity {
  episodeId: string;
  timelineDate: string;
  facts: string;
  stateChanges: string;
  propsCostume: string;
  unresolved: string;
  nextConstraints: string;
}

/** SCRIPT_RUNS — the Make.com AI script queue. */
export type QueueStatus = 'HOLD' | 'GENERATE' | 'REVIEW' | 'BLOCKED' | 'DONE';
export interface ScriptRun {
  id: string; // RUN-EP001-001
  episodeId: string;
  queueStatus: QueueStatus;
  model: string;
  promptVersion: string;
  outputJson: string;
  createdAt: string;
  errorMessage: string;
  humanApproval: 'PENDING' | 'APPROVED' | 'REJECTED';
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

export type DepartmentId = 'writer' | 'director' | 'storyboard' | 'video' | 'voice' | 'editor' | 'distribution';

export interface ActivityItem {
  id: string;
  timestamp: string;
  actor: string;
  department?: DepartmentId;
  message: string;
  episodeId?: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

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

/** Episode-level publishing summary across platforms. */
export const publishSummary = (e: Pick<Episode, 'instagramStatus' | 'tiktokStatus'>): PublishStatus => {
  const order: PublishStatus[] = ['Failed', 'Draft', 'Ready', 'Scheduled', 'Published'];
  if (e.instagramStatus === 'Failed' || e.tiktokStatus === 'Failed') return 'Failed';
  return order[Math.min(order.indexOf(e.instagramStatus), order.indexOf(e.tiktokStatus))];
};
