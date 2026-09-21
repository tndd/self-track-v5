'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, CalendarDays, Check, Download, Droplet, LoaderCircle, LockKeyhole, FlaskConical, Palette, Plus, Send, Trash2, TrendingUp, Tags } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { todayKey, shiftDay, entrySchema, entryPatchSchema, csvContent, type Entry, type EntryInput, type EntryPage, type Overview } from '@/lib/journal';
import { MoodButtons, TagPicker, useRequest, datasetRequest, DatasetRequest, makeId, dateText, time, localInput, fmt } from '@/components/journal/shared';
import { Timeline, type Filters } from '@/components/journal/timeline';
import { CalendarView } from '@/components/journal/calendar';
import { TagManager } from '@/components/journal/tag-manager';
import { catalogSchema, type Catalog } from '@/lib/tags';
import { TimeAxis } from '@/components/journal/time-axis';
import { Trends } from '@/components/journal/trends';
const skins = [{ id: 'night', name: '夜', hint: '静かな青とやわらかな光' }, { id: 'paper', name: '紙', hint: '明るい紙面とすっきりした文字' }, { id: 'ink', name: '墨', hint: 'くっきりした輪郭とミニマルな余白' }];
const layouts = [{ id: 'standard', name: '標準', hint: 'コンパクトな入力と、その下に履歴。' }, { id: 'daybook', name: '手帳', hint: '日付を切り替えて、一日の総括と投稿をひとまとめに。' }, { id: 'chronicle', name: '時間軸', hint: '一日の流れを主役に。記録は下のボタンから。' }, { id: 'thumb', name: '片手入力', hint: '履歴を広く。親指に近い下側から入力を開く。' }];
const interfaces = [{ id: 'shizuku', name: 'しずく標準', hint: '夜の青と、やわらかな丸み。' }, { id: 'apple', name: 'Apple風', hint: '浮かぶガラスの操作部と、静かな記録面。' }, { id: 'google', name: 'Google風', hint: '丸い操作部と、はっきりした強弱。' }, { id: 'openai', name: 'OpenAI風', hint: '余白と文字を主役にした、シンプルな画面。' }];

