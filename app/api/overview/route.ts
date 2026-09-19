import { readOverview } from '@/lib/store';
import { database } from '@/db/raw';
import { reply, identity } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
    const user = await identity(req);
    if (!user)
        return reply({ error: 'サインインし直してください' }, 401);
    try {
        return reply(await readOverview(database(), user));
    }
    catch (e) {
        console.error('overview:read', e);
        return reply({ error: '集計を読み込めませんでした。再読み込みしてください。' }, 503);
    }
}
