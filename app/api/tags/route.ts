import { database } from '@/db/raw';
import { identity, originAllowed, readBody, reply } from '@/lib/server';
import { catalogSchema } from '@/lib/tags';
import { readCatalog, writeCatalog } from '@/lib/tag-store';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
    const user = await identity(req);
    if (!user) return reply({ error: 'サインインし直してください' }, 401);
    try { return reply(await readCatalog(database(), user)); }
    catch (e) { console.error('tags:read', e); return reply({ error: 'タグを読み込めませんでした' }, 503); }
}
export async function PUT(req: Request) {
    const user = await identity(req);
    if (!user) return reply({ error: 'サインインし直してください' }, 401);
    if (!originAllowed(req)) return reply({ error: '送信元を確認できません' }, 403);
    let input: unknown;
    try { input = await readBody(req, 120000); } catch { return reply({ error: 'タグを読み取れません' }, 400); }
    const parsed = catalogSchema.safeParse(input);
    if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message || '入力を確認してください' }, 400);
    try { const result = await writeCatalog(database(), user, parsed.data); return result ? reply(result) : reply({ error: '別の画面でタグが更新されました。再読み込みしてから変更してください。' }, 409); }
    catch (e) { console.error('tags:write', e); return reply({ error: 'タグを保存できませんでした。入力は残っています。' }, 503); }
}
