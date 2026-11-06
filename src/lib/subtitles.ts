import type { Character, Scene } from '../../shared/types';

export interface Cue {
  lineId: string;
  sceneNumber: number;
  characterId: string;
  start: number; // seconds
  end: number;
  zh: string;
  en: string;
}

/** Distribute each scene's dialogue evenly across the scene's duration (editable later in the NLE). */
export function buildCues(scenes: Scene[]): Cue[] {
  const cues: Cue[] = [];
  let t = 0;
  for (const sc of scenes) {
    const n = sc.dialogue.length;
    if (n) {
      const lead = Math.min(1, sc.duration * 0.1);
      const slot = (sc.duration - lead) / n;
      sc.dialogue.forEach((d, i) => {
        const start = t + lead + i * slot;
        cues.push({ lineId: d.id, sceneNumber: sc.number, characterId: d.characterId, start, end: start + slot * 0.92, zh: d.zh, en: d.en });
      });
    }
    t += sc.duration;
  }
  return cues;
}

const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`;
};
export const fmtTs = (s: number) => ts(s).slice(3, 11).replace(',', '.');

export function toSrt(cues: Cue[], lang: 'zh' | 'en' | 'both') {
  return cues
    .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${lang === 'zh' ? c.zh : lang === 'en' ? c.en : `${c.zh}\n${c.en}`}\n`)
    .join('\n');
}

export const speaker = (chars: Character[], id: string) => chars.find((c) => c.id === id)?.nameZh.split(' / ')[0] ?? id;
