'use client';
import { useMemo, useState } from 'react';
import { MoodWave } from './mood-wave';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Overview, tagAssociations, todayKey, shiftDay, mean } from '@/lib/journal';
import { fmt } from './shared';
import { TimeAxis } from './time-axis';
export function Trends({ overview, revision, active }: {
    overview: Overview; revision: number; active: boolean;
}) {
    const [range, setRange] = useState('30'), [source, setSource] = useState('summary'), [mode, setMode] = useState<'same' | 'next'>('same');
    const start = range === 'all' ? '0000' : shiftDay(todayKey(), 1 - Number(range));
    const summaries = overview.summaries.filter(s => s.date >= start), days = overview.days.filter(d => d.date >= start);
    const associations = useMemo(() => tagAssociations(overview.days.filter(d => d.date >= start), mode, source === 'summary' ? overview.summaries.filter(s => s.date >= start) : undefined), [overview, start, mode, source]);
    const earliest = [...overview.days.map(d=>d.date), ...overview.summaries.map(d=>d.date)].sort()[0] ?? todayKey();
    const length = range === 'all' ? Math.round((Date.parse(todayKey())-Date.parse(earliest))/86400000)+1 : Number(range);
    const dates = Array.from({ length }, (_, i) => shiftDay(todayKey(), i-length+1));
    return <><div className="page-heading"><div><p className="eyebrow">THE BIG PICTURE</p><h1>体調の流れ</h1></div><Select value={range} onValueChange={setRange}><SelectTrigger aria-label="集計する期間"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">最近の7日</SelectItem><SelectItem value="30">最近の30日</SelectItem><SelectItem value="90">最近の90日</SelectItem><SelectItem value="all">すべて</SelectItem></SelectContent></Select></div><div className="stat-grid"><section className="stat-card"><span>一日の総括</span><strong>{fmt(mean(summaries.map(s => s.score)))}<small>/ 5</small></strong><p>{summaries.length}日分の総括の平均</p></section><section className="stat-card"><span>その時の体調</span><strong>{fmt(mean(days.flatMap(d => d.score === null ? [] : [d.score])))}<small>/ 5</small></strong><p>日ごとの平均を、同じ重みで集計</p></section><section className="stat-card"><span>残した投稿</span><strong>{days.reduce((sum, d) => sum + d.count, 0)}<small>件</small></strong><p>{days.length}日分の足あと</p></section></div>
 <MoodWave overview={overview} dates={dates} title="体調の推移"/>
 <TimeAxis revision={revision} active={active}/><section className="analysis-card"><div className="section-heading"><div><h2>タグと体調の関連</h2><p className="form-hint">そのタグを残した日と、それ以外の日を比べます。</p></div></div><div className="analysis-controls"><Select value={source} onValueChange={setSource}><SelectTrigger aria-label="分析する体調"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="summary">一日の総括</SelectItem><SelectItem value="moment">その時の体調（日平均）</SelectItem></SelectContent></Select><Tabs value={mode} onValueChange={v => setMode(v as 'same' | 'next')}><TabsList><TabsTrigger value="same">同じ日</TabsTrigger><TabsTrigger value="next">翌日の変化</TabsTrigger></TabsList></Tabs></div><p className="analysis-explainer">{mode === 'same' ? 'タグありの日 − タグなしの日の体調差' : '「翌日 − 当日」の変化量を、タグあり・なしで比較'}</p>
 {associations.length ? associations.map(a => <div className="association-row" key={a.tag}><div><strong>#{a.tag}</strong><p>あり {a.withCount}日 · なし {a.withoutCount}日</p></div><div className="association-value">{a.enough && a.diff !== null ? <><b className={a.diff >= 0 ? 'positive' : 'negative'}>{a.diff > 0 ? '+' : ''}{a.diff.toFixed(2)}</b><span>/ 5</span></> : <span>記録を待っています</span>}</div></div>) : <div className="empty-state"><p>タグ付きの投稿が増えると、比較できるようになります。</p></div>}
 <p className="analysis-caveat">両方のグループが3日以上そろうと表示します。数字は記録上の関連で、因果効果ではありません。未記録の日は比較せず、翌日は連続する日だけを使います。</p></section></>;
}
