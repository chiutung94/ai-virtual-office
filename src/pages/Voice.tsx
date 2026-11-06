import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import type { VoiceLine } from '../../shared/types';
import { latestScript, useStore } from '../store/store';
import { Banner, Card, DataTable, Empty, PageHead, Stat, download } from '../components/ui';
import { EpisodePicker, useEpisodeParam } from '../components/shared';
import { buildCues, fmtTs, speaker, toSrt } from '../lib/subtitles';

const VS: VoiceLine['voiceStatus'][] = ['Not Started', 'Recorded', 'Approved'];

export default function Voice() {
  const s = useStore();
  const [epId, setEp] = useEpisodeParam();
  const script = latestScript(s.scriptVersions, epId);
  const cues = useMemo(() => (script ? buildCues(script.scenes) : []), [script]);
  const voiceIntegration = s.integrations?.find((i) => i.id === 'voice');
  const vl = (id: string): VoiceLine => s.voiceLines.find((v) => v.id === id) ?? { id, episodeId: epId, voiceStatus: 'Not Started', audioUrl: '' };
  const speakers = [...new Set(cues.map((c) => c.characterId).filter(Boolean))];
  const approved = cues.filter((c) => vl(c.lineId).voiceStatus === 'Approved').length;

  return (
    <>
      <PageHead title="Voice & Subtitles" sub="Mandarin dialogue tracks and bilingual subtitles (Simplified Chinese + English)" actions={<>
        <EpisodePicker value={epId} onChange={setEp} />
      </>} />
      {voiceIntegration?.state !== 'Connected' && <div className="mb16"><Banner tone="warning">Voice generation is <strong>{voiceIntegration?.state ?? 'Not Connected'}</strong>. Record or generate lines externally, paste the audio URL and update status here. Subtitle export works offline.</Banner></div>}
      <div className="grid g4">
        <Stat label="Dialogue lines" value={cues.length} hint={script ? `Script v${script.version}` : 'No script'} />
        <Stat label="Voice approved" value={`${approved}/${cues.length}`} />
        <Stat label="Speakers" value={speakers.length} />
        <Stat label="Subtitle tracks" value="2" hint="zh-Hans · en" />
      </div>

      <div className="grid g3 mt16" style={{ alignItems: 'start' }}>
        <Card className="span2" title="Dialogue & subtitle cues" sub="Timings are distributed evenly per scene — fine-tune in the edit" actions={<>
          <button className="btn sm" disabled={!cues.length} onClick={() => download(`${epId}.zh-Hans.srt`, toSrt(cues, 'zh'), 'text/plain;charset=utf-8')}><Download size={12} />SRT 中文</button>
          <button className="btn sm" disabled={!cues.length} onClick={() => download(`${epId}.en.srt`, toSrt(cues, 'en'), 'text/plain;charset=utf-8')}><Download size={12} />SRT EN</button>
          <button className="btn sm" disabled={!cues.length} onClick={() => download(`${epId}.bilingual.srt`, toSrt(cues, 'both'), 'text/plain;charset=utf-8')}><Download size={12} />Bilingual</button>
        </>} flush>
          <DataTable rows={cues} rowKey={(c) => c.lineId} pageSize={25} columns={[
            { key: 't', header: 'Time', render: (c) => <span className="mono nowrap">{fmtTs(c.start)}–{fmtTs(c.end)}</span> },
            { key: 'sc', header: 'Sc', render: (c) => `S${c.sceneNumber}` },
            { key: 'who', header: 'Speaker', render: (c) => <span className="zh nowrap">{c.speaker || (c.characterId ? speaker(s.characters, c.characterId) : '旁白 VO')}</span> },
            { key: 'line', header: 'Line', render: (c) => <div style={{ minWidth: 220 }}><div className="zh">{c.zh}</div><div className="small muted">{c.en}</div></div> },
            { key: 'v', header: 'Voice', render: (c) => (
              <select className="select sm" style={{ width: 120 }} aria-label="Voice status" value={vl(c.lineId).voiceStatus} onChange={(e) => s.upsertVoiceLine({ ...vl(c.lineId), voiceStatus: e.target.value as VoiceLine['voiceStatus'] })}>
                {VS.map((v) => <option key={v}>{v}</option>)}
              </select>) },
            { key: 'a', header: 'Audio URL', render: (c) => (
              <input className="input sm" style={{ width: 170 }} aria-label="Audio URL" placeholder="https://…" defaultValue={vl(c.lineId).audioUrl}
                onBlur={(e) => { if (e.target.value !== vl(c.lineId).audioUrl) { s.upsertVoiceLine({ ...vl(c.lineId), audioUrl: e.target.value }); s.toast('success', 'Audio URL saved'); } }} />) },
          ]} empty={<Empty title="No dialogue">{script ? 'This script has no dialogue lines.' : <Link to={`/script/${epId}`}>Write the script first</Link>}</Empty>} />
        </Card>
        <Card title="Voice casting" sub="From the Character Library" flush>
          {speakers.length ? <div className="list">{speakers.map((id) => {
            const c = s.characters.find((x) => x.id === id);
            return <div key={id} className="list-item"><span className="tag">{id}</span><div className="grow"><div className="zh small strong">{c?.nameZh}</div><div className="xs muted">{c?.voice ?? 'No voice description'}</div></div></div>;
          })}</div> : <Empty title="No speakers" />}
        </Card>
      </div>
    </>
  );
}
