import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {demoData,seedDemo} from '../lib/demo.ts';
import {readOverview,listEntries,createEntry} from '../lib/store.ts';
import {dailyStats,entrySchema,summarySchema} from '../lib/journal.ts';
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={prepare(query){let args=[];const stmt=sql.prepare(query);const wrapper={bind(...v){args=v;return wrapper;},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}};},async all(){return {results:stmt.all(...args)};},async first(){return stmt.get(...args)??null;}};return wrapper;},async batch(statements){return Promise.all(statements.map(s=>s.all()));}};
 return {db,sql};
}
test('120日の試用記録は5段階・欠測・日内変動・小数・月境界を含む',()=>{
 const data=demoData('2026-09-18');assert.deepEqual(data,demoData('2026-09-18'));
 assert.equal(data.entries.length,2510);
 const counts=Object.values(Object.groupBy(data.entries,e=>e.date)).map(es=>es.length);
 assert.equal(counts.length,120);assert.equal(Math.min(...counts),2);assert.equal(Math.max(...counts),56);
assert.ok(data.summaries.length>100);
 assert.equal(new Set(data.entries.map(e=>e.date.slice(0,7))).size,5);
 assert.deepEqual([...new Set(data.summaries.map(s=>s.score))].sort(),[1,2,3,4,5]);
 const days=dailyStats(data.entries);
 assert.ok(days.filter(d=>d.tags.includes('服薬')).length>3);assert.ok(days.filter(d=>!d.tags.includes('服薬')).length>3);
 assert.ok(data.entries.some(e=>e.score===null));assert.ok(data.entries.some(e=>Object.values(e.quantities).includes(.5)));
 for(const {date,updatedAt,...entry} of data.entries){assert.ok(date);assert.ok(updatedAt);assert.equal(entrySchema.safeParse(entry).success,true);}
 for(const {createdAt,updatedAt,...summary} of data.summaries){assert.ok(createdAt);assert.ok(updatedAt);assert.equal(summarySchema.safeParse(summary).success,true);}
});
test('実SQL: 試用データは実記録と分離、再投入で増殖せず、全ページと集計が一致',async()=>{
 const {db}=setup();const data=demoData('2026-09-18');
 await assert.rejects(seedDemo(db,'owner','2026-09-18'));
 await createEntry(db,'owner',{...data.entries[0],score:1});
 await seedDemo(db,'owner:demo:v2','2026-09-18');
 assert.equal((await seedDemo(db,'owner:demo:v2','2026-09-18')).created,false);
 const actual=await readOverview(db,'owner:demo:v2');const expected=dailyStats(data.entries);
 assert.equal(actual.summaries.length,data.summaries.length);
 for(const d of expected){const a=actual.days.find(x=>x.date===d.date);assert.equal(a.score,d.score);assert.equal(a.count,d.count);assert.equal(a.scoreCount,d.scoreCount);assert.deepEqual([...a.tags].sort(),[...d.tags].sort());}
 assert.equal((await readOverview(db,'owner')).days.length,1);assert.equal((await readOverview(db,'other:demo:v2')).days.length,0);
 const ids=[];let cursor=null;do{const page=await listEntries(db,'owner:demo:v2',new URLSearchParams(cursor?{cursor}:{}));ids.push(...page.entries.map(e=>e.id));cursor=page.nextCursor;}while(cursor);
 assert.equal(ids.length,data.entries.length);assert.equal(new Set(ids).size,ids.length);
});
test('実SQL: コメントのみは3として平均に含み、記録のない日を捏造しない',async()=>{
 const {db}=setup();const data=demoData('2026-09-18').entries;
 await createEntry(db,'owner',{...data[0],score:null,note:'コメントだけ',tags:[],quantities:{}});
 await createEntry(db,'owner',{...data[1],score:5});
 const result=await readOverview(db,'owner');assert.equal(result.days.length,1);assert.equal(result.days[0].score,4);assert.equal(result.days[0].scoreCount,2);
});

test('実SQL: 40件を超える日と月境界の日付フィルターでも重複・欠落しない',async()=>{
 const {db}=setup();const data=demoData('2026-09-18');await seedDemo(db,'owner:demo:v2','2026-09-18');
 const grouped=Object.groupBy(data.entries,e=>e.date);
 for(const date of Object.keys(grouped).filter(d=>grouped[d].length>40 || d.endsWith('-01') || d.endsWith('-31'))){
  let cursor=null;const rows=[];
  do{const p=new URLSearchParams({date});if(cursor)p.set('cursor',cursor);const page=await listEntries(db,'owner:demo:v2',p);rows.push(...page.entries);cursor=page.nextCursor;}while(cursor);
  assert.equal(rows.length,grouped[date].length);assert.equal(new Set(rows.map(e=>e.id)).size,rows.length);assert.ok(rows.every(e=>e.date===date));
 }
 assert.equal((await listEntries(db,'owner:demo:v2',new URLSearchParams({date:'2026-01-01'}))).entries.length,0);
});
