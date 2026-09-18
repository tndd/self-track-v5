import { database } from '@/db/raw';
import { summarySchema, daySchema } from '@/lib/journal';
import { saveSummary } from '@/lib/store';
import { reply, identity, originAllowed, readBody } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function PUT(req: Request) { const user = await identity(); if (!user)
    return reply({ error: 'サインインし直してください' }, 401); if (!originAllowed(req))
    return reply({ error: '送信元を確認できません' }, 403); let input; try {
    input = await readBody(req);
}
catch {
    return reply({ error: '記録を読み取れません' }, 400);
} const parsed = summarySchema.safeParse(input); if (!parsed.success)
    return reply({ error: parsed.error.issues[0]?.message || '入力を確認してください' }, 400); try {
    return reply({ summary: await saveSummary(database(), user, parsed.data) });
}
catch (e) {
    console.error('summary:write', e);
    return reply({ error: '総括を保存できませんでした。入力を残しています。' }, 503);
} }
export async function DELETE(req: Request) { const user = await identity(); if (!user)
    return reply({ error: 'サインインし直してください' }, 401); if (!originAllowed(req))
    return reply({ error: '送信元を確認できません' }, 403); const date = daySchema.safeParse(new URL(req.url).searchParams.get('date')); if (!date.success)
    return reply({ error: '日付を確認してください' }, 400); try {
    await database().prepare('DELETE FROM daily_summaries WHERE user_id=? AND date=?').bind(user, date.data).run();
    return reply({ ok: true });
}
catch (e) {
    console.error('summary:delete', e);
    return reply({ error: '削除できませんでした' }, 503);
} }
