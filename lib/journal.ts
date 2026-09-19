import { z } from 'zod';
export const TIMEZONE = 'Asia/Tokyo';
export const todayKey = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const shiftDay = (s: string, n: number) => new Date(new Date(s + 'T12:00:00+09:00').getTime() + n * 86400000).toISOString().slice(0, 10);
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s, '日付を確認してください').refine(s => s <= todayKey(), '未来の日付には記録できません');
const fields = { score: z.number().int().min(1).max(5).nullable(), note: z.string().trim().max(4000), tags: z.array(z.string().trim().min(1).max(30)).max(20), quantities: z.record(z.string().min(1).max(30), z.number().finite().positive().max(1000000)).optional() };
const hasContent = (e: {
    score: number | null;
    note: string;
    tags: string[];
}) => e.score !== null || e.note.length > 0 || e.tags.length > 0;
export const entrySchema = z.object({ id: z.string().uuid(), recordedAt: z.string().datetime({ offset: true }), ...fields }).strict().refine(e => Object.keys(e.quantities ?? {}).every(t => e.tags.includes(t)), '数量は選択したタグにだけ設定できます').refine(hasContent, '体調・メモ・タグのいずれかを記録してください').refine(e => Date.parse(e.recordedAt) <= Date.now() + 60000, '未来の時刻には記録できません');
// 編集リクエストには日時を含めない。記録日時はサーバー側でも変更しない。
export const entryPatchSchema = z.object({ id: z.string().uuid(), ...fields }).strict().refine(e => Object.keys(e.quantities ?? {}).every(t => e.tags.includes(t)), '数量は選択したタグにだけ設定できます').refine(hasContent, '体調・メモ・タグのいずれかを記録してください');
export const summarySchema = z.object({ date: daySchema, score: z.number().int().min(1).max(5), note: z.string().trim().max(4000) }).strict();
export type EntryInput = z.infer<typeof entrySchema>;
export type EntryPatch = z.infer<typeof entryPatchSchema>;
export type Entry = EntryInput & {
    date: string;
    updatedAt: string;
};
export type DailySummary = z.infer<typeof summarySchema> & {
    createdAt: string;
    updatedAt: string;
};
export const MOODS = [{ score: 1, label: 'とてもつらい', short: 'つらい', color: '#c77c99' }, { score: 2, label: 'つらい', short: '低め', color: '#c2966d' }, { score: 3, label: 'ふつう', short: 'ふつう', color: '#8e9eb9' }, { score: 4, label: 'まずまず', short: 'まずまず', color: '#68bbb9' }, { score: 5, label: '良い', short: '良い', color: '#78b88d' }];
export const DEFAULT_TAGS = ['横になる', '睡眠', '食事', '外出', '入浴', '服薬', '頭の詰まり', 'ブレインフォグ', '頭痛', '背中の痛み'];
export const mean = (a: number[]) => a.length ? a.reduce((s, n) => s + n, 0) / a.length : null;
export type DayStat = {
    date: string;
    score: number | null;
    count: number;
    scoreCount: number;
    tags: string[];
};
export function dailyStats(entries: Entry[]): DayStat[] {
    const groups = new Map<string, Entry[]>();
    for (const e of entries)
        groups.set(e.date, [...(groups.get(e.date) || []), e]);
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => { const scores = items.map(e => e.score ?? 3); return { date, score: mean(scores), count: items.length, scoreCount: scores.length, tags: [...new Set(items.flatMap(e => e.tags))] }; });
}
export function tagAssociations(days: DayStat[], mode: 'same' | 'next', summaries?: DailySummary[]) {
    const scores = new Map((summaries ?? days).map(d => [d.date, d.score]));
    return [...new Set(days.flatMap(d => d.tags))].map(tag => {
        const withTag: number[] = [], withoutTag: number[] = [];
        for (const d of days) {
            let value = scores.get(d.date) ?? null;
            if (mode === 'next') {
                const next = scores.get(shiftDay(d.date, 1));
                value = value !== null && next != null ? next - value : null;
            }
            if (value !== null)
                (d.tags.includes(tag) ? withTag : withoutTag).push(value);
        }
        const a = mean(withTag), b = mean(withoutTag);
        return { tag, withCount: withTag.length, withoutCount: withoutTag.length, withMean: a, withoutMean: b, diff: a !== null && b !== null ? a - b : null, enough: withTag.length >= 3 && withoutTag.length >= 3 };
    }).sort((a, b) => Number(b.enough) - Number(a.enough) || b.withCount - a.withCount);
}
export type EntryPage = {
    entries: Entry[];
    nextCursor: string | null;
};
export type Overview = {
    days: DayStat[];
    summaries: DailySummary[];
    tags: string[];
};
export function calendarDates(month: string) { const first = month + '-01'; const offset = (new Date(first + 'T12:00:00+09:00').getUTCDay() + 6) % 7; const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate(); return Array.from({ length: Math.ceil((offset + last) / 7) * 7 }, (_, i) => shiftDay(first, i - offset)); }
export function csvContent(entries: Entry[], summaries: DailySummary[]) {
    const rows = [['種別', '記録日時（ISO）', '日付（日本時間）', '体調（1〜5）', 'タグ', 'コメント', '作成日時', '更新日時'], ...entries.map(e => ['その時の記録', e.recordedAt, e.date, e.score ?? '', e.tags.map(t => `${t} ×${e.quantities?.[t] ?? 1}`).join(' | '), e.note, e.recordedAt, e.updatedAt]), ...summaries.map(s => ['一日の総括', '', s.date, s.score, '', s.note, s.createdAt, s.updatedAt])];
    const cell = (v: unknown) => '"' + String(v).replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""') + '"';
    return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}

// 隣り合う投稿の間隔。日をまたぐ接続はしない。
export function entryInterval(a: Entry, b: Entry) { return Math.abs(Date.parse(a.recordedAt) - Date.parse(b.recordedAt)); }
export function entriesConnected(a: Entry, b: Entry) { return a.date === b.date && entryInterval(a, b) <= 3600000; }
export function gapLabel(milliseconds: number) { const minutes = Math.floor(milliseconds / 60000), hours = Math.floor(minutes / 60); return `${hours ? hours + '時間' : ''}${minutes % 60 || !hours ? minutes % 60 + '分' : ''}`; }
