import { mean, shiftDay, type Overview } from './journal.ts';

export const HORIZONS = [1, 2, 3, 7] as const;
export const MIN_DAYS = 5;
export type AnalysisSource = 'summary' | 'moment';
export type Observation = { date: string; score: number | null; tags: string[] };
const average = (values: number[]) => mean(values);
export function observations(overview: Overview, start: string, end: string, source: AnalysisSource): Observation[] {
    const scores = new Map((source === 'summary' ? overview.summaries : overview.days).map(d => [d.date, d.score]));
    // 投稿のない日は、タグが付いていない日とは区別する。
    return overview.days.filter(d => d.date >= start && d.date <= end).map(d => ({
        date: d.date, tags: [...new Set(d.tags)], score: scores.get(d.date) ?? null,
    })).sort((a, b) => a.date.localeCompare(b.date));
}
export function distribution(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = (p: number) => {
        if (!sorted.length) return null;
        const i = (sorted.length - 1) * p, low = Math.floor(i), high = Math.ceil(i);
        return sorted[low] + (sorted[high] - sorted[low]) * (i - low);
    };
    return { count: values.length, mean: average(values), low: quantile(.25), high: quantile(.75), improved: values.filter(v => v >= .5).length };
}
export function sameDay(rows: Observation[], tag: string) {
    const withTag: number[] = [], withoutTag: number[] = [];
    for (const row of rows) if (row.score !== null) (row.tags.includes(tag) ? withTag : withoutTag).push(row.score);
    const a = distribution(withTag), b = distribution(withoutTag);
    return { withTag: a, withoutTag: b, enough: a.count >= MIN_DAYS && b.count >= MIN_DAYS,
        diff: a.mean === null || b.mean === null ? null : a.mean - b.mean };
}
export function laggedAssociation(rows: Observation[], scores: Map<string, number | null>, tag: string, lag: number, end: string) {
    const pairs = rows.flatMap(row => {
        const target = shiftDay(row.date, lag), after = scores.get(target);
        return row.score === null || after == null || target > end ? [] : [{
            date: row.date, baseline: row.score, after, delta: after - row.score, exposed: row.tags.includes(tag),
        }];
    });
    const exposed = pairs.filter(p => p.exposed), controls = pairs.filter(p => !p.exposed);
    // 当日の体調を1点刻みで層別し、タグあり側の日数で両群を同じ構成にそろえる。
    const bin = (score: number) => Math.round(score);
    const controlBins = new Map<number, number[]>();
    for (const c of controls) { const key = bin(c.baseline); const values = controlBins.get(key) ?? []; values.push(c.delta); controlBins.set(key, values); }
    const controlMeans = new Map([...controlBins].map(([key, values]) => [key, average(values)!]));
    const matched = exposed.filter(p => controlMeans.has(bin(p.baseline)));
    const matchedBins = new Set(matched.map(p => bin(p.baseline)));
    const usedControls = controls.filter(c => matchedBins.has(bin(c.baseline)));
    const expected = matched.map(p => controlMeans.get(bin(p.baseline))!);
    const actual = distribution(matched.map(p => p.delta)), comparison = average(expected);
    return {
        lag, eligible: exposed.length, missing: rows.filter(r => r.tags.includes(tag)).length - exposed.length,
        unmatched: exposed.length - matched.length, withCount: matched.length, withoutCount: usedControls.length,
        actual, comparison, after: distribution(matched.map(p => p.after)),
        diff: actual.mean === null || comparison === null ? null : actual.mean - comparison,
        enough: matched.length >= MIN_DAYS && usedControls.length >= MIN_DAYS,
        dates: matched.map(p => p.date),
    };
}
export function tagPairs(rows: Observation[], tag: string) {
    const names = [...new Set(rows.flatMap(r => r.tags))].filter(t => t !== tag);
    return names.map(other => {
        const groups = [[], [], [], []] as number[][];
        const counts = [0, 0, 0, 0];
        for (const row of rows) {
            // 両方・対象タグだけ・相手タグだけ・どちらもなし。
            const index = row.tags.includes(tag) ? (row.tags.includes(other) ? 0 : 1) : (row.tags.includes(other) ? 2 : 3);
            counts[index]++;
            if (row.score !== null) groups[index].push(row.score);
        }
        const [both, onlyA, onlyB, neither] = counts;
        const a = both + onlyA, b = both + onlyB, noA = onlyB + neither, noB = onlyA + neither;
        const divisor = Math.sqrt(a * b * noA * noB);
        return { tag: other, counts, scores: groups.map(distribution),
            phi: divisor ? (both * neither - onlyA * onlyB) / divisor : null,
            enough: Math.min(a, b, noA, noB) >= MIN_DAYS,
            overlap: a ? both / a : 0,
        };
    }).sort((a, b) => Number(b.enough) - Number(a.enough) || Math.abs(b.phi ?? 0) - Math.abs(a.phi ?? 0) || b.counts[0] - a.counts[0]);
}
export function analyzeTags(overview: Overview, start: string, end: string, source: AnalysisSource) {
    const rows = observations(overview, start, end, source);
    const scores = new Map((source === 'summary' ? overview.summaries : overview.days)
        .filter(d => d.date >= start && d.date <= end).map(d => [d.date, d.score]));
    const tags = [...new Set(rows.flatMap(r => r.tags))].map(tag => ({ tag,
        count: rows.filter(r => r.tags.includes(tag)).length, same: sameDay(rows, tag),
        lags: HORIZONS.map(lag => laggedAssociation(rows, scores, tag, lag, end)),
    })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ja'));
    return { rows, tags, scoredDays: rows.filter(r => r.score !== null).length };
}
