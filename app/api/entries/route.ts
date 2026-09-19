import { database } from '@/db/raw';
import { entrySchema, entryPatchSchema } from '@/lib/journal';
import { createEntry, updateEntry, listEntries } from '@/lib/store';
import { reply, identity, originAllowed, readBody } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { const user = await identity(req); if (!user)
    return reply({ error: 'サインインし直してください' }, 401); try {
    return reply(await listEntries(database(), user, new URL(req.url).searchParams));
}
catch (e) {
    console.error('entries:read', e);
    return reply({ error: '記録を読み込めませんでした。もう一度お試しください。' }, 503);
} }
export async function POST(req: Request) { return save(req, false); }
export async function PUT(req: Request) { return save(req, true); }
async function save(req: Request, editing: boolean) {
    const user = await identity(req);
    if (!user)
        return reply({ error: 'サインインし直してください' }, 401);
    if (!originAllowed(req))
        return reply({ error: '送信元を確認できません' }, 403);
    let input: unknown;
    try {
        input = await readBody(req);
    }
    catch {
        return reply({ error: '記録を読み取れません' }, 400);
    }
    const parsed = (editing ? entryPatchSchema : entrySchema).safeParse(input);
    if (!parsed.success)
        return reply({ error: parsed.error.issues[0]?.message || '入力を確認してください' }, 400);
    try {
        const entry = editing ? await updateEntry(database(), user, entryPatchSchema.parse(input)) : await createEntry(database(), user, entrySchema.parse(input));
        return entry ? reply({ entry }) : reply({ error: '記録が見つかりません' }, 404);
    }
    catch (e) {
        console.error('entries:write', e);
        return reply({ error: '保存できませんでした。入力は残っています。再試行してください。' }, 503);
    }
}
export async function DELETE(req: Request) { const user = await identity(req); if (!user)
    return reply({ error: 'サインインし直してください' }, 401); if (!originAllowed(req))
    return reply({ error: '送信元を確認できません' }, 403); const id = new URL(req.url).searchParams.get('id'); if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    return reply({ error: '記録を確認してください' }, 400); try {
    await database().prepare('DELETE FROM entries WHERE user_id=? AND id=?').bind(user, id).run();
    return reply({ ok: true });
}
catch (e) {
    console.error('entries:delete', e);
    return reply({ error: '削除できませんでした' }, 503);
} }
