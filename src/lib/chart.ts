// Chart palette — validated for the dark surface #121722 (CVD + contrast pass).
export const SERIES = ['#3987e5', '#d95926', '#199e70'] as const;
export const PLATFORM_COLOR = { TikTok: SERIES[0], Instagram: SERIES[1] } as const;
export const AXIS = { stroke: '#2f394d', tick: { fill: '#8b94a7', fontSize: 11 } };
export const GRID = '#232b3b';
export const tooltipStyle = {
  contentStyle: { background: '#171d2a', border: '1px solid #2f394d', borderRadius: 8, fontSize: 12, color: '#d6dbe4' },
  labelStyle: { color: '#f1f3f7' },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
};
