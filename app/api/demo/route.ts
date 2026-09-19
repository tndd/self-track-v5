import { database } from '@/db/raw';
import { identity, originAllowed, reply } from '@/lib/server';
import { seedDemo } from '@/lib/demo';
import { todayKey, shiftDay } from '@/lib/journal';
export async function POST(req: Request) {
    const user = await identity(req);
    if(!user) return reply({error:'サインインし直してください'},401);
    if(!originAllowed(req) || req.headers.get('X-Shizuku-Dataset') !== 'demo') return reply({error:'試用データ専用です'},403);
    try { return reply(await seedDemo(database(),user,shiftDay(todayKey(),-1))); }
    catch(e) { console.error('demo:seed',e); return reply({error:'試用データを用意できませんでした。もう一度お試しください。'},503); }
}
