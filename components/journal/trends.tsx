'use client';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRight, GitCompareArrows, Search, Tag, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Overview, todayKey, shiftDay } from '@/lib/journal';
import { analyzeTags, tagPairs, HORIZONS, MIN_DAYS, type AnalysisSource } from '@/lib/insights';
import { fmt } from './shared';
import { PatternLab } from './pattern-lab';

const signed = (n: number | null) => n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
const direction = (n: number | null) => n === null || Math.abs(n) < .05 ? 'neutral' : n > 0 ? 'positive' : 'negative';
const horizonLabel = (n: number) => n === 1 ? '翌日' : `${n}日後`;
export function Trends({ overview, active, demo, onViewEntries }: { overview: Overview; active: boolean; demo: boolean; onViewEntries: (date: string) => void }) {
    const [legacyOpen, setLegacyOpen] = useState(false);
    const [range, setRange] = useState('90'), [source, setSource] = useState<AnalysisSource>('moment');
    const [chosen, setChosen] = useState(''), [query, setQuery] = useState('');
    const [lag, setLag] = useState(1), [mode, setMode] = useState('later'), [partner, setPartner] = useState('');
    const end = todayKey(), start = range === 'all' ? '0000' : shiftDay(end, 1 - Number(range));
    const analysis = useMemo(() => analyzeTags(overview, start, end, source), [overview, start, end, source]);
    const selected = analysis.tags.find(t => t.tag === chosen) ?? analysis.tags.find(t => t.lags.some(l => l.enough)) ?? analysis.tags[0];
    const related = useMemo(() => selected ? tagPairs(analysis.rows, selected.tag) : [], [analysis.rows, selected]);
    const pair = related.find(p => p.tag === partner) ?? related[0];
    const result = selected?.lags.find(l => l.lag === lag);
    const shown = analysis.tags.filter(t => t.tag.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    const available = analysis.tags.filter(t => t.lags.some(l => l.enough)).length;
    return <div className="insights-page">
      <div className="page-heading"><div><p className="eyebrow">PATTERNS, NOT GUESSES</p><h1>自分の傾向を知る</h1></div><p className="heading-note">何と重なり、その後どう変わったか。</p></div>
      <div className="insights-filters"><label><span>調べる期間</span><Select value={range} onValueChange={v => {setChosen(selected?.tag ?? '');setRange(v);}}><SelectTrigger aria-label="集計する期間"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="30">最近の30日</SelectItem><SelectItem value="90">最近の90日</SelectItem><SelectItem value="180">最近の180日</SelectItem><SelectItem value="all">すべて</SelectItem></SelectContent></Select></label><label><span>体調の基準</span><Select value={source} onValueChange={v => {setChosen(selected?.tag ?? '');setSource(v as AnalysisSource);}}><SelectTrigger aria-label="分析する体調"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="moment">投稿の平均（日ごと）</SelectItem><SelectItem value="summary">一日の総括</SelectItem></SelectContent></Select></label></div>
      <div className="insights-coverage"><div><strong>{analysis.rows.length}<small>日</small></strong><span>タグを観測できた日</span></div><div><strong>{analysis.scoredDays}<small>日</small></strong><span>体調もそろった日</span></div><div><strong>{available}<small>タグ</small></strong><span>時間差を比較可能</span></div></div>
      <p className="insights-scope">日々の波はカレンダーへ。ここでは、繰り返す傾向を探します。</p>
      <PatternLab overview={overview} start={start} end={end} source={source} active={active} demo={demo} tag={selected?.tag ?? ''} onTag={setChosen} onViewEntries={onViewEntries} onInspect={(tag, lag) => { setChosen(tag); setLag(lag); setMode('later'); setLegacyOpen(true); requestAnimationFrame(() => document.querySelector('.daily-analysis-details')?.scrollIntoView({block:'start',behavior:'smooth'})); }}/>
      <details className="daily-analysis-details" open={legacyOpen} onToggle={e => setLegacyOpen(e.currentTarget.open)}><summary>日単位の比較・タグ同士の相関</summary>
      {!analysis.tags.length ? <section className="analysis-card insights-empty"><Tag size={28}/><h2>タグから、体調の手がかりを</h2><p>この期間にはタグ付きの記録がありません。記録にタグを添えると、同じ日の関係や数日後の変化が見えてきます。</p><p>時間差の比較には、体調が近い「タグあり・なし」の日がそれぞれ{MIN_DAYS}日以上必要です。</p></section> : <>
      <section className="insight-tag-picker" aria-label="分析するタグの選択"><div className="section-heading"><h2>調べるタグ</h2><span className="metadata">{analysis.tags.length}種類</span></div><label className="insight-search"><Search size={17}/><input aria-label="分析するタグを検索" placeholder="タグを探す" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="insight-tag-options">{shown.map(t=><button key={t.tag} aria-pressed={selected?.tag === t.tag} onClick={()=>{setChosen(t.tag);setPartner('');}}><Tag size={14}/><span>{t.tag}</span><small>{t.count}日</small></button>)}{!shown.length && <p className="form-hint">一致するタグはありません。</p>}</div></section>
      {selected && <><section className="analysis-card insight-detail" aria-label={`${selected.tag}の分析`}>
        <div className="insight-title"><span className="insight-kicker"><Tag size={15}/>選んだタグ</span><h2>{selected.tag}</h2><p>{selected.count}日に記録 · {source === 'summary' ? '一日の総括' : '投稿の平均'}で比較</p></div>
        <div className="insight-segments" role="group" aria-label="タグ分析の種類"><button aria-pressed={mode === 'later'} onClick={()=>setMode('later')}>あとからの変化</button><button aria-pressed={mode === 'same'} onClick={()=>setMode('same')}>同じ日の関係</button></div>
        {mode === 'later' && result ? <>
          <h3 className="insight-question">このタグを記録した後、体調は？</h3><p className="form-hint">当日の体調が近い、タグを記録していない日と比べます。</p>
          <div className="lag-options" role="group" aria-label="何日後を調べる">{HORIZONS.map(h=><button key={h} aria-pressed={lag===h} onClick={()=>setLag(h)}>{horizonLabel(h)}</button>)}</div>
          {result.enough ? <><div className={`insight-effect ${direction(result.diff)}`}><span>似た体調の日と比べた、{horizonLabel(lag)}の変化差</span><strong>{result.diff! >= .05 ? <ArrowUp/> : result.diff! <= -.05 ? <ArrowDown/> : <GitCompareArrows/>}{signed(result.diff)}<small>点</small></strong><p>{Math.abs(result.diff!) < .05 ? '平均の差はほとんどありません' : result.diff! > 0 ? '比較日より、変化がプラス寄り' : '比較日より、変化がマイナス寄り'}</p></div>
          <div className="change-comparison"><div><span>タグあり</span><b className={direction(result.actual.mean)}>{signed(result.actual.mean)}</b><small>{result.withCount}日を起点に比較</small></div><ArrowRight size={18}/><div><span>タグなし・体調をそろえた比較</span><b className={direction(result.comparison)}>{signed(result.comparison)}</b><small>{result.withoutCount}日の比較候補</small></div></div>
          <div className="insight-outlook"><h3>過去の記録から見た、{horizonLabel(lag)}の目安</h3><p>タグありの日は平均 <b>{fmt(result.after.mean)} / 5</b>。変化量の中央50%は <b>{signed(result.actual.low)}〜{signed(result.actual.high)}点</b>。</p><p>0.5点以上上向いたのは <b>{result.actual.improved} / {result.withCount}日</b>。</p><small>これは観測された分布です。次回の予測範囲や改善確率ではありません。</small></div></> : <div className="insight-pending"><Info size={22}/><h3>まだ比較の材料が足りません</h3><p>体調が近い比較日が、タグあり <b>{result.withCount}日</b>、タグなし <b>{result.withoutCount}日</b>。それぞれ{MIN_DAYS}日以上そろうと差を表示します。</p><p>別の期間・タグ・体調の基準も試せます。</p></div>}
          <div className="lag-overview" aria-label="時間差ごとの比較"><h3>どのくらい後に、違いが出る？</h3>{selected.lags.map(r=><button key={r.lag} aria-label={`${horizonLabel(r.lag)}の比較を見る`} aria-pressed={lag===r.lag} onClick={()=>setLag(r.lag)}><span>{horizonLabel(r.lag)}</span><span className="lag-bar"><i className={direction(r.diff)} style={{width:`${r.enough ? Math.min(50, Math.abs(r.diff!) / 4 * 50) : 0}%`,left:`${r.enough && r.diff!<0 ? 50-Math.min(50,Math.abs(r.diff!)/4*50) : 50}%`}}/></span><b className={r.enough ? direction(r.diff) : ''}>{r.enough ? signed(r.diff) : '不足'}</b><small>{r.withCount} / {r.withoutCount}日</small></button>)}<p>左ほど下向き、右ほど上向き。日数はタグあり / なし。</p></div>
          <p className="insight-footnote">対象タグの{selected.count}日のうち、当日・{horizonLabel(lag)}がそろわない日（まだ到来していない日を含む）{result.missing}日、近い体調の比較日がない日{result.unmatched}日は除外。</p>
        </> : <><h3 className="insight-question">このタグは、どんな体調の日に多い？</h3><div className="same-day-comparison"><div><span>タグあり</span><strong>{fmt(selected.same.withTag.mean)}<small>/ 5</small></strong><p>{selected.same.withTag.count}日</p></div><div><span>タグなし</span><strong>{fmt(selected.same.withoutTag.mean)}<small>/ 5</small></strong><p>{selected.same.withoutTag.count}日</p></div></div><p className="same-day-difference">平均の差 <b className={direction(selected.same.diff)}>{selected.same.enough ? `${signed(selected.same.diff)}点` : '比較日が不足'}</b></p><p className="form-hint">症状のタグや、つらい日に取る行動は低い体調と重なりやすくなります。ここでは記録した日との関係を見ています。</p></>}
      </section>
      <section className="analysis-card tag-relations"><div className="section-heading"><div><p className="insight-kicker">TAG × TAG</p><h2>一緒に現れるタグ</h2></div><GitCompareArrows size={22}/></div><p className="form-hint">「{selected.tag}」と同じ日に記録されやすい・されにくいタグ。投稿がある全{analysis.rows.length}日で比較。</p>
        {related.length ? <><div className="tag-relation-list">{related.slice(0,8).map(p=><button key={p.tag} aria-pressed={pair?.tag===p.tag} onClick={()=>setPartner(p.tag)}><span><Tag size={14}/><strong>{p.tag}</strong><small>同じ日 {p.counts[0]}日 · {Math.round(p.overlap*100)}%</small></span><b className={p.enough ? direction(p.phi) : ''}>{p.enough ? signed(p.phi) : '不足'}</b></button>)}</div>{related.length>8 && <label className="partner-select">ほかの組み合わせ<Select value={pair?.tag} onValueChange={setPartner}><SelectTrigger aria-label="組み合わせるタグ"><SelectValue/></SelectTrigger><SelectContent>{related.map(p=><SelectItem key={p.tag} value={p.tag}>{p.tag}</SelectItem>)}</SelectContent></Select></label>}
        <p className="insight-footnote">右の数字は同時出現の相関（−1〜+1）。プラスは重なりやすく、マイナスは重なりにくい傾向です。体調への良し悪しを示す数字ではありません。</p>
        {pair && <div className="pair-detail"><h3>{selected.tag} × {pair.tag}</h3><p>組み合わせ別の、その日の体調</p><div className="pair-grid">{['両方あり', `${selected.tag}だけ`, `${pair.tag}だけ`, 'どちらもなし'].map((name,i)=><div key={name}><span>{name}</span><strong>{pair.scores[i].count >= 3 ? fmt(pair.scores[i].mean) : '—'}<small>/ 5</small></strong><small>体調あり {pair.scores[i].count} / {pair.counts[i]}日</small></div>)}</div><p className="insight-footnote">体調が3日以上ある区分の平均を表示。タグ同士の相互作用や、組み合わせの効果を検証したものではありません。</p></div>}</> : <div className="insight-pending"><p>ほかのタグが増えると、組み合わせを比べられます。</p></div>}
      </section></>}
      <details className="analysis-card insight-all"><summary>全タグを比較する <span>{horizonLabel(lag)}の変化差</span></summary><div className="insight-all-list">{analysis.tags.map(t=>{const r=t.lags.find(l=>l.lag===lag)!;return <button key={t.tag} onClick={()=>{setChosen(t.tag);setMode('later');document.querySelector('.insight-tag-picker')?.scrollIntoView({block:'start',behavior:'smooth'});}}><span>{t.tag}<small>{t.count}日に記録</small></span><b className={r.enough?direction(r.diff):''}>{r.enough?signed(r.diff):'比較不足'}</b></button>;})}</div></details>
      </>}
      </details>
      <details className="analysis-card insight-method"><summary><Info size={16}/>数字の読み方と計算方法</summary><div><h3>比較の単位</h3><p>1日に何十回投稿しても、1日を同じ重みで扱います。体調の未選択は3。投稿そのものがない日は欠測です。「タグなし」は記録にタグがないという意味で、行動をしていない保証ではありません。</p><h3>あとからの変化</h3><p>指定した暦日の「後日の体調 − 当日の体調」を計算。当日の体調を四捨五入した1〜5の区分でそろえ、タグあり側の日数比でタグなし側を重み付けします。両方{MIN_DAYS}日以上あると、その変化差を表示。途中の日の欠測は補完せず、指定した日の記録だけを使います。</p><h3>分かること・まだ分からないこと</h3><p>表示は過去の関連です。曜日・他のタグ・連日の使用などは調整していません。同じ日を複数の時間差の比較に使うため、日数は独立した実験回数ではありません。薬や行動の因果効果、今後の体調を確定するものではありません。</p><h3>タグ同士</h3><p>両方・片方・どちらもない日の2×2表からφ相関を計算します。各タグのあり・なしがそれぞれ{MIN_DAYS}日未満の場合は数値を保留。数量や強度は混ぜず、タグの有無で分析します。</p></div></details>
    </div>;
}
