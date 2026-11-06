// Realistic SAMPLE data for local demo mode. Nothing here represents a real
// connection, real charge, real post or real metric.
import type {
  ActivityItem, ApprovalRecord, Asset, BudgetLine, Character, Episode, EditJob, Location,
  ProductionClip, Project, PublishEntry, Scene, ScriptVersion, Shot, Task, WorkStatus, ApprovalStage, PublishStatus,
} from '../../shared/types';
import { ARCS, OUTLINE } from './episodeOutline';

export const SEED_VERSION = 1;

export const project: Project = {
  id: 'P001',
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
  logline:
    'Five years after her stepmother staged her death, the Shen family heiress returns under a new name to take back everything — and bring the whole dynasty down.',
};

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const epId = (n: number) => `EP${String(n).padStart(3, '0')}`;
const T0 = '2026-11-06T09:00:00.000Z';
const ago = (h: number) => new Date(Date.parse(T0) - h * 3600_000).toISOString();

type Row = [WorkStatus, WorkStatus, WorkStatus, WorkStatus, ApprovalStage, PublishStatus];
const statusFor = (n: number): Row => {
  if (n === 1) return ['Approved', 'Complete', 'Approved', 'Approved', 'Ready to Publish', 'Draft Prepared'];
  if (n === 2) return ['Approved', 'Complete', 'Complete', 'In Review', 'Final Review', 'Not Scheduled'];
  if (n === 3) return ['Approved', 'Complete', 'In Progress', 'Not Started', 'In Production', 'Not Scheduled'];
  if (n <= 5) return ['Approved', 'In Progress', 'Not Started', 'Not Started', 'Approved', 'Not Scheduled'];
  if (n <= 8) return ['In Review', 'Not Started', 'Not Started', 'Not Started', 'Under Review', 'Not Scheduled'];
  if (n === 9) return ['Changes Requested', 'Not Started', 'Not Started', 'Not Started', 'Changes Requested', 'Not Scheduled'];
  if (n <= 12) return ['In Progress', 'Not Started', 'Not Started', 'Not Started', 'Draft', 'Not Scheduled'];
  return ['Not Started', 'Not Started', 'Not Started', 'Not Started', 'Draft', 'Not Scheduled'];
};

export const episodes: Episode[] = OUTLINE.map(([zh, en, syn], i) => {
  const n = i + 1;
  const [s, sb, v, ed, ap, pub] = statusFor(n);
  return {
    id: epId(n),
    number: n,
    titleZh: zh,
    titleEn: en,
    synopsis: syn,
    arc: ARCS.find((a) => n >= a.from && n <= a.to)!.name,
    scriptStatus: s,
    storyboardStatus: sb,
    videoStatus: v,
    editingStatus: ed,
    approvalStatus: ap,
    publishingStatus: pub,
    targetPublishDate: addDays(project.startDate, i),
    targetDuration: n === 1 ? 85 : n % 10 === 0 ? 90 : 70,
    notes: '',
    updatedAt: n <= 12 ? ago(n * 3) : ago(240),
  };
});

