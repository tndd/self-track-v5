'use client';
import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Check, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { type Overview, type DailySummary, todayKey, calendarDates, summarySchema } from '@/lib/journal';
import { MoodButtons, dateText, request } from './shared';
export function CalendarView({ overview, onSaved, onViewEntries, disabled }: {
    overview: Overview;
    onSaved: () => Promise<void>;
    onViewEntries: (d: string) => void;
    disabled: boolean;
}) {
    const today = todayKey(), [month, setMonth] = useState(today.slice(0, 7)), [date, setDate] = useState(today), [drafts, setDrafts] = useState<Record<string, {
        score: number | null;
        note: string;
    }>>({}), [busy, setBusy] = useState(false), [removeOpen, setRemoveOpen] = useState(false), [editorOpen, setEditorOpen] = useState(false);
    const saved = overview.summaries.find(s => s.date === date), draft = drafts[date] ?? { score: saved?.score ?? null, note: saved?.note ?? '' }, count = overview.days.find(d => d.date === date)?.count ?? 0;
    const update = (value: Partial<typeof draft>) => setDrafts(old => ({ ...old, [date]: { ...draft, ...value } }));
    const changeMonth = (n: number) => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 7)); };
    async function save() { if (busy)
        return; const parsed = summarySchema.safeParse({ date, ...draft }); if (!parsed.success) {
        toast.error('一日の総括を5段階から選んでください');
        return;
    } setBusy(true); try {
        await request<{
            summary: DailySummary;
        }>('/api/summaries', { method: 'PUT', body: JSON.stringify(parsed.data) });
        await onSaved();
        setDrafts(old => { const next = { ...old }; delete next[date]; return next; });
        toast.success('一日の総括を保存しました'); setEditorOpen(false);
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function remove() { if (busy)
        return; setBusy(true); try {
        await request('/api/summaries?date=' + date, { method: 'DELETE' });
        await onSaved();
        setDrafts(old => { const next = { ...old }; delete next[date]; return next; });
        setRemoveOpen(false);
        toast.success('この日の総括を削除しました');
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <><div className="page-heading"><div><p className="eyebrow">DAY BY DAY</p><h1>一日を振り返る</h1></div><p className="heading-note">その日を、君自身の感覚で。</p></div><div className="calendar-layout"><section className="calendar-card"><div className="month-header"><div className="month-title"><span>{month.slice(0, 4)}</span><h2>{Number(month.slice(5))}月</h2></div><div className="row"><button className="text-button" onClick={() => { setMonth(today.slice(0, 7)); setDate(today); setEditorOpen(true); }}>今日</button><button className="icon-button" aria-label="前の月" onClick={() => changeMonth(-1)}><ChevronLeft /></button><button className="icon-button" aria-label="次の月" disabled={month >= today.slice(0, 7)} onClick={() => changeMonth(1)}><ChevronRight /></button></div></div><div className="calendar-week" aria-hidden="true">{['月', '火', '水', '木', '金', '土', '日'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid" role="group" aria-label={`${month}の総括カレンダー`}>{calendarDates(month).map(d => { const summary = overview.summaries.find(s => s.date === d), n = overview.days.find(s => s.date === d)?.count ?? 0; return <button key={d} className={`calendar-day ${d.slice(0, 7) !== month ? 'outside' : ''} ${d === today ? 'is-today' : ''} ${d === date ? 'selected-day' : ''} ${summary ? 'mood-' + summary.score : 'unrecorded'}`} disabled={d > today || busy} aria-pressed={d === date} aria-label={`${d} 総括${summary ? summary.score : '未記録'} その時の記録${n}件${summary?.note ? ' コメントあり' : ''}`} onClick={() => { setDate(d); setEditorOpen(true); if (d.slice(0, 7) !== month)
        setMonth(d.slice(0, 7)); }}><span className="calendar-date">{Number(d.slice(8))}</span><strong>{summary?.score ?? '—'}</strong><span className="calendar-marker">{summary?.note ? <span aria-hidden="true">▰</span> : null}{n > 0 ? <i aria-hidden="true"/> : null}</span></button>; })}</div><div className="calendar-legend"><span>数字：一日の総括</span><span>● その時の記録あり</span><span>— 総括は未記録</span></div></section>
 </div><Dialog open={editorOpen} onOpenChange={v => !busy && setEditorOpen(v)}><DialogContent className="journal-dialog calendar-dialog"><DialogTitle>{dateText(date)}の総括</DialogTitle><DialogDescription>この一日を振り返って記録します。</DialogDescription><section className="summary-editor"><div className="section-heading"><div><p className="eyebrow">DAILY REFLECTION</p><h2>{dateText(date)}</h2></div><CalendarDays size={21}/></div><p className="summary-status">{saved ? <><Check size={15}/>総括を記録済み</> : 'この日の総括は、まだ空白です'}</p><fieldset disabled={disabled || busy}><legend className="field-label">一日全体の体調</legend><MoodButtons label="一日の総括" selected={draft.score} onPick={score => update({ score })}/><label className="field-label" htmlFor="day-note">一日のコメント <small>任意</small></label><textarea id="day-note" className="text-input" rows={4} maxLength={4000} placeholder="一日を通して、どうだった？" value={draft.note} onChange={e => update({ note: e.target.value })}/><button className="primary-button full-width" disabled={disabled || busy || draft.score === null} onClick={() => void save()}>{busy ? '保存中…' : '総括を保存'}</button></fieldset><p className="form-hint">その時々の体調とは、別の記録です。</p><div className="summary-actions"><button className="text-button" onClick={() => { setEditorOpen(false); onViewEntries(date); }}>この日の投稿を見る（{count}件）</button>{saved && <button className="icon-button danger-button" disabled={busy} aria-label="この日の総括を削除" onClick={() => setRemoveOpen(true)}><Trash2 size={17}/></button>}</div></section></DialogContent></Dialog><AlertDialog open={removeOpen} onOpenChange={v => !busy && setRemoveOpen(v)}><AlertDialogContent><AlertDialogTitle>この日の総括を削除しますか？</AlertDialogTitle><AlertDialogDescription>その時々の投稿は残ります。総括は元に戻せません。</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={busy}>残す</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void remove(); }}>総括を削除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
