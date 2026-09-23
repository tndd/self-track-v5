import { database } from '@/db/raw';
import { identity, reply } from '@/lib/server';
import { daySchema } from '@/lib/journal';
import { readAnalysisRecords } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
    const user=await identity(req);if(!user)return reply({error:'サインインし直してください'},401);
    const params=new URL(req.url).searchParams, start=params.get('start'),end=params.get('end');
    if(!start||!end||!daySchema.safeParse(start).success||!daySchema.safeParse(end).success||start>end)return reply({error:'集計期間を確認してください'},400);
    try { const result=await readAnalysisRecords(database(),user,start,end);
        if(result.tooMany)return reply({error:'この期間は2万件を超えています。期間を短くして再度お試しください。'},422);
        return reply({samples:result.samples});
    } catch {return reply({error:'詳しい記録を読み込めませんでした。再試行してください。'},503);}
}
