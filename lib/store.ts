import { todayKey, type EntryInput, type EntryPatch, type Entry, type DailySummary } from './journal.ts';
const columns = 'id,date,recorded_at AS recordedAt,score,note,tags,updated_at AS updatedAt';
const unpack = (row: Record<string, unknown>) => ({ ...row, tags: JSON.parse(row.tags as string) }) as Entry;
export async function listEntries(db: D1Database, user: string, params: URLSearchParams) {
    const where = ['user_id=?'];
    const args: (string | number)[] = [user];
    const date = params.get('date'), tag = params.get('tag'), q = params.get('q'), cursor = params.get('cursor');
    if (date) {
        where.push('date=?');
        args.push(date);
    }
    if (tag) {
        where.push('EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE value=?)');
        args.push(tag);
    }
    if (q) {
        where.push("(instr(lower(note),lower(?))>0 OR EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE instr(lower(value),lower(?))>0))");
        args.push(q, q);
    }
    if (cursor) {
        const c = JSON.parse(cursor);
        if (!Array.isArray(c) || c.length !== 2 || c.some(v => typeof v !== 'string'))
            throw new Error('invalid_cursor');
        where.push('(recorded_at < ? OR (recorded_at = ? AND id < ?))');
        args.push(c[0], c[0], c[1]);
    }
    const limit = 40;
    args.push(limit + 1);
    const result = await db.prepare(`SELECT ${columns} FROM entries WHERE ${where.join(' AND ')} ORDER BY recorded_at DESC,id DESC LIMIT ?`).bind(...args).all();
    const rows = result.results.slice(0, limit).map(unpack);
    const last = rows.at(-1);
    return { entries: rows, nextCursor: result.results.length > limit && last ? JSON.stringify([last.recordedAt, last.id]) : null };
}
export async function createEntry(db: D1Database, user: string, v: EntryInput) {
    const recordedAt = new Date(v.recordedAt).toISOString();
    await db.prepare('INSERT INTO entries (id,user_id,date,recorded_at,score,pain,note,tags,updated_at) VALUES (?,?,?,?,?,NULL,?,?,?) ON CONFLICT(user_id,id) DO NOTHING').bind(v.id, user, todayKey(new Date(recordedAt)), recordedAt, v.score, v.note, JSON.stringify([...new Set(v.tags)]), new Date().toISOString()).run();
    return getEntry(db, user, v.id);
}
export async function updateEntry(db: D1Database, user: string, v: EntryPatch) {
    // 元の日時・日付と既存の旧疼痛データは変更しない。
    const result = await db.prepare('UPDATE entries SET score=?,note=?,tags=?,updated_at=? WHERE user_id=? AND id=?').bind(v.score, v.note, JSON.stringify([...new Set(v.tags)]), new Date().toISOString(), user, v.id).run();
    return result.meta.changes ? getEntry(db, user, v.id) : null;
}
async function getEntry(db: D1Database, user: string, id: string) { const row = await db.prepare(`SELECT ${columns} FROM entries WHERE user_id=? AND id=?`).bind(user, id).first(); return row ? unpack(row) : null; }
export async function saveSummary(db: D1Database, user: string, v: {
    date: string;
    score: number;
    note: string;
}) {
    const now = new Date().toISOString();
    await db.prepare('INSERT INTO daily_summaries (user_id,date,score,note,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET score=excluded.score,note=excluded.note,updated_at=excluded.updated_at').bind(user, v.date, v.score, v.note, now, now).run();
    return await db.prepare('SELECT date,score,note,created_at AS createdAt,updated_at AS updatedAt FROM daily_summaries WHERE user_id=? AND date=?').bind(user, v.date).first() as DailySummary;
}
