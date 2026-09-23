import test from 'node:test';
import assert from 'node:assert/strict';
import {eventTrajectory,conditionalPatterns,recovery,stability,sequencePatterns,similarDays,discoveryInbox,patternAnalysis} from '../lib/patterns.ts';
import {shiftDay,dailyStats} from '../lib/journal.ts';
import {demoData} from '../lib/demo.ts';
const sample=(date,h,score,tags=[],id='')=>({id:id||`${date}-${h}`,date,recordedAt:new Date(`${date}T00:00:00+09:00`).getTime()+h*3600000,score,tags});
const make=(...args)=>{const r=sample(...args);return {...r,recordedAt:new Date(r.recordedAt).toISOString()};};
const row=(date,score,tags=[])=>({date,score,tags});
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('前後: 一日最初のタグだけを起点にし、窓の外を補間しない',()=>{
 const rows=[make('2026-07-01',9,2,['A']),make('2026-07-01',9.1,1,['A']),make('2026-07-01',10,4),make('2026-07-01',14,5)];
 const r=eventTrajectory(rows,'A');assert.equal(r.events,1);assert.equal(r.points.find(p=>p.hours===1).actual.mean,4);assert.equal(r.points.find(p=>p.hours===3).actual.mean,null);assert.equal(r.points.find(p=>p.hours===-1).actual.count,0);assert.equal(r.points.find(p=>p.hours===24).actual.count,0);
});
test('前後: 同じ起点スコアと時間帯の対照、比較日を再利用しても水増ししない',()=>{
 const rows=[];for(let i=0;i<11;i++){const d=shiftDay('2026-06-01',i);rows.push(make(d,9,2,i<6?['A']:[]),make(d,10,i<6?4:3));}
 const p=eventTrajectory(rows,'A').points.find(p=>p.hours===1);assert.equal(p.matched,6);assert.equal(p.controls,5);close(p.difference,1);
 const wrong=rows.map(r=>r.tags.length?{...r,score:5}:r);assert.equal(eventTrajectory(wrong,'A').points.find(p=>p.hours===1).difference,null);
});
test('回復: 実際の区間を示し、長い空白と期間末を未確認にする',()=>{
 const r=recovery([make('2026-06-01',8,1),make('2026-06-01',10,2),make('2026-06-01',11,3),make('2026-06-02',8,2),make('2026-06-02',16,5),make('2026-06-03',20,1)]);
 assert.equal(r.confirmed,1);assert.equal(r.unresolved,2);assert.equal(r.episodes[0].lower,2);assert.equal(r.episodes[0].upper,3);assert.equal(r.episodes[1].upper,null);
});
test('安定度: 同じ平均でも幅が違い、同時刻・長時間間隔を急変に数えない',()=>{
 const r=stability([make('2026-06-01',8,3),make('2026-06-01',10,3),make('2026-06-02',8,1),make('2026-06-02',10,5),make('2026-06-03',8,1,[],'a'),make('2026-06-03',8,5,[],'b'),make('2026-06-03',16,3)]);
 assert.equal(r[0].average,r[1].average);assert.equal(r[0].sd,0);assert.equal(r[1].sd,2);assert.equal(r[1].step,4);assert.equal(r[2].pairs,0);
});
test('条件: 条件で絞るのは起点だけ。翌日が別の条件でも計算に残す',()=>{
 const rows=[];for(let i=0;i<12;i++){const d=shiftDay('2026-05-01',i*3);rows.push(row(d,2,i<6?['A']:[]),row(shiftDay(d,1),i<6?4:3));}
 const low=conditionalPatterns(rows,'A','2026-07-01')[0];assert.equal(low.enough,true);close(low.diff,1);assert.equal(low.withCount,6);
});
test('条件: 小数の平均でも低め・それ以外を漏れなく分ける',()=>{
 const rows=[];for(let i=0;i<12;i++){const d=shiftDay('2026-05-01',i*3);rows.push(row(d,2.4,i<6?['A']:[]),row(shiftDay(d,1),3));}
 const conditions=conditionalPatterns(rows,'A','2026-07-01');assert.equal(conditions[0].withCount,6);assert.equal(conditions[1].withCount,0);
});
test('順序: 同時刻は不明、前日の欠測は単発と扱わない',()=>{
 const samples=[make('2026-06-02',8,2,['A']),make('2026-06-02',9,3,['B']),make('2026-06-03',8,3,['A','B'])];
 const rows=[row('2026-06-02',2,['A','B']),row('2026-06-03',3,['A','B']),row('2026-06-04',4)];
 const r=sequencePatterns(samples,rows,'A','B');assert.equal(r.order.first.count,1);assert.equal(r.order.second.count,0);assert.equal(r.tied,1);assert.equal(r.consecutive.second.count,0);assert.equal(r.consecutive.first.count,1);
});
test('似た日: 対象日の数値を翌日の答えとして使わず、欠測も飛ばさない',()=>{
 const rows=[row('2026-06-01',3,['A']),row('2026-06-02',4),row('2026-06-04',3,['A']),row('2026-06-06',3,['A']),row('2026-06-07',3,['A'])];
 const r=similarDays(rows);assert.equal(r.anchor.date,'2026-06-07');assert.equal(r.matches.length,1);assert.equal(r.matches[0].date,'2026-06-01');assert.equal(r.matches[0].after,4);
});
test('発見: 前半の候補を固定し、後半で逆転しても良い候補へ入れ替えない',()=>{
 const rows=[];for(let i=0;i<120;i++){const phase=i%4;rows.push(row(shiftDay('2026-01-01',i),phase===1?4:3,phase===0?['A']:[]));}
 const original=discoveryInbox(rows,'2026-04-30');assert(original.candidates.length>0);
 const split=original.split;const modified=rows.map(r=>r.date>=split?{...r,score:3,tags:['B']}:r);
 const changed=discoveryInbox(modified,'2026-04-30');assert.deepEqual(changed.candidates.map(c=>[c.tag,c.lag]),original.candidates.map(c=>[c.tag,c.lag]));assert(changed.candidates.every(c=>c.status==='pending'));
 for(const c of original.candidates){assert(c.train.dates.every(d=>shiftDay(d,c.lag)<split));assert(c.confirmation.dates.every(d=>d>=split));}
});
test('発見: 常に同時に付いたタグは別々の発見として数えない',()=>{
 const rows=[];for(let i=0;i<120;i++){const phase=i%4;rows.push(row(shiftDay('2026-01-01',i),phase===1?4:3,phase===0?['A','B']:[]));}
 const inbox=discoveryInbox(rows,'2026-04-30');assert.equal(inbox.candidates.length,1);
});
test('空・未選択・期間境界: NaNや空想の観測を返さない',()=>{
 const overview={days:[],summaries:[],tags:[]};const empty=patternAnalysis(overview,[],'2026-06-01','2026-06-30','moment','','');assert.equal(empty.similar.anchor,null);assert.equal(empty.recovery.episodes.length,0);assert.equal(empty.trajectory.events,0);assert(!JSON.stringify(empty).includes('NaN'));
 const r=patternAnalysis(overview,[make('2026-05-31',9,5,['A']),make('2026-06-01',9,null,['A'])],'2026-06-01','2026-06-30','moment','A','');assert.equal(r.trajectory.events,1);assert.equal(r.trajectory.points.find(p=>p.hours===0).actual.mean,3);
});
test('120日ダミー: 全分析が実行でき、日数が入力の日数を超えない',()=>{
 const demo=demoData('2026-09-20'),overview={days:dailyStats(demo.entries),summaries:demo.summaries,tags:[]};
 const result=patternAnalysis(overview,demo.entries,'2026-06-01','2026-09-20','moment','服薬','外出');
 assert(result.trajectory.events>0);assert(result.stability.length>100);assert(result.recovery.episodes.length>0);assert(result.similar.matches.length>0);assert(result.inbox.tested>0);for(const p of result.trajectory.points)assert(p.actual.count<=result.trajectory.events);
});
