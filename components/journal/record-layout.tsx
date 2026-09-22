'use client';
import { type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Plus, BookOpen, PenLine } from 'lucide-react';
import { MOODS, shiftDay, todayKey } from '@/lib/journal';
import { type RecordLayout } from '@/lib/layouts';
import { MoodIcon, dateText } from './shared';

type Props = {
    layout: RecordLayout;
    composer: ReactNode;
    history: ReactNode;
    summary: ReactNode;
    date: string;
    dayCount: number;
    dayScore: number | null;
    score: number | null;
    reading: boolean;
    onReading: (reading: boolean) => void;
    onDate: (date: string) => void;
    onCompose: () => void;
};

export function RecordLayoutView(props: Props) {
    const { layout, composer, history, summary, date, reading, onReading } = props;
    if (layout.id === 'focus') return <div className="focus-experience">
        <div className="focus-switch" role="group" aria-label="一枚の表示">
            <button aria-pressed={!reading} onClick={() => onReading(false)}><PenLine size={16}/>記録する</button>
            <button aria-pressed={reading} onClick={() => onReading(true)}><BookOpen size={16}/>記録を読む</button>
        </div>
        <div hidden={reading}>
            <div className={`focus-hero mood-${props.score ?? 3}`}>
                <p>{dateText(todayKey())}</p>
                <span className="focus-face" aria-hidden="true"><MoodIcon score={props.score ?? 3} size={74}/></span>
                <h1>{props.score === null ? 'いま、どんな感じ？' : MOODS[props.score - 1].label}</h1>
                <p>{props.score === null ? 'ひとつ選んで、残そう。' : 'この感覚を、ここに。'}</p>
            </div>
            {composer}
        </div>
        <div hidden={!reading}>{history}</div>
    </div>;
    if (layout.id === 'dock') return <div className="dock-experience">
        <div className="dock-caption"><h1>その時の記録</h1><span>{dateText(todayKey())}</span></div>
        <div className="dock-history" tabIndex={0} role="region" aria-label="スクロールできる履歴">{history}</div>
        <div className="dock-composer">{composer}</div>
    </div>;
    if (layout.id === 'daybook') return <div className="daybook-experience">
        <DayPage date={date} count={props.dayCount} score={props.dayScore} onDate={props.onDate}/>
        {history}
        <button type="button" className="daybook-compose primary-button" onClick={props.onCompose}><Plus size={19}/>{date === todayKey() ? '今日に記録する' : 'この日に記録する'}</button>
    </div>;
    return <>
        <div className="page-heading"><div><p className="eyebrow">A MOMENT, KEPT</p><h1>その時の記録</h1></div><span className="heading-note">{dateText(todayKey())}</span></div>
        <div className="record-grid"><div className="record-main">{layout.composer === 'inline' && composer}{history}</div>{summary}</div>
    </>;
}

function DayPage({ date, count, score, onDate }: { date: string; count: number; score: number | null; onDate: (date: string) => void }) {
    const today = todayKey();
    function chooseDate(value: string) { if (value && value <= today) onDate(value); }
    return <header className="day-page">
        <div className="day-page-top"><span>一日、一ページ。</span><div className="day-page-actions">
            {date !== today && <button className="text-button" onClick={() => onDate(today)}>今日</button>}
            <label className="icon-button day-page-picker" title="日付を選ぶ"><CalendarDays size={20}/><input type="date" aria-label="日めくりの日付" max={today} value={date} onInput={e => chooseDate(e.currentTarget.value)} onChange={e => chooseDate(e.target.value)} onClick={e => { try { e.currentTarget.showPicker?.(); } catch { /* ネイティブ入力へのフォーカスは維持する */ } }}/></label>
        </div></div>
        <div className="day-page-date"><button className="icon-button" aria-label="前の日" onClick={() => onDate(shiftDay(date, -1))}><ArrowLeft size={21}/></button>
            <h1><span>{Number(date.slice(5, 7))}月</span><strong>{Number(date.slice(8))}</strong><span>{['日','月','火','水','木','金','土'][new Date(`${date}T12:00:00+09:00`).getUTCDay()]}曜日</span></h1>
            <button className="icon-button" aria-label="次の日" disabled={date >= today} onClick={() => onDate(shiftDay(date, 1))}><ArrowRight size={21}/></button>
        </div>
        <div className="day-page-summary"><span>{count ? `${count}件の記録` : 'まだ、まっさらな一日。'}</span>{score !== null && <span className={`mood-${Math.round(score)}`}><MoodIcon score={Math.round(score)} size={20}/>投稿平均 {score.toFixed(1)}</span>}</div>
    </header>;
}