export const characters: Character[] = [
  {
    id: 'C01', nameZh: '沈知遥 / 顾念', nameEn: 'Shen Zhiyao / Gu Nian', age: 28, role: 'Female protagonist',
    appearance: '168cm, slender. Shoulder-length black hair, straight, centre part. Calm dark eyes, sharp jaw. Thin pale scar on inner left wrist (never hidden on camera after EP003).',
    wardrobeLock: 'As Gu Nian: tailored black or ivory suits, thin gold watch on RIGHT wrist, no other jewellery, low black heels. Flashbacks (Zhiyao): soft pastel dresses, long hair.',
    voice: 'Low, controlled alto. Measured pace, rarely raises voice; precise Beijing-standard Mandarin. Softer and warmer only with her mother.',
    continuity: 'Glasses (thin gold frames) worn as Gu Nian until EP031 reveal. Scar on LEFT wrist. Watch on RIGHT wrist.',
  },
  {
    id: 'C02', nameZh: '陆景深', nameEn: 'Lu Jingshen', age: 31, role: 'Strategic ally · CEO of Jingheng Capital',
    appearance: '185cm, broad-shouldered. Short side-parted black hair, clean-shaven, composed expression.',
    wardrobeLock: 'Charcoal three-piece suits, white shirt, no tie at night scenes, steel wristwatch on LEFT wrist, black umbrella (EP001, EP060).',
    voice: 'Deep baritone, unhurried, dry humour. Short sentences.',
    continuity: 'Always drives the black sedan (plate obscured). Never seen smoking.',
  },
  {
    id: 'C03', nameZh: '林曼如', nameEn: 'Lin Manru', age: 48, role: 'Stepmother · primary antagonist',
    appearance: '165cm. Elegant, immaculate low chignon, red lipstick, pearl earrings. Smiles with her mouth, never her eyes.',
    wardrobeLock: 'Qipao-inspired dresses in deep burgundy or emerald; pearl earrings ALWAYS; jade bangle on LEFT wrist (the Shen family jade after EP002).',
    voice: 'Silky mezzo, polite and sweet; turns cold and clipped when threatened.',
    continuity: 'Jade bangle missing after EP051 (she takes it to the airport). Holds teacup with two hands.',
  },
  {
    id: 'C04', nameZh: '沈浩然', nameEn: 'Shen Haoran', age: 27, role: 'Half-brother · antagonist (redemptive arc)',
    appearance: '180cm, lean. Styled undercut, slightly bloodshot eyes, restless hands.',
    wardrobeLock: 'Designer streetwear jackets, silver chain necklace, flashy watch. Courtroom (EP057): plain grey suit.',
    voice: 'Quick, defensive tenor; trails off when lying.',
    continuity: 'Always fidgets with a lighter. Sober from EP043 onwards — lighter disappears.',
  },
  {
    id: 'C05', nameZh: '周承宇', nameEn: 'Zhou Chengyu', age: 30, role: 'Former fiancé',
    appearance: '182cm. Neat short hair, gentle features that turn uncertain under pressure.',
    wardrobeLock: 'Navy suits, light-blue shirts. Wears the engagement ring on LEFT ring finger until EP007.',
    voice: 'Soft-spoken tenor, overly polite, hesitant pauses.',
    continuity: 'Ring removed in EP007 and never worn again.',
  },
  {
    id: 'C06', nameZh: '沈国峰', nameEn: 'Shen Guofeng', age: 58, role: 'Deceased father (flashbacks, recordings)',
    appearance: '175cm, greying temples, warm eyes, reading glasses on a chain.',
    wardrobeLock: 'Brown cardigan over shirt at home; dark grey suit at the office. Flashbacks only, warm amber grade.',
    voice: 'Warm, slightly hoarse baritone; heard mostly via phone recording (EP023).',
    continuity: 'Appears only in flashbacks/recordings. Study desk has a fountain pen and a jade paperweight.',
  },
  {
    id: 'C07', nameZh: '苏婉清', nameEn: 'Su Wanqing', age: 52, role: 'Mother',
    appearance: '160cm, thin, pale. Long greying hair loosely tied. Gentle face, tired eyes.',
    wardrobeLock: 'Sanatorium: pale blue patient wear and a cream cardigan. After EP055: simple ivory blouse.',
    voice: 'Quiet, breathy alto; slow speech while sedated, clear and firm after EP033.',
    continuity: 'Holds a faded photograph of young Zhiyao in every sanatorium scene.',
  },
];

export const locations: Location[] = [
  { id: 'L01', nameZh: '沈家老宅', nameEn: 'Shen Family Mansion', description: 'Old-money villa: marble foyer, sweeping staircase, dark wood dining room for 12.', lighting: 'Warm tungsten interiors, cold blue window spill at night.', continuity: 'Family portrait above staircase — Zhiyao removed from it until EP055.' },
  { id: 'L02', nameZh: '沈氏集团大厦', nameEn: 'Shen Group Tower', description: 'Glass high-rise lobby and 48th-floor boardroom with city view.', lighting: 'Cool daylight, glass reflections.', continuity: 'Boardroom chair at head of table is black leather; nameplate changes in EP056.' },
  { id: 'L03', nameZh: '慈善晚宴宴会厅', nameEn: 'Charity Gala Ballroom', description: 'Chandeliers, round tables, auction podium, red carpet entrance.', lighting: 'Gold practicals, soft haze.', continuity: 'Used EP001–002, EP029–031.' },
  { id: 'L04', nameZh: '雨夜街头', nameEn: 'Rainy Street', description: 'Wet asphalt, neon reflections, black sedan at the curb.', lighting: 'Night, neon magenta/cyan reflections, rain backlit.', continuity: 'Same street opens EP001 and closes EP060.' },
  { id: 'L05', nameZh: '景恒资本办公室', nameEn: 'Jingheng Capital Office', description: 'Minimalist office, concrete walls, single bonsai, floor-to-ceiling window.', lighting: 'Soft top light, high contrast.', continuity: 'Bonsai always on the left of the desk.' },
  { id: 'L06', nameZh: '私人疗养院', nameEn: 'Private Sanatorium', description: 'White corridors, garden courtyard, Su Wanqing\'s room 307.', lighting: 'Overexposed whites, sterile.', continuity: 'Room number 307 visible on door.' },
  { id: 'L07', nameZh: '沈国峰书房', nameEn: "Guofeng's Study", description: 'Bookshelves, desk with jade paperweight, sealed for five years (dust).', lighting: 'Dusty shafts of window light.', continuity: 'Dust removed after EP008.' },
];