type Draft = {
    note: string;
    tags: string[];
    score: number | null;
    quantities: Record<string, number>;
};
const blank: Draft = { note: '', tags: [], score: null, quantities: {} };
function preference(key: string, fallback: string, options: {id: string}[]) {
    try { const value = localStorage.getItem(key); return options.some(o => o.id === value) ? value! : fallback; } catch { return fallback; }
}
type SessionData = { demo: boolean; overview: Overview; tags: {catalog: Catalog; usage: Record<string, number>; recent: string[]}; entries: EntryPage };
const requests = { own: datasetRequest(false), demo: datasetRequest(true) };
async function prepareSession(demo: boolean): Promise<SessionData> {
    const request = demo ? requests.demo : requests.own;
    if (demo) await request('/api/demo', {method: 'POST'});
    const [overview, tags, entries] = await Promise.all([
        request<Overview>('/api/overview'), request<SessionData['tags']>('/api/tags'), request<EntryPage>('/api/entries')
    ]);
    return {demo, overview, tags, entries};
}
export default function Journal() {
    const [session, setSession] = useState<SessionData | null>(null);
    const [switching, setSwitching] = useState(true), [loadError, setLoadError] = useState('');
    const transition = useRef(0), requestedDataset = useRef(false);
    const switchDataset = useCallback(async (demo: boolean) => {
        const generation = ++transition.current;
        requestedDataset.current = demo;
        setSwitching(true); setLoadError('');
        try {
            const next = await prepareSession(demo);
            if (generation !== transition.current) return;
            const url = new URL(window.location.href);
            if (demo) url.searchParams.set('demo', '1'); else url.searchParams.delete('demo');
            window.history.replaceState(null, '', url);
            setSession(next);
        } catch (e) { if (generation === transition.current) setLoadError((e as Error).message); }
        finally { if (generation === transition.current) setSwitching(false); }
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => void switchDataset(new URLSearchParams(window.location.search).get('demo') === '1'), 0);
        return () => { clearTimeout(timer); };
    }, [switchDataset]);
    return <>{session && <DatasetRequest.Provider value={session.demo ? requests.demo : requests.own}>
        <JournalSession key={String(session.demo)} initial={session} switching={switching} switchDataset={switchDataset}/>
    </DatasetRequest.Provider>}
    {switching && <div className="dataset-transition" role="status"><LoaderCircle className="spin" size={20}/>記録を準備しています…</div>}
    {loadError && <div className="dataset-transition" role="alert">{loadError}<button className="text-button" onClick={() => void switchDataset(requestedDataset.current)}>再試行</button>{session && <button className="text-button" onClick={() => setLoadError('')}>元の画面へ</button>}</div>}</>;
}
function JournalSession({initial, switching, switchDataset}: {initial: SessionData; switching: boolean; switchDataset: (demo: boolean) => Promise<void>}) {
    const request = useRequest();
    const demo = initial.demo;

    const [overview, setOverview] = useState<Overview>(initial.overview), [loading, setLoading] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [tab, setTab] = useState('record'), [draft, setDraft] = useState<Draft>(blank), [more, setMore] = useState(false), [backdate, setBackdate] = useState(''), [tagOpen, setTagOpen] = useState(false), [newTag, setNewTag] = useState(''), [editing, setEditing] = useState<Entry | null>(null), [deleteId, setDeleteId] = useState<string | null>(null), [filters, setFilters] = useState<Filters>({ q: '', tag: '', date: '' }), [revision, setRevision] = useState(0), [skin, setSkin] = useState(() => preference('shizuku-skin', 'night', skins)), [skinOpen, setSkinOpen] = useState(false), [exporting, setExporting] = useState(false), [failed, setFailed] = useState<EntryInput | null>(null);
    const [catalog, setCatalog] = useState<Catalog>(initial.tags.catalog), [usage, setUsage] = useState<Record<string, number>>(initial.tags.usage), [tagBusy, setTagBusy] = useState(false), [tagReady, setTagReady] = useState(true), [newTagGroup, setNewTagGroup] = useState('未分類');
    const [layout, setLayout] = useState(() => preference('shizuku-layout-experiment-v3', 'standard', layouts)), [designOpen, setDesignOpen] = useState(false), [ui, setUi] = useState(() => preference('shizuku-ui', 'shizuku', interfaces)), [composerOpen, setComposerOpen] = useState(false);
    async function openDemo() { if (demo) { setDesignOpen(false); return; } await switchDataset(true); }
    const tagSaving = useRef(false);
    const saving = useRef(false), overviewGeneration = useRef(0), actionRef = useRef(overview);
    useEffect(() => { actionRef.current = overview; }, [overview]);
    const refresh = useCallback(async () => { const gen = ++overviewGeneration.current; try {
        const [data, tagData] = await Promise.all([request<Overview>('/api/overview'), request<{catalog: Catalog; usage: Record<string, number>; recent: string[]}>('/api/tags')]);
        if (gen === overviewGeneration.current) {
            setOverview(data);
            setCatalog(old => tagData.catalog.revision >= old.revision ? tagData.catalog : old); setUsage(tagData.usage); setTagReady(true);
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
    } }, [request]);
    useEffect(() => { const update = () => { if (document.visibilityState === 'visible' && !saving.current && !tagSaving.current) {
        void refresh().catch(() => { });
    } }; document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, [refresh]);
    useEffect(() => { document.documentElement.dataset.skin = skin; document.documentElement.dataset.ui = ui; }, [skin, ui]);
    function chooseUi(value: string) { if (!value) return; setUi(value); document.documentElement.dataset.ui = value; try { localStorage.setItem('shizuku-ui', value); } catch { } }
    function chooseLayout(value: string) { if (!value) return; setLayout(value); setComposerOpen(false); try { localStorage.setItem('shizuku-layout-experiment-v3', value); } catch { } }
    function chooseSkin(value: string) { if (!value)
        return; setSkin(value); document.documentElement.dataset.skin = value; try {
        localStorage.setItem('shizuku-skin', value);
    }
    catch { } }
    const allTags = useMemo(() => [...new Set([...catalog.tags.filter(t => !t.archived).map(t => t.name), ...overview.tags])], [overview.tags, catalog]);
    async function saveCatalog(next: Catalog) { if (tagSaving.current || !tagReady) return false; const parsed = catalogSchema.safeParse(next); if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return false; } tagSaving.current = true; setTagBusy(true); try { const result = await request<{catalog: Catalog; usage: Record<string, number>; recent: string[]}>('/api/tags', { method: 'PUT', body: JSON.stringify(parsed.data) }); setCatalog(result.catalog); setUsage(result.usage); toast.success('タグを保存しました'); return true; } catch (e) { toast.error((e as Error).message); return false; } finally { tagSaving.current = false; setTagBusy(false); } }
    const today = todayKey(), todayStat = overview.days.find(d => d.date === today), todaySummary = overview.summaries.find(d => d.date === today);
    const displayedTags = [...new Set([...allTags.slice(0, more ? allTags.length : 6), ...draft.tags])];
    async function afterMutation() { setRevision(r => r + 1); try {
        await refresh();
    }
    catch {
        toast.error('保存済みですが、集計の更新に失敗しました。再読み込みしてください。');
    } }
    async function persist(input: EntryInput | Entry, edit = false) { if (saving.current)
        return; const payload = edit ? { id: input.id, score: input.score, note: input.note, tags: input.tags, quantities: input.quantities } : input; const parsed = (edit ? entryPatchSchema : entrySchema).safeParse(payload); if (!parsed.success) {
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
            setDraft(blank); setComposerOpen(false);
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
    async function addTag() { const t = newTag.trim(); if (!t) return;
        if ((editing?.tags ?? draft.tags).length >= 20) { toast.error('タグは20個までです'); return; }
        const existing = catalog.tags.find(x => x.name === t);
        const next = existing ? { ...catalog, tags: catalog.tags.map(x => x.name === t ? { ...x, archived: false } : x) } : { ...catalog, tags: [...catalog.tags, { name: t, group: newTagGroup, quantified: false, unit: '', archived: false }] };
        if (!await saveCatalog(next)) return;
        if (editing) setEditing({ ...editing, tags: [...new Set([...editing.tags, t])] });
        else setDraft(d => ({ ...d, tags: [...new Set([...d.tags, t])] })); setTagOpen(false); setNewTag('');
    }
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
    const composer = <section className={`checkin-card ${more ? 'expanded' : ''}`}>
      <div className="section-heading"><h2>いまの体調は？</h2><span className="tap-hint">選んで、送信</span></div>
      <fieldset disabled={busy || !!failed}>
        <MoodButtons selected={draft.score} onPick={score => setDraft({ ...draft, score: draft.score === score ? null : score })}/>
        <div className="composer">
          <textarea aria-label="ひとことメモ" value={draft.note} maxLength={4000} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="ひとこと残す？ 書かなくても大丈夫。" rows={1}/>
          <TagPicker all={displayedTags} value={draft.tags} catalog={catalog} usage={usage} expanded={more} onToggle={() => setMore(v => !v)}
            quantities={draft.quantities} onQuantities={quantities => setDraft({ ...draft, quantities })}
            onChange={tags => setDraft({ ...draft, tags, quantities: Object.fromEntries(tags.map(t => [t, draft.quantities[t] ?? 1])) })}
            onAdd={() => { setNewTagGroup('未分類'); setTagOpen(true); }}
            expandedContent={<label className="backdate-field"><span>記録する日時</span><small>空欄なら、送信した時刻</small><input className="text-input" type="datetime-local" aria-label="投稿の日時" max={localInput(new Date().toISOString())} value={backdate} onInput={e => setBackdate(e.currentTarget.value)} onChange={e => setBackdate(e.target.value)}/></label>}
            footerAction={<button type="button" className="send-button" disabled={busy || (!draft.note.trim() && !draft.tags.length && draft.score === null)} onClick={submit}>{busy ? <LoaderCircle size={17} className="spin"/> : <Send size={17}/>}送信</button>}/>
        </div>
      </fieldset>
      {failed && <div className="error-banner" role="alert">まだ保存を確認できていません。<button disabled={busy} onClick={submit}>同じ記録を再送</button></div>}
    </section>;
    return <div className="app-shell" data-layout={layout} data-ui={ui}><Toaster theme={skin === 'paper' ? 'light' : 'dark'} position="top-center" richColors/><header className="app-header"><Link href={demo ? "/?demo=1" : "/"} className="brand"><span className="brand-icon"><Droplet size={24}/></span><span>しずく<small>体調の記録</small></span></Link><div className="header-actions"><span className="private-label"><LockKeyhole size={14}/><span>{demo ? "試用データ" : "自分だけの記録"}</span></span><button className="icon-button" aria-label="デザイン実験" title="デザイン実験" onClick={() => setDesignOpen(true)}><FlaskConical size={20}/></button><button className="icon-button skin-trigger" aria-label="見た目を変える" onClick={() => setSkinOpen(true)}><Palette size={21}/></button></div></header>
 {demo && <aside className="demo-banner"><div><FlaskConical size={17}/><span><strong>試用モード</strong><small>4か月分の架空の記録。自由に追加・編集できます。</small></span></div><button className="text-button" disabled={switching || busy || tagBusy || exporting} onClick={() => void switchDataset(false)}>自分の記録へ</button></aside>}
 <Tabs value={tab} onValueChange={setTab} className="app-tabs"><TabsList className="main-nav"><TabsTrigger value="record"><Plus size={18}/>その時の記録</TabsTrigger><TabsTrigger value="calendar"><CalendarDays size={18}/>カレンダー</TabsTrigger><TabsTrigger value="trends"><TrendingUp size={18}/>統計</TabsTrigger><TabsTrigger value="tags"><Tags size={18}/>タグ管理</TabsTrigger></TabsList>
 {error && <div className="error-banner" role="alert">{error}<button onClick={() => void refresh().catch(() => { })}>再読み込み</button></div>}
 <TabsContent value="record" forceMount className="tab-panel"><div className="page-heading"><div><p className="eyebrow">A MOMENT, KEPT</p><h1>その時の記録</h1></div><span className="heading-note">{dateText(today)}</span></div><div className="record-grid"><div className="record-main">{!['thumb', 'chronicle'].includes(layout) && composer}{layout === 'daybook' && <section className="daybook-overview"><div className="book-summary"><span>{dateText(filters.date || today)}の総括 <b>{overview.summaries.find(d => d.date === (filters.date || today))?.score ?? '—'}</b></span><span>投稿 <b>{overview.days.find(d => d.date === (filters.date || today))?.count ?? 0}件</b></span></div></section>}
 {layout === 'chronicle' ? <TimeAxis revision={revision} active={tab === 'record'} selectedDate={filters.date || (demo ? overview.days.at(-1)?.date || today : today)} onDateChange={date => setFilters({...filters, date})} onEdit={setEditing}/> : <Timeline initialPage={initial.entries} visible={tab === 'record'} revision={revision} tags={allTags} filters={filters} setFilters={setFilters} onEdit={e => setEditing({ ...e, tags: [...e.tags] })}/>}</div><aside className="summary-column"><section className="summary-card"><div className="section-heading"><h2>今日、その時々の体調</h2><Activity size={18}/></div><div className="daily-number">{fmt(todayStat?.score)}<span>/ 5</span></div><p className="metadata">{todayStat?.scoreCount ? `${todayStat.scoreCount}回の体調の平均` : '体調の投稿はまだありません'}</p><div className="summary-divider"/><div className="row"><span>一日の総括</span><strong>{todaySummary ? `${todaySummary.score} / 5` : '未記録'}</strong></div><button className="subtle-link" onClick={() => setTab('calendar')}>{todaySummary ? 'カレンダーを見る' : '今日を振り返る'}<ArrowUpRight size={16}/></button></section><section className="week-card"><div className="section-heading"><h2>最近7日の総括</h2></div><div className="week-strip">{Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6)).map(d => { const s = overview.summaries.find(s => s.date === d); return <div key={d}><span>{Number(d.slice(8))}</span><strong className={s ? 'mood-' + s.score : ''}>{s?.score ?? '—'}</strong></div>; })}</div><p className="form-hint">空白は、まだ振り返っていない日。</p></section></aside></div></TabsContent>
 <TabsContent value="calendar" forceMount className="tab-panel"><CalendarView overview={overview} disabled={loading || !!error} onSaved={refresh} onViewTrends={() => setTab('trends')} onViewEntries={date => { setFilters({ q: '', tag: '', date }); setTab('record'); }}/></TabsContent>
 <TabsContent value="trends" forceMount className="tab-panel"><Trends overview={overview}/></TabsContent><TabsContent value="tags" forceMount className="tab-panel"><TagManager catalog={catalog} usage={usage} busy={tagBusy || !tagReady} onSave={saveCatalog}/></TabsContent></Tabs>
 {tab === 'record' && ['thumb', 'chronicle'].includes(layout) && <button className="floating-compose" onClick={() => setComposerOpen(true)}><Plus size={22}/>記録する</button>}
 <Dialog open={composerOpen} onOpenChange={v => !busy && setComposerOpen(v)}><DialogContent className="journal-dialog composer-sheet"><DialogTitle>その時の記録</DialogTitle><DialogDescription>体調だけでも、ひとことだけでも。</DialogDescription>{['thumb', 'chronicle'].includes(layout) && composer}</DialogContent></Dialog>
 <footer className="app-footer"><span>しずく <small>· 日本時間</small></span><button className="text-button" disabled={exporting} onClick={() => void download()}><Download size={15}/>{exporting ? '書き出し中…' : 'CSVを書き出す'}</button></footer>
 <Dialog open={designOpen} onOpenChange={setDesignOpen}><DialogContent className="journal-dialog design-dialog"><DialogTitle>デザイン実験</DialogTitle><DialogDescription>UIと配置を別々に組み合わせて試せます。記録と入力途中の内容は共通です。</DialogDescription><section className="demo-launch"><div><strong>記録が増えたら、どう見える？</strong><p>120日分・1日2〜56件の投稿と日別総括で試せます。切り替えると入力中の下書きは閉じます。</p></div><button className="secondary-button" disabled={switching || busy || tagBusy || exporting} onClick={() => void openDemo()}>{switching ? '準備中…' : demo ? '試用データを開く' : 'ダミーデータで試す'}</button></section><h3>UIの見た目</h3><ToggleGroup type="single" value={ui} onValueChange={chooseUi} className="interface-options" aria-label="UIの見た目">{interfaces.map(i => <ToggleGroupItem key={i.id} value={i.id} aria-label={`${i.name}のUI`} className="interface-option"><strong>{i.name}</strong><small>{i.hint}</small>{ui === i.id && <Check size={16}/>}</ToggleGroupItem>)}</ToggleGroup><h3>試験レイアウト</h3><ToggleGroup type="single" value={layout} onValueChange={chooseLayout} className="layout-options" aria-label="配置の候補">{layouts.map(l => <ToggleGroupItem key={l.id} value={l.id} className="layout-option" aria-label={`${l.name}の配置`}><span><strong>{l.name}</strong><small>{l.hint}</small></span>{layout === l.id && <Check size={18}/>}</ToggleGroupItem>)}</ToggleGroup><div className="row"><button className="text-button" onClick={() => { chooseLayout('standard'); chooseUi('shizuku'); }}>標準に戻す</button><button className="primary-button" onClick={() => setDesignOpen(false)}>この配置で試す</button></div></DialogContent></Dialog>
 <Dialog open={skinOpen} onOpenChange={setSkinOpen}><DialogContent className="journal-dialog skin-dialog"><DialogTitle>見た目を選ぶ</DialogTitle><DialogDescription>使い方と記録は、そのまま。心地よい見た目を。</DialogDescription><ToggleGroup type="single" value={skin} onValueChange={chooseSkin} className="skin-options" aria-label="スキン">{skins.map(s => <ToggleGroupItem key={s.id} value={s.id} aria-label={`${s.name}のスキン`} className={`skin-option skin-preview-${s.id}`}><div className="skin-mini"><span /><i /><b /></div><span className="skin-name">{s.name}{skin === s.id && <Check size={16}/>}</span><small>{s.hint}</small></ToggleGroupItem>)}</ToggleGroup><button className="primary-button" onClick={() => setSkinOpen(false)}>この見た目で使う</button></DialogContent></Dialog>
 <Dialog open={tagOpen} onOpenChange={setTagOpen}><DialogContent className="journal-dialog"><DialogTitle>タグを追加</DialogTitle><DialogDescription>症状、薬の名前、場所など、あとで探したい言葉を。</DialogDescription><form onSubmit={e => { e.preventDefault(); void addTag(); }}><input className="text-input" autoFocus maxLength={30} value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="例：頭の詰まり" aria-label="新しいタグの名前"/><label>所属グループ<select className="text-input" aria-label="新しいタグのグループ" value={newTagGroup} onChange={e => setNewTagGroup(e.target.value)}>{catalog.groups.map(g => <option key={g}>{g}</option>)}</select></label><button className="primary-button full-width" type="submit" disabled={!newTag.trim() || tagBusy || !tagReady}>このタグを付ける</button></form></DialogContent></Dialog>
 <Dialog open={!!editing} onOpenChange={v => !v && !busy && setEditing(null)}><DialogContent className="journal-dialog edit-dialog"><DialogTitle>その時の記録を編集</DialogTitle><DialogDescription>元の記録日時は変わりません。</DialogDescription>{editing && <fieldset disabled={busy} className="edit-fields"><div className="recorded-time"><span>記録日時</span><time dateTime={editing.recordedAt}>{dateText(editing.date)} {time(editing.recordedAt)}</time></div><MoodButtons label="編集する体調" selected={editing.score} onPick={score => setEditing({ ...editing, score: editing.score === score ? null : score })}/><textarea className="text-input" aria-label="記録のメモ" rows={3} maxLength={4000} value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })}/><TagPicker all={allTags} value={editing.tags} catalog={catalog} usage={usage} quantities={editing.quantities} onQuantities={quantities => setEditing({ ...editing, quantities })} onChange={tags => setEditing({ ...editing, tags, quantities: Object.fromEntries(tags.map(t => [t, editing.quantities?.[t] ?? 1])) })} onAdd={() => { setNewTagGroup('未分類'); setTagOpen(true); }}/><div className="row"><button className="danger-button" onClick={() => setDeleteId(editing.id)}><Trash2 size={17}/>削除</button><button className="primary-button" onClick={() => void persist(editing, true)}>{busy ? '保存中…' : '変更を保存'}</button></div></fieldset>}</DialogContent></Dialog>
 <AlertDialog open={!!deleteId} onOpenChange={v => !v && !busy && setDeleteId(null)}><AlertDialogContent><AlertDialogTitle>この記録を削除しますか？</AlertDialogTitle><AlertDialogDescription>この投稿だけを削除します。一日の総括は残ります。元に戻せません。</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={busy}>残す</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void remove(); }}>削除する</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
