import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTags, observations, sameDay, laggedAssociation, tagPairs, distribution } from '../lib/insights.ts';
import { shiftDay, dailyStats } from '../lib/journal.ts';
import { demoData } from '../lib/demo.ts';
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const row = (date, score, tags=[]) => ({date, score, tags});

test('欠測: 投稿のない日はタグなしにせず、総括と投稿平均を混ぜない', () => {
 const overview={days:[{date:'2026-08-01',score:3,tags:['休憩']},{date:'2026-08-03',score:5,tags:[]}],summaries:[{date:'2026-08-02',score:1},{date:'2026-08-03',score:2}]};
 const rows=observations(overview,'2026-08-01','2026-08-31','summary');
 assert.deepEqual(rows,[row('2026-08-01',null,['休憩']),row('2026-08-03',2)]);
 assert.equal(observations(overview,'2026-08-01','2026-08-31','moment')[0].score,3);
 assert.equal(sameDay(rows,'休憩').withTag.count,0);
});

test('時間差: 指定した暦日だけを比較し、未来・終端・欠測を補完しない', () => {
 const rows=[row('2026-08-01',2,['休憩']),row('2026-08-04',2,['休憩']),row('2026-08-06',null,['休憩'])];
 const scores=new Map([['2026-08-02',4],['2026-08-07',5]]);
 const result=laggedAssociation(rows,scores,'休憩',1,'2026-08-06');
 assert.equal(result.eligible,1);assert.equal(result.missing,2);assert.equal(result.unmatched,1);assert.equal(result.enough,false);assert.equal(result.diff,null);
 const two=laggedAssociation(rows,scores,'休憩',2,'2026-08-06');assert.equal(two.eligible,0);
});

test('層別比較: 低い体調の日に使うタグを、起点の違いだけで不利にしない', () => {
 const rows=[],scores=new Map();
 // タグありは起点1が8日、起点4が2日。対照は起点1が2日、起点4が8日。
 for(let i=0;i<20;i++) { const date=shiftDay('2026-01-01',i*3),exposed=i<10,base=exposed?(i<8?1:4):(i<12?1:4);rows.push(row(date,base,exposed?['休憩']:[]));scores.set(shiftDay(date,1),base+(base===1?1:0)); }
 const r=laggedAssociation(rows,scores,'休憩',1,'2026-04-01');
 assert.equal(r.enough,true);assert.equal(r.withCount,10);assert.equal(r.withoutCount,10);close(r.actual.mean,.8);close(r.comparison,.8);close(r.diff,0);
});

test('時間差: 手計算と一致し、同じ比較日を重み付けしても日数は水増ししない', () => {
 const rows=[],scores=new Map();
 for(let i=0;i<11;i++){const date=shiftDay('2026-01-01',i*3);rows.push(row(date,3,i<6?['散歩']:[]));scores.set(shiftDay(date,1),i<6?4:2);}
 const r=laggedAssociation(rows,scores,'散歩',1,'2026-04-01');assert.equal(r.withCount,6);assert.equal(r.withoutCount,5);close(r.diff,2);assert.equal(r.actual.improved,6);close(r.after.mean,4);
 const noMatch=laggedAssociation([...rows,row('2026-03-01',5,['散歩'])],new Map([...scores,['2026-03-02',5]]),'散歩',1,'2026-04-01');assert.equal(noMatch.unmatched,1);assert.equal(noMatch.withCount,6);
});

test('タグ相関: 完全共起・排他・独立・定数を区別する', () => {
 const rows=Array.from({length:20},(_,i)=>row(String(i),3,[...(i<10?['A','B']:['C']),...(i%2===0?['D']:[]),'常時']));
 const pairs=tagPairs(rows,'A');close(pairs.find(p=>p.tag==='B').phi,1);close(pairs.find(p=>p.tag==='C').phi,-1);close(pairs.find(p=>p.tag==='D').phi,0);assert.equal(pairs.find(p=>p.tag==='常時').phi,null);assert.equal(pairs.find(p=>p.tag==='常時').enough,false);
 assert.deepEqual(pairs.find(p=>p.tag==='D').counts,[5,5,5,5]);
});

test('日単位: 投稿の多い日を重くせず、タグ重複も数え直さない', () => {
 const entries=[...Array.from({length:50},()=>({date:'2026-08-01',score:5,tags:['A','A']})),{date:'2026-08-02',score:1,tags:['A']},{date:'2026-08-03',score:null,tags:[]}];
 const a=analyzeTags({days:dailyStats(entries),summaries:[],tags:['A']},'2026-08-01','2026-08-03','moment');assert.equal(a.tags[0].count,2);close(a.tags[0].same.withTag.mean,3);assert.equal(a.rows[2].score,3);
});

test('ばらつきは観測分布の四分位点。空・単独データでNaNを出さない',()=>{
 const d=distribution([-2,0,1,3]);close(d.low,-.5);close(d.high,1.5);assert.equal(distribution([]).mean,null);assert.equal(distribution([2]).low,2);
});

test('120日分データ: 期間外を使わず、総括の欠測を除外し、試用タグを比較できる',()=>{
 const data=demoData('2026-09-20'), overview={days:dailyStats(data.entries),summaries:data.summaries,tags:[]};
 for(const source of ['moment','summary']) { const a=analyzeTags(overview,'2026-06-23','2026-09-20',source);assert.equal(a.rows.length,90);assert(a.tags.some(t=>t.lags.some(l=>l.enough)));for(const t of a.tags)for(const l of t.lags){assert(l.withCount<=t.count);assert(l.dates.every(d=>d>='2026-06-23'&&shiftDay(d,l.lag)<='2026-09-20'));}}
 assert.deepEqual(analyzeTags({days:[],summaries:[],tags:[]},'0000','2026-09-20','moment').tags,[]);
});