export const assets: Asset[] = [
  { id: 'A001', type: 'Character Reference', name: 'Gu Nian — front/side/back turnaround', linkedTo: 'C01', url: '', status: 'In Progress', notes: 'Needed before Kling generation of EP003+' },
  { id: 'A002', type: 'Character Reference', name: 'Lin Manru — portrait set', linkedTo: 'C03', url: '', status: 'Needed', notes: '' },
  { id: 'A003', type: 'Prop', name: 'Shen family jade bangle', linkedTo: 'EP002', url: '', status: 'Approved', notes: 'Emerald green, single carved phoenix' },
  { id: 'A004', type: 'Location Reference', name: 'Charity gala ballroom wide', linkedTo: 'L03', url: '', status: 'Approved', notes: '' },
  { id: 'A005', type: 'Music', name: 'Main theme — tension sting (8s)', linkedTo: 'EP001', url: '', status: 'Needed', notes: 'Royalty-free; confirm licence for IG/TikTok' },
  { id: 'A006', type: 'SFX', name: 'Rain + distant thunder loop', linkedTo: 'L04', url: '', status: 'Approved', notes: '' },
  { id: 'A007', type: 'Logo', name: 'Series title card 9:16', linkedTo: 'P001', url: '', status: 'In Progress', notes: 'Chinese + English lockup' },
];

let lid = 0;
const L = (characterId: string, zh: string, en: string, emotion = '') => ({ id: `DL${++lid}`, characterId, zh, en, emotion });

