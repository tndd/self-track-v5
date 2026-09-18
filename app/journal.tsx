'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, CalendarDays, Check, Download, Droplet, LoaderCircle, LockKeyhole, Palette, Plus, Send, SlidersHorizontal, Trash2, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { DEFAULT_TAGS, todayKey, shiftDay, entrySchema, entryPatchSchema, csvContent, type Entry, type EntryInput, type EntryPage, type Overview } from '@/lib/journal';
import { MoodButtons, TagPicker, request, makeId, dateText, time, localInput, fmt } from '@/components/journal/shared';
import { Timeline, type Filters } from '@/components/journal/timeline';
import { CalendarView } from '@/components/journal/calendar';
import { Trends } from '@/components/journal/trends';
const skins = [{ id: 'night', name: '夜', hint: '静かな青とやわらかな光' }, { id: 'paper', name: '紙', hint: '明るい紙面とすっきりした文字' }, { id: 'ink', name: '墨', hint: 'くっきりした輪郭とミニマルな余白' }];
type Draft = {
    note: string;
    tags: string[];
    score: number | null;
};
const blank: Draft = { note: '', tags: [], score: null };
const emptyOverview: Overview = { days: [], summaries: [], tags: [] };
export default function Journal() {
    const [overview, setOverview] = useState<Overview>(emptyOverview), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [tab, setTab] = useState('record'), [draft, setDraft] = useState<Draft>(blank), [more, setMore] = useState(false), [backdate, setBackdate] = useState(''), [tagOpen, setTagOpen] = useState(false), [newTag, setNewTag] = useState(''), [extraTags, setExtraTags] = useState<string[]>([]), [editing, setEditing] = useState<Entry | null>(null), [deleteId, setDeleteId] = useState<string | null>(null), [filters, setFilters] = useState<Filters>({ q: '', tag: '', date: '' }), [revision, setRevision] = useState(0), [skin, setSkin] = useState('night'), [skinOpen, setSkinOpen] = useState(false), [exporting, setExporting] = useState(false), [failed, setFailed] = useState<EntryInput | null>(null);
    const saving = useRef(false), overviewGeneration = useRef(0), actionRef = useRef(overview);
    useEffect(() => { actionRef.current = overview; }, [overview]);
    const refresh = useCallback(async () => { const gen = ++overviewGeneration.current; try {
        const data = await request<Overview>('/api/overview');
        if (gen === overviewGeneration.current) {
            setOverview(data);
            setError('');
        }
    }
    catch (e) {
        if (gen === overviewGeneration.current)
            setError((e as Error).message);
        throw e;
    }
    finally {
        if (gen === overviewGeneration.current)
            setLoading(false);
    } }, []);
    useEffect(() => { void refresh().catch(() => { }); }, [refresh]);
    useEffect(() => { const update = () => { if (document.visibilityState === 'visible' && !saving.current) {
        void refresh().catch(() => { });
        setRevision(r => r + 1);
    } }; document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, [refresh]);
    useEffect(() => { try {
        const value = localStorage.getItem('shizuku-skin');
        if (skins.some(s => s.id === value)) {
            // ブラウザー保存値はSSRで取得できないため、マウント後に同期する。
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSkin(value!);
            document.documentElement.dataset.skin = value!;
        }
    }
    catch { } }, []);
    function chooseSkin(value: string) { if (!value)
        return; setSkin(value); document.documentElement.dataset.skin = value; try {
        localStorage.setItem('shizuku-skin', value);
    }
    catch { } }
    const allTags = useMemo(() => [...new Set([...DEFAULT_TAGS, ...overview.tags, ...extraTags])], [overview.tags, extraTags]);
    const today = todayKey(), todayStat = overview.days.find(d => d.date === today), todaySummary = overview.summaries.find(d => d.date === today);
    const displayedTags = [...new Set([...allTags.slice(0, more ? allTags.length : 6), ...draft.tags])];
    async function afterMutation() { setRevision(r => r + 1); try {
        await refresh();
    }
    catch {
        toast.error('保存済みですが、集計の更新に失敗しました。再読み込みしてください。');
    } }
    async function persist(input: EntryInput | Entry, edit = false) { if (saving.current)
        return; const payload = edit ? { id: input.id, score: input.score, note: input.note, tags: input.tags } : input; const parsed = (edit ? entryPatchSchema : entrySchema).safeParse(payload); if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message);
        return;
    } saving.current = true; setBusy(true); try {
        await request<{
            entry: Entry;
        }>('/api/entries', { method: edit ? 'PUT' : 'POST', body: JSON.stringify(parsed.data) });
        setFailed(null);
        if (edit)
            setEditing(null);
        else {
            setDraft(blank);
            setMore(false);
            setBackdate('');
        }
        toast.success(edit ? '記録を更新しました' : '記録しました');
        await afterMutation();
    }
    catch (e) {
        if (!edit)
            setFailed(input);
        toast.error((e as Error).message);
    }
    finally {
        saving.current = false;
        setBusy(false);
    } }
    function submit() { if (failed) {
        void persist(failed);
        return;
    } const instant = backdate ? new Date(backdate + ':00+09:00') : new Date(); if (Number.isNaN(instant.getTime())) {
        toast.error('日時を確認してください');
        return;
    } void persist({ ...draft, id: makeId(), recordedAt: instant.toISOString() }); }
    async function remove() { if (saving.current || !deleteId)
        return; saving.current = true; setBusy(true); try {
        await request('/api/entries?id=' + deleteId, { method: 'DELETE' });
        setEditing(null);
        setDeleteId(null);
        toast.success('記録を削除しました');
        await afterMutation();
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        saving.current = false;
        setBusy(false);
    } }
    function addTag() { const t = newTag.trim(); if (!t)
        return; if ((editing?.tags ?? draft.tags).length >= 20) {
        toast.error('タグは20個までです');
        return;
    } setExtraTags(old => [...new Set([...old, t])]); if (editing)
        setEditing({ ...editing, tags: [...new Set([...editing.tags, t])] });
    else
        setDraft(d => ({ ...d, tags: [...new Set([...d.tags, t])] })); setTagOpen(false); setNewTag(''); }
    async function download() { if (exporting)
        return; setExporting(true); try {
        const entries: Entry[] = [];
        let cursor: string | null = null;
        do {
            const data: EntryPage = await request<EntryPage>('/api/entries' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
            entries.push(...data.entries);
            cursor = data.nextCursor;
        } while (cursor);
        const data = await request<Overview>('/api/overview');
        const blob = new Blob([csvContent(entries, data.summaries)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = `self-track-v5-${todayKey()}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success('投稿と一日の総括を書き出しました');
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setExporting(false);
    } }
    useEffect(() => { const context = (document as Document & {
        modelContext?: {
            registerTool: (tool: unknown, options: unknown) => Promise<void> | void;
        };
    }).modelContext; if (!context?.registerTool)
        return; const life = new AbortController(); try {
        void Promise.resolve(context.registerTool({ name: 'read_health_journal_summary', title: '体調記録の集計を読む', description: '一日の総括と、その時の体調の日平均を区別して返す。変更は行わない。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => actionRef.current }, { signal: life.signal })).catch(() => { });
    }
    catch { } return () => life.abort(); }, []);
    return <div className="app-shell"><Toaster theme={skin === 'paper' ? 'light' : 'dark'} position="top-center" richColors/><header className="app-header"><Link href="/" className="brand"><span className="brand-icon"><Droplet size={24}/></span><span>しずく<small>体調の記録</small></span></Link><div className="header-actions"><span className="private-label"><LockKeyhole size={14}/><span>自分だけの記録</span></span><button className="icon-button skin-trigger" aria-label="見た目を変える" onClick={() => setSkinOpen(true)}><Palette size={21}/></button></div></header>
 <Tabs value={tab} onValueChange={setTab} className="app-tabs"><TabsList className="main-nav"><TabsTrigger value="record"><Plus size={18}/>その時の記録</TabsTrigger><TabsTrigger value="calendar"><CalendarDays size={18}/>カレンダー</TabsTrigger><TabsTrigger value="trends"><TrendingUp size={18}/>傾向</TabsTrigger></TabsList>
 {error && <div className="error-banner" role="alert">{error}<button onClick={() => void refresh().catch(() => { })}>再読み込み</button></div>}
 <TabsContent value="record" forceMount className="tab-panel"><div className="page-heading"><div><p className="eyebrow">A MOMENT, KEPT</p><h1>その時の記録</h1></div><span className="heading-note">{dateText(today)}</span></div><div className="record-grid"><div className="record-main"><section className="checkin-card"><div className="section-heading"><h2>いまの体調は？</h2><span className="tap-hint">選んで、送信</span></div><fieldset disabled={busy || !!failed}><MoodButtons selected={draft.score} onPick={score => setDraft({ ...draft, score: draft.score === score ? null : score })}/><div className="composer"><textarea aria-label="ひとことメモ" value={draft.note} maxLength={4000} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="ひとこと残す？ 書かなくても大丈夫。" rows={2}/><TagPicker all={displayedTags} value={draft.tags} onChange={tags => setDraft({ ...draft, tags })} onAdd={() => setTagOpen(true)}/>{more && <label className="backdate-field">記録する日時 <small>空欄なら、送信した時刻</small><input className="text-input" type="datetime-local" aria-label="投稿の日時" max={localInput(new Date().toISOString())} value={backdate} onInput={e => setBackdate(e.currentTarget.value)} onChange={e => setBackdate(e.target.value)}/></label>}<div className="composer-footer"><button className="details-toggle" onClick={() => setMore(!more)} aria-expanded={more}><SlidersHorizontal size={16}/>{more ? '閉じる' : 'タグ・日時'}</button><button className="send-button" disabled={busy || (!draft.note.trim() && !draft.tags.length && draft.score === null)} onClick={submit}>{busy ? <LoaderCircle size={17} className="spin"/> : <Send size={17}/>}送信</button></div></div></fieldset>{failed && <div className="error-banner" role="alert">まだ保存を確認できていません。<button disabled={busy} onClick={submit}>同じ記録を再送</button></div>}</section>
 <Timeline revision={revision} tags={allTags} filters={filters} setFilters={setFilters} onEdit={e => setEditing({ ...e, tags: [...e.tags] })}/></div><aside className="summary-column"><section className="summary-card"><div className="section-heading"><h2>今日、その時々の体調</h2><Activity size={18}/></div><div className="daily-number">{fmt(todayStat?.score)}<span>/ 5</span></div><p className="metadata">{todayStat?.scoreCount ? `${todayStat.scoreCount}回の体調の平均` : '体調の投稿はまだありません'}</p><div className="summary-divider"/><div className="row"><span>一日の総括</span><strong>{todaySummary ? `${todaySummary.score} / 5` : '未記録'}</strong></div><button className="subtle-link" onClick={() => setTab('calendar')}>{todaySummary ? 'カレンダーを見る' : '今日を振り返る'}<ArrowUpRight size={16}/></button></section><section className="week-card"><div className="section-heading"><h2>最近7日の総括</h2></div><div className="week-strip">{Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6)).map(d => { const s = overview.summaries.find(s => s.date === d); return <div key={d}><span>{Number(d.slice(8))}</span><strong className={s ? 'mood-' + s.score : ''}>{s?.score ?? '—'}</strong></div>; })}</div><p className="form-hint">空白は、まだ振り返っていない日。</p></section></aside></div></TabsContent>
 <TabsContent value="calendar" forceMount className="tab-panel"><CalendarView overview={overview} disabled={loading || !!error} onSaved={refresh} onViewEntries={date => { setFilters({ q: '', tag: '', date }); setTab('record'); }}/></TabsContent>
 <TabsContent value="trends" forceMount className="tab-panel"><Trends overview={overview}/></TabsContent></Tabs>
 <footer className="app-footer"><span>しずく <small>· 日本時間</small></span><button className="text-button" disabled={exporting} onClick={() => void download()}><Download size={15}/>{exporting ? '書き出し中…' : 'CSVを書き出す'}</button></footer>
 <Dialog open={skinOpen} onOpenChange={setSkinOpen}><DialogContent className="journal-dialog skin-dialog"><DialogTitle>見た目を選ぶ</DialogTitle><DialogDescription>使い方と記録は、そのまま。心地よい見た目を。</DialogDescription><ToggleGroup type="single" value={skin} onValueChange={chooseSkin} className="skin-options" aria-label="スキン">{skins.map(s => <ToggleGroupItem key={s.id} value={s.id} aria-label={`${s.name}のスキン`} className={`skin-option skin-preview-${s.id}`}><div className="skin-mini"><span /><i /><b /></div><span className="skin-name">{s.name}{skin === s.id && <Check size={16}/>}</span><small>{s.hint}</small></ToggleGroupItem>)}</ToggleGroup><button className="primary-button" onClick={() => setSkinOpen(false)}>この見た目で使う</button></DialogContent></Dialog>
 <Dialog open={tagOpen} onOpenChange={setTagOpen}><DialogContent className="journal-dialog"><DialogTitle>タグを追加</DialogTitle><DialogDescription>症状、薬の名前、場所など、あとで探したい言葉を。</DialogDescription><form onSubmit={e => { e.preventDefault(); addTag(); }}><input className="text-input" autoFocus maxLength={30} value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="例：頭の詰まり" aria-label="新しいタグの名前"/><button className="primary-button full-width" type="submit" disabled={!newTag.trim()}>このタグを付ける</button></form></DialogContent></Dialog>
 <Dialog open={!!editing} onOpenChange={v => !v && !busy && setEditing(null)}><DialogContent className="journal-dialog edit-dialog"><DialogTitle>その時の記録を編集</DialogTitle><DialogDescription>元の記録日時は変わりません。</DialogDescription>{editing && <fieldset disabled={busy} className="edit-fields"><div className="recorded-time"><span>記録日時</span><time dateTime={editing.recordedAt}>{dateText(editing.date)} {time(editing.recordedAt)}</time></div><MoodButtons label="編集する体調" selected={editing.score} onPick={score => setEditing({ ...editing, score: editing.score === score ? null : score })}/><textarea className="text-input" aria-label="記録のメモ" rows={3} maxLength={4000} value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })}/><TagPicker all={allTags} value={editing.tags} onChange={tags => setEditing({ ...editing, tags })} onAdd={() => setTagOpen(true)}/><div className="row"><button className="danger-button" onClick={() => setDeleteId(editing.id)}><Trash2 size={17}/>削除</button><button className="primary-button" onClick={() => void persist(editing, true)}>{busy ? '保存中…' : '変更を保存'}</button></div></fieldset>}</DialogContent></Dialog>
 <AlertDialog open={!!deleteId} onOpenChange={v => !v && !busy && setDeleteId(null)}><AlertDialogContent><AlertDialogTitle>この記録を削除しますか？</AlertDialogTitle><AlertDialogDescription>この投稿だけを削除します。一日の総括は残ります。元に戻せません。</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={busy}>残す</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void remove(); }}>削除する</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
