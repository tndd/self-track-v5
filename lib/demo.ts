import { shiftDay, type Entry, type DailySummary } from './journal.ts';

// 同じ基準日なら常に同じ結果。実在人物の記録・薬効を模したデータではない。
export function demoData(end: string, length = 120) {
    const entries: Entry[] = [], summaries: DailySummary[] = [];
    const notes = ['朝はゆっくり。窓を開けて少し休む。', '昼食後に短い散歩。帰宅してひと息。', '頭が重いので横になって休憩。', '服薬の記録。午後の予定を確認。', '入浴を済ませて、早めに眠る準備。'];
    const tags = [['睡眠','食事'], ['外出'], ['頭の詰まり','横になる'], ['服薬'], ['入浴','睡眠']];
    const clamp = (n: number) => Math.max(1,Math.min(5,Math.round(n)));
    for(let i=0;i<length;i++) {
        const date = shiftDay(end,i-length+1), base = 3+1.45*Math.sin(i/6)+0.7*Math.cos(i/13);
        // 2〜56件。朝・昼・夕方・夜の塊と、長い空白を混ぜる。
        const count = [2, 7, 16, 31, 5, 48, 12, 24, 56, 9, 3, 38][(i * 7) % 12];
        const times = Array.from({length: count}, (_, j) => {
            const cluster = Math.floor(j * 4 / count);
            const minute = [6*60, 11*60, 16*60, 21*60][cluster] + (j % Math.ceil(count / 4)) * 7 + i % 17;
            return `${String(Math.floor(minute / 60)).padStart(2,'0')}:${String(minute % 60).padStart(2,'0')}`;
        });
        for(let j=0;j<times.length;j++) {
            const cluster = Math.floor(j * 4 / count);
            const kind = j === 3 && i % 3 === 0 ? 3 : (i + j) % 4;
            const selectedTags = kind === 3 && j === 3 && i % 3 === 0 ? ['服薬']
                : kind === 2 && base < 3 ? tags[2]
                : kind === 1 ? ['外出'] : kind === 0 ? (cluster === 0 ? ['睡眠','食事'] : ['食事'])
                : cluster === 3 ? ['入浴','睡眠'] : ['横になる'];
            const note = selectedTags.includes('服薬') ? '服薬の記録。少し休んで様子を見る。'
                : selectedTags.includes('頭の詰まり') ? notes[2]
                : selectedTags.includes('外出') ? '短い散歩。帰宅してひと息。'
                : selectedTags.includes('入浴') ? notes[4]
                : selectedTags.includes('睡眠') ? notes[0]
                : selectedTags.includes('食事') ? '少し食べてひと息。' : '横になって休憩。今の状態を記録。';
            const recordedAt = new Date(`${date}T${times[j]}:00+09:00`).toISOString();
            entries.push({id:`de000000-0000-4000-8000-${String(i*100+j).padStart(12,'0')}`,date,recordedAt,updatedAt:recordedAt,score:(i+j)%11===0?null:clamp(base+Math.sin(j/3)*0.7),note:(i+j)%4===0?'':note,tags:selectedTags,quantities:Object.fromEntries(selectedTags.map(t=>[t,t==='服薬' ? (i%9===0 ? 0.5 : i%2+1) : t==='外出' ? i%3+1 : 1]))});
        }
        if(i%19!==3 && i%13!==4) { const stamp = `${date}T14:30:00.000Z`; summaries.push({date,score:clamp(base),note:notes[i%notes.length],createdAt:stamp,updatedAt:stamp}); }
    }
    return {entries,summaries};
}

export async function seedDemo(db: D1Database, user: string, end: string) {
    if(!user.endsWith(':demo:v2')) throw new Error('試用データ専用です');
    const existing = await db.prepare('SELECT COUNT(*) AS count FROM entries WHERE user_id=?').bind(user).first<{count:number}>();
    if(existing?.count) return {created:false,count:existing.count};
    const data = demoData(end);
    // JSONをまとめて渡すことで数千件でも2クエリ。両方を同じトランザクションで確定する。
    await db.batch([
        db.prepare(`INSERT INTO entries (id,user_id,date,recorded_at,score,note,tags,quantities,updated_at)
          SELECT json_extract(value,'$.id'), ?, json_extract(value,'$.date'), json_extract(value,'$.recordedAt'),
          json_extract(value,'$.score'), json_extract(value,'$.note'), json_extract(value,'$.tags'),
          json_extract(value,'$.quantities'), json_extract(value,'$.updatedAt') FROM json_each(?) WHERE 1
          ON CONFLICT(user_id,id) DO NOTHING`).bind(user,JSON.stringify(data.entries)),
        db.prepare(`INSERT INTO daily_summaries (user_id,date,score,note,created_at,updated_at)
          SELECT ?, json_extract(value,'$.date'), json_extract(value,'$.score'), json_extract(value,'$.note'),
          json_extract(value,'$.createdAt'), json_extract(value,'$.updatedAt') FROM json_each(?) WHERE 1
          ON CONFLICT(user_id,date) DO NOTHING`).bind(user,JSON.stringify(data.summaries))
    ]);
    return {created:true,count:data.entries.length,summaries:data.summaries.length};
}
