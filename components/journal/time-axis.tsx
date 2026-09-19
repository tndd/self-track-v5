'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { type Entry, type EntryPage, todayKey, shiftDay, gapLabel, entryInterval, MOODS } from '@/lib/journal';
import { request, MoodIcon, time, dateText } from './shared';

export function TimeAxis({ revision, active = true, onEdit }: { revision: number; active?: boolean; onEdit?: (entry: Entry) => void }) {
    const [date, setDate] = useState(todayKey), [retry, setRetry] = useState(0);
    const [result, setResult] = useState<{ date: string; entries: Entry[]; error: string; loading: boolean }>({ date: '', entries: [], error: '', loading: true });
    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        // 日付変更時には前日の結果を見せず、全ページの取得が終わってから描画する。
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResult({ date, entries: [], error: '', loading: true });
        void (async () => {
            try {
                let cursor: string | null = null;
                const entries: Entry[] = [];
                do {
                    const query = new URLSearchParams({ date });
                    if (cursor) query.set('cursor', cursor);
                    const page: EntryPage = await request<EntryPage>('/api/entries?' + query);
                    if (cancelled) return;
                    entries.push(...page.entries); cursor = page.nextCursor;
                } while (cursor);
                entries.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
                setResult({ date, entries, error: '', loading: false });
            } catch (e) { if (!cancelled) setResult({ date, entries: [], error: (e as Error).message, loading: false }); }
        })();
        return () => { cancelled = true; };
    }, [date, revision, active, retry]);
    const entries = result.date === date ? result.entries : [];
    return <section className="time-axis-section" aria-label="一日の時間軸"><div className="section-heading"><div><h2>一日の時間軸</h2><p className="form-hint">体調と行動を、起きた順に。</p></div></div>
      <div className="axis-date-controls"><button className="icon-button" aria-label="時間軸の前日" onClick={() => setDate(shiftDay(date, -1))}><ChevronLeft/></button><input className="text-input" aria-label="時間軸の日付" type="date" value={date} max={todayKey()} onChange={e => { if (e.target.value && e.target.value <= todayKey()) setDate(e.target.value); }}/><button className="icon-button" aria-label="時間軸の翌日" disabled={date >= todayKey()} onClick={() => setDate(shiftDay(date, 1))}><ChevronRight/></button><button className="text-button" onClick={() => setDate(todayKey())}>今日</button></div>
      <p className="metadata axis-caption">{dateText(date)} · {entries.length}件</p>
      {result.loading || result.date !== date ? <p className="form-hint" role="status">記録を読み込んでいます…</p> : result.error ? <div className="error-banner" role="alert">{result.error}<button onClick={() => setRetry(n => n + 1)}>再試行</button></div> : entries.length === 0 ? <div className="empty-state"><MessageCircle size={24}/><p>この日の記録はまだありません。</p></div> : <ol className="time-axis-list">{entries.map((entry, i) => {
          const previous = entries[i - 1], gap = previous ? entryInterval(previous, entry) : 0;
          const score = entry.score ?? 3;
          return <li key={entry.id} className={`axis-event ${gap > 3600000 ? 'axis-break' : ''}`}>
            {gap > 3600000 && <p className="axis-gap">{gapLabel(gap)}の間隔</p>}
            <div className="axis-event-body"><time dateTime={entry.recordedAt}>{time(entry.recordedAt)}</time><span className={`axis-mood mood-${score}`} role="img" aria-label={`体調${score} ${MOODS[score - 1].label}`}><MoodIcon score={score} size={25}/></span><div className="axis-content">{entry.note && <p>{entry.note}</p>}{entry.tags.length > 0 && <div className="axis-tags">{entry.tags.map(t => <span key={t}>#{t}{(entry.quantities?.[t] ?? 1) !== 1 ? ` ×${entry.quantities?.[t]}` : ''}</span>)}</div>}{!entry.note && !entry.tags.length && <span className="metadata">体調の記録</span>}{onEdit && <button className="text-button axis-edit" aria-label={`${time(entry.recordedAt)}の投稿を編集`} onClick={() => onEdit(entry)}>編集</button>}</div></div>
          </li>;
      })}</ol>}
      <p className="form-hint">間隔が1時間を超えた場所は線を切って表示。縦の長さは時間に比例しません。</p>
    </section>;
}
