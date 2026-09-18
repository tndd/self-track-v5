'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, MoreHorizontal, MessageCircle, LoaderCircle, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { type Entry, type EntryPage, MOODS, todayKey } from '@/lib/journal';
import { dateText, time, request } from './shared';
export type Filters = {
    q: string;
    tag: string;
    date: string;
};
export function Timeline({ revision, tags, filters, setFilters, onEdit }: {
    revision: number;
    tags: string[];
    filters: Filters;
    setFilters: (f: Filters) => void;
    onEdit: (e: Entry) => void;
}) {
    const [entries, setEntries] = useState<Entry[]>([]), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [open, setOpen] = useState(false), [search, setSearch] = useState(filters.q);
    const generation = useRef(0), inflight = useRef(false), sentinel = useRef<HTMLDivElement>(null);
    useEffect(() => { const timer = setTimeout(() => setSearch(filters.q), 250); return () => clearTimeout(timer); }, [filters.q]);
    const url = useCallback((next?: string) => { const p = new URLSearchParams(); if (search)
        p.set('q', search); if (filters.tag)
        p.set('tag', filters.tag); if (filters.date)
        p.set('date', filters.date); if (next)
        p.set('cursor', next); return '/api/entries?' + p; }, [search, filters.tag, filters.date]);
    // 検索条件・保存後の再取得開始時に、古い結果とカーソルを一緒に破棄する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { const gen = ++generation.current; inflight.current = true; setLoading(true); setError(''); setEntries([]); setCursor(null); request<EntryPage>(url()).then(data => { if (generation.current === gen) {
        setEntries(data.entries);
        setCursor(data.nextCursor);
    } }).catch(e => { if (generation.current === gen)
        setError(e.message); }).finally(() => { if (generation.current === gen) {
        inflight.current = false;
        setLoading(false);
    } }); return () => { generation.current = gen + 1; }; }, [url, revision]);
    const loadMore = useCallback(async () => { if (inflight.current)
        return; const gen = generation.current; inflight.current = true; setLoading(true); setError(''); try {
        const data = await request<EntryPage>(url(cursor ?? undefined));
        if (gen === generation.current) {
            setEntries(old => [...old, ...data.entries.filter(e => !old.some(x => x.id === e.id))]);
            setCursor(data.nextCursor);
        }
    }
    catch (e) {
        if (gen === generation.current)
            setError((e as Error).message);
    }
    finally {
        if (gen === generation.current) {
            inflight.current = false;
            setLoading(false);
        }
    } }, [url, cursor]);
    useEffect(() => { if (!sentinel.current || !cursor || error || loading)
        return; const observer = new IntersectionObserver(items => { if (items[0].isIntersecting)
        void loadMore(); }, { rootMargin: '350px' }); observer.observe(sentinel.current); return () => observer.disconnect(); }, [cursor, error, loading, loadMore]);
    const active = !!(filters.q || filters.tag || filters.date);
    const groups = [...new Set(entries.map(e => e.date))];
    return <section className="timeline-section" aria-label="その時の記録の履歴"><div className="section-heading"><div><p className="eyebrow">TIMELINE</p><h2>記録をたどる</h2></div><button className={`secondary-button ${open || active ? 'selected' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}><SlidersHorizontal size={16}/>絞り込み{active && <span className="filter-count">ON</span>}</button></div>
 {(open || active) && <div className="history-tools"><label className="search-field"><Search size={18}/><input aria-label="言葉で検索" placeholder="メモやタグを検索" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })}/></label><Select value={filters.tag || '__all'} onValueChange={v => setFilters({ ...filters, tag: v === '__all' ? '' : v })}><SelectTrigger aria-label="タグで絞り込む"><SelectValue placeholder="すべてのタグ"/></SelectTrigger><SelectContent><SelectItem value="__all">すべてのタグ</SelectItem>{tags.map(t => <SelectItem key={t} value={t}>#{t}</SelectItem>)}</SelectContent></Select><input className="history-date" type="date" aria-label="履歴の日付" max={todayKey()} value={filters.date} onInput={e => setFilters({ ...filters, date: e.currentTarget.value })} onChange={e => setFilters({ ...filters, date: e.target.value })}/>{active && <button className="text-button" onClick={() => setFilters({ q: '', tag: '', date: '' })}><X size={14}/>解除</button>}</div>}
 {groups.map(d => <section className="history-day" key={d}><div className="day-heading"><h3>{d === todayKey() ? '今日 · ' : ''}{dateText(d)}</h3></div>{entries.filter(e => e.date === d).map(e => <article className="entry" key={e.id} data-entry-id={e.id}><time dateTime={e.recordedAt} className="entry-time">{time(e.recordedAt)}</time><div className="entry-bubble"><div className="entry-top">{e.score !== null ? <span className={`score-badge mood-${e.score}`}>{MOODS[e.score - 1].label}<b>{e.score}</b></span> : <span className="metadata"><MessageCircle size={14}/>メモ</span>}<button className="icon-button" aria-label={`${d} ${time(e.recordedAt)}の記録を編集`} onClick={() => onEdit(e)}><MoreHorizontal size={20}/></button></div>{e.note && <p className="entry-note">{e.note}</p>}{e.tags.length > 0 && <div className="entry-tags">{e.tags.map(t => <button key={t} onClick={() => setFilters({ ...filters, tag: t })}>#{t}</button>)}</div>}</div></article>)}</section>)}
 {loading && <Skeleton className="h-24 w-full rounded-xl"/>}{!loading && !error && !entries.length && <div className="empty-state"><MessageCircle size={26}/><h3>{active ? '該当する記録はありません' : '最初の記録を、ここに。'}</h3><p>{active ? '言葉やタグ、日付を変えてみてください。' : '体調だけでも、ひとことだけでも残せます。'}</p></div>}
 {error && <div className="error-banner" role="alert">{error}<button onClick={() => void loadMore()}>再試行</button></div>}<div ref={sentinel} className="timeline-end">{cursor && !error && <button disabled={loading} className="text-button" onClick={() => void loadMore()}>{loading ? <LoaderCircle size={16} className="spin"/> : null}以前の記録を読み込む</button>}{!cursor && entries.length > 0 && !loading && <span className="metadata">ここまでの記録をすべて表示しました</span>}</div></section>;
}