const pilotScenes: Scene[] = [
  {
    id: 'EP001-S1', number: 1, locationId: 'L04', timeOfDay: 'Night', characterIds: ['C01'], duration: 14,
    visualAction: 'Heavy rain. A black sedan stops. A heel steps into a puddle. Gu Nian rises from the car, umbrella opens, neon reflected in her glasses.',
    camera: 'Extreme close-up on heel → tilt up to MCU. Slow push-in. 9:16 centre-framed.',
    sfx: 'Rain, distant thunder, low synth drone rising.',
    dialogue: [L('C01', '五年了。', 'Five years.', 'cold'), L('C01', '沈家，我回来了。', 'Shen family — I\'m back.', 'restrained fury')],
  },
  {
    id: 'EP001-S2', number: 2, locationId: 'L03', timeOfDay: 'Night', characterIds: ['C03', 'C04', 'C05'], duration: 16,
    visualAction: 'Gala in full swing. Lin Manru toasts guests; Haoran scrolls his phone; Zhou Chengyu twists the ring on his finger.',
    camera: 'Slow dolly through tables, rack focus from champagne glass to Lin Manru.',
    sfx: 'String quartet, glasses clinking, crowd murmur.',
    dialogue: [L('C03', '今晚所有善款，都以先夫沈国峰的名义捐出。', 'Tonight, every donation is made in the name of my late husband, Shen Guofeng.', 'gracious'), L('C04', '妈，演够了没有？', 'Mum, are you done performing yet?', 'bored')],
  },
  {
    id: 'EP001-S3', number: 3, locationId: 'L03', timeOfDay: 'Night', characterIds: ['C01', 'C05'], duration: 18,
    visualAction: 'The doors open. Silence spreads. Gu Nian walks the aisle; Zhou Chengyu\'s glass slips and shatters.',
    camera: 'Low-angle tracking shot on Gu Nian; whip pan to Chengyu; slow-motion glass shatter insert.',
    sfx: 'Music cuts out. Footsteps echo. Glass shatter (sweetened).',
    dialogue: [L('C05', '……知遥？', '…Zhiyao?', 'shocked'), L('C01', '先生，你认错人了。我姓顾，顾念。', 'Sir, you have me confused. My surname is Gu. Gu Nian.', 'polite, icy')],
  },
  {
    id: 'EP001-S4', number: 4, locationId: 'L03', timeOfDay: 'Night', characterIds: ['C01', 'C03'], duration: 20,
    visualAction: 'Auction of the Shen family jade. Lin Manru raises her paddle. Gu Nian raises hers — again, and again.',
    camera: 'Alternating MCUs, tightening each bid. Final shot: OTS from Lin Manru onto Gu Nian.',
    sfx: 'Gavel strikes, crowd gasps, heartbeat bass pulse.',
    dialogue: [L('C03', '五百万。', 'Five million.', 'confident'), L('C01', '一千万。', 'Ten million.', 'calm'), L('C03', '顾小姐，这是我们沈家的东西。', 'Miss Gu, that belongs to the Shen family.', 'tight smile'), L('C01', '所以，我才要买回来。', 'Which is exactly why I\'m buying it back.', 'quiet')],
  },
  {
    id: 'EP001-S5', number: 5, locationId: 'L04', timeOfDay: 'Night', characterIds: ['C01', 'C02'], duration: 17,
    visualAction: 'Outside, rain again. Lu Jingshen holds an umbrella over her. She does not look at him.',
    camera: 'Wide two-shot under neon, slow push to Lu Jingshen\'s CU on final line. Smash cut to black.',
    sfx: 'Rain swells; single piano note on the cliffhanger.',
    dialogue: [L('C02', '顾小姐的戏，演得不错。', 'Quite the performance, Miss Gu.', 'amused'), L('C01', '陆总想看下一场？', 'Want a ticket to the next act, Mr Lu?', 'challenging'), L('C02', '我想知道——你到底是谁。', 'I want to know who you really are.', 'serious')],
  },
];

const ep2Scenes: Scene[] = [
  {
    id: 'EP002-S1', number: 1, locationId: 'L03', timeOfDay: 'Night', characterIds: ['C01', 'C03'], duration: 22,
    visualAction: 'The jade is delivered to Gu Nian on a velvet tray. Lin Manru approaches with two glasses of champagne.',
    camera: 'Insert on jade; MCU two-shot; push-in on Lin Manru\'s eyes.',
    sfx: 'Muffled gala ambience, low cello.',
    dialogue: [L('C03', '顾小姐面生得很，是哪家的千金？', 'I don\'t know your face, Miss Gu. Whose daughter are you?', 'sweet'), L('C01', '我是谁不重要。重要的是，这块玉现在是我的。', 'Who I am doesn\'t matter. What matters is that this jade is now mine.', 'calm')],
  },
  {
    id: 'EP002-S2', number: 2, locationId: 'L01', timeOfDay: 'Night', characterIds: ['C03', 'C04'], duration: 24,
    visualAction: 'Back at the mansion, Lin Manru throws her pearl earrings onto the dresser.',
    camera: 'Mirror shot, Lin Manru framed twice.',
    sfx: 'Clock ticking, earrings clatter.',
    dialogue: [L('C03', '去查她。三天之内，我要知道她的一切。', 'Look into her. In three days I want to know everything.', 'cold'), L('C04', '一个女人而已，你紧张什么？', 'She\'s just a woman. Why are you so nervous?', 'dismissive')],
  },
  {
    id: 'EP002-S3', number: 3, locationId: 'L05', timeOfDay: 'Night', characterIds: ['C01', 'C02'], duration: 24,
    visualAction: 'Gu Nian places the jade on Lu Jingshen\'s desk next to the bonsai.',
    camera: 'Top-down insert; slow orbit around both.',
    sfx: 'Quiet room tone, city hum.',
    dialogue: [L('C02', '一千万买一块玉，就为了气她？', 'Ten million on a bangle, just to annoy her?', 'dry'), L('C01', '为了让她知道——有人回来了。', 'To let her know someone has come back.', 'firm')],
  },
];

