'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { type Overview, mean } from '@/lib/journal';
import { fmt, dateText } from './shared';

export function MoodWave({ overview, dates, title = '日ごとの波', selectedDate, onSelect }: {
    overview: Overview; dates: string[]; title?: string; selectedDate?: string; onSelect?: (date: string) => void;
}) {
    const gradient = useId().replaceAll(':', '');
    const chart = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(690);
    useEffect(() => {
        const element = chart.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry.contentRect.width > 0) setWidth(Math.max(260, entry.contentRect.width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const [source, setSource] = useState<'summary' | 'moment'>('summary');
    const [focused, setFocused] = useState('');
    const records = source === 'summary' ? overview.summaries : overview.days;
    const values = new Map(records.map(d => [d.date, d.score]));
    const points = dates.map((date, index) => ({date, score: values.get(date) ?? null, x: 30 + index * (width - 60) / Math.max(1, dates.length - 1)}));
    const scores = points.flatMap(p => p.score === null ? [] : [p.score]);
    const hitWidth = Math.min(22, (width - 60) / Math.max(1, dates.length - 1));
    const y = (score: number) => 180 - (score - 1) * 40;
    const picked = points.find(p => p.date === (selectedDate ?? focused));
    const select = (date: string) => { setFocused(date); onSelect?.(date); };
    return <section className="wave-card" aria-label={title}>
      <div className="section-heading"><div><p className="eyebrow">RHYTHM</p><h2>{title}</h2></div><span className="wave-coverage">{scores.length} / {dates.length}日</span></div>
      <div className="wave-toolbar"><div className="wave-segments" role="group" aria-label="グラフの体調"><button aria-pressed={source === 'summary'} onClick={() => setSource('summary')}>一日の総括</button><button aria-pressed={source === 'moment'} onClick={() => setSource('moment')}>投稿の平均</button></div><span className="wave-average">平均 <b>{fmt(mean(scores))}</b></span></div>
      <div className="wave-chart" ref={chart}><svg viewBox={`0 0 ${width} 214`} role="group" aria-label="日ごとの体調。上が良い、下がつらい。点を選ぶと日付と値を表示。">
        <defs><linearGradient id={gradient} x1="0" y1="20" x2="0" y2="180" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#8fe1ab"/><stop offset="0.45" stopColor="#c9d5ae"/><stop offset="0.7" stopColor="#efba80"/><stop offset="1" stopColor="#f28e9c"/></linearGradient></defs>
        <rect x="28" y="20" width={width - 56} height="160" rx="12" fill={`url(#${gradient})`} opacity=".08"/>
        {[1,3,5].map(n => <g key={n}><line x1="28" x2={width - 28} y1={y(n)} y2={y(n)} stroke="var(--border)" strokeDasharray="3 5"/><text x="7" y={y(n)+4} fontSize="12" fill="var(--muted-foreground)">{n}</text></g>)}
        {points.map((p,i) => { const prev = points[i-1]; return <g key={p.date}>
          {p.score !== null && <>{prev?.score != null && <path pointerEvents="none" d={`M ${prev.x} ${y(prev.score)} C ${(prev.x+p.x)/2} ${y(prev.score)}, ${(prev.x+p.x)/2} ${y(p.score)}, ${p.x} ${y(p.score)}`} fill="none" stroke={`url(#${gradient})`} strokeWidth="3"/>}
          <circle pointerEvents="none" cx={p.x} cy={y(p.score)} r={p.date === picked?.date ? 6 : 3.5} fill={`url(#${gradient})`}/>
          <rect x={p.x - hitWidth / 2} y={y(p.score) - 16} width={hitWidth} height="32" fill="transparent" tabIndex={0} role="button" aria-label={`${p.date} ${source === 'summary' ? '総括' : '投稿平均'} ${fmt(p.score)}`} onClick={() => select(p.date)} onKeyDown={e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.date); } }}><title>{p.date} · {fmt(p.score)}</title></rect></>}
          {(i === 0 || i === dates.length-1 || (i % Math.max(1,Math.round(dates.length/4)) === 0 && i < dates.length-3)) && <text x={p.x} y="205" textAnchor={i === 0 ? 'start' : i === dates.length-1 ? 'end' : 'middle'} fontSize="12" fill="var(--muted-foreground)">{Number(p.date.slice(5,7))}/{Number(p.date.slice(8))}</text>}
        </g>; })}
      </svg></div>
      <div className="wave-readout" aria-live="polite"><span>{picked ? dateText(picked.date) : '点をタップして振り返る'}</span><strong>{picked ? fmt(picked.score) : scores.length ? '↑ 良い　↓ つらい' : 'この期間の記録はありません'}</strong></div>
      <div className="wave-insights"><span>良い・まずまず <b>{scores.filter(s=>s>=4).length}日</b></span><span>つらい・低め <b>{scores.filter(s=>s<=2).length}日</b></span><span>未記録 <b>{dates.length-scores.length}日</b></span></div>
      <details className="wave-data"><summary>日別の数値を見る</summary><div><table><thead><tr><th>日付</th><th>{source === 'summary' ? '総括' : '投稿平均'}</th></tr></thead><tbody>{points.map(p=><tr key={p.date}><td><button onClick={() => select(p.date)}>{p.date}</button></td><td>{fmt(p.score)}</td></tr>)}</tbody></table></div></details>
    </section>;
}
