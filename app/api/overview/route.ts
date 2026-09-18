import { database } from '@/db/raw';
import { reply, identity } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
    const user = await identity();
    if (!user)
        return reply({ error: 'サインインし直してください' }, 401);
    try {
        const db = database();
        const [days, tags, summaries] = await db.batch<Record<string, unknown>>([
            db.prepare('SELECT date,AVG(score) AS score,COUNT(*) AS count,COUNT(score) AS scoreCount FROM entries WHERE user_id=? GROUP BY date ORDER BY date').bind(user),
            db.prepare('SELECT DISTINCT date,value AS tag FROM entries,json_each(entries.tags) WHERE user_id=? ORDER BY date').bind(user),
            db.prepare('SELECT date,score,note,created_at AS createdAt,updated_at AS updatedAt FROM daily_summaries WHERE user_id=? ORDER BY date').bind(user)
        ]);
        const tagMap = new Map<string, string[]>();
        for (const t of tags.results)
            tagMap.set(t.date as string, [...(tagMap.get(t.date as string) || []), t.tag as string]);
        return reply({ days: days.results.map(d => ({ ...d, tags: tagMap.get(d.date as string) || [] })), tags: [...new Set(tags.results.map(t => t.tag))], summaries: summaries.results });
    }
    catch (e) {
        console.error('overview:read', e);
        return reply({ error: '集計を読み込めませんでした。再読み込みしてください。' }, 503);
    }
}