export const scriptVersions: ScriptVersion[] = [
  { id: 'SV1', episodeId: 'EP001', version: 1, scenes: pilotScenes.slice(0, 3), savedAt: ago(140), savedBy: 'Writer (demo)', note: 'First draft — demo template', source: 'demo-template' },
  { id: 'SV2', episodeId: 'EP001', version: 2, scenes: pilotScenes, savedAt: ago(110), savedBy: 'Producer', note: 'Added auction + cliffhanger. Pilot 85s.', source: 'manual' },
  { id: 'SV3', episodeId: 'EP002', version: 1, scenes: ep2Scenes, savedAt: ago(90), savedBy: 'Producer', note: 'Approved draft', source: 'manual' },
];

const shotTypes = ['ECU', 'CU', 'MCU', 'MS', 'WS', 'OTS', 'Insert'];
export const shots: Shot[] = pilotScenes.flatMap((sc) =>
  [0, 1, 2].map((k) => ({
    id: `EP001-S${sc.number}-SH${k + 1}`,
    episodeId: 'EP001',
    sceneNumber: sc.number,
    shotNumber: k + 1,
    shotType: shotTypes[(sc.number + k) % shotTypes.length],
    camera: k === 0 ? sc.camera.split(/[.;]/)[0] : k === 1 ? 'Static, shallow depth of field' : 'Slow push-in',
    description: k === 0 ? sc.visualAction.split('.')[0] + '.' : k === 1 ? `Reaction: ${sc.characterIds.join(', ')}` : 'Closing beat of the scene',
    visualPrompt: `Photorealistic cinematic 9:16 vertical, ${locations.find((l) => l.id === sc.locationId)!.nameEn.toLowerCase()}, ${sc.timeOfDay.toLowerCase()}, ${sc.visualAction.split('.')[0].toLowerCase()}, anamorphic shallow depth of field, film grain, ${locations.find((l) => l.id === sc.locationId)!.lighting.toLowerCase()}`,
    characterIds: sc.characterIds,
    duration: Math.round(sc.duration / 3),
    storyboardStatus: 'Complete' as WorkStatus,
  })),
);

export const clips: ProductionClip[] = [
  ...pilotScenes.map((sc) => ({
    id: `CLIP-EP001-S${sc.number}`, episodeId: 'EP001', sceneNumber: sc.number,
    prompt: shots.find((s) => s.sceneNumber === sc.number)!.visualPrompt,
    characterRefs: sc.characterIds, generationStatus: 'Approved' as const, clipUrl: '', duration: sc.duration,
    credits: 0, notes: 'Sample record — no real clip attached.', updatedAt: ago(30),
  })),
  ...ep2Scenes.map((sc, i) => ({
    id: `CLIP-EP002-S${sc.number}`, episodeId: 'EP002', sceneNumber: sc.number,
    prompt: `Photorealistic cinematic 9:16, ${sc.visualAction}`,
    characterRefs: sc.characterIds, generationStatus: (i < 2 ? 'Generated' : 'Not Generated') as ProductionClip['generationStatus'],
    clipUrl: '', duration: sc.duration, credits: 0, notes: '', updatedAt: ago(20),
  })),
];

export const editJobs: EditJob[] = [
  { episodeId: 'EP001', music: 'A005 Main theme — tension sting', subtitlesBurned: true, renderStatus: 'Approved', renderUrl: '', notes: 'Final cut 85s. Sample record.', clipOrder: pilotScenes.map((s) => `CLIP-EP001-S${s.number}`) },
  { episodeId: 'EP002', music: '', subtitlesBurned: false, renderStatus: 'Assembling', renderUrl: '', notes: '', clipOrder: ep2Scenes.map((s) => `CLIP-EP002-S${s.number}`) },
];

const HASHTAGS = '#短剧 #逆袭 #豪门 #复仇 #shortdrama #cdrama #revenge';
export const publishing: PublishEntry[] = episodes.slice(0, 14).flatMap((e) =>
  (['TikTok', 'Instagram'] as const).map((p) => ({
    id: `${e.id}-${p === 'TikTok' ? 'TT' : 'IG'}`,
    episodeId: e.id,
    platform: p,
    caption: `${e.titleZh} | ${e.titleEn} — EP${e.number}/60`,
    hashtags: HASHTAGS,
    scheduledDate: e.targetPublishDate,
    status: (e.number === 1 ? 'Draft Prepared' : 'Not Scheduled') as PublishStatus,
    postUrl: '',
  })),
);

