import { shiftDay, type Entry, type DailySummary } from './journal.ts';

// 同じ基準日なら常に同じ結果。実在人物の記録・薬効を模したデータではない。
export function demoData(end: string, length = 120) {
    const entries: Entry[] = [], summaries: DailySummary[] = [];
    const notes = ['朝はゆっくり。窓を開けて少し休む。', '昼食後に短い散歩。帰宅してひと息。', '頭が重いので横になって休憩。', '服薬の記録。午後の予定を確認。', '入浴を済ませて、早めに眠る準備。'];
    const tags = [['睡眠','食事'], ['外出'], ['頭の詰まり','横になる'], ['服薬'], ['入浴','睡眠']];
    const clamp = (n: number) => Math.max(1,Math.min(5,Math.round(n)));
    for(let i=0;i<length;i++) {
        const date = shiftDay(end,i-length+1), base = 3+1.45*Math.sin(i/6)+0.7*Math.cos(i/13);
        if(i%19 === 3) continue;
        const times = ['07:40','12:15','12:45','13:20','21:10'];
        for(let j=0;j<times.length;j++) {
            const selectedTags = j === 2 && base > 3 ? (i % 2 ? ['外出'] : ['食事']) : j === 3 && i % 3 !== 0 ? ['食事'] : j === 4 && i % 4 === 0 ? ['睡眠'] : tags[j];
            const note = j === 2 && base > 3 ? '休憩して午後の予定を確認。' : j === 3 && i % 3 !== 0 ? '少し食べてひと息。' : notes[j];
            const recordedAt = new Date(`${date}T${times[j]}:00+09:00`).toISOString();
            entries.push({id:`de000000-0000-4000-8000-${String(i*5+j).padStart(12,'0')}`,date,recordedAt,updatedAt:recordedAt,score:(i+j)%11===0?null:clamp(base+(j-2)*0.35),note:(i+j)%4===0?'':note,tags:selectedTags,quantities:Object.fromEntries(selectedTags.map(t=>[t,t==='服薬' ? (i%9===0 ? 0.5 : i%2+1) : t==='外出' ? i%3+1 : 1]))});
        }
        if(i%13!==4) { const stamp = `${date}T14:30:00.000Z`; summaries.push({date,score:clamp(base),note:notes[i%notes.length],createdAt:stamp,updatedAt:stamp}); }
    }
    return {entries,summaries};
}

export async function seedDemo(db: D1Database, user: string, end: string) {
    if(!user.endsWith(':demo')) throw new Error('試用データ専用です');
    const existing = await db.prepare('SELECT COUNT(*) AS count FROM entries WHERE user_id=?').bind(user).first<{count:number}>();
    if(existing?.count) return {created:false,count:existing.count};
    const data = demoData(end);
    const statements = [
        ...data.entries.map(e=>db.prepare('INSERT INTO entries (id,user_id,date,recorded_at,score,note,tags,quantities,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING').bind(e.id,user,e.date,e.recordedAt,e.score,e.note,JSON.stringify(e.tags),JSON.stringify(e.quantities),e.updatedAt)),
        ...data.summaries.map(s=>db.prepare('INSERT INTO daily_summaries (user_id,date,score,note,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,date) DO NOTHING').bind(user,s.date,s.score,s.note,s.createdAt,s.updatedAt))
    ];
    await db.batch(statements);
    return {created:true,count:data.entries.length,summaries:data.summaries.length};
}