export const budgetLines: BudgetLine[] = [
  { id: 'B1', service: 'OpenAI', description: 'Script generation & translation (est. 60 runs × revisions)', estimatedMonthly: 8 },
  { id: 'B2', service: 'Kling AI', description: 'Video generation credits (largest cost driver)', estimatedMonthly: 55 },
  { id: 'B3', service: 'Shotstack', description: 'Render minutes for final edits', estimatedMonthly: 15 },
  { id: 'B4', service: 'Make.com', description: 'Core plan operations', estimatedMonthly: 10 },
  { id: 'B5', service: 'Voice', description: 'Mandarin voice generation', estimatedMonthly: 8 },
  { id: 'B6', service: 'Other', description: 'Music licences / storage buffer', estimatedMonthly: 4 },
];

export const approvals: ApprovalRecord[] = [
  { id: 'AP1', episodeId: 'EP001', subject: 'Script', action: 'Submitted', from: 'Draft', to: 'Under Review', reviewer: 'Writer (demo)', comment: 'Pilot v2 ready.', timestamp: ago(108) },
  { id: 'AP2', episodeId: 'EP001', subject: 'Script', action: 'Approved', from: 'Under Review', to: 'Approved', reviewer: 'Producer', comment: 'Strong hook. Approved for production.', timestamp: ago(100) },
  { id: 'AP3', episodeId: 'EP001', subject: 'Episode', action: 'Advanced', from: 'Approved', to: 'In Production', reviewer: 'Producer', comment: '', timestamp: ago(96) },
  { id: 'AP4', episodeId: 'EP001', subject: 'Video', action: 'Submitted', from: 'In Production', to: 'Final Review', reviewer: 'Editor (demo)', comment: 'Final cut 85s.', timestamp: ago(30) },
  { id: 'AP5', episodeId: 'EP001', subject: 'Video', action: 'Approved', from: 'Final Review', to: 'Ready to Publish', reviewer: 'Producer', comment: 'Approved. Prepare TikTok + IG drafts.', timestamp: ago(26) },
  { id: 'AP6', episodeId: 'EP002', subject: 'Video', action: 'Submitted', from: 'In Production', to: 'Final Review', reviewer: 'Editor (demo)', comment: 'Rough assembly for review.', timestamp: ago(6) },
  { id: 'AP7', episodeId: 'EP009', subject: 'Script', action: 'Changes Requested', from: 'Under Review', to: 'Changes Requested', reviewer: 'Producer', comment: 'Haoran\'s debt reveal needs a clearer hook in the first 3 seconds.', timestamp: ago(12) },
];

export const activity: ActivityItem[] = [
  { id: 'AC1', timestamp: ago(6), actor: 'Editor (demo)', department: 'editor', message: 'EP002 submitted for final video review', episodeId: 'EP002', level: 'info' },
  { id: 'AC2', timestamp: ago(12), actor: 'Producer', message: 'Requested changes on EP009 script', episodeId: 'EP009', level: 'warning' },
  { id: 'AC3', timestamp: ago(20), actor: 'Producer', department: 'video', message: 'EP002 scenes 1–2 marked as generated (manual upload)', episodeId: 'EP002', level: 'info' },
  { id: 'AC4', timestamp: ago(26), actor: 'Producer', message: 'EP001 approved — Ready to Publish', episodeId: 'EP001', level: 'success' },
  { id: 'AC5', timestamp: ago(48), actor: 'Producer', department: 'writer', message: 'EP006–EP008 scripts submitted for review', level: 'info' },
];

export const tasks: Task[] = [
  { id: 'T1', title: 'Review EP002 final video', episodeId: 'EP002', due: '2026-11-07', done: false, owner: 'Producer' },
  { id: 'T2', title: 'Review scripts EP006–EP008', episodeId: 'EP006', due: '2026-11-08', done: false, owner: 'Producer' },
  { id: 'T3', title: 'Revise EP009 hook', episodeId: 'EP009', due: '2026-11-08', done: false, owner: 'Writer' },
  { id: 'T4', title: 'Prepare TikTok + IG drafts for EP001', episodeId: 'EP001', due: '2026-11-10', done: false, owner: 'Producer' },
  { id: 'T5', title: 'Import workbook into Google Sheets & share with service account', due: '2026-11-09', done: false, owner: 'Admin' },
  { id: 'T6', title: 'Lock Gu Nian character reference turnaround', due: '2026-11-09', done: false, owner: 'Art' },
];
